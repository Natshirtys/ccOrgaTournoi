import {
  PhaseStrategy,
  PhaseContext,
  TourGeneration,
  MatchResultEntry,
  DrawAssignment,
  QualifiedEntry,
} from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';
import { assignmentsToPoules } from './pool-phase-strategy.js';

/**
 * Phase de poules Round Robin : 6 matchs par poule de 4 (3 tours fixes).
 *
 * - Tour 1 : A-B, C-D
 * - Tour 2 : A-C, B-D
 * - Tour 3 : A-D, B-C
 *
 * Classement par 4 critères :
 *   1. Points (V=2, D=0)
 *   2. Différence de score (marqués - encaissés)
 *   3. Confrontation directe (si exactement 2 équipes ex-aequo)
 *   4. Score marqué total
 *
 * Les 3 premiers de chaque poule sont qualifiés (4e éliminé).
 * Utilisé pour le format CHAMPIONNAT (poules de 4 + 3 tableaux KO).
 */
export class RoundRobinPoolStrategy implements PhaseStrategy {
  constructor(private readonly pouleAssignments?: DrawAssignment[]) {}

  generateTours(context: PhaseContext): TourGeneration[] {
    const poules = this.getPoules(context);

    if (poules.length === 0) {
      throw new Error('Aucune poule configurée');
    }
    for (const poule of poules) {
      if (poule.length !== 4) {
        throw new Error(`Chaque poule doit contenir exactement 4 équipes (trouvé ${poule.length})`);
      }
    }

    // Tour 1 : A-B, C-D
    // Tour 2 : A-C, B-D
    // Tour 3 : A-D, B-C
    const tourDefs: Array<{ nom: string; pairs: [number, number][] }> = [
      { nom: 'Tour 1 — A-B / C-D', pairs: [[0, 1], [2, 3]] },
      { nom: 'Tour 2 — A-C / B-D', pairs: [[0, 2], [1, 3]] },
      { nom: 'Tour 3 — A-D / B-C', pairs: [[0, 3], [1, 2]] },
    ];

    return tourDefs.map((def, idx) => ({
      numero: idx + 1,
      nom: def.nom,
      matchups: poules.flatMap((poule) =>
        def.pairs.map(([i, j]) => ({
          equipeAId: poule[i],
          equipeBId: poule[j],
        })),
      ),
    }));
  }

  isPhaseComplete(context: PhaseContext): boolean {
    const poules = this.getPoules(context);
    const totalExpected = poules.length * 6;
    const completed = context.matchResults.filter((r) => r.vainqueurId !== null).length;
    return completed >= totalExpected;
  }

  /**
   * Retourne les 3 premiers de chaque poule (rang 1, 2, 3).
   * Le 4e est éliminé.
   */
  getQualifies(context: PhaseContext): QualifiedEntry[] {
    const poules = this.getPoules(context);
    const qualifies: QualifiedEntry[] = [];
    for (let i = 0; i < poules.length; i++) {
      const ranking = this.computeClassement(poules[i], context.matchResults);
      for (let rang = 0; rang < 3 && rang < ranking.length; rang++) {
        qualifies.push({ equipeId: ranking[rang], pouleIndex: i, rang: rang + 1 });
      }
    }
    return qualifies;
  }

  getPoules(context: PhaseContext): EntityId[][] {
    if (this.pouleAssignments && this.pouleAssignments.length > 0) {
      return assignmentsToPoules(this.pouleAssignments);
    }

    const { equipeIds, config } = context;
    const nbPoules = config.nbPoules ?? 1;
    const poules: EntityId[][] = Array.from({ length: nbPoules }, () => []);
    for (let i = 0; i < equipeIds.length; i++) {
      poules[i % nbPoules].push(equipeIds[i]);
    }
    return poules;
  }

