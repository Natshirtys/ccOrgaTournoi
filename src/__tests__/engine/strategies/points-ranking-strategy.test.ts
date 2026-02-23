import { describe, it, expect } from 'vitest';
import { PointsRankingStrategy } from '../../../engine/strategies/ranking/points-ranking-strategy.js';
import { RankingEntry } from '../../../engine/strategies/interfaces.js';

function makeEntry(overrides: Partial<RankingEntry> & { equipeId: string }): RankingEntry {
  return {
    matchesJoues: 3,
    victoires: 0,
    nuls: 0,
    defaites: 0,
    pointsMarques: 0,
    pointsEncaisses: 0,
    points: 0,
    ...overrides,
  };
}

describe('PointsRankingStrategy', () => {
  it('classe par points décroissant', () => {
    const strategy = new PointsRankingStrategy();
    const entries: RankingEntry[] = [
      makeEntry({ equipeId: 'e1', points: 4 }),
      makeEntry({ equipeId: 'e2', points: 6 }),
      makeEntry({ equipeId: 'e3', points: 2 }),
    ];

    const result = strategy.calculate(entries);

    expect(result[0].equipeId).toBe('e2');
    expect(result[1].equipeId).toBe('e1');
    expect(result[2].equipeId).toBe('e3');
    expect(result.map((r) => r.rang)).toEqual([1, 2, 3]);
  });

  it('départage par goal average différence à points égaux', () => {
    const strategy = new PointsRankingStrategy();
    const entries: RankingEntry[] = [
      makeEntry({ equipeId: 'e1', points: 4, pointsMarques: 30, pointsEncaisses: 25 }), // GA +5
      makeEntry({ equipeId: 'e2', points: 4, pointsMarques: 35, pointsEncaisses: 20 }), // GA +15
      makeEntry({ equipeId: 'e3', points: 4, pointsMarques: 20, pointsEncaisses: 30 }), // GA -10
    ];

    const result = strategy.calculate(entries);

    expect(result[0].equipeId).toBe('e2'); // +15
    expect(result[1].equipeId).toBe('e1'); // +5
    expect(result[2].equipeId).toBe('e3'); // -10
  });

  it('départage par quotient GA si différence égale', () => {
    const strategy = new PointsRankingStrategy();
    const entries: RankingEntry[] = [
      makeEntry({ equipeId: 'e1', points: 4, pointsMarques: 30, pointsEncaisses: 25 }), // GA +5, quotient 1.2
      makeEntry({ equipeId: 'e2', points: 4, pointsMarques: 25, pointsEncaisses: 20 }), // GA +5, quotient 1.25
    ];

    const result = strategy.calculate(entries);

    expect(result[0].equipeId).toBe('e2'); // quotient supérieur
    expect(result[1].equipeId).toBe('e1');
  });

  it('départage par points marqués en dernier recours', () => {
    const strategy = new PointsRankingStrategy();
    const entries: RankingEntry[] = [
      makeEntry({ equipeId: 'e1', points: 4, pointsMarques: 30, pointsEncaisses: 20 }), // GA +10, q 1.5
      makeEntry({ equipeId: 'e2', points: 4, pointsMarques: 40, pointsEncaisses: 30 }), // GA +10, q 1.333
    ];

    const result = strategy.calculate(entries);

    // GA différence identique (+10), quotient : e1=1.5 > e2=1.333
    expect(result[0].equipeId).toBe('e1');
  });

  it('marque les qualifiés correctement', () => {
    const strategy = new PointsRankingStrategy(2);
    const entries: RankingEntry[] = [
      makeEntry({ equipeId: 'e1', points: 6 }),
      makeEntry({ equipeId: 'e2', points: 4 }),
      makeEntry({ equipeId: 'e3', points: 2 }),
      makeEntry({ equipeId: 'e4', points: 0 }),
    ];

    const result = strategy.calculate(entries);

    expect(result[0].qualifiee).toBe(true);
    expect(result[1].qualifiee).toBe(true);
    expect(result[2].qualifiee).toBe(false);
    expect(result[3].qualifiee).toBe(false);
  });

  it('gère le cas quotient infini (0 points encaissés)', () => {
    const strategy = new PointsRankingStrategy();
    const entries: RankingEntry[] = [
      makeEntry({ equipeId: 'e1', points: 4, pointsMarques: 30, pointsEncaisses: 0 }),
      makeEntry({ equipeId: 'e2', points: 4, pointsMarques: 25, pointsEncaisses: 0 }),
    ];

    const result = strategy.calculate(entries);

    // Même quotient Infinity, départage par points marqués
    expect(result[0].equipeId).toBe('e1');
    expect(result[1].equipeId).toBe('e2');
  });
});
