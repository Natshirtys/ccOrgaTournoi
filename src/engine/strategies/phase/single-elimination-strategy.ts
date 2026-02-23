import {
  PhaseStrategy,
  PhaseContext,
  TourGeneration,
  Matchup,
} from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';
import { nextPowerOf2 } from '../draw/integral-draw-strategy.js';

/**
 * Phase d'élimination directe (Simple KO).
 *
 * - Le premier tour est généré à partir des équipes (ou des positions du tirage)
 * - Les tours suivants sont générés à partir des vainqueurs du tour précédent
 * - La phase est complète quand il ne reste qu'un vainqueur (la finale est jouée)
 */
export class SingleEliminationStrategy implements PhaseStrategy {
  generateTours(context: PhaseContext): TourGeneration[] {
    const { equipeIds, matchResults } = context;

    if (equipeIds.length < 2) {
      throw new Error("L'élimination directe nécessite au moins 2 équipes");
    }

    const tours: TourGeneration[] = [];

    // Tour 1 : appariement initial
    if (matchResults.length === 0) {
      const matchups = this.generateFirstRound(equipeIds);
      tours.push({ numero: 1, matchups });
      return tours;
    }

    // Reconstituer la progression tour par tour
    let currentEquipes = equipeIds;
    let tourNumero = 1;
    let matchIndex = 0;

    while (currentEquipes.length > 1) {
      const matchups = this.pairEquipes(currentEquipes);
      tours.push({ numero: tourNumero, matchups });

      // Déterminer les vainqueurs de ce tour
      const winners: EntityId[] = [];
      for (const matchup of matchups) {
        if (matchup.equipeBId === null) {
          // BYE : l'équipe avance directement
          winners.push(matchup.equipeAId);
          continue;
        }

        // Chercher le résultat correspondant
        const result = this.findResult(matchup, matchResults, matchIndex);
        if (result) {
          if (result.vainqueurId) {
            winners.push(result.vainqueurId);
          } else {
            // Match pas encore décidé — on s'arrête ici
            return tours;
          }
          matchIndex++;
        } else {
          // Match pas encore joué — on s'arrête ici
          return tours;
        }
      }

      currentEquipes = winners;
      tourNumero++;
    }

    return tours;
  }

  isPhaseComplete(context: PhaseContext): boolean {
    const { equipeIds, matchResults } = context;

    // Nombre total de matchs nécessaires = n-1 (pour n équipes, hors BYEs)
    const bracketSize = nextPowerOf2(equipeIds.length);
    const nbByes = bracketSize - equipeIds.length;
    const totalMatchesNeeded = bracketSize - 1 - nbByes;

    const completedMatches = matchResults.filter((r) => r.vainqueurId !== null).length;
    return completedMatches >= totalMatchesNeeded;
  }

  private generateFirstRound(equipeIds: EntityId[]): Matchup[] {
    return this.pairEquipes(equipeIds);
  }

  private pairEquipes(equipeIds: EntityId[]): Matchup[] {
    const matchups: Matchup[] = [];

    for (let i = 0; i < equipeIds.length - 1; i += 2) {
      matchups.push({
        equipeAId: equipeIds[i],
        equipeBId: equipeIds[i + 1],
      });
    }

    // BYE si nombre impair
    if (equipeIds.length % 2 !== 0) {
      matchups.push({
        equipeAId: equipeIds[equipeIds.length - 1],
        equipeBId: null,
      });
    }

    return matchups;
  }

  private findResult(
    matchup: Matchup,
    matchResults: PhaseContext['matchResults'],
    _startIndex: number,
  ) {
    return matchResults.find(
      (r) =>
        (r.equipeAId === matchup.equipeAId && r.equipeBId === matchup.equipeBId) ||
        (r.equipeAId === matchup.equipeBId && r.equipeBId === matchup.equipeAId),
    );
  }
}
