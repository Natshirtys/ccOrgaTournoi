import {
  PhaseStrategy,
  PhaseContext,
  TourGeneration,
  Matchup,
  MatchResultEntry,
} from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';
import { nextPowerOf2 } from '../draw/integral-draw-strategy.js';
import { getRoundName } from './single-elimination-strategy.js';

/**
 * Phase complémentaire (consolation bracket).
 *
 * Reçoit les perdants du 1er tour du bracket principal
 * et construit un bracket KO identique à SingleElimination.
 */
export class ComplementaireStrategy implements PhaseStrategy {
  generateTours(context: PhaseContext): TourGeneration[] {
    const { equipeIds } = context;

    if (equipeIds.length < 2) {
      throw new Error('La complémentaire nécessite au moins 2 équipes');
    }

    const matchups = this.pairEquipes(equipeIds);
    const bracketSize = nextPowerOf2(equipeIds.length);
    const totalRounds = Math.log2(bracketSize);
    const roundName = 'Consolante — ' + getRoundName(bracketSize, 1, totalRounds);

    return [{ numero: 1, matchups, nom: roundName }];
  }

  generateNextTour(context: PhaseContext, currentTourNumero: number): TourGeneration | null {
    const { equipeIds, matchResults } = context;
    const bracketSize = nextPowerOf2(equipeIds.length);
    const totalRounds = Math.log2(bracketSize);

    if (currentTourNumero >= totalRounds) return null;

    // Reconstituer les vainqueurs tour par tour
    let currentEquipes = equipeIds;
    for (let tour = 1; tour <= currentTourNumero; tour++) {
      const tourMatchups = this.pairEquipes(currentEquipes);
      const winners: EntityId[] = [];

      for (const matchup of tourMatchups) {
        if (matchup.equipeBId === null) {
          winners.push(matchup.equipeAId);
          continue;
        }
        const result = findMatchResult(matchup, matchResults);
        if (result?.vainqueurId) {
          winners.push(result.vainqueurId);
        } else {
          return null;
        }
      }

      currentEquipes = winners;
    }

    if (currentEquipes.length < 2) return null;

    const matchups = this.pairEquipes(currentEquipes);
    const roundName = 'Consolante — ' + getRoundName(bracketSize, currentTourNumero + 1, totalRounds);

    return { numero: currentTourNumero + 1, matchups, nom: roundName };
  }

  isPhaseComplete(context: PhaseContext): boolean {
    const { equipeIds, matchResults } = context;
    const bracketSize = nextPowerOf2(equipeIds.length);
    const nbByes = bracketSize - equipeIds.length;
    const totalMatchesNeeded = bracketSize - 1 - nbByes;
    const completedMatches = matchResults.filter((r) => r.vainqueurId !== null).length;
    return completedMatches >= totalMatchesNeeded;
  }

  private pairEquipes(equipeIds: EntityId[]): Matchup[] {
    const matchups: Matchup[] = [];

    for (let i = 0; i < equipeIds.length - 1; i += 2) {
      matchups.push({
        equipeAId: equipeIds[i],
        equipeBId: equipeIds[i + 1],
      });
    }

    if (equipeIds.length % 2 !== 0) {
      matchups.push({
        equipeAId: equipeIds[equipeIds.length - 1],
        equipeBId: null,
      });
    }

    return matchups;
  }
}

function findMatchResult(matchup: Matchup, matchResults: MatchResultEntry[]): MatchResultEntry | undefined {
  return matchResults.find(
    (r) =>
      (r.equipeAId === matchup.equipeAId && r.equipeBId === matchup.equipeBId) ||
      (r.equipeAId === matchup.equipeBId && r.equipeBId === matchup.equipeAId),
  );
}
