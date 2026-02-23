import { describe, it, expect } from 'vitest';
import { PoolPhaseStrategy } from '../../../engine/strategies/phase/pool-phase-strategy.js';
import { PhaseContext } from '../../../engine/strategies/interfaces.js';

describe('PoolPhaseStrategy', () => {
  describe('generateTours', () => {
    it('génère le round-robin pour une poule de 4', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        matchResults: [],
        config: { nbPoules: 1 },
      };

      const tours = strategy.generateTours(context);

      // 4 équipes = 3 tours
      expect(tours).toHaveLength(3);

      // Chaque tour a 2 matchs
      for (const tour of tours) {
        expect(tour.matchups).toHaveLength(2);
      }

      // Total : 6 matchups (4*3/2)
      const totalMatchups = tours.reduce((sum, t) => sum + t.matchups.length, 0);
      expect(totalMatchups).toBe(6);

      // Chaque paire d'équipes se rencontre exactement une fois
      const pairSet = new Set<string>();
      for (const tour of tours) {
        for (const m of tour.matchups) {
          if (m.equipeBId) {
            const key = [m.equipeAId, m.equipeBId].sort().join(':');
            expect(pairSet.has(key)).toBe(false);
            pairSet.add(key);
          }
        }
      }
      expect(pairSet.size).toBe(6);
    });

    it('génère le round-robin pour une poule de 3 (avec BYE)', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3'],
        matchResults: [],
        config: { nbPoules: 1 },
      };

      const tours = strategy.generateTours(context);

      // 3 équipes → 4 avec fantôme → 3 tours
      expect(tours).toHaveLength(3);

      // Compter les vrais matchs (pas BYE)
      let realMatches = 0;
      let byeMatches = 0;
      for (const tour of tours) {
        for (const m of tour.matchups) {
          if (m.equipeBId === null) {
            byeMatches++;
          } else {
            realMatches++;
          }
        }
      }

      // 3 vrais matchs (3*2/2) + 3 BYEs
      expect(realMatches).toBe(3);
      expect(byeMatches).toBe(3);
    });

    it('génère les tours pour 2 poules séparées', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'],
        matchResults: [],
        config: { nbPoules: 2 },
      };

      const tours = strategy.generateTours(context);

      // 3 équipes par poule → 2 tours (avec fantôme)
      // Les matchups de chaque tour incluent les 2 poules
      expect(tours.length).toBeGreaterThanOrEqual(2);

      // Vérifier que les équipes de poules différentes ne se rencontrent pas
      // Poule 0: e1, e3, e5 | Poule 1: e2, e4, e6 (répartition round-robin)
      for (const tour of tours) {
        for (const m of tour.matchups) {
          if (m.equipeBId) {
            // Les deux équipes doivent être dans la même poule
            const idxA = context.equipeIds.indexOf(m.equipeAId);
            const idxB = context.equipeIds.indexOf(m.equipeBId);
            expect(idxA % 2).toBe(idxB % 2);
          }
        }
      }
    });

    it('rejette si aucune poule n\'est configurée avec 0 poules', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: [],
        matchResults: [],
        config: { nbPoules: 0 },
      };

      // Poules vides → erreur
      expect(() => strategy.generateTours(context)).toThrow();
    });
  });

  describe('isPhaseComplete', () => {
    it('retourne false quand aucun match n\'est joué', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3'],
        matchResults: [],
        config: { nbPoules: 1 },
      };

      expect(strategy.isPhaseComplete(context)).toBe(false);
    });

    it('retourne true quand tous les matchs sont joués', () => {
      const strategy = new PoolPhaseStrategy();
      const context: PhaseContext = {
        phaseId: 'phase-1',
        equipeIds: ['e1', 'e2', 'e3'],
        matchResults: [
          { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
          { matchId: 'm2', equipeAId: 'e1', equipeBId: 'e3', scoreA: 13, scoreB: 5, vainqueurId: 'e1' },
          { matchId: 'm3', equipeAId: 'e2', equipeBId: 'e3', scoreA: 13, scoreB: 10, vainqueurId: 'e2' },
        ],
        config: { nbPoules: 1 },
      };

      expect(strategy.isPhaseComplete(context)).toBe(true);
    });
  });
});
