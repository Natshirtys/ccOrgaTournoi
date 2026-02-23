import { DrawStrategy, DrawContext, DrawResult, DrawAssignment } from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';

/**
 * Tirage intégral aléatoire.
 * - Mélange aléatoire de toutes les équipes
 * - Si des poules sont configurées (pouleCount), répartit en poules
 * - Sinon, répartit pour un bracket (complète avec BYEs à la puissance de 2 supérieure)
 * - Respecte les têtes de série si fournies (positionnées en premier)
 */
export class IntegralDrawStrategy implements DrawStrategy {
  constructor(
    private readonly pouleCount?: number,
    private readonly shuffleFn: (arr: EntityId[]) => EntityId[] = defaultShuffle,
  ) {}

  execute(context: DrawContext): DrawResult {
    const { equipeIds, tetesDeSerieIds } = context;

    if (equipeIds.length < 2) {
      throw new Error('Le tirage nécessite au moins 2 équipes');
    }

    // Séparer têtes de série et reste
    const tds = tetesDeSerieIds ?? [];
    const reste = equipeIds.filter((id) => !tds.includes(id));
    const resteShuffled = this.shuffleFn([...reste]);

    if (this.pouleCount && this.pouleCount > 0) {
      return this.repartirEnPoules(tds, resteShuffled, this.pouleCount);
    }

    return this.repartirBracket(tds, resteShuffled);
  }

  /**
   * Répartition en poules avec placement serpentin des têtes de série.
   */
  private repartirEnPoules(
    tds: EntityId[],
    reste: EntityId[],
    nbPoules: number,
  ): DrawResult {
    const assignments: DrawAssignment[] = [];
    let position = 0;

    // Placement serpentin des têtes de série
    for (let i = 0; i < tds.length; i++) {
      const pouleIndex = i % nbPoules;
      assignments.push({
        equipeId: tds[i],
        position: position++,
        pouleIndex,
      });
    }

    // Complétion aléatoire du reste
    let pouleIndex = tds.length % nbPoules;
    let direction = 1; // serpentin : alterne la direction

    for (const equipeId of reste) {
      assignments.push({
        equipeId,
        position: position++,
        pouleIndex,
      });

      pouleIndex += direction;
      if (pouleIndex >= nbPoules) {
        pouleIndex = nbPoules - 1;
        direction = -1;
      } else if (pouleIndex < 0) {
        pouleIndex = 0;
        direction = 1;
      }
    }

    return { assignments, byes: [] };
  }

  /**
   * Répartition pour un bracket d'élimination directe.
   * Complète avec des BYEs pour atteindre la puissance de 2 supérieure.
   * Têtes de série aux positions prédéfinies.
   */
  private repartirBracket(
    tds: EntityId[],
    reste: EntityId[],
  ): DrawResult {
    const totalEquipes = tds.length + reste.length;
    const bracketSize = nextPowerOf2(totalEquipes);

    const assignments: DrawAssignment[] = [];
    const byes: EntityId[] = [];

    // Positions des têtes de série dans le bracket
    // TDS 1 = position 0 (haut), TDS 2 = position dernière (bas)
    // TDS 3-4 = quarts opposés
    const tdsPositions = getTdsPositions(tds.length, bracketSize);

    for (let i = 0; i < tds.length; i++) {
      assignments.push({
        equipeId: tds[i],
        position: tdsPositions[i],
      });
    }

    // Positions restantes pour le reste des équipes + BYEs
    const usedPositions = new Set(tdsPositions);
    const freePositions: number[] = [];
    for (let i = 0; i < bracketSize; i++) {
      if (!usedPositions.has(i)) {
        freePositions.push(i);
      }
    }

    // Placer les équipes restantes
    for (let i = 0; i < reste.length; i++) {
      assignments.push({
        equipeId: reste[i],
        position: freePositions[i],
      });
    }

    // BYEs pour les positions restantes
    for (let i = reste.length; i < freePositions.length; i++) {
      const byeId = `bye-${i - reste.length + 1}`;
      byes.push(byeId);
      assignments.push({
        equipeId: byeId,
        position: freePositions[i],
      });
    }

    return { assignments, byes };
  }
}

/**
 * Retourne la puissance de 2 supérieure ou égale à n.
 */
export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Positions des têtes de série dans un bracket.
 * TDS 1 → position 0 (haut du bracket)
 * TDS 2 → position size-1 (bas du bracket)
 * TDS 3 → position size/2 (milieu-haut)
 * TDS 4 → position size/2-1 (milieu-bas)
 */
function getTdsPositions(count: number, bracketSize: number): number[] {
  if (count === 0) return [];
  const positions: number[] = [0];
  if (count >= 2) positions.push(bracketSize - 1);
  if (count >= 3) positions.push(Math.floor(bracketSize / 2));
  if (count >= 4) positions.push(Math.floor(bracketSize / 2) - 1);
  return positions.slice(0, count);
}

/**
 * Fisher-Yates shuffle.
 */
function defaultShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
