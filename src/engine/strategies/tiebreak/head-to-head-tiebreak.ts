import { TiebreakStrategy, RankedEntry, MatchResultEntry } from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';

/**
 * Départage par confrontation directe.
 * Analyse les matchs entre les équipes à égalité et départage
 * en fonction des résultats de leurs confrontations mutuelles.
 */
export class HeadToHeadTiebreak implements TiebreakStrategy {
  readonly name = 'HEAD_TO_HEAD';

  resolve(tied: RankedEntry[], allMatches: MatchResultEntry[]): RankedEntry[] {
    if (tied.length < 2) return tied;

    const tiedIds = new Set(tied.map((e) => e.equipeId));

    // Construire un mini-classement basé uniquement sur les confrontations directes
    const h2hStats = new Map<EntityId, { wins: number; pointsFor: number; pointsAgainst: number }>();

    for (const entry of tied) {
      h2hStats.set(entry.equipeId, { wins: 0, pointsFor: 0, pointsAgainst: 0 });
    }

    for (const match of allMatches) {
      if (match.equipeAId && match.equipeBId &&
          tiedIds.has(match.equipeAId) && tiedIds.has(match.equipeBId)) {
        const statsA = h2hStats.get(match.equipeAId)!;
        const statsB = h2hStats.get(match.equipeBId)!;

        statsA.pointsFor += match.scoreA;
        statsA.pointsAgainst += match.scoreB;
        statsB.pointsFor += match.scoreB;
        statsB.pointsAgainst += match.scoreA;

        if (match.vainqueurId === match.equipeAId) {
          statsA.wins++;
        } else if (match.vainqueurId === match.equipeBId) {
          statsB.wins++;
        }
      }
    }

    const sorted = [...tied].sort((a, b) => {
      const sa = h2hStats.get(a.equipeId)!;
      const sb = h2hStats.get(b.equipeId)!;

      // Nombre de victoires en confrontation directe
      if (sb.wins !== sa.wins) return sb.wins - sa.wins;

      // Goal average des confrontations directes
      const gaA = sa.pointsFor - sa.pointsAgainst;
      const gaB = sb.pointsFor - sb.pointsAgainst;
      if (gaB !== gaA) return gaB - gaA;

      // Points marqués en confrontation directe
      return sb.pointsFor - sa.pointsFor;
    });

    return sorted.map((entry, index) => ({
      ...entry,
      rang: tied[0].rang + index,
    }));
  }
}
