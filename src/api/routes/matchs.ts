import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../context.js';
import { validateBody } from '../middleware/validation.js';
import { ApiError } from '../middleware/error-handler.js';
import { Score, ResultatMatch, GoalAverage, PhaseDefinition } from '../../domain/shared/value-objects.js';
import { TypeResultat, CritereClassement, TypePhase, StatutPhase } from '../../domain/shared/enums.js';
import { Match } from '../../domain/concours/entities/match.js';
import { Tour } from '../../domain/concours/entities/tour.js';
import { Phase } from '../../domain/concours/entities/phase.js';
import { Classement, LigneClassement } from '../../domain/concours/entities/classement.js';
import { PointsRankingStrategy } from '../../engine/strategies/ranking/points-ranking-strategy.js';
import { RankingEntry, MatchResultEntry, TourGeneration } from '../../engine/strategies/interfaces.js';
import { PoolPhaseStrategy, buildKoCrossMatchups } from '../../engine/strategies/phase/pool-phase-strategy.js';
import { RoundRobinPoolStrategy, buildSymmetricKoMatchups } from '../../engine/strategies/phase/round-robin-pool-strategy.js';
import { SingleEliminationStrategy } from '../../engine/strategies/phase/single-elimination-strategy.js';
import { ComplementaireStrategy } from '../../engine/strategies/phase/complementaire-strategy.js';
import { SwissSystemStrategy } from '../../engine/strategies/phase/swiss-system-strategy.js';
import { assignerTerrainsAuTour, assignerTerrainsToursNonAssignes } from '../helpers/terrain-assignment.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const saisirScoreSchema = z.object({
  scoreEquipeA: z.number().int().min(0),
  scoreEquipeB: z.number().int().min(0),
});

