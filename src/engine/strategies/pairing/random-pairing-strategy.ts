import { PairingStrategy, PairingContext, Matchup } from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';

/**
 * Appariement aléatoire des équipes.
 * - Mélange aléatoire puis appariement 2 par 2
 * - Si nombre impair, la dernière équipe reçoit un BYE (null)
 * - Vérifie qu'on n'a pas déjà eu ces confrontations si possible
 */
export class RandomPairingStrategy implements PairingStrategy {
  constructor(
    private readonly shuffleFn: (arr: EntityId[]) => EntityId[] = defaultShuffle,
  ) {}

  pair(context: PairingContext): Matchup[] {
    const { equipeIds, previousMatchups } = context;

    // Essayer de trouver un appariement sans répétition
    const shuffled = this.shuffleFn([...equipeIds]);
    const paired = this.tryPairing(shuffled, previousMatchups);

    if (paired) return paired;

    // Fallback : appariement simple sans vérification de répétition
    return this.simplePairing(shuffled);
  }

  private tryPairing(
    equipes: EntityId[],
    previousMatchups: Set<string>,
    maxAttempts: number = 10,
  ): Matchup[] | null {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const shuffled = attempt === 0 ? equipes : this.shuffleFn([...equipes]);
      const matchups: Matchup[] = [];
      let valid = true;

      for (let i = 0; i < shuffled.length - 1; i += 2) {
        const key = matchupKey(shuffled[i], shuffled[i + 1]);
        if (previousMatchups.has(key)) {
          valid = false;
          break;
        }
        matchups.push({ equipeAId: shuffled[i], equipeBId: shuffled[i + 1] });
      }

      if (!valid) continue;

      // BYE pour nombre impair
      if (shuffled.length % 2 !== 0) {
        matchups.push({ equipeAId: shuffled[shuffled.length - 1], equipeBId: null });
      }

      return matchups;
    }

    return null;
  }

  private simplePairing(equipes: EntityId[]): Matchup[] {
    const matchups: Matchup[] = [];
    for (let i = 0; i < equipes.length - 1; i += 2) {
      matchups.push({ equipeAId: equipes[i], equipeBId: equipes[i + 1] });
    }
    if (equipes.length % 2 !== 0) {
      matchups.push({ equipeAId: equipes[equipes.length - 1], equipeBId: null });
    }
    return matchups;
  }
}

export function matchupKey(a: EntityId, b: EntityId): string {
  return [a, b].sort().join(':');
}

function defaultShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
