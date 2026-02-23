import {
  PhaseStrategy,
  PhaseContext,
  TourGeneration,
  Matchup,
  DrawAssignment,
} from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';

/**
 * Phase de poules : round-robin complet dans chaque poule.
 *
 * Génère tous les tours nécessaires pour que chaque équipe
 * affronte toutes les autres de sa poule exactement une fois.
 *
 * Utilise l'algorithme du polygone tournant (circle method)
 * pour générer les matchups round-robin.
 */
export class PoolPhaseStrategy implements PhaseStrategy {
  constructor(
    private readonly pouleAssignments?: DrawAssignment[],
  ) {}

  generateTours(context: PhaseContext): TourGeneration[] {
    const poules = this.getPoules(context);

    if (poules.length === 0) {
      throw new Error('Aucune poule configurée');
    }

    // Générer le round-robin pour chaque poule
    const toursParPoule = poules.map((poule) => generateRoundRobin(poule));

    // Le nombre max de tours parmi toutes les poules
    const nbTours = Math.max(...toursParPoule.map((t) => t.length));

    // Fusionner : tour N = matchups du tour N de chaque poule
    const tours: TourGeneration[] = [];
    for (let tourNum = 0; tourNum < nbTours; tourNum++) {
      const matchups: Matchup[] = [];
      for (const pouleTours of toursParPoule) {
        if (tourNum < pouleTours.length) {
          matchups.push(...pouleTours[tourNum]);
        }
      }
      tours.push({ numero: tourNum + 1, matchups });
    }

    return tours;
  }

  isPhaseComplete(context: PhaseContext): boolean {
    const poules = this.getPoules(context);
    const totalMatchesExpected = poules.reduce((sum, poule) => {
      // n*(n-1)/2 matchs pour n équipes
      return sum + (poule.length * (poule.length - 1)) / 2;
    }, 0);

    // Compter les matchs terminés (avec un résultat)
    const completedMatches = context.matchResults.filter(
      (r) => r.vainqueurId !== null || (r.scoreA > 0 || r.scoreB > 0),
    ).length;

    return completedMatches >= totalMatchesExpected;
  }

  /**
   * Reconstruit les poules à partir des assignments ou de la config.
   */
  private getPoules(context: PhaseContext): EntityId[][] {
    if (this.pouleAssignments && this.pouleAssignments.length > 0) {
      return assignmentsToPoules(this.pouleAssignments);
    }

    // Fallback : répartir selon la config
    const { equipeIds, config } = context;
    const nbPoules = config.nbPoules ?? 1;
    const poules: EntityId[][] = Array.from({ length: nbPoules }, () => []);

    for (let i = 0; i < equipeIds.length; i++) {
      poules[i % nbPoules].push(equipeIds[i]);
    }

    return poules;
  }
}

/**
 * Convertit les DrawAssignment (avec pouleIndex) en tableau de poules.
 */
function assignmentsToPoules(assignments: DrawAssignment[]): EntityId[][] {
  const poulesMap = new Map<number, EntityId[]>();

  for (const a of assignments) {
    const idx = a.pouleIndex ?? 0;
    if (!poulesMap.has(idx)) {
      poulesMap.set(idx, []);
    }
    poulesMap.get(idx)!.push(a.equipeId);
  }

  // Trier par index de poule
  const sorted = Array.from(poulesMap.entries()).sort((a, b) => a[0] - b[0]);
  return sorted.map(([, equipes]) => equipes);
}

/**
 * Génère les tours round-robin par la méthode du polygone tournant.
 * Pour n équipes (si impair, on ajoute un BYE), on a n-1 tours.
 *
 * Retourne un tableau de tours, chaque tour contenant les matchups.
 */
function generateRoundRobin(equipeIds: EntityId[]): Matchup[][] {
  const equipes = [...equipeIds];

  // Si nombre impair, ajouter un "fantôme" pour le BYE
  const hasGhost = equipes.length % 2 !== 0;
  if (hasGhost) {
    equipes.push('__BYE__');
  }

  const n = equipes.length;
  const tours: Matchup[][] = [];

  // Fixer la première équipe, faire tourner les autres
  for (let round = 0; round < n - 1; round++) {
    const matchups: Matchup[] = [];

    for (let i = 0; i < n / 2; i++) {
      const home = i === 0 ? equipes[0] : equipes[((round + i - 1) % (n - 1)) + 1];
      const away = equipes[((round + (n / 2) - 1 + (n / 2 - i) - 1) % (n - 1)) + 1];

      if (home === '__BYE__') {
        matchups.push({ equipeAId: away, equipeBId: null });
      } else if (away === '__BYE__') {
        matchups.push({ equipeAId: home, equipeBId: null });
      } else {
        matchups.push({ equipeAId: home, equipeBId: away });
      }
    }

    tours.push(matchups);
  }

  return tours;
}
