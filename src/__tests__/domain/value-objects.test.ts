import { describe, it, expect } from 'vitest';
import {
  Score,
  GoalAverage,
  DateRange,
  LicenceNumber,
  FormuleConcours,
  PhaseDefinition,
  QualificationRule,
  ReglementConcours,
  ResultatMatch,
} from '../../domain/shared/value-objects.js';
import { TypeEquipe, TypePhase, CritereClassement, TypeResultat, TypeQualification } from '../../domain/shared/enums.js';
import { InvariantViolationError } from '../../shared/types.js';

describe('Score', () => {
  it('crée un score valide', () => {
    const score = new Score(13, 7);
    expect(score.pointsA).toBe(13);
    expect(score.pointsB).toBe(7);
    expect(score.isValid()).toBe(true);
  });

  it('accepte un score de 0-0', () => {
    const score = new Score(0, 0);
    expect(score.isValid()).toBe(true);
  });

  it('rejette un score négatif', () => {
    expect(() => new Score(-1, 5)).toThrow(InvariantViolationError);
    expect(() => new Score(5, -1)).toThrow(InvariantViolationError);
  });

  it('rejette un score non entier', () => {
    expect(() => new Score(1.5, 5)).toThrow(InvariantViolationError);
  });

  it('vérifie l\'égalité', () => {
    const a = new Score(13, 7);
    const b = new Score(13, 7);
    const c = new Score(7, 13);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('GoalAverage', () => {
  it('calcule la différence et le quotient', () => {
    const ga = new GoalAverage(39, 21);
    expect(ga.difference).toBe(18);
    expect(ga.quotient).toBeCloseTo(1.857, 2);
  });

  it('gère le cas 0 points encaissés', () => {
    const ga = new GoalAverage(26, 0);
    expect(ga.quotient).toBe(Infinity);
  });
});

describe('DateRange', () => {
  it('crée une plage de dates valide', () => {
    const debut = new Date('2025-06-15');
    const fin = new Date('2025-06-15');
    const range = new DateRange(debut, fin);
    expect(range.contains(debut)).toBe(true);
  });

  it('rejette début > fin', () => {
    expect(() => new DateRange(new Date('2025-06-16'), new Date('2025-06-15'))).toThrow(InvariantViolationError);
  });

  it('détecte le chevauchement', () => {
    const a = new DateRange(new Date('2025-06-15'), new Date('2025-06-17'));
    const b = new DateRange(new Date('2025-06-16'), new Date('2025-06-18'));
    const c = new DateRange(new Date('2025-06-20'), new Date('2025-06-22'));
    expect(a.overlaps(b)).toBe(true);
    expect(a.overlaps(c)).toBe(false);
  });
});

describe('LicenceNumber', () => {
  it('rejette un numéro vide', () => {
    expect(() => new LicenceNumber('', 'A', '2024-2025')).toThrow(InvariantViolationError);
    expect(() => new LicenceNumber('  ', 'A', '2024-2025')).toThrow(InvariantViolationError);
  });
});

describe('FormuleConcours', () => {
  const phasePoules = new PhaseDefinition(
    TypePhase.POULES, 'integral', [CritereClassement.POINTS], [CritereClassement.GOAL_AVERAGE_GENERAL],
    new QualificationRule(TypeQualification.TOP_N_PER_POOL, 2),
  );

  it('crée une formule valide', () => {
    const formule = new FormuleConcours(TypeEquipe.TRIPLETTE, [phasePoules], 8, 32);
    expect(formule.joueurParEquipe).toBe(3);
  });

  it('rejette une formule sans phases', () => {
    expect(() => new FormuleConcours(TypeEquipe.TRIPLETTE, [], 8, 32)).toThrow(InvariantViolationError);
  });

  it('rejette nbEquipesMin < 2', () => {
    expect(() => new FormuleConcours(TypeEquipe.TRIPLETTE, [phasePoules], 1, 32)).toThrow(InvariantViolationError);
  });

  it('rejette nbEquipesMax < nbEquipesMin', () => {
    expect(() => new FormuleConcours(TypeEquipe.TRIPLETTE, [phasePoules], 16, 8)).toThrow(InvariantViolationError);
  });
});

describe('ReglementConcours', () => {
  it('utilise les valeurs par défaut', () => {
    const reglement = new ReglementConcours();
    expect(reglement.scoreVictoire).toBe(13);
    expect(reglement.pointsVictoire).toBe(2);
    expect(reglement.pointsNul).toBe(1);
    expect(reglement.pointsDefaite).toBe(0);
    expect(reglement.nulAutorise).toBe(false);
    expect(reglement.protectionClub).toBe(false);
  });

  it('accepte des valeurs personnalisées', () => {
    const reglement = new ReglementConcours({ scoreVictoire: 11, nulAutorise: true, protectionClub: true });
    expect(reglement.scoreVictoire).toBe(11);
    expect(reglement.nulAutorise).toBe(true);
    expect(reglement.protectionClub).toBe(true);
  });
});

describe('ResultatMatch', () => {
  it('crée un résultat de match nul', () => {
    const r = ResultatMatch.nul(new Score(10, 10), 1);
    expect(r.vainqueur).toBeNull();
    expect(r.type).toBe(TypeResultat.NUL);
    expect(r.pointsAttribuesA).toBe(1);
    expect(r.pointsAttribuesB).toBe(1);
  });

  it('crée un résultat de forfait', () => {
    const r = ResultatMatch.forfait('eq1', 13, 0, 2, 0);
    expect(r.vainqueur).toBe('eq1');
    expect(r.type).toBe(TypeResultat.FORFAIT);
    expect(r.score.pointsA).toBe(13);
    expect(r.score.pointsB).toBe(0);
  });

  it('crée un BYE', () => {
    const r = ResultatMatch.bye();
    expect(r.type).toBe(TypeResultat.BYE);
    expect(r.vainqueur).toBeNull();
  });
});
