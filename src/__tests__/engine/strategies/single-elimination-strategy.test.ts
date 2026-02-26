import { describe, it, expect } from 'vitest';
import { SingleEliminationStrategy } from '../../../engine/strategies/phase/single-elimination-strategy.js';
import { PhaseContext } from '../../../engine/strategies/interfaces.js';

describe('SingleEliminationStrategy', () => {
  describe('generateTours', () => {
    it('génère seulement le premier tour pour 4 équipes', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [],
        config: {},
      };

      const tours = strategy.generateTours(context);

      expect(tours).toHaveLength(1);
      expect(tours[0].numero).toBe(1);
      expect(tours[0].matchups).toHaveLength(2);
      expect(tours[0].matchups[0]).toEqual({ equipeAId: 'e1', equipeBId: 'e2' });
      expect(tours[0].matchups[1]).toEqual({ equipeAId: 'e3', equipeBId: 'e4' });
      expect(tours[0].nom).toBe('Demi-finales');
    });

    it('gère un nombre impair avec BYE', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3'],
        matchResults: [],
        config: {},
      };

      const tours = strategy.generateTours(context);

      expect(tours[0].matchups).toHaveLength(2);
      const byeMatch = tours[0].matchups.find((m) => m.equipeBId === null);
      expect(byeMatch).toBeDefined();
    });

    it('rejette moins de 2 équipes', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1'],
        matchResults: [],
        config: {},
      };

      expect(() => strategy.generateTours(context)).toThrow('au moins 2 équipes');
    });

    it('nomme correctement les rounds pour 8 équipes', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'],
        matchResults: [],
        config: {},
      };

      const tours = strategy.generateTours(context);

      expect(tours[0].nom).toBe('Quarts de finale');
    });
  });

  describe('generateNextTour', () => {
    it('génère la finale après les demi-finales', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 5, scoreB: 13, vainqueurId: 'e4' },
        ],
        config: {},
      };

      const nextTour = strategy.generateNextTour(context, 1);

      expect(nextTour).not.toBeNull();
      expect(nextTour!.numero).toBe(2);
      expect(nextTour!.nom).toBe('Finale');
      expect(nextTour!.matchups).toHaveLength(1);
      expect(nextTour!.matchups[0]).toEqual({ equipeAId: 'e1', equipeBId: 'e4' });
    });

    it('retourne null après la finale', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 5, scoreB: 13, vainqueurId: 'e4' },
          { matchId: 'm3', equipeAId: 'e1', equipeBId: 'e4', scoreA: 13, scoreB: 11, vainqueurId: 'e1' },
        ],
        config: {},
      };

      const nextTour = strategy.generateNextTour(context, 2);
      expect(nextTour).toBeNull();
    });
  });

  describe('getFirstRoundLosers', () => {
    it('retourne les perdants du premier tour', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 5, scoreB: 13, vainqueurId: 'e4' },
        ],
        config: {},
      };

      const losers = strategy.getFirstRoundLosers(context);

      expect(losers).toHaveLength(2);
      expect(losers).toContain('e2');
      expect(losers).toContain('e3');
    });
  });

  describe('isPhaseComplete', () => {
    it('retourne false quand il reste des matchs', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
        ],
        config: {},
      };

      expect(strategy.isPhaseComplete(context)).toBe(false);
    });

    it('retourne true quand tous les matchs sont joués', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 5, scoreB: 13, vainqueurId: 'e4' },
          { matchId: 'm3', equipeAId: 'e1', equipeBId: 'e4', scoreA: 13, scoreB: 11, vainqueurId: 'e1' },
        ],
        config: {},
      };

      expect(strategy.isPhaseComplete(context)).toBe(true);
    });

    it('retourne true pour 2 équipes avec 1 match joué', () => {
      const strategy = new SingleEliminationStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
        ],
        config: {},
      };

      expect(strategy.isPhaseComplete(context)).toBe(true);
    });
  });
});
