import { describe, it, expect } from 'vitest';
import { GoalAverageTiebreak } from '../../../engine/strategies/tiebreak/goal-average-tiebreak.js';
import { HeadToHeadTiebreak } from '../../../engine/strategies/tiebreak/head-to-head-tiebreak.js';
import { PointsScoredTiebreak } from '../../../engine/strategies/tiebreak/points-scored-tiebreak.js';
import { TiebreakChain } from '../../../engine/strategies/tiebreak/tiebreak-chain.js';
import { RankedEntry, MatchResultEntry } from '../../../engine/strategies/interfaces.js';

function makeRanked(overrides: Partial<RankedEntry> & { equipeId: string; rang: number }): RankedEntry {
  return {
    matchesJoues: 3,
    victoires: 0,
    nuls: 0,
    defaites: 0,
    pointsMarques: 0,
    pointsEncaisses: 0,
    points: 0,
    qualifiee: false,
    ...overrides,
  };
}

describe('GoalAverageTiebreak', () => {
  it('départage par différence de goal average', () => {
    const strategy = new GoalAverageTiebreak();
    const tied: RankedEntry[] = [
      makeRanked({ equipeId: 'e1', rang: 1, pointsMarques: 25, pointsEncaisses: 20 }), // +5
      makeRanked({ equipeId: 'e2', rang: 1, pointsMarques: 30, pointsEncaisses: 15 }), // +15
    ];

    const result = strategy.resolve(tied, []);

    expect(result[0].equipeId).toBe('e2');
    expect(result[0].rang).toBe(1);
    expect(result[1].equipeId).toBe('e1');
    expect(result[1].rang).toBe(2);
  });
});

describe('HeadToHeadTiebreak', () => {
  it('départage par confrontation directe', () => {
    const strategy = new HeadToHeadTiebreak();
    const tied: RankedEntry[] = [
      makeRanked({ equipeId: 'e1', rang: 1, points: 4 }),
      makeRanked({ equipeId: 'e2', rang: 1, points: 4 }),
    ];

    const matches: MatchResultEntry[] = [
      { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
    ];

    const result = strategy.resolve(tied, matches);

    // e1 a battu e2 en confrontation directe
    expect(result[0].equipeId).toBe('e1');
    expect(result[1].equipeId).toBe('e2');
  });

  it('départage 3 équipes par confrontation directe', () => {
    const strategy = new HeadToHeadTiebreak();
    const tied: RankedEntry[] = [
      makeRanked({ equipeId: 'e1', rang: 1, points: 4 }),
      makeRanked({ equipeId: 'e2', rang: 1, points: 4 }),
      makeRanked({ equipeId: 'e3', rang: 1, points: 4 }),
    ];

    const matches: MatchResultEntry[] = [
      { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e2', scoreA: 13, scoreB: 8, vainqueurId: 'e1' },
      { matchId: 'm2', equipeAId: 'e2', equipeBId: 'e3', scoreA: 13, scoreB: 5, vainqueurId: 'e2' },
      { matchId: 'm3', equipeAId: 'e3', equipeBId: 'e1', scoreA: 13, scoreB: 10, vainqueurId: 'e3' },
    ];

    const result = strategy.resolve(tied, matches);

    // Chaque équipe a 1 victoire, départage par GA des confrontations
    // e1: +5 (13-8) -3 (10-13) = marqués 23, encaissés 21, GA +2
    // e2: -5 (8-13) +8 (13-5) = marqués 21, encaissés 18, GA +3
    // e3: -8 (5-13) +3 (13-10) = marqués 18, encaissés 23, GA -5
    expect(result[0].equipeId).toBe('e2'); // GA +3
    expect(result[1].equipeId).toBe('e1'); // GA +2
    expect(result[2].equipeId).toBe('e3'); // GA -5
  });

  it('ignore les matchs contre des équipes hors du groupe à égalité', () => {
    const strategy = new HeadToHeadTiebreak();
    const tied: RankedEntry[] = [
      makeRanked({ equipeId: 'e1', rang: 1 }),
      makeRanked({ equipeId: 'e2', rang: 1 }),
    ];

    const matches: MatchResultEntry[] = [
      { matchId: 'm1', equipeAId: 'e1', equipeBId: 'e3', scoreA: 13, scoreB: 0, vainqueurId: 'e1' },
      { matchId: 'm2', equipeAId: 'e1', equipeBId: 'e2', scoreA: 5, scoreB: 13, vainqueurId: 'e2' },
    ];

    const result = strategy.resolve(tied, matches);

    expect(result[0].equipeId).toBe('e2'); // victoire directe contre e1
  });
});

describe('PointsScoredTiebreak', () => {
  it('départage par points marqués', () => {
    const strategy = new PointsScoredTiebreak();
    const tied: RankedEntry[] = [
      makeRanked({ equipeId: 'e1', rang: 1, pointsMarques: 30 }),
      makeRanked({ equipeId: 'e2', rang: 1, pointsMarques: 45 }),
    ];

    const result = strategy.resolve(tied, []);

    expect(result[0].equipeId).toBe('e2');
    expect(result[1].equipeId).toBe('e1');
  });
});

describe('TiebreakChain', () => {
  it('applique les stratégies en chaîne', () => {
    const chain = new TiebreakChain([
      new GoalAverageTiebreak(),
      new PointsScoredTiebreak(),
    ]);

    // Deux paires à égalité au rang 1 et au rang 3
    const entries: RankedEntry[] = [
      makeRanked({ equipeId: 'e1', rang: 1, pointsMarques: 30, pointsEncaisses: 20 }), // GA +10
      makeRanked({ equipeId: 'e2', rang: 1, pointsMarques: 25, pointsEncaisses: 15 }), // GA +10 aussi
      makeRanked({ equipeId: 'e3', rang: 3, points: 2 }),
    ];

    const result = chain.resolve(entries, []);

    // e1 et e2 ont même GA différence (+10), mais quotient e2 (1.667) > e1 (1.5) → e2 devant
    expect(result[0].equipeId).toBe('e2');
    expect(result[1].equipeId).toBe('e1');
    expect(result[2].equipeId).toBe('e3');
  });

  it('ne touche pas les entrées déjà séparées', () => {
    const chain = new TiebreakChain([new GoalAverageTiebreak()]);

    const entries: RankedEntry[] = [
      makeRanked({ equipeId: 'e1', rang: 1 }),
      makeRanked({ equipeId: 'e2', rang: 2 }),
      makeRanked({ equipeId: 'e3', rang: 3 }),
    ];

    const result = chain.resolve(entries, []);

    expect(result.map((r) => r.equipeId)).toEqual(['e1', 'e2', 'e3']);
  });
});
