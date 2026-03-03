import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../../infrastructure/db/concours-mapper.js';
import { Concours } from '../../domain/concours/entities/concours.js';
import { Phase } from '../../domain/concours/entities/phase.js';
import { Tour } from '../../domain/concours/entities/tour.js';
import { Match } from '../../domain/concours/entities/match.js';
import { Terrain } from '../../domain/concours/entities/terrain.js';
import { Inscription } from '../../domain/concours/entities/inscription.js';
import { Equipe } from '../../domain/concours/entities/equipe.js';
import { Classement } from '../../domain/concours/entities/classement.js';
import {
  DateRange,
  FormuleConcours,
  ReglementConcours,
  PhaseDefinition,
  QualificationRule,
  Score,
  ResultatMatch,
  GoalAverage,
} from '../../domain/shared/value-objects.js';
import {
  StatutConcours,
  StatutMatch,
  StatutPhase,
  StatutTour,
  StatutInscription,
  TypePhase,
  TypeEquipe,
  CritereClassement,
  MethodeAppariement,
  TypeResultat,
  TypeQualification,
} from '../../domain/shared/enums.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildConcours(): Concours {
  const dates = new DateRange(new Date('2025-06-01T08:00:00Z'), new Date('2025-06-01T18:00:00Z'));

  const phaseDef = new PhaseDefinition(
    TypePhase.ELIMINATION_SIMPLE,
    'knockout',
    [CritereClassement.POINTS, CritereClassement.GOAL_AVERAGE_GENERAL],
    [CritereClassement.POINTS_MARQUES],
    new QualificationRule(TypeQualification.WINNER, 1, CritereClassement.POINTS),
    { protectionClub: true, nbPoules: 4 },
  );

  const formule = new FormuleConcours(TypeEquipe.DOUBLETTE, [phaseDef], 4, 32);
  const reglement = new ReglementConcours({
    scoreVictoire: 13,
    pointsVictoire: 2,
    nulAutorise: false,
    methodeAppariement: MethodeAppariement.ALEATOIRE,
    protectionClub: true,
  });

  const terrain1 = new Terrain('t1', 'c1', 1, 'Terrain 1', true, 'standard');
  const terrain2 = new Terrain('t2', 'c1', 2, 'Terrain 2', false, 'standard');

  const equipeA = new Equipe('eq1', ['j1', 'j2'], 'club1', 'Les Rois', 1);
  const equipeB = new Equipe('eq2', ['j3', 'j4'], 'club2', 'Les As', 2);
  const equipeBye = new Equipe('eq3', [], '', 'BYE', null);

  const insc1 = new Inscription('i1', 'c1', equipeA, new Date('2025-05-15T10:00:00Z'), StatutInscription.CONFIRMEE, false);
  const insc2 = new Inscription('i2', 'c1', equipeB, new Date('2025-05-16T14:00:00Z'), StatutInscription.CONFIRMEE, true);
  const insc3 = new Inscription('i3', 'c1', equipeBye, new Date('2025-05-17T09:00:00Z'), StatutInscription.ANNULEE, false);

  const scoreAB = new Score(13, 7);
  const resultatAB = new ResultatMatch('eq1', TypeResultat.VICTOIRE, scoreAB, 2, 0);

  const matchTermine = new Match('m1', 'tour1', 'eq1', 'eq2', 't1', new Date('2025-06-01T09:00:00Z'), StatutMatch.TERMINE, scoreAB, resultatAB);
  const matchBye = new Match('m2', 'tour1', 'eq3', null);

  const tour1 = new Tour('tour1', 'phase1', 1, StatutTour.TERMINE, [matchTermine, matchBye], 'Tour 1');

  const ga1 = new GoalAverage(13, 7);
  const classement = new Classement('phase1', [
    {
      equipeId: 'eq1',
      rang: 1,
      points: 2,
      matchsJoues: 1,
      matchsGagnes: 1,
      matchsPerdus: 0,
      matchsNuls: 0,
      pointsMarques: 13,
      pointsEncaisses: 7,
      goalAverage: ga1,
      qualifiee: true,
    },
    {
      equipeId: 'eq2',
      rang: 2,
      points: 0,
      matchsJoues: 1,
      matchsGagnes: 0,
      matchsPerdus: 1,
      matchsNuls: 0,
      pointsMarques: 7,
      pointsEncaisses: 13,
      goalAverage: new GoalAverage(7, 13),
      qualifiee: false,
    },
  ], [CritereClassement.POINTS, CritereClassement.GOAL_AVERAGE_GENERAL]);

  const phase1 = new Phase('phase1', 'c1', TypePhase.ELIMINATION_SIMPLE, 1, phaseDef, 'Phase principale', StatutPhase.TERMINEE, [tour1], classement);

  return new Concours('c1', 'Concours Test', dates, 'Lyon', 'org1', formule, reglement, StatutConcours.EN_COURS, [terrain1, terrain2], [phase1], [insc1, insc2, insc3]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('concours-mapper', () => {
  describe('serialize / deserialize (round-trip)', () => {
    it('reconstruit un Concours identique champ par champ', () => {
      const original = buildConcours();
      const data = serialize(original);
      const restored = deserialize(data);

      // Identité
      expect(restored.id).toBe(original.id);
      expect(restored.nom).toBe(original.nom);
      expect(restored.lieu).toBe(original.lieu);
      expect(restored.organisateurId).toBe(original.organisateurId);
      expect(restored.statut).toBe(original.statut);

      // Dates
      expect(restored.dates.debut.getTime()).toBe(original.dates.debut.getTime());
      expect(restored.dates.fin.getTime()).toBe(original.dates.fin.getTime());

      // Formule
      expect(restored.formule.typeEquipe).toBe(original.formule.typeEquipe);
      expect(restored.formule.nbEquipesMin).toBe(original.formule.nbEquipesMin);
      expect(restored.formule.nbEquipesMax).toBe(original.formule.nbEquipesMax);
      expect(restored.formule.phases).toHaveLength(1);
      const phDef = restored.formule.phases[0];
      expect(phDef.type).toBe(TypePhase.ELIMINATION_SIMPLE);
      expect(phDef.drawStrategy).toBe('knockout');
      expect(phDef.constraints.protectionClub).toBe(true);
      expect(phDef.constraints.nbPoules).toBe(4);
      expect(phDef.qualificationRule?.type).toBe(TypeQualification.WINNER);
      expect(phDef.qualificationRule?.nombre).toBe(1);

      // Règlement
      expect(restored.reglement.scoreVictoire).toBe(13);
      expect(restored.reglement.nulAutorise).toBe(false);
      expect(restored.reglement.protectionClub).toBe(true);
      expect(restored.reglement.methodeAppariement).toBe(MethodeAppariement.ALEATOIRE);
    });

    it('reconstruit les terrains (disponible inclus)', () => {
      const original = buildConcours();
      const restored = deserialize(serialize(original));

      expect(restored.terrains).toHaveLength(2);
      const t1 = restored.terrains.find(t => t.id === 't1')!;
      const t2 = restored.terrains.find(t => t.id === 't2')!;
      expect(t1.disponible).toBe(true);
      expect(t2.disponible).toBe(false);
      expect(t1.numero).toBe(1);
      expect(t1.nom).toBe('Terrain 1');
    });

    it('reconstruit les inscriptions (statut, teteDeSerie, equipe)', () => {
      const original = buildConcours();
      const restored = deserialize(serialize(original));

      expect(restored.inscriptions).toHaveLength(3);
      const i1 = restored.inscriptions.find(i => i.id === 'i1')!;
      const i2 = restored.inscriptions.find(i => i.id === 'i2')!;
      const i3 = restored.inscriptions.find(i => i.id === 'i3')!;

      expect(i1.statut).toBe(StatutInscription.CONFIRMEE);
      expect(i1.teteDeSerie).toBe(false);
      expect(i1.equipe.nom).toBe('Les Rois');
      expect(i1.equipe.joueurIds).toEqual(['j1', 'j2']);
      expect(i1.equipe.clubId).toBe('club1');
      expect(i1.horodatage.getTime()).toBe(new Date('2025-05-15T10:00:00Z').getTime());

      expect(i2.teteDeSerie).toBe(true);
      expect(i3.statut).toBe(StatutInscription.ANNULEE);
    });

    it('reconstruit les phases, tours et matchs', () => {
      const original = buildConcours();
      const restored = deserialize(serialize(original));

      expect(restored.phases).toHaveLength(1);
      const phase = restored.phases[0];
      expect(phase.id).toBe('phase1');
      expect(phase.type).toBe(TypePhase.ELIMINATION_SIMPLE);
      expect(phase.statut).toBe(StatutPhase.TERMINEE);
      expect(phase.nom).toBe('Phase principale');
      expect(phase.tours).toHaveLength(1);

      const tour = phase.tours[0];
      expect(tour.id).toBe('tour1');
      expect(tour.statut).toBe(StatutTour.TERMINE);
      expect(tour.nom).toBe('Tour 1');
      expect(tour.matchs).toHaveLength(2);

      const m1 = tour.matchs.find(m => m.id === 'm1')!;
      expect(m1.statut).toBe(StatutMatch.TERMINE);
      expect(m1.equipeAId).toBe('eq1');
      expect(m1.equipeBId).toBe('eq2');
      expect(m1.terrainId).toBe('t1');
      expect(m1.horaire?.getTime()).toBe(new Date('2025-06-01T09:00:00Z').getTime());
      expect(m1.score?.pointsA).toBe(13);
      expect(m1.score?.pointsB).toBe(7);
      expect(m1.resultat?.vainqueur).toBe('eq1');
      expect(m1.resultat?.type).toBe(TypeResultat.VICTOIRE);
      expect(m1.resultat?.pointsAttribuesA).toBe(2);
    });

    it('gère un match BYE (equipeBId = null)', () => {
      const original = buildConcours();
      const restored = deserialize(serialize(original));
      const m2 = restored.phases[0].tours[0].matchs.find(m => m.id === 'm2')!;
      expect(m2.equipeBId).toBeNull();
      expect(m2.statut).toBe(StatutMatch.BYE);
    });

    it('reconstruit le classement avec GoalAverage', () => {
      const original = buildConcours();
      const restored = deserialize(serialize(original));
      const classement = restored.phases[0].classement!;
      expect(classement.lignes).toHaveLength(2);

      const ligne1 = classement.getLigne('eq1')!;
      expect(ligne1.rang).toBe(1);
      expect(ligne1.points).toBe(2);
      expect(ligne1.qualifiee).toBe(true);
      // GoalAverage recalculé
      expect(ligne1.goalAverage.pointsMarques).toBe(13);
      expect(ligne1.goalAverage.pointsEncaisses).toBe(7);
      expect(ligne1.goalAverage.difference).toBe(6);
      expect(ligne1.goalAverage.quotient).toBeCloseTo(13 / 7);

      const ligne2 = classement.getLigne('eq2')!;
      expect(ligne2.qualifiee).toBe(false);
    });

    it('GoalAverage avec pointsEncaisses = 0 → quotient = Infinity', () => {
      const ga = new GoalAverage(10, 0);
      const serialized = JSON.stringify({ pm: ga.pointsMarques, pe: ga.pointsEncaisses });
      const parsed = JSON.parse(serialized);
      const restored = new GoalAverage(parsed.pm, parsed.pe);
      expect(restored.quotient).toBe(Infinity);
    });

    it('serialize → JSON.stringify ne perd pas de données', () => {
      const original = buildConcours();
      const data = serialize(original);
      // Simulate JSONB round-trip
      const json = JSON.stringify(data);
      expect(json).not.toContain('Infinity');
      const reparsed = JSON.parse(json);
      const restored = deserialize(reparsed);
      expect(restored.id).toBe(original.id);
      expect(restored.phases[0].tours[0].matchs).toHaveLength(2);
    });

    it('inscription sans joueurs ni club (équipe simplifiée)', () => {
      const dates = new DateRange(new Date('2025-06-01'), new Date('2025-06-01'));
      const phaseDef = new PhaseDefinition(TypePhase.POULES, 'pools', [CritereClassement.POINTS], [], null, {});
      const formule = new FormuleConcours(TypeEquipe.DOUBLETTE, [phaseDef], 2, 16);
      const reglement = new ReglementConcours();
      const equipe = new Equipe('eq-bare', [], '', 'Anonyme', null);
      const insc = new Inscription('i-bare', 'c2', equipe, new Date(), StatutInscription.CONFIRMEE, false);
      const concours = new Concours('c2', 'Test', dates, 'Paris', 'org2', formule, reglement, StatutConcours.BROUILLON, [], [], [insc]);

      const restored = deserialize(serialize(concours));
      const r = restored.inscriptions[0];
      expect(r.equipe.joueurIds).toEqual([]);
      expect(r.equipe.clubId).toBe('');
    });
  });
});
