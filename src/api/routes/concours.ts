import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../context.js';
import { validateBody } from '../middleware/validation.js';
import { ApiError } from '../middleware/error-handler.js';
import { Concours } from '../../domain/concours/entities/concours.js';
import { Equipe } from '../../domain/concours/entities/equipe.js';
import { Inscription } from '../../domain/concours/entities/inscription.js';
import { Terrain } from '../../domain/concours/entities/terrain.js';
import { Phase } from '../../domain/concours/entities/phase.js';
import { Tour } from '../../domain/concours/entities/tour.js';
import { Match } from '../../domain/concours/entities/match.js';
import { DateRange, FormuleConcours, ReglementConcours, PhaseDefinition, QualificationRule } from '../../domain/shared/value-objects.js';
import { TypeEquipe, TypePhase, CritereClassement, TypeQualification } from '../../domain/shared/enums.js';
import { IntegralDrawStrategy } from '../../engine/strategies/draw/integral-draw-strategy.js';
import { assignerTerrainsAuTour } from '../helpers/terrain-assignment.js';
import { PoolPhaseStrategy } from '../../engine/strategies/phase/pool-phase-strategy.js';
import { SingleEliminationStrategy } from '../../engine/strategies/phase/single-elimination-strategy.js';
import { SwissSystemStrategy } from '../../engine/strategies/phase/swiss-system-strategy.js';
import { TourGeneration, Matchup } from '../../engine/strategies/interfaces.js';

// ─── Schemas Zod ────────────────────────────────────────────────────────────

const creerConcoursSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  lieu: z.string().min(1, 'Le lieu est requis'),
  organisateurId: z.string().min(1),
  typeEquipe: z.nativeEnum(TypeEquipe),
  nbEquipesMin: z.number().int().min(2).default(4),
  nbEquipesMax: z.number().int().min(2).default(32),
  nbTerrains: z.number().int().min(0).max(50).default(0),
  typePhase: z.nativeEnum(TypePhase).default(TypePhase.POULES),
  reglement: z.object({
    scoreVictoire: z.number().int().positive().default(13),
    pointsVictoire: z.number().int().min(0).default(2),
    pointsNul: z.number().int().min(0).default(1),
    pointsDefaite: z.number().int().min(0).default(0),
    nulAutorise: z.boolean().default(false),
  }).default({ scoreVictoire: 13, pointsVictoire: 2, pointsNul: 1, pointsDefaite: 0, nulAutorise: false }),
});

const inscrireEquipeSchema = z.object({
  nomEquipe: z.string().min(1),
  joueurs: z.array(z.string().min(1)).default([]),
  club: z.string().default(''),
  teteDeSerie: z.boolean().default(false),
});

const ajouterTerrainSchema = z.object({
  numero: z.number().int().positive(),
  nom: z.string().min(1),
  type: z.string().default('standard'),
});

