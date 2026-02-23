import { RankingStrategy, RankingEntry, RankedEntry } from '../interfaces.js';

/**
 * Classement par points avec départage par goal average puis points marqués.
 *
 * Ordre de tri :
 * 1. Points (décroissant)
 * 2. Goal average différence (décroissant)
 * 3. Goal average quotient (décroissant)
 * 4. Points marqués (décroissant)
 */
export class PointsRankingStrategy implements RankingStrategy {
  constructor(private readonly qualifiesCount: number = 0) {}

  calculate(entries: RankingEntry[]): RankedEntry[] {
    const sorted = [...entries].sort((a, b) => {
      // 1. Points décroissant
      if (b.points !== a.points) return b.points - a.points;

      // 2. Goal average différence
      const gaA = a.pointsMarques - a.pointsEncaisses;
      const gaB = b.pointsMarques - b.pointsEncaisses;
      if (gaB !== gaA) return gaB - gaA;

      // 3. Goal average quotient
      const quotA = a.pointsEncaisses === 0 ? Infinity : a.pointsMarques / a.pointsEncaisses;
      const quotB = b.pointsEncaisses === 0 ? Infinity : b.pointsMarques / b.pointsEncaisses;
      if (quotB !== quotA) {
        if (quotA === Infinity) return -1;
        if (quotB === Infinity) return 1;
        return quotB - quotA;
      }

      // 4. Points marqués
      return b.pointsMarques - a.pointsMarques;
    });

    return sorted.map((entry, index) => ({
      ...entry,
      rang: index + 1,
      qualifiee: this.qualifiesCount > 0 ? index < this.qualifiesCount : false,
    }));
  }
}
