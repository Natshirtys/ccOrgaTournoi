import { TiebreakStrategy, RankedEntry, MatchResultEntry } from '../interfaces.js';

/**
 * Départage par nombre total de points marqués (décroissant).
 */
export class PointsScoredTiebreak implements TiebreakStrategy {
  readonly name = 'POINTS_SCORED';

  resolve(tied: RankedEntry[], _allMatches: MatchResultEntry[]): RankedEntry[] {
    const sorted = [...tied].sort((a, b) => b.pointsMarques - a.pointsMarques);

    return sorted.map((entry, index) => ({
      ...entry,
      rang: tied[0].rang + index,
    }));
  }
}