  /**
   * Classement d'une poule selon 4 critères :
   * 1. Points (V=2, D=0)
   * 2. Différence de score (marqués - encaissés)
   * 3. Confrontation directe (si EXACTEMENT 2 équipes ex-aequo après critères 1+2)
   * 4. Score marqué total (appliqué si 3+ équipes encore ex-aequo après critères 1+2)
   *
   * Algorithme multi-passes pour respecter "exactement 2 ex-aequo" :
   * - Tri initial par points → diff → score marqué
   * - Détection des groupes ex-aequo sur points+diff
   * - Pour un groupe de taille 2 : application de la confrontation directe
   * - Pour un groupe de taille 3+ : le score marqué (déjà appliqué) fait office de critère 4
   */
  computeClassement(poule: EntityId[], results: MatchResultEntry[]): EntityId[] {
    const pouleResults = results.filter(
      (r) => poule.includes(r.equipeAId) && r.equipeBId !== null && poule.includes(r.equipeBId),
    );

    type Stats = { points: number; diff: number; marques: number };
    const stats = new Map<EntityId, Stats>();
    for (const eq of poule) {
      stats.set(eq, { points: 0, diff: 0, marques: 0 });
    }

    for (const r of pouleResults) {
      const sA = stats.get(r.equipeAId)!;
      const sB = stats.get(r.equipeBId!)!;

      sA.marques += r.scoreA;
      sA.diff += r.scoreA - r.scoreB;
      sB.marques += r.scoreB;
      sB.diff += r.scoreB - r.scoreA;

      if (r.vainqueurId === r.equipeAId) {
        sA.points += 2;
      } else if (r.vainqueurId === r.equipeBId) {
        sB.points += 2;
      }
    }

    // Passe 1 : tri par points → diff → score marqué
    const ranked = [...poule].sort((a, b) => {
      const sa = stats.get(a)!;
      const sb = stats.get(b)!;
      if (sb.points !== sa.points) return sb.points - sa.points;
      if (sb.diff !== sa.diff) return sb.diff - sa.diff;
      return sb.marques - sa.marques;
    });

    // Passe 2 : pour chaque groupe de EXACTEMENT 2 équipes ex-aequo (points+diff identiques),
    // appliquer la confrontation directe pour potentiellement inverser l'ordre
    let i = 0;
    while (i < ranked.length) {
      // Trouver la fin du groupe avec mêmes points+diff
      let j = i + 1;
      while (j < ranked.length) {
        const si = stats.get(ranked[i])!;
        const sj = stats.get(ranked[j])!;
        if (si.points !== sj.points || si.diff !== sj.diff) break;
        j++;
      }

      // Si exactement 2 équipes dans ce groupe → appliquer confrontation directe
      if (j - i === 2) {
        const teamA = ranked[i];
        const teamB = ranked[i + 1];
        const direct = pouleResults.find(
          (r) =>
            (r.equipeAId === teamA && r.equipeBId === teamB) ||
            (r.equipeAId === teamB && r.equipeBId === teamA),
        );
        // Si le vainqueur direct est teamB (actuellement 2e), on inverse
        if (direct?.vainqueurId === teamB) {
          ranked[i] = teamB;
          ranked[i + 1] = teamA;
        }
        // Si vainqueur === teamA ou pas de résultat : ordre inchangé (score marqué déjà appliqué)
      }
      // Si 3+ équipes ex-aequo : critère 4 (score marqué) déjà appliqué en passe 1 → rien à faire

      i = j;
    }

    return ranked;
  }
}

/**
 * Appariements symétriques pour les phases KO du CHAMPIONNAT.
 * Poule 0 vs Poule 1, Poule 2 vs Poule 3, etc.
 * Fonctionne pour 2, 4, 8, 16 poules.
 */
export function buildSymmetricKoMatchups(
  qualifies: QualifiedEntry[],
  rang: number,
): Array<{ equipeAId: EntityId; equipeBId: EntityId | null }> {
  const qualified = qualifies
    .filter((q) => q.rang === rang)
    .sort((a, b) => a.pouleIndex - b.pouleIndex);

  const matchups: Array<{ equipeAId: EntityId; equipeBId: EntityId | null }> = [];
  for (let i = 0; i < qualified.length; i += 2) {
    if (qualified[i + 1]) {
      matchups.push({
        equipeAId: qualified[i].equipeId,
        equipeBId: qualified[i + 1].equipeId,
      });
    }
  }
  return matchups;
}