const declarerForfaitSchema = z.object({
  equipeDeclarantForfaitId: z.string().min(1),
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
            phaseType: phase.type,
            phaseNom: phase.nom,
            tourId: tour.id,
            tourNumero: tour.numero,
            tourNom: tour.nom,
            equipeAId: match.equipeAId,
            equipeBId: match.equipeBId,
            statut: match.statut,
            score: match.score ? { equipeA: match.score.pointsA, equipeB: match.score.pointsB } : null,
            resultat: match.resultat ? match.resultat.type : null,
            terrainId: match.terrainId,
            terrainNumero: match.terrainId
              ? concours.terrains.find((t) => t.id === match.terrainId)?.numero ?? null
              : null,
            terrainNom: match.terrainId
              ? concours.terrains.find((t) => t.id === match.terrainId)?.nom ?? null
              : null,
            canEditScore: match.statut === 'TERMINE' && !phase.tours.some(
              (t) => t.numero > tour.numero && t.matchs.some((m) => m.statut !== 'PROGRAMME'),
            ),
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
    const { concours, phase, tour, match } = await findMatchWithContext(ctx, param(req.params.id), param(req.params.matchId));
    const { scoreEquipeA, scoreEquipeB } = req.body;

    const score = new Score(scoreEquipeA, scoreEquipeB);
    match.saisirScore(score);

    // Déterminer le résultat
    const reglement = concours.reglement;
    let resultat: ResultatMatch;

    if (scoreEquipeA === scoreEquipeB && reglement.nulAutorise) {
      resultat = ResultatMatch.nul(score, reglement.pointsNul);
    } else {
      const vainqueurId = scoreEquipeA > scoreEquipeB ? match.equipeAId : match.equipeBId!;
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

    // Libérer le terrain
    if (match.terrainId) {
      const terrain = concours.terrains.find((t) => t.id === match.terrainId);
      if (terrain) terrain.liberer();
    }

    // Assigner les terrains aux tours suivants si le tour courant est maintenant complet
    assignerTerrainsToursNonAssignes(concours, tour, phase.tours);

    await ctx.concoursRepository.save(concours);

    res.json({
      matchId: match.id,
      statut: match.statut,
      score: { pointsA: scoreEquipeA, pointsB: scoreEquipeB },
      vainqueur: resultat.vainqueur,
    });
  }));

  // POST /:id/matchs/:matchId/forfait — Déclarer forfait
  router.post('/:id/matchs/:matchId/forfait', validateBody(declarerForfaitSchema), asyncHandler(async (req, res) => {
    const { concours, phase, tour, match } = await findMatchWithContext(ctx, param(req.params.id), param(req.params.matchId));

    match.declarerForfait(req.body.equipeDeclarantForfaitId);

    // Libérer le terrain
    if (match.terrainId) {
      const terrain = concours.terrains.find((t) => t.id === match.terrainId);
      if (terrain) terrain.liberer();
    }

    // Assigner les terrains aux tours suivants si le tour courant est maintenant complet
    assignerTerrainsToursNonAssignes(concours, tour, phase.tours);

    const vainqueurId = req.body.equipeDeclarantForfaitId === match.equipeAId ? match.equipeBId! : match.equipeAId;
    await ctx.concoursRepository.save(concours);

    res.json({
      matchId: match.id,
      statut: match.statut,
      forfaitEquipe: req.body.equipeDeclarantForfaitId,
      vainqueur: vainqueurId,
    });
  }));

  // POST /:id/matchs/:matchId/terrain — Réassigner un terrain manuellement
  router.post('/:id/matchs/:matchId/terrain', validateBody(z.object({ terrainId: z.string().min(1) })), asyncHandler(async (req, res) => {
    const { concours, match } = await findMatch(ctx, param(req.params.id), param(req.params.matchId));
    const { terrainId } = req.body;

    // Vérifier que le terrain existe
    const terrain = concours.terrains.find((t) => t.id === terrainId);
    if (!terrain) throw ApiError.notFound('Terrain non trouvé');

    // Vérifier que le terrain n'est pas utilisé par un match EN_COURS
    // (l'échange avec un match PROGRAMME est autorisé)
    let autreMatchAvecCeTerrain: Match | undefined;
    for (const phase of concours.phases) {
      for (const tour of phase.tours) {
        for (const m of tour.matchs) {
          if (m.id !== match.id && m.terrainId === terrainId && !m.isBye) {
            if (m.statut === 'EN_COURS') {
              throw ApiError.badRequest('Ce terrain est utilisé par un match en cours');
            }
            // Terrain d'un match terminé = libre, pas de swap à faire
            if (!m.isTermine) {
              autreMatchAvecCeTerrain = m as Match;
            }
          }
        }
      }
    }

    const oldTerrainId = match.terrainId;

    // Libérer l'ancien terrain si le match courant était EN_COURS
    if (oldTerrainId && match.statut === 'EN_COURS') {
      const ancienTerrain = concours.terrains.find((t) => t.id === oldTerrainId);
      if (ancienTerrain) ancienTerrain.liberer();
    }

    // Swap : si l'autre match PROGRAMME avait ce terrain, lui donner notre ancien terrain
    if (autreMatchAvecCeTerrain && oldTerrainId) {
      autreMatchAvecCeTerrain.assignerTerrain(oldTerrainId);
    }

    // Assigner le nouveau terrain à ce match
    match.assignerTerrain(terrainId);

    // Si le match est en cours, marquer le terrain comme occupé
    if (match.statut === 'EN_COURS') {
      terrain.occuper();
    }

    await ctx.concoursRepository.save(concours);

    res.json({ matchId: match.id, terrainId, terrainNumero: terrain.numero, terrainNom: terrain.nom });
  }));

  // POST /:id/matchs/:matchId/corriger-score — Corriger le score d'un match terminé
  router.post('/:id/matchs/:matchId/corriger-score', validateBody(saisirScoreSchema), asyncHandler(async (req, res) => {
    const { concours, phase, tour, match } = await findMatchWithContext(ctx, param(req.params.id), param(req.params.matchId));
    const { scoreEquipeA, scoreEquipeB } = req.body;

    if (match.statut !== 'TERMINE') {
      throw ApiError.badRequest('Seul un match terminé peut être corrigé');
    }

    const tourSuivantDemarre = phase.tours.some(
      (t) => t.numero > tour.numero && t.matchs.some((m) => m.statut !== 'PROGRAMME'),
    );
    if (tourSuivantDemarre) {
      throw ApiError.badRequest('Impossible de corriger : le tour suivant a déjà commencé');
    }

    match.demanderCorrection();

    const nouveauScore = new Score(scoreEquipeA, scoreEquipeB);
    const reglement = concours.reglement;
    let resultat: ResultatMatch;

    if (scoreEquipeA === scoreEquipeB && reglement.nulAutorise) {
      resultat = ResultatMatch.nul(nouveauScore, reglement.pointsNul);
    } else {
      const vainqueurId = scoreEquipeA > scoreEquipeB ? match.equipeAId : match.equipeBId!;
      const pointsV = reglement.pointsVictoire;
      const pointsD = reglement.pointsDefaite;
      resultat = new ResultatMatch(
        vainqueurId,
        TypeResultat.VICTOIRE,
        nouveauScore,
        vainqueurId === match.equipeAId ? pointsV : pointsD,
        vainqueurId === match.equipeAId ? pointsD : pointsV,
      );
    }

    match.corrigerScore(nouveauScore, resultat);
    await ctx.concoursRepository.save(concours);

    res.json({ matchId: match.id, statut: match.statut, score: { pointsA: scoreEquipeA, pointsB: scoreEquipeB } });
  }));

  // POST /:id/generer-tour-suivant — Générer le tour / phase suivant(e)
  router.post('/:id/generer-tour-suivant', asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    if (concours.phases.length === 0) {
      throw ApiError.badRequest('Aucune phase n\'existe encore');
    }

    // Trouver la phase en cours (optionnellement ciblée par phaseId)
    const requestedPhaseId = req.body?.phaseId;
    let phase = requestedPhaseId
      ? concours.phases.find((p) => p.id === requestedPhaseId && p.statut === StatutPhase.EN_COURS)
      : concours.phases.find((p) => p.statut === StatutPhase.EN_COURS);
    if (!phase) throw ApiError.badRequest('Aucune phase en cours');

    const dernierTour = phase.dernierTour;
    if (!dernierTour) throw ApiError.badRequest('Aucun tour dans la phase en cours');

    // Vérifier que tous les matchs du dernier tour sont terminés
    if (!dernierTour.tousMatchsTermines) {
      throw ApiError.badRequest('Tous les matchs du tour en cours doivent être terminés');
    }

    // Terminer le tour si pas encore fait
    if (dernierTour.statut !== 'TERMINE') {
      dernierTour.demarrer();
      dernierTour.terminer();
    }

    // Collecter tous les résultats de la phase
    const phaseResults = collectPhaseResults(phase);

    // Récupérer les équipes de la phase
    const phaseEquipeIds = collectPhaseEquipeIds(phase);

    const phaseType = phase.type;
    let newTourGen: { numero: number; matchups: { equipeAId: string; equipeBId: string | null }[]; nom?: string } | null = null;

    if (phaseType === TypePhase.POULES) {
      const nbPoules = phase.config.constraints?.nbPoules ?? Math.floor(phaseEquipeIds.length / 4);

      // Reconstruire les poules depuis les matchs du Tour 1
      // Chaque poule de 4 a 2 matchs au Tour 1 (A-B, C-D)
      const tour1 = phase.tours[0];
      const pouleAssignments: import('../../engine/strategies/interfaces.js').DrawAssignment[] = [];
      if (tour1) {
        const matchsPerPoule = 2; // 4 équipes → 2 matchs
        let pouleIdx = 0;
        let posInPoule = 0;
        for (const match of tour1.matchs) {
          pouleAssignments.push({ equipeId: match.equipeAId, position: posInPoule * 2, pouleIndex: pouleIdx });
          if (match.equipeBId) {
            pouleAssignments.push({ equipeId: match.equipeBId, position: posInPoule * 2 + 1, pouleIndex: pouleIdx });
          }
          posInPoule++;
          if (posInPoule >= matchsPerPoule) {
            posInPoule = 0;
            pouleIdx++;
          }
        }
      }

      const poolStrategy = new PoolPhaseStrategy(pouleAssignments.length > 0 ? pouleAssignments : undefined);
      const poolContext = {
        phaseId: phase.id,
        equipeIds: phaseEquipeIds,
        matchResults: phaseResults,
        config: { nbPoules },
      };

      // Vérifier si la phase de poules est complète (5 matchs par poule)
      const phaseComplete = poolStrategy.isPhaseComplete(poolContext);

      if (!phaseComplete) {
        // Générer tour 2 ou 3 dans les poules
        newTourGen = poolStrategy.generateNextTour(poolContext, dernierTour.numero);
      } else {
        // Poules terminées → créer phase KO avec les qualifiés et croisement
        const qualifies = poolStrategy.getQualifies(poolContext);

        if (qualifies.length < 2) {
          throw ApiError.badRequest('Pas assez de qualifiés pour créer la phase éliminatoire');
        }

        // Terminer la phase de poules
        phase.terminer();

        // Créer nouvelle phase ELIMINATION_SIMPLE
        const newPhaseId = `phase-${concours.phases.length + 1}`;
        const phaseDef = new PhaseDefinition(
          TypePhase.ELIMINATION_SIMPLE,
          'integral',
          [CritereClassement.POINTS],
          [],
          null,
        );
        const newPhase = new Phase(newPhaseId, concours.id, TypePhase.ELIMINATION_SIMPLE, concours.phases.length + 1, phaseDef);
        concours.ajouterPhase(newPhase);
        newPhase.demarrer();

        // Croisement KO classique (1er A vs 2e D, etc.)
        const crossMatchups = buildKoCrossMatchups(qualifies);

        // Générer uniquement le premier tour avec les croisements
        const roundName = crossMatchups.length === 1 ? 'Finale' :
          crossMatchups.length === 2 ? 'Demi-finales' : 'Quarts de finale';
        const elimTours: TourGeneration[] = [{ numero: 1, matchups: crossMatchups, nom: roundName }];

        for (const tourGen of elimTours) {
          const tourId = `${newPhaseId}-tour-${tourGen.numero}`;
          const tour = new Tour(tourId, newPhaseId, tourGen.numero, undefined, [], tourGen.nom);
          for (let i = 0; i < tourGen.matchups.length; i++) {
            const mu = tourGen.matchups[i];
            const matchId = `${tourId}-match-${i + 1}`;
            const match = new Match(matchId, tourId, mu.equipeAId, mu.equipeBId);
            tour.ajouterMatch(match);
          }
          newPhase.ajouterTour(tour);
          assignerTerrainsAuTour(concours, tour);
        }

        await ctx.concoursRepository.save(concours);
        res.status(201).json({
          message: 'Phase éliminatoire créée avec croisement des poules',
          phaseId: newPhaseId,
          phaseType: TypePhase.ELIMINATION_SIMPLE,
          qualifies: qualifies.map((q) => ({ equipeId: q.equipeId, poule: q.pouleIndex, rang: q.rang })),
          tours: elimTours.map((t) => ({
            numero: t.numero,
            nom: t.nom,
            matchups: t.matchups.map((m) => ({ equipeA: m.equipeAId, equipeB: m.equipeBId })),
          })),
        });
        return;
      }
    } else if (phaseType === TypePhase.ELIMINATION_SIMPLE) {
      const elimStrategy = new SingleEliminationStrategy();
      const elimContext = {
        phaseId: phase.id,
        equipeIds: phaseEquipeIds,
        matchResults: phaseResults,
        config: {},
      };

      // Après le tour 1 : créer la phase CONSOLANTE avec les perdants
      if (dernierTour.numero === 1) {
        const losers = elimStrategy.getFirstRoundLosers(elimContext);
        if (losers.length >= 2) {
          const consolPhaseId = `phase-${concours.phases.length + 1}`;
          const consolDef = new PhaseDefinition(
            TypePhase.CONSOLANTE,
            'integral',
            [CritereClassement.POINTS],
            [],
            null,
          );
          const consolPhase = new Phase(consolPhaseId, concours.id, TypePhase.CONSOLANTE, concours.phases.length + 1, consolDef);
          concours.ajouterPhase(consolPhase);
          consolPhase.demarrer();

          const consolStrategy = new ComplementaireStrategy();
          const consolTours = consolStrategy.generateTours({
            phaseId: consolPhaseId,
            equipeIds: losers,
            matchResults: [],
            config: {},
          });

          for (const tourGen of consolTours) {
            const tourId = `${consolPhaseId}-tour-${tourGen.numero}`;
            const tour = new Tour(tourId, consolPhaseId, tourGen.numero, undefined, [], tourGen.nom);
            for (let i = 0; i < tourGen.matchups.length; i++) {
              const mu = tourGen.matchups[i];
              const matchId = `${tourId}-match-${i + 1}`;
              const match = new Match(matchId, tourId, mu.equipeAId, mu.equipeBId);
              tour.ajouterMatch(match);
            }
            consolPhase.ajouterTour(tour);
            assignerTerrainsAuTour(concours, tour);
          }
        }
      }

      // Générer le tour suivant du bracket principal
      newTourGen = elimStrategy.generateNextTour(elimContext, dernierTour.numero);

      if (!newTourGen) {
        // Phase terminée
        phase.terminer();
        await ctx.concoursRepository.save(concours);
        res.json({ message: 'Phase d\'élimination terminée' });
        return;
      }
    } else if (phaseType === TypePhase.CONSOLANTE) {
      const consolStrategy = new ComplementaireStrategy();
      const consolContext = {
        phaseId: phase.id,
        equipeIds: phaseEquipeIds,
        matchResults: phaseResults,
        config: {},
      };

      newTourGen = consolStrategy.generateNextTour(consolContext, dernierTour.numero);

      if (!newTourGen) {
        phase.terminer();
        await ctx.concoursRepository.save(concours);
        res.json({ message: 'Phase consolante terminée' });
        return;
      }
    } else if (phaseType === TypePhase.SYSTEME_SUISSE) {
      const swissStrategy = new SwissSystemStrategy();
      const swissContext = {
        phaseId: phase.id,
        equipeIds: phaseEquipeIds,
        matchResults: phaseResults,
        config: { nbTours: phase.config.constraints?.nbPoules }, // nbTours from config
      };

      newTourGen = swissStrategy.generateNextTour(swissContext, dernierTour.numero);

      if (!newTourGen) {
        phase.terminer();
        await ctx.concoursRepository.save(concours);
        res.json({ message: 'Système suisse terminé' });
        return;
      }
    } else if (phaseType === TypePhase.CHAMPIONNAT) {
      const nbPoules = phase.config.constraints?.nbPoules ?? Math.floor(phaseEquipeIds.length / 4);

      // Reconstruire les poules depuis les matchs du Tour 1 (même logique que POULES)
      const tour1Champ = phase.tours[0];
      const champAssignments: import('../../engine/strategies/interfaces.js').DrawAssignment[] = [];
      if (tour1Champ) {
        const matchsPerPoule = 2;
        let pouleIdx = 0;
        let posInPoule = 0;
        for (const match of tour1Champ.matchs) {
          champAssignments.push({ equipeId: match.equipeAId, position: posInPoule * 2, pouleIndex: pouleIdx });
          if (match.equipeBId) {
            champAssignments.push({ equipeId: match.equipeBId, position: posInPoule * 2 + 1, pouleIndex: pouleIdx });
          }
          posInPoule++;
          if (posInPoule >= matchsPerPoule) {
            posInPoule = 0;
            pouleIdx++;
          }
        }
      }

      const champStrategy = new RoundRobinPoolStrategy(champAssignments.length > 0 ? champAssignments : undefined);
      const champContext = {
        phaseId: phase.id,
        equipeIds: phaseEquipeIds,
        matchResults: phaseResults,
        config: { nbPoules },
      };

      if (!champStrategy.isPhaseComplete(champContext)) {
        throw ApiError.badRequest('Tous les matchs de la phase de poules doivent être terminés');
      }

      const qualifies = champStrategy.getQualifies(champContext);

      // Terminer la phase de poules CHAMPIONNAT
      phase.terminer();

      // Créer 3 phases ELIMINATION_SIMPLE : Championnat A (1ers), B (2es), C (3es)
      const labels = ['A', 'B', 'C'];
      const createdPhases: Array<{ phaseId: string; label: string; matchups: ReturnType<typeof buildSymmetricKoMatchups> }> = [];

      for (let rangIdx = 0; rangIdx < 3; rangIdx++) {
        const rang = rangIdx + 1;
        const label = labels[rangIdx];
        const nom = `Championnat ${label}`;

        const matchups = buildSymmetricKoMatchups(qualifies, rang);
        if (matchups.length === 0) continue;

        const newPhaseId = `phase-${concours.phases.length + 1}`;
        const phaseDef = new PhaseDefinition(
          TypePhase.ELIMINATION_SIMPLE,
          'integral',
          [CritereClassement.POINTS],
          [],
          null,
        );
        const newPhase = new Phase(newPhaseId, concours.id, TypePhase.ELIMINATION_SIMPLE, concours.phases.length + 1, phaseDef, nom);
        concours.ajouterPhase(newPhase);
        newPhase.demarrer();

        const roundName = matchups.length === 1 ? 'Finale' :
          matchups.length === 2 ? 'Demi-finales' :
          matchups.length === 4 ? 'Quarts de finale' : `Tour 1`;

        const tourId = `${newPhaseId}-tour-1`;
        const tour = new Tour(tourId, newPhaseId, 1, undefined, [], roundName);
        for (let i = 0; i < matchups.length; i++) {
          const mu = matchups[i];
          const matchId = `${tourId}-match-${i + 1}`;
          const match = new Match(matchId, tourId, mu.equipeAId, mu.equipeBId);
          tour.ajouterMatch(match);
        }
        newPhase.ajouterTour(tour);
        assignerTerrainsAuTour(concours, tour);

        createdPhases.push({ phaseId: newPhaseId, label, matchups });
      }

      await ctx.concoursRepository.save(concours);
      res.status(201).json({
        message: 'Phases de Championnat A, B, C créées',
        qualifies: qualifies.map((q) => ({ equipeId: q.equipeId, poule: q.pouleIndex, rang: q.rang })),
        phases: createdPhases.map((p) => ({
          phaseId: p.phaseId,
          nom: `Championnat ${p.label}`,
          matchups: p.matchups.map((m) => ({ equipeA: m.equipeAId, equipeB: m.equipeBId })),
        })),
      });
      return;
    } else {
      throw ApiError.badRequest(`Type de phase non supporté pour la progression : ${phaseType}`);
    }

    if (!newTourGen) {
      throw ApiError.badRequest('Impossible de générer le tour suivant');
    }

    // Créer le nouveau tour et ses matchs
    const tourId = `${phase.id}-tour-${newTourGen.numero}`;
    const newTour = new Tour(tourId, phase.id, newTourGen.numero, undefined, [], newTourGen.nom);

    for (let i = 0; i < newTourGen.matchups.length; i++) {
      const mu = newTourGen.matchups[i];
      const matchId = `${tourId}-match-${i + 1}`;
      const match = new Match(matchId, tourId, mu.equipeAId, mu.equipeBId);
      newTour.ajouterMatch(match);
    }

    phase.ajouterTour(newTour);
    assignerTerrainsAuTour(concours, newTour);
    await ctx.concoursRepository.save(concours);

    res.status(201).json({
      phaseId: phase.id,
      phaseType,
      tour: {
        numero: newTourGen.numero,
        nom: newTourGen.nom,
        matchups: newTourGen.matchups.map((m) => ({
          equipeA: m.equipeAId,
          equipeB: m.equipeBId,
        })),
      },
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

function collectPhaseResults(phase: Phase): MatchResultEntry[] {
  const results: MatchResultEntry[] = [];
  for (const tour of phase.tours) {
    for (const match of tour.matchs) {
      if (match.isBye) continue;
      if (match.resultat) {
        results.push({
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
  return results;
}

function collectPhaseEquipeIds(phase: Phase): string[] {
  const equipeIds = new Set<string>();
  for (const tour of phase.tours) {
    for (const match of tour.matchs) {
      equipeIds.add(match.equipeAId);
      if (match.equipeBId) equipeIds.add(match.equipeBId);
    }
  }
  return Array.from(equipeIds);
}

async function findMatchWithContext(ctx: AppContext, concoursId: string, matchId: string) {
  const concours = await ctx.concoursRepository.findById(concoursId);
  if (!concours) throw ApiError.notFound('Concours non trouvé');

  for (const phase of concours.phases) {
    for (const tour of phase.tours) {
      const match = tour.trouverMatch(matchId) as Match | undefined;
      if (match) return { concours, phase, tour, match };
    }
  }

  throw ApiError.notFound('Match non trouvé');
}

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
