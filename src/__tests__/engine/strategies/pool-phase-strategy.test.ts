import { describe, it, expect } from 'vitest';
import { PoolPhaseStrategy, buildKoCrossMatchups } from '../../../engine/strategies/phase/pool-phase-strategy.js';
import { PhaseContext, QualifiedEntry } from '../../../engine/strategies/interfaces.js';

describe('PoolPhaseStrategy', () => {
  describe('generateTours', () => {
    it('génère seulement le tour 1 pour une poule de 4', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [],
        config: { nbPoules: 1 },
      };

      const tours = strategy.generateTours(context);

      expect(tours).toHaveLength(1);
      expect(tours[0].numero).toBe(1);
      expect(tours[0].matchups).toHaveLength(2);
      expect(tours[0].nom).toBe('Tour 1 — Poules');
    });

    it('rejette une poule qui n\'a pas 4 équipes', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3'],
        matchResults: [],
        config: { nbPoules: 1 },
      };

      expect(() => strategy.generateTours(context)).toThrow('exactement 4 équipes');
    });

    it('génère le tour 1 pour 2 poules séparées (8 équipes)', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'],
        matchResults: [],
        config: { nbPoules: 2 },
      };

      const tours = strategy.generateTours(context);

      expect(tours).toHaveLength(1);
      // 2 poules × 2 matchs = 4 matchs
      expect(tours[0].matchups).toHaveLength(4);
    });

    it('génère le tour 1 pour 4 poules (16 équipes)', () => {
      const strategy = new PoolPhaseStrategy();
      const ids = Array.from({ length: 16 }, (_, i) => `e${i + 1}`);
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ids,
        matchResults: [],
        config: { nbPoules: 4 },
      };

      const tours = strategy.generateTours(context);

      expect(tours).toHaveLength(1);
      // 4 poules × 2 matchs = 8 matchs
      expect(tours[0].matchups).toHaveLength(8);
    });

    it('rejette si aucune poule n\'est configurée avec 0 équipes', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: [],
        matchResults: [],
        config: { nbPoules: 0 },
      };

      expect(() => strategy.generateTours(context)).toThrow();
    });
  });

  describe('generateNextTour', () => {
    it('génère le tour 2 (gagnants vs gagnants, perdants vs perdants)', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 13, scoreB: 5, vainqueurId: 'e3' },
        ],
        config: { nbPoules: 1 },
      };

      const tour2 = strategy.generateNextTour(context, 1);

      expect(tour2).not.toBeNull();
      expect(tour2!.numero).toBe(2);
      expect(tour2!.matchups).toHaveLength(2);
      // Gagnants vs gagnants : e1 vs e3
      expect(tour2!.matchups[0]).toEqual({ equipeAId: 'e1', equipeBId: 'e3' });
      // Perdants vs perdants : e2 vs e4
      expect(tour2!.matchups[1]).toEqual({ equipeAId: 'e2', equipeBId: 'e4' });
    });

    it('génère le barrage (tour 3) entre perdant M3 et gagnant M4', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          // Tour 1 : e1 bat e2, e3 bat e4
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 13, scoreB: 5, vainqueurId: 'e3' },
          // Tour 2 : e1 bat e3 (Winners), e2 bat e4 (Losers)
          { matchId: 'm3', equipeAId: 'e1', equipeBId: 'e3', scoreA: 13, scoreB: 10, vainqueurId: 'e1' },
          { matchId: 'm4', equipeAId: 'e2', equipeBId: 'e4', scoreA: 13, scoreB: 7, vainqueurId: 'e2' },
        ],
        config: { nbPoules: 1 },
      };

      const tour3 = strategy.generateNextTour(context, 2);

      expect(tour3).not.toBeNull();
      expect(tour3!.numero).toBe(3);
      expect(tour3!.matchups).toHaveLength(1);
      // Barrage : perdant M3 (e3) vs gagnant M4 (e2)
      expect(tour3!.matchups[0]).toEqual({ equipeAId: 'e3', equipeBId: 'e2' });
    });

    it('retourne null après le tour 3', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [],
        config: { nbPoules: 1 },
      };

      const tour4 = strategy.generateNextTour(context, 3);
      expect(tour4).toBeNull();
    });
  });

  describe('isPhaseComplete', () => {
    it('retourne false quand aucun match n\'est joué', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [],
        config: { nbPoules: 1 },
      };

      expect(strategy.isPhaseComplete(context)).toBe(false);
    });

    it('retourne false avec seulement 3 matchs joués (ancienne logique)', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 13, scoreB: 5, vainqueurId: 'e3' },
          { matchId: 'm3', equipeAId: 'e1', equipeBId: 'e3', scoreA: 13, scoreB: 10, vainqueurId: 'e1' },
        ],
        config: { nbPoules: 1 },
      };

      expect(strategy.isPhaseComplete(context)).toBe(false);
    });

    it('retourne true quand les 5 matchs sont joués', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 13, scoreB: 5, vainqueurId: 'e3' },
          { matchId: 'm3', equipeAId: 'e1', equipeBId: 'e3', scoreA: 13, scoreB: 10, vainqueurId: 'e1' },
          { matchId: 'm4', equipeAId: 'e2', equipeBId: 'e4', scoreA: 13, scoreB: 7, vainqueurId: 'e2' },
          { matchId: 'm5', equipeAId: 'e3', equipeBId: 'e2', scoreA: 13, scoreB: 9, vainqueurId: 'e3' },
        ],
        config: { nbPoules: 1 },
      };

      expect(strategy.isPhaseComplete(context)).toBe(true);
    });

    it('retourne true pour 2 poules quand les 10 matchs sont joués', () => {
      const strategy = new PoolPhaseStrategy();
      const results = [];
      // 5 matchs par poule × 2 poules = 10 matchs
      for (let i = 0; i < 10; i++) {
        results.push({
          matchId: `m${i}`,
          equipeAId: `e${i * 2}`,
          equipeBId: `e${i * 2 + 1}`,
          scoreA: 13,
          scoreB: 8,
          vainqueurId: `e${i * 2}`,
        });
      }

      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'],
        matchResults: results,
        config: { nbPoules: 2 },
      };

      expect(strategy.isPhaseComplete(context)).toBe(true);
    });
  });

  describe('getPouleRanking — classement positionnel GSL', () => {
    it('classe W_M3=1er, W_M5=2e, L_M5=3e, L_M4=4e', () => {
      const strategy = new PoolPhaseStrategy();
      const poule = ['e1', 'e2', 'e3', 'e4'];
      const results = [
        // Tour 1 : e1 bat e2, e3 bat e4
        { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
        { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 13, scoreB: 5, vainqueurId: 'e3' },
        // Tour 2 (M3=Winners, M4=Losers) : e1 bat e3, e2 bat e4
        { matchId: 'm3', equipeAId: 'e1', equipeBId: 'e3', scoreA: 13, scoreB: 10, vainqueurId: 'e1' },
        { matchId: 'm4', equipeAId: 'e2', equipeBId: 'e4', scoreA: 13, scoreB: 7, vainqueurId: 'e2' },
        // Tour 3 (M5=Barrage) : e3 bat e2
        { matchId: 'm5', equipeAId: 'e3', equipeBId: 'e2', scoreA: 13, scoreB: 9, vainqueurId: 'e3' },
      ];

      const ranking = strategy.getPouleRanking(poule, results);

      expect(ranking[0]).toBe('e1'); // W_M3 = 1er (2V)
      expect(ranking[1]).toBe('e3'); // W_M5 = 2e
      expect(ranking[2]).toBe('e2'); // L_M5 = 3e
      expect(ranking[3]).toBe('e4'); // L_M4 = 4e (0V)
    });

    it('avant le barrage, 2e/3e sont ex-aequo', () => {
      const strategy = new PoolPhaseStrategy();
      const poule = ['e1', 'e2', 'e3', 'e4'];
      const results = [
        // Tour 1
        { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
        { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 13, scoreB: 5, vainqueurId: 'e3' },
        // Tour 2
        { matchId: 'm3', equipeAId: 'e1', equipeBId: 'e3', scoreA: 13, scoreB: 10, vainqueurId: 'e1' },
        { matchId: 'm4', equipeAId: 'e2', equipeBId: 'e4', scoreA: 13, scoreB: 7, vainqueurId: 'e2' },
      ];

      const ranking = strategy.getPouleRanking(poule, results);

      expect(ranking[0]).toBe('e1'); // W_M3 = 1er
      expect(ranking[3]).toBe('e4'); // L_M4 = 4e
      // e3 (perdant M3) et e2 (gagnant M4) sont ex-aequo 2e/3e
      expect(ranking.slice(1, 3).sort()).toEqual(['e2', 'e3'].sort());
    });

    it('fallback sur victoires quand pas assez de résultats', () => {
      const strategy = new PoolPhaseStrategy();
      const poule = ['e1', 'e2', 'e3', 'e4'];
      const results = [
        { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
        { matchId: 'm2', equipeAId: 'e3', equipeBId: 'e4', scoreA: 13, scoreB: 5, vainqueurId: 'e3' },
      ];

      const ranking = strategy.getPouleRanking(poule, results);

      // e1 et e3 ont 1V, e2 et e4 ont 0V
      expect(ranking.slice(0, 2).sort()).toEqual(['e1', 'e3'].sort());
      expect(ranking.slice(2).sort()).toEqual(['e2', 'e4'].sort());
    });
  });

  describe('getQualifies', () => {
    it('retourne les 1er et 2e de chaque poule avec pouleIndex et rang', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'],
        matchResults: [
          // Poule A (e1, e3, e5, e7)
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e3', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e5', equipeBId: 'e7', scoreA: 13, scoreB: 5, vainqueurId: 'e5' },
          { matchId: 'm3', equipeAId: 'e1', equipeBId: 'e5', scoreA: 13, scoreB: 10, vainqueurId: 'e1' },
          { matchId: 'm4', equipeAId: 'e3', equipeBId: 'e7', scoreA: 13, scoreB: 7, vainqueurId: 'e3' },
          { matchId: 'm5', equipeAId: 'e5', equipeBId: 'e3', scoreA: 13, scoreB: 9, vainqueurId: 'e5' },
          // Poule B (e2, e4, e6, e8)
          { matchId: 'm6', equipeAId: 'e2', equipeBId: 'e4', scoreA: 13, scoreB: 8, vainqueurId: 'e2' },
          { matchId: 'm7', equipeAId: 'e6', equipeBId: 'e8', scoreA: 13, scoreB: 5, vainqueurId: 'e6' },
          { matchId: 'm8', equipeAId: 'e2', equipeBId: 'e6', scoreA: 13, scoreB: 10, vainqueurId: 'e2' },
          { matchId: 'm9', equipeAId: 'e4', equipeBId: 'e8', scoreA: 13, scoreB: 7, vainqueurId: 'e4' },
          { matchId: 'm10', equipeAId: 'e6', equipeBId: 'e4', scoreA: 13, scoreB: 9, vainqueurId: 'e6' },
        ],
        config: { nbPoules: 2 },
      };

      const qualifies = strategy.getQualifies(context);

      expect(qualifies).toHaveLength(4);
      // Poule 0 : 1er = e1 (W_M3), 2e = e5 (W_M5)
      expect(qualifies[0]).toEqual({ equipeId: 'e1', pouleIndex: 0, rang: 1 });
      expect(qualifies[1]).toEqual({ equipeId: 'e5', pouleIndex: 0, rang: 2 });
      // Poule 1 : 1er = e2 (W_M3), 2e = e6 (W_M5)
      expect(qualifies[2]).toEqual({ equipeId: 'e2', pouleIndex: 1, rang: 1 });
      expect(qualifies[3]).toEqual({ equipeId: 'e6', pouleIndex: 1, rang: 2 });
    });
  });

  describe('buildKoCrossMatchups — croisement KO', () => {
    it('croise 2 poules : 1A vs 2B, 1B vs 2A', () => {
      const qualifies: QualifiedEntry[] = [
        { equipeId: '1A', pouleIndex: 0, rang: 1 },
        { equipeId: '2A', pouleIndex: 0, rang: 2 },
        { equipeId: '1B', pouleIndex: 1, rang: 1 },
        { equipeId: '2B', pouleIndex: 1, rang: 2 },
      ];

      const matchups = buildKoCrossMatchups(qualifies);

      expect(matchups).toHaveLength(2);
      expect(matchups[0]).toEqual({ equipeAId: '1A', equipeBId: '2B' });
      expect(matchups[1]).toEqual({ equipeAId: '1B', equipeBId: '2A' });
    });

    it('croise 4 poules : schéma FIFA', () => {
      const qualifies: QualifiedEntry[] = [
        { equipeId: '1A', pouleIndex: 0, rang: 1 },
        { equipeId: '2A', pouleIndex: 0, rang: 2 },
        { equipeId: '1B', pouleIndex: 1, rang: 1 },
        { equipeId: '2B', pouleIndex: 1, rang: 2 },
        { equipeId: '1C', pouleIndex: 2, rang: 1 },
        { equipeId: '2C', pouleIndex: 2, rang: 2 },
        { equipeId: '1D', pouleIndex: 3, rang: 1 },
        { equipeId: '2D', pouleIndex: 3, rang: 2 },
      ];

      const matchups = buildKoCrossMatchups(qualifies);

      expect(matchups).toHaveLength(4);
      expect(matchups[0]).toEqual({ equipeAId: '1A', equipeBId: '2D' }); // 1A vs 2D
      expect(matchups[1]).toEqual({ equipeAId: '1C', equipeBId: '2B' }); // 1C vs 2B
      expect(matchups[2]).toEqual({ equipeAId: '1B', equipeBId: '2C' }); // 1B vs 2C
      expect(matchups[3]).toEqual({ equipeAId: '1D', equipeBId: '2A' }); // 1D vs 2A
    });

    it('gère 1 seule poule', () => {
      const qualifies: QualifiedEntry[] = [
        { equipeId: '1A', pouleIndex: 0, rang: 1 },
        { equipeId: '2A', pouleIndex: 0, rang: 2 },
      ];

      const matchups = buildKoCrossMatchups(qualifies);

      expect(matchups).toHaveLength(1);
      expect(matchups[0]).toEqual({ equipeAId: '1A', equipeBId: '2A' });
    });
  });
});