const lancerTirageSchema = z.object({
  nbPoules: z.number().int().positive().optional(),
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

function concoursToJson(c: Concours) {
  return {
    id: c.id,
    nom: c.nom,
    dates: { debut: c.dates.debut.toISOString(), fin: c.dates.fin.toISOString() },
    lieu: c.lieu,
    organisateurId: c.organisateurId,
    statut: c.statut,
    nbEquipesInscrites: c.nbEquipesInscrites,
    nbTerrains: c.terrains.length,
    nbPhases: c.phases.length,
    formule: {
      typeEquipe: c.formule.typeEquipe,
      nbEquipesMin: c.formule.nbEquipesMin,
      nbEquipesMax: c.formule.nbEquipesMax,
    },
  };
}

// ─── Router ─────────────────────────────────────────────────────────────────

export function createConcoursRouter(ctx: AppContext): Router {
  const router = Router();

  // GET / — Lister les concours
  router.get('/', asyncHandler(async (_req, res) => {
    const concoursList = await ctx.concoursRepository.findAll();
    res.json({ data: concoursList.map(concoursToJson) });
  }));

  // GET /:id — Détail d'un concours
  router.get('/:id', asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    res.json({
      ...concoursToJson(concours),
      terrains: concours.terrains.map((t) => ({
        id: t.id, numero: t.numero, nom: t.nom, disponible: t.disponible,
      })),
      inscriptions: concours.inscriptionsActives.map((i) => ({
        id: i.id, equipeId: i.equipeId, nomEquipe: i.equipe.nom,
        joueurs: i.equipe.joueurIds,
        club: i.equipe.clubId,
        teteDeSerie: i.teteDeSerie,
      })),
      phases: concours.phases.map((p) => ({
        id: p.id, type: p.type, ordre: p.ordre, statut: p.statut,
        nbTours: p.tours.length,
        classement: p.classement ? p.classement.lignes : null,
      })),
    });
  }));

  // POST / — Créer un concours
  router.post('/', validateBody(creerConcoursSchema), asyncHandler(async (req, res) => {
    const data = req.body;
    const id = ctx.concoursRepository.nextId();

    const dates = new DateRange(new Date(data.dateDebut), new Date(data.dateFin));
    const phaseDefinition = new PhaseDefinition(
      data.typePhase,
      'integral',
      [CritereClassement.POINTS, CritereClassement.GOAL_AVERAGE_GENERAL],
      [CritereClassement.POINTS_MARQUES],
      new QualificationRule(TypeQualification.TOP_N, 2),
    );
    const formule = new FormuleConcours(
      data.typeEquipe,
      [phaseDefinition],
      data.nbEquipesMin,
      data.nbEquipesMax,
    );
    const reglement = new ReglementConcours(data.reglement);

    const concours = new Concours(id, data.nom, dates, data.lieu, data.organisateurId, formule, reglement);

    // Auto-générer les terrains
    for (let i = 0; i < data.nbTerrains; i++) {
      const terrain = new Terrain(`terrain-${i + 1}`, id, i + 1, `Terrain ${i + 1}`, true, 'standard');
      concours.ajouterTerrain(terrain);
    }

    await ctx.concoursRepository.save(concours);

    res.status(201).json(concoursToJson(concours));
  }));

  // POST /:id/ouvrir-inscriptions
  router.post('/:id/ouvrir-inscriptions', asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    concours.ouvrirInscriptions();
    await ctx.concoursRepository.save(concours);

    res.json({ statut: concours.statut });
  }));

  // POST /:id/cloturer-inscriptions
  router.post('/:id/cloturer-inscriptions', asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    concours.cloturerInscriptions();
    await ctx.concoursRepository.save(concours);

    res.json({ statut: concours.statut });
  }));

  // POST /:id/terrains — Ajouter un terrain
  router.post('/:id/terrains', validateBody(ajouterTerrainSchema), asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    const terrainId = `terrain-${concours.terrains.length + 1}`;
    const terrain = new Terrain(terrainId, concours.id, req.body.numero, req.body.nom, true, req.body.type);
    concours.ajouterTerrain(terrain);
    await ctx.concoursRepository.save(concours);

    res.status(201).json({ id: terrainId, numero: terrain.numero, nom: terrain.nom });
  }));

  // POST /:id/inscriptions — Inscrire une équipe
  router.post('/:id/inscriptions', validateBody(inscrireEquipeSchema), asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    const data = req.body;
    const equipeId = `equipe-${concours.nbEquipesInscrites + 1}`;
    const equipe = new Equipe(equipeId, data.joueurs, data.club, data.nomEquipe);

    const inscriptionId = `inscription-${concours.nbEquipesInscrites + 1}`;
    const inscription = new Inscription(inscriptionId, concours.id, equipe, new Date(), undefined, data.teteDeSerie);

    concours.inscrireEquipe(inscription);
    await ctx.concoursRepository.save(concours);

    res.status(201).json({
      inscriptionId,
      equipeId,
      equipeNom: data.nomEquipe,
      nbInscrites: concours.nbEquipesInscrites,
    });
  }));

  // POST /:id/tirage — Lancer le tirage et générer la phase
  router.post('/:id/tirage', validateBody(lancerTirageSchema), asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    // Récupérer les équipes inscrites (avant lancerTirage pour validation)
    const equipeIds = concours.inscriptionsActives.map((i) => i.equipeId);
    const phaseType = concours.formule.phases[0].type;
    const nbPoules = req.body.nbPoules ?? (phaseType === TypePhase.POULES ? Math.floor(equipeIds.length / 4) : undefined);

    // Validation poules : chaque poule doit contenir exactement 4 équipes
    if (phaseType === TypePhase.POULES) {
      if (equipeIds.length % 4 !== 0) {
        throw ApiError.badRequest(
          `Le nombre d'équipes (${equipeIds.length}) doit être un multiple de 4 pour les poules`
        );
      }
      if (nbPoules && equipeIds.length / nbPoules !== 4) {
        throw ApiError.badRequest(
          `Avec ${nbPoules} poules et ${equipeIds.length} équipes, les poules n'auront pas 4 équipes chacune`
        );
      }
    }

    // Lancer le tirage (vérifie les invariants de statut)
    concours.lancerTirage();

    const tetesDeSerieIds = concours.inscriptionsActives
      .filter((i) => i.teteDeSerie)
      .map((i) => i.equipeId);

    const drawStrategy = new IntegralDrawStrategy(nbPoules);
    const drawResult = drawStrategy.execute({
      equipeIds,
      constraints: { protectionClub: false, clubsByEquipe: new Map() },
      tetesDeSerieIds: tetesDeSerieIds.length > 0 ? tetesDeSerieIds : undefined,
    });

    // Créer la phase — stocker nbPoules et assignments dans constraints pour reconstruction
    const baseConfig = concours.formule.phases[0];
    const phaseConfig = new PhaseDefinition(
      baseConfig.type,
      baseConfig.drawStrategy,
      baseConfig.rankingCriteria,
      baseConfig.tiebreakChain,
      baseConfig.qualificationRule,
      {
        ...baseConfig.constraints,
        nbPoules: nbPoules ?? baseConfig.constraints.nbPoules,
      },
    );
    const phaseId = `phase-${concours.phases.length + 1}`;
    const phase = new Phase(phaseId, concours.id, phaseType, concours.phases.length + 1, phaseConfig);
    concours.ajouterPhase(phase);

    // Générer les tours selon le type de phase
    const assignedEquipeIds = drawResult.assignments.map((a) => a.equipeId);
    const phaseContext = {
      phaseId,
      equipeIds: assignedEquipeIds,
      matchResults: [] as never[],
      config: { nbPoules },
    };

    let tours;
    if (phaseType === TypePhase.POULES) {
      // POULES : seulement tour 1 (tours 2-3 générés dynamiquement)
      const strategy = new PoolPhaseStrategy(drawResult.assignments);
      tours = strategy.generateTours(phaseContext);
    } else if (phaseType === TypePhase.ELIMINATION_SIMPLE) {
      // ELIMINATION : seulement tour 1
      const strategy = new SingleEliminationStrategy();
      tours = strategy.generateTours(phaseContext);
    } else if (phaseType === TypePhase.CHAMPIONNAT) {
      // CHAMPIONNAT : round-robin complet (tous les tours générés)
      tours = generateRoundRobinTours(assignedEquipeIds);
    } else if (phaseType === TypePhase.SYSTEME_SUISSE) {
      // SUISSE : seulement tour 1 (aléatoire)
      const strategy = new SwissSystemStrategy();
      tours = strategy.generateTours(phaseContext);
    } else {
      throw ApiError.badRequest(`Type de phase non supporté : ${phaseType}`);
    }

    // Créer les entités Tour + Match
    for (const tourGen of tours) {
      const tourId = `${phaseId}-tour-${tourGen.numero}`;
      const tour = new Tour(tourId, phaseId, tourGen.numero, undefined, [], tourGen.nom);

      for (let i = 0; i < tourGen.matchups.length; i++) {
        const mu = tourGen.matchups[i];
        const matchId = `${tourId}-match-${i + 1}`;
        const match = new Match(matchId, tourId, mu.equipeAId, mu.equipeBId);
        tour.ajouterMatch(match);
      }

      phase.ajouterTour(tour);
      assignerTerrainsAuTour(concours, tour);
    }

    // Valider le tirage et démarrer
    concours.validerTirage();
    phase.demarrer();

    await ctx.concoursRepository.save(concours);

    res.status(201).json({
      statut: concours.statut,
      phaseId,
      phaseType,
      nbTours: tours.length,
      tours: tours.map((t) => ({
        numero: t.numero,
        nom: t.nom,
        matchups: t.matchups.map((m) => ({
          equipeA: m.equipeAId,
          equipeB: m.equipeBId,
        })),
      })),
      tirage: {
        nbEquipes: equipeIds.length,
        nbByes: drawResult.byes.length,
        assignments: drawResult.assignments.map((a) => ({
          equipeId: a.equipeId,
          position: a.position,
          poule: a.pouleIndex,
        })),
      },
    });
  }));

  // POST /:id/annuler — Annuler un concours
  router.post('/:id/annuler', asyncHandler(async (req, res) => {
    const concours = await ctx.concoursRepository.findById(param(req.params.id));
    if (!concours) throw ApiError.notFound('Concours non trouvé');

    concours.annuler();
    await ctx.concoursRepository.save(concours);

    res.json({ statut: concours.statut });
  }));

  return router;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Génère un round-robin complet pour le championnat (tous les tours).
 */
function generateRoundRobinTours(equipeIds: string[]): TourGeneration[] {
  const equipes = [...equipeIds];
  const hasGhost = equipes.length % 2 !== 0;
  if (hasGhost) equipes.push('__BYE__');

  const n = equipes.length;
  const tours: TourGeneration[] = [];

  for (let round = 0; round < n - 1; round++) {
    const matchups: Matchup[] = [];

    for (let i = 0; i < n / 2; i++) {
      const home = i === 0 ? equipes[0] : equipes[((round + i - 1) % (n - 1)) + 1];
      const away = equipes[((round + (n / 2) - 1 + (n / 2 - i) - 1) % (n - 1)) + 1];

      if (home === '__BYE__') {
        matchups.push({ equipeAId: away, equipeBId: null });
      } else if (away === '__BYE__') {
        matchups.push({ equipeAId: home, equipeBId: null });
      } else {
        matchups.push({ equipeAId: home, equipeBId: away });
      }
    }

    tours.push({ numero: round + 1, matchups, nom: `Journée ${round + 1}` });
  }

  return tours;
}
