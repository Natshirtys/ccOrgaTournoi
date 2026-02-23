import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../context.js';
import { validateBody } from '../middleware/validation.js';
import { ApiError } from '../middleware/error-handler.js';
import { Score, ResultatMatch, GoalAverage } from '../../domain/shared/value-objects.js';
import { TypeResultat, CritereClassement } from '../../domain/shared/enums.js';
import { Match } from '../../domain/concours/entities/match.js';
import { Classement, LigneClassement } from '../../domain/concours/entities/classement.js';
import { PointsRankingStrategy } from '../../engine/strategies/ranking/points-ranking-strategy.js';
import { RankingEntry, MatchResultEntry } from '../../engine/strategies/interfaces.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const saisirScoreSchema = z.object({
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
});

const declarerForfaitSchema = z.object({
  equipeId: z.string().min(1),
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

// ─── Router ─────────────────────────────────────────────────────────────────

export function createMatchsRouter(ctx: AppContext): Router {
  const router = Router();

  // GET /:id/matchs — Lister les matchs d'un concours
  router.get('/:id/matchs', asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    const matchs: Array<Record<string, unknown>> = [];
    for (const phase of concours.phases) {
      for (const tour of phase.tours) {
        for (const match of tour.matchs) {
          matchs.push({
            id: match.id,
            phaseId: phase.id,
            tourId: tour.id,
            tourNumero: tour.numero,
            equipeAId: match.equipeAId,
            equipeBId: match.equipeBId,
            statut: match.statut,
            score: match.score ? { pointsA: match.score.pointsA, pointsB: match.score.pointsB } : null,
            resultat: match.resultat ? {
              vainqueur: match.resultat.vainqueur,
              type: match.resultat.type,
            } : null,
            terrainId: match.terrainId,
          });
        }
      }
    }

    res.json({ data: matchs });
  }));

  // POST /:id/matchs/:matchId/demarrer — Démarrer un match
  router.post('/:id/matchs/:matchId/demarrer', asyncHandler(async (req, res) => {
    const { concours, match } = await findMatch(ctx, param(req.params.id), param(req.params.matchId));

    match.demarrer();
    await ctx.concoursRepository.save(concours);

    res.json({ matchId: match.id, statut: match.statut });
  }));

  // POST /:id/matchs/:matchId/score — Saisir le score et valider
  router.post('/:id/matchs/:matchId/score', validateBody(saisirScoreSchema), asyncHandler(async (req, res) => {
    const { concours, match } = await findMatch(ctx, param(req.params.id), param(req.params.matchId));
    const { scoreA, scoreB } = req.body;

    const score = new Score(scoreA, scoreB);
    match.saisirScore(score);

    // Déterminer le résultat
    const reglement = concours.reglement;
    let resultat: ResultatMatch;

    if (scoreA === scoreB && reglement.nulAutorise) {
      resultat = ResultatMatch.nul(score, reglement.pointsNul);
    } else {
      const vainqueurId = scoreA > scoreB ? match.equipeAId : match.equipeBId!;
      const pointsV = reglement.pointsVictoire;
      const pointsD = reglement.pointsDefaite;
      resultat = new ResultatMatch(
        vainqueurId,
        TypeResultat.VICTOIRE,
        score,
        vainqueurId === match.equipeAId ? pointsV : pointsD,
        vainqueurId === match.equipeAId ? pointsD : pointsV,
      );
    }

    match.validerResultat(resultat);
    await ctx.concoursRepository.save(concours);

    res.json({
      matchId: match.id,
      statut: match.statut,
      score: { pointsA: scoreA, pointsB: scoreB },
      vainqueur: resultat.vainqueur,
    });
  }));

  // POST /:id/matchs/:matchId/forfait — Déclarer forfait
  router.post('/:id/matchs/:matchId/forfait', validateBody(declarerForfaitSchema), asyncHandler(async (req, res) => {
    const { concours, match } = await findMatch(ctx, param(req.params.id), param(req.params.matchId));

    match.declarerForfait(req.body.equipeId);

    const vainqueurId = req.body.equipeId === match.equipeAId ? match.equipeBId! : match.equipeAId;
    await ctx.concoursRepository.save(concours);

    res.json({
      matchId: match.id,
      statut: match.statut,
      forfaitEquipe: req.body.equipeId,
      vainqueur: vainqueurId,
    });
  }));

  // GET /:id/classement — Calculer et obtenir le classement
  router.get('/:id/classement', asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    if (concours.phases.length === 0) {
      throw ApiError.badRequest('Aucune phase n\'existe encore');
    }

    const phase = concours.phases[concours.phases.length - 1];
    const reglement = concours.reglement;

    // Collecter tous les résultats de matchs
    const allResults: MatchResultEntry[] = [];
    const equipeIds = new Set<string>();

    for (const tour of phase.tours) {
      for (const match of tour.matchs) {
        if (match.isBye) continue;
        equipeIds.add(match.equipeAId);
        if (match.equipeBId) equipeIds.add(match.equipeBId);

        if (match.resultat) {
          allResults.push({
            matchId: match.id,
            equipeAId: match.equipeAId,
            equipeBId: match.equipeBId,
            scoreA: match.score?.pointsA ?? 0,
            scoreB: match.score?.pointsB ?? 0,
            vainqueurId: match.resultat.vainqueur,
          });
        }
      }
    }

    // Construire les entrées de classement
    const entries: RankingEntry[] = Array.from(equipeIds).map((eqId) => {
      const matchesForEquipe = allResults.filter(
        (r) => r.equipeAId === eqId || r.equipeBId === eqId,
      );

      let points = 0, victoires = 0, defaites = 0, nuls = 0, ptsMar = 0, ptsEnc = 0;

      for (const r of matchesForEquipe) {
        const isA = r.equipeAId === eqId;
        ptsMar += isA ? r.scoreA : r.scoreB;
        ptsEnc += isA ? r.scoreB : r.scoreA;

        if (r.vainqueurId === eqId) {
          victoires++;
          points += reglement.pointsVictoire;
        } else if (r.vainqueurId === null) {
          nuls++;
          points += reglement.pointsNul;
        } else {
          defaites++;
          points += reglement.pointsDefaite;
        }
      }

      return {
        equipeId: eqId,
        matchesJoues: matchesForEquipe.length,
        victoires,
        nuls,
        defaites,
        pointsMarques: ptsMar,
        pointsEncaisses: ptsEnc,
        points,
      };
    });

    // Calculer le classement
    const qualifiesCount = phase.config.qualificationRule?.nombre ?? 0;
    const rankingStrategy = new PointsRankingStrategy(qualifiesCount);
    const ranked = rankingStrategy.calculate(entries);

    // Sauvegarder le classement dans la phase
    const lignes: LigneClassement[] = ranked.map((r) => ({
      equipeId: r.equipeId,
      rang: r.rang,
      points: r.points,
      matchsJoues: r.matchesJoues,
      matchsGagnes: r.victoires,
      matchsPerdus: r.defaites,
      matchsNuls: r.nuls,
      pointsMarques: r.pointsMarques,
      pointsEncaisses: r.pointsEncaisses,
      goalAverage: new GoalAverage(r.pointsMarques, r.pointsEncaisses),
      qualifiee: r.qualifiee,
    }));

    const classement = new Classement(phase.id, lignes, [
      CritereClassement.POINTS,
      CritereClassement.GOAL_AVERAGE_GENERAL,
    ]);
    phase.mettreAJourClassement(classement);
    await ctx.concoursRepository.save(concours);

    res.json({
      phaseId: phase.id,
      classement: lignes.map((l) => ({
        rang: l.rang,
        equipeId: l.equipeId,
        points: l.points,
        matchsJoues: l.matchsJoues,
        victoires: l.matchsGagnes,
        defaites: l.matchsPerdus,
        nuls: l.matchsNuls,
        pointsMarques: l.pointsMarques,
        pointsEncaisses: l.pointsEncaisses,
        goalAverage: l.goalAverage.difference,
        qualifiee: l.qualifiee,
      })),
    });
  }));

  return router;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findMatch(ctx: AppContext, concoursId: string, matchId: string) {
  const concours = await ctx.concoursRepository.findById(concoursId);
  if (!concours) throw ApiError.notFound('Concours non trouvé');

  let match: Match | undefined;
  for (const phase of concours.phases) {
    for (const tour of phase.tours) {
      match = tour.trouverMatch(matchId) as Match | undefined;
      if (match) break;
    }
    if (match) break;
  }

  if (!match) throw ApiError.notFound('Match non trouvé');

  return { concours, match };
}
