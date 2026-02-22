import { describe, it, expect } from 'vitest';
import { Match } from '../../domain/concours/entities/match.js';
import { StatutMatch, TypeResultat } from '../../domain/shared/enums.js';
import { Score, ResultatMatch } from '../../domain/shared/value-objects.js';
import { InvalidStateTransitionError, InvariantViolationError } from '../../shared/types.js';

function creerMatchTest(id = 'm1', eqA = 'eqA', eqB: string | null = 'eqB'): Match {
  return new Match(id, 'tour1', eqA, eqB);
}

describe('Machine à états Match', () => {
  it('démarre en PROGRAMME (si deux équipes)', () => {
    const m = creerMatchTest();
    expect(m.statut).toBe(StatutMatch.PROGRAMME);
  });

  it('démarre en BYE si pas d\'adversaire', () => {
    const m = creerMatchTest('m1', 'eqA', null);
    expect(m.statut).toBe(StatutMatch.BYE);
    expect(m.isBye).toBe(true);
    expect(m.isTermine).toBe(true);
  });

  it('PROGRAMME → EN_COURS', () => {
    const m = creerMatchTest();
    m.demarrer();
    expect(m.statut).toBe(StatutMatch.EN_COURS);
  });

  it('EN_COURS → SCORE_SAISI', () => {
    const m = creerMatchTest();
    m.demarrer();
    m.saisirScore(new Score(13, 7));
    expect(m.statut).toBe(StatutMatch.SCORE_SAISI);
    expect(m.score!.pointsA).toBe(13);
    expect(m.score!.pointsB).toBe(7);
  });

  it('SCORE_SAISI → TERMINE', () => {
    const m = creerMatchTest();
    m.demarrer();
    m.saisirScore(new Score(13, 7));
    const resultat = new ResultatMatch('eqA', TypeResultat.VICTOIRE, new Score(13, 7), 2, 0);
    m.validerResultat(resultat);
    expect(m.statut).toBe(StatutMatch.TERMINE);
    expect(m.resultat!.vainqueur).toBe('eqA');
  });

  it('TERMINE → EN_CORRECTION → TERMINE', () => {
    const m = creerMatchTest();
    m.demarrer();
    m.saisirScore(new Score(13, 7));
    m.validerResultat(new ResultatMatch('eqA', TypeResultat.VICTOIRE, new Score(13, 7), 2, 0));
    m.demanderCorrection();
    expect(m.statut).toBe(StatutMatch.EN_CORRECTION);
    m.corrigerScore(
      new Score(7, 13),
      new ResultatMatch('eqB', TypeResultat.VICTOIRE, new Score(7, 13), 0, 2),
    );
    expect(m.statut).toBe(StatutMatch.TERMINE);
    expect(m.resultat!.vainqueur).toBe('eqB');
  });

  it('EN_COURS → FORFAIT', () => {
    const m = creerMatchTest();
    m.demarrer();
    m.declarerForfait('eqA');
    expect(m.statut).toBe(StatutMatch.FORFAIT);
    expect(m.isTermine).toBe(true);
  });

  it('EN_COURS → ABANDON', () => {
    const m = creerMatchTest();
    m.demarrer();
    m.declarerAbandon('eqB');
    expect(m.statut).toBe(StatutMatch.ABANDON);
    expect(m.isTermine).toBe(true);
  });

  it('refuse saisie score si pas EN_COURS', () => {
    const m = creerMatchTest();
    expect(() => m.saisirScore(new Score(13, 7))).toThrow(InvariantViolationError);
  });

  it('refuse démarrer deux fois', () => {
    const m = creerMatchTest();
    m.demarrer();
    expect(() => m.demarrer()).toThrow(InvalidStateTransitionError);
  });

  it('refuse forfait d\'une équipe non participante', () => {
    const m = creerMatchTest();
    m.demarrer();
    expect(() => m.declarerForfait('eqC')).toThrow(InvariantViolationError);
  });

  it('refuse correction si pas TERMINÉ', () => {
    const m = creerMatchTest();
    m.demarrer();
    expect(() => m.demanderCorrection()).toThrow(InvalidStateTransitionError);
  });

  it('refuse corriger si pas EN_CORRECTION', () => {
    const m = creerMatchTest();
    m.demarrer();
    m.saisirScore(new Score(13, 7));
    m.validerResultat(new ResultatMatch('eqA', TypeResultat.VICTOIRE, new Score(13, 7), 2, 0));
    expect(() => m.corrigerScore(
      new Score(7, 13),
      new ResultatMatch('eqB', TypeResultat.VICTOIRE, new Score(7, 13), 0, 2),
    )).toThrow(InvariantViolationError);
  });

  it('assigne un terrain', () => {
    const m = creerMatchTest();
    m.assignerTerrain('t1', new Date('2025-06-15T10:00'));
    expect(m.terrainId).toBe('t1');
    expect(m.horaire).toEqual(new Date('2025-06-15T10:00'));
  });
});
