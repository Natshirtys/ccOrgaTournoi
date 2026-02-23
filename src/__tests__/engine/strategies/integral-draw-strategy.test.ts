import { describe, it, expect } from 'vitest';
import { IntegralDrawStrategy, nextPowerOf2 } from '../../../engine/strategies/draw/integral-draw-strategy.js';
import { DrawContext, DrawConstraints } from '../../../engine/strategies/interfaces.js';

const noConstraints: DrawConstraints = {
  protectionClub: false,
  clubsByEquipe: new Map(),
};

// Shuffle déterministe pour les tests : ne fait rien (garde l'ordre)
const identityShuffle = <T>(arr: T[]): T[] => arr;

describe('IntegralDrawStrategy', () => {
  describe('nextPowerOf2', () => {
    it('retourne la puissance de 2 supérieure ou égale', () => {
      expect(nextPowerOf2(1)).toBe(1);
      expect(nextPowerOf2(2)).toBe(2);
      expect(nextPowerOf2(3)).toBe(4);
      expect(nextPowerOf2(4)).toBe(4);
      expect(nextPowerOf2(5)).toBe(8);
      expect(nextPowerOf2(8)).toBe(8);
      expect(nextPowerOf2(9)).toBe(16);
      expect(nextPowerOf2(16)).toBe(16);
      expect(nextPowerOf2(17)).toBe(32);
    });
  });

  describe('mode bracket (élimination directe)', () => {
    it('place toutes les équipes quand le nombre est une puissance de 2', () => {
      const strategy = new IntegralDrawStrategy(undefined, identityShuffle);
      const context: DrawContext = {
        equipeIds: ['e1', 'e2', 'e3', 'e4'],
        constraints: noConstraints,
      };

      const result = strategy.execute(context);

      expect(result.assignments).toHaveLength(4);
      expect(result.byes).toHaveLength(0);
      expect(result.assignments.map((a) => a.equipeId)).toEqual(
        expect.arrayContaining(['e1', 'e2', 'e3', 'e4']),
      );
    });

    it('ajoute des BYEs quand le nombre n\'est pas une puissance de 2', () => {
      const strategy = new IntegralDrawStrategy(undefined, identityShuffle);
      const context: DrawContext = {
        equipeIds: ['e1', 'e2', 'e3'],
        constraints: noConstraints,
      };

      const result = strategy.execute(context);

      // 3 équipes → bracket de 4 → 1 BYE
      expect(result.assignments).toHaveLength(4);
      expect(result.byes).toHaveLength(1);
    });

    it('place les têtes de série aux bonnes positions', () => {
      const strategy = new IntegralDrawStrategy(undefined, identityShuffle);
      const context: DrawContext = {
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'tds1', 'tds2'],
        constraints: noConstraints,
        tetesDeSerieIds: ['tds1', 'tds2'],
      };

      const result = strategy.execute(context);

      const tds1 = result.assignments.find((a) => a.equipeId === 'tds1');
      const tds2 = result.assignments.find((a) => a.equipeId === 'tds2');

      // TDS1 en position 0 (haut), TDS2 en dernière position (bas)
      expect(tds1?.position).toBe(0);
      // bracket de 8 → position 7
      expect(tds2?.position).toBe(7);
    });

    it('rejette moins de 2 équipes', () => {
      const strategy = new IntegralDrawStrategy(undefined, identityShuffle);
      const context: DrawContext = {
        equipeIds: ['e1'],
        constraints: noConstraints,
      };

      expect(() => strategy.execute(context)).toThrow('au moins 2 équipes');
    });

    it('gère 5 équipes avec BYEs', () => {
      const strategy = new IntegralDrawStrategy(undefined, identityShuffle);
      const context: DrawContext = {
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'e5'],
        constraints: noConstraints,
      };

      const result = strategy.execute(context);

      // 5 → bracket 8, 3 BYEs
      expect(result.assignments).toHaveLength(8);
      expect(result.byes).toHaveLength(3);
    });
  });

  describe('mode poules', () => {
    it('répartit les équipes dans le bon nombre de poules', () => {
      const strategy = new IntegralDrawStrategy(2, identityShuffle);
      const context: DrawContext = {
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'],
        constraints: noConstraints,
      };

      const result = strategy.execute(context);

      expect(result.assignments).toHaveLength(6);
      expect(result.byes).toHaveLength(0);

      // Vérifier que les pouleIndex sont 0 ou 1
      const poules = new Set(result.assignments.map((a) => a.pouleIndex));
      expect(poules.size).toBe(2);
    });

    it('place les têtes de série dans des poules différentes', () => {
      const strategy = new IntegralDrawStrategy(3, identityShuffle);
      const context: DrawContext = {
        equipeIds: ['tds1', 'tds2', 'tds3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9'],
        constraints: noConstraints,
        tetesDeSerieIds: ['tds1', 'tds2', 'tds3'],
      };

      const result = strategy.execute(context);

      const tds1Poule = result.assignments.find((a) => a.equipeId === 'tds1')?.pouleIndex;
      const tds2Poule = result.assignments.find((a) => a.equipeId === 'tds2')?.pouleIndex;
      const tds3Poule = result.assignments.find((a) => a.equipeId === 'tds3')?.pouleIndex;

      // Chaque TDS dans une poule différente
      expect(new Set([tds1Poule, tds2Poule, tds3Poule]).size).toBe(3);
    });

    it('répartit équitablement avec un nombre inégal', () => {
      const strategy = new IntegralDrawStrategy(3, identityShuffle);
      const context: DrawContext = {
        equipeIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'],
        constraints: noConstraints,
      };

      const result = strategy.execute(context);

      // Compter les équipes par poule
      const pouleCounts = new Map<number, number>();
      for (const a of result.assignments) {
        const idx = a.pouleIndex ?? 0;
        pouleCounts.set(idx, (pouleCounts.get(idx) ?? 0) + 1);
      }

      // Avec 7 équipes en 3 poules : 3, 2, 2 ou similaire
      const counts = Array.from(pouleCounts.values()).sort();
      expect(counts.reduce((a, b) => a + b, 0)).toBe(7);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    });
  });
});
