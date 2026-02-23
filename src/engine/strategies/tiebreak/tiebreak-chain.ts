import { TiebreakStrategy, RankedEntry, MatchResultEntry } from '../interfaces.js';

/**
 * Chaîne de départage : applique les stratégies de départage séquentiellement.
 * Si un groupe reste à égalité après une stratégie, on passe à la suivante.
 */
export class TiebreakChain {
  constructor(private readonly strategies: TiebreakStrategy[]) {}

  resolve(entries: RankedEntry[], allMatches: MatchResultEntry[]): RankedEntry[] {
    // Grouper les entrées par rang (= celles à égalité)
    const groups = groupByRang(entries);
    const result: RankedEntry[] = [];

    for (const group of groups) {
      if (group.length <= 1) {
        result.push(...group);
        continue;
      }

      // Appliquer les stratégies de départage séquentiellement
      let resolved = group;
      for (const strategy of this.strategies) {
        resolved = strategy.resolve(resolved, allMatches);

        // Si tout le monde a un rang différent, c'est résolu
        const rangs = new Set(resolved.map((e) => e.rang));
        if (rangs.size === resolved.length) break;
      }

      result.push(...resolved);
    }

    return result;
  }
}

function groupByRang(entries: RankedEntry[]): RankedEntry[][] {
  const groups = new Map<number, RankedEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.rang) ?? [];
    group.push(entry);
    groups.set(entry.rang, group);
  }
  return Array.from(groups.values());
}
