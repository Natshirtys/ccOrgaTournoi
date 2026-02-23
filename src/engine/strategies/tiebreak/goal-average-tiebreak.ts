import { TiebreakStrategy, RankedEntry, MatchResultEntry } from '../interfaces.js';

/**
 * Départage par goal average (différence puis quotient).
 * Recalcule le GA uniquement entre les équipes à égalité.
 */
export class GoalAverageTiebreak implements TiebreakStrategy {
  readonly name = 'GOAL_AVERAGE';

  resolve(tied: RankedEntry[], _allMatches: MatchResultEntry[]): RankedEntry[] {
    const sorted = [...tied].sort((a, b) => {
      // Différence de GA
      const gaA = a.pointsMarques - a.pointsEncaisses;
      const gaB = b.pointsMarques - b.pointsEncaisses;
      if (gaB !== gaA) return gaB - gaA;

      // Quotient
      const quotA = a.pointsEncaisses === 0 ? Infinity : a.pointsMarques / a.pointsEncaisses;
      const quotB = b.pointsEncaisses === 0 ? Infinity : b.pointsMarques / b.pointsEncaisses;
      if (quotA === Infinity && quotB === Infinity) return 0;
      if (quotA === Infinity) return -1;
      if (quotB === Infinity) return 1;
      return quotB - quotA;
    });

    return sorted.map((entry, index) => ({
      ...entry,
      rang: tied[0].rang + index,
    }));
  }
}
