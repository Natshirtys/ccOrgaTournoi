import {
  PhaseStrategy,
  PhaseContext,
  TourGeneration,
  Matchup,
  MatchResultEntry,
} from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';

/**
 * Système Suisse.
 *
 * - Tour 1 : appariement aléatoire
 * - Tours suivants : appariement par classement (éviter les re-rencontres)
 * - Pas d'élimination, classement final par points
 * - Nombre de tours = Math.ceil(Math.log2(nbEquipes)) par défaut
 */
export class SwissSystemStrategy implements PhaseStrategy {
  generateTours(context: PhaseContext): TourGeneration[] {
    const { equipeIds } = context;

    if (equipeIds.length < 2) {
      throw new Error('Le système suisse nécessite au moins 2 équipes');
    }

    // Tour 1 : appariement aléatoire
    const shuffled = [...equipeIds].sort(() => Math.random() - 0.5);
    const matchups = pairSequential(shuffled);

    return [{ numero: 1, matchups, nom: 'Tour 1 — Système Suisse' }];
  }

  /**
   * Génère le tour suivant par appariement selon le classement courant.
   */
  generateNextTour(context: PhaseContext, currentTourNumero: number): TourGeneration | null {
    const { equipeIds, matchResults, config } = context;
    const maxTours = config.nbTours ?? Math.ceil(Math.log2(equipeIds.length));

    if (currentTourNumero >= maxTours) return null;

    // Calculer le classement courant
    const standings = this.calculateStandings(equipeIds, matchResults);

    // Trier par points desc
    standings.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);

    // Construire l'ensemble des rencontres déjà jouées
    const previousMatchups = new Set<string>();
    for (const r of matchResults) {
      if (r.equipeBId) {
        previousMatchups.add(makeKey(r.equipeAId, r.equipeBId));
      }
    }

    // Apparier par classement en évitant les re-rencontres
    const sorted = standings.map((s) => s.equipeId);
    const matchups = this.pairByRanking(sorted, previousMatchups);

    const tourNum = currentTourNumero + 1;
    return { numero: tourNum, matchups, nom: `Tour ${tourNum} — Système Suisse` };
  }

  isPhaseComplete(context: PhaseContext): boolean {
    const { equipeIds, config } = context;
    const maxTours = config.nbTours ?? Math.ceil(Math.log2(equipeIds.length));

    // Compter le nombre de tours joués (chaque tour a equipeIds.length/2 matchs)
    const matchsParTour = Math.floor(equipeIds.length / 2);
    if (matchsParTour === 0) return true;

    const completedMatches = context.matchResults.filter((r) => r.vainqueurId !== null).length;
    const toursCompletes = Math.floor(completedMatches / matchsParTour);

    return toursCompletes >= maxTours;
  }

  private calculateStandings(equipeIds: EntityId[], results: MatchResultEntry[]) {
    return equipeIds.map((eqId) => {
      let points = 0;
      let goalDiff = 0;

      for (const r of results) {
        const isA = r.equipeAId === eqId;
        const isB = r.equipeBId === eqId;
        if (!isA && !isB) continue;

        const scored = isA ? r.scoreA : r.scoreB;
        const conceded = isA ? r.scoreB : r.scoreA;
        goalDiff += scored - conceded;

        if (r.vainqueurId === eqId) {
          points += 2;
        } else if (r.vainqueurId === null) {
          points += 1;
        }
      }

      return { equipeId: eqId, points, goalDiff };
    });
  }

  private pairByRanking(sorted: EntityId[], previousMatchups: Set<string>): Matchup[] {
    const matchups: Matchup[] = [];
    const paired = new Set<EntityId>();

    for (let i = 0; i < sorted.length; i++) {
      if (paired.has(sorted[i])) continue;

      let matched = false;
      for (let j = i + 1; j < sorted.length; j++) {
        if (paired.has(sorted[j])) continue;

        const key = makeKey(sorted[i], sorted[j]);
        if (!previousMatchups.has(key)) {
          matchups.push({ equipeAId: sorted[i], equipeBId: sorted[j] });
          paired.add(sorted[i]);
          paired.add(sorted[j]);
          matched = true;
          break;
        }
      }

      // Si aucun adversaire non-rencontré, prendre le prochain disponible
      if (!matched) {
        for (let j = i + 1; j < sorted.length; j++) {
          if (!paired.has(sorted[j])) {
            matchups.push({ equipeAId: sorted[i], equipeBId: sorted[j] });
            paired.add(sorted[i]);
            paired.add(sorted[j]);
            break;
          }
        }
      }
    }

    // BYE si nombre impair
    const unpaired = sorted.filter((eq) => !paired.has(eq));
    for (const eq of unpaired) {
      matchups.push({ equipeAId: eq, equipeBId: null });
    }

    return matchups;
  }
}

function makeKey(a: EntityId, b: EntityId): string {
  return [a, b].sort().join('|');
}

function pairSequential(equipeIds: EntityId[]): Matchup[] {
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
