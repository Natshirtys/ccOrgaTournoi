import { describe, expect, it } from 'vitest';
import { PosteMelee } from '../../../domain/shared/enums.js';
import { generateFixedMeleeTeams, generateRotatingMeleeRound, pairFixedMeleeTeams, validateMeleePlayerCount } from '../../../engine/strategies/melee/melee-scheduler.js';

function seededRandom(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const players = Array.from({ length: 8 }, (_, index) => ({
  id: `p${index + 1}`,
  poste: index % 2 === 0 ? PosteMelee.POINTEUR : PosteMelee.TIREUR,
}));

describe('MeleeScheduler', () => {
  it('refuse un nombre de joueurs ne permettant pas des matchs complets', () => {
    expect(() => validateMeleePlayerCount(6, 2)).toThrow('multiple de 4');
    expect(() => validateMeleePlayerCount(12, 3)).not.toThrow();
  });

  it('forme des doublettes équilibrées avec un pointeur et un tireur', () => {
    const teams = generateFixedMeleeTeams(players, 2, seededRandom());
    expect(teams).toHaveLength(4);
    for (const team of teams) {
      const roles = team.map((id) => players.find((player) => player.id === id)?.poste);
      expect(roles).toContain(PosteMelee.POINTEUR);
      expect(roles).toContain(PosteMelee.TIREUR);
    }
  });

  it('recompose les équipes en évitant les partenaires déjà rencontrés', () => {
    const first = generateRotatingMeleeRound(players, 2, [], seededRandom(1));
    const second = generateRotatingMeleeRound(players, 2, first, seededRandom(2));
    const oldPairs = new Set(first.flatMap((match) => [match.equipeA, match.equipeB]).map((team) => [...team].sort().join('|')));
    const newPairs = second.flatMap((match) => [match.equipeA, match.equipeB]).map((team) => [...team].sort().join('|'));
    expect(newPairs.every((pair) => !oldPairs.has(pair))).toBe(true);
  });

  it('privilégie les postes équilibrés même si tous les binômes équilibrés ont déjà joué ensemble', () => {
    const fourPlayers = players.slice(0, 4);
    const history = [
      { equipeA: ['p1', 'p2'], equipeB: ['p3', 'p4'] },
      { equipeA: ['p1', 'p4'], equipeB: ['p3', 'p2'] },
    ];

    const round = generateRotatingMeleeRound(fourPlayers, 2, history, seededRandom(12));

    for (const team of round.flatMap((match) => [match.equipeA, match.equipeB])) {
      const roles = team.map((id) => fourPlayers.find((player) => player.id === id)?.poste);
      expect(roles).toContain(PosteMelee.POINTEUR);
      expect(roles).toContain(PosteMelee.TIREUR);
    }
  });

  it('conserve les équipes de la mêlée classique entre les parties', () => {
    const teams = generateFixedMeleeTeams(players, 2, seededRandom());
    const first = pairFixedMeleeTeams(teams, [], false, seededRandom(3));
    const second = pairFixedMeleeTeams(teams, first, false, seededRandom(4));
    const expected = new Set(teams.map((team) => [...team].sort().join('|')));
    for (const match of second) {
      expect(expected.has([...match.equipeA].sort().join('|'))).toBe(true);
      expect(expected.has([...match.equipeB].sort().join('|'))).toBe(true);
    }
  });
});
