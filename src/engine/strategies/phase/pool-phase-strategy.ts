import {
  PhaseStrategy,
  PhaseContext,
  TourGeneration,
  Matchup,
  MatchResultEntry,
  DrawAssignment,
  QualifiedEntry,
} from '../interfaces.js';
import { EntityId } from '../../../shared/types.js';

/**
 * Phase de poules GSL : 5 matchs par poule de 4.
 *
 * - Tour 1 (M1, M2) : A-B, C-D
 * - Tour 2 (M3, M4) : gagnants vs gagnants (Winners Match), perdants vs perdants (Losers Match)
 * - Tour 3 (M5) : barrage entre le perdant du Winners Match et le gagnant du Losers Match
 *
 * Classement positionnel GSL :
 *   W_M3 (2V) = 1er
 *   W_M5 = 2e
 *   L_M5 = 3e
 *   L_M4 (0V) = 4e
 *
 * Seul le tour 1 est généré par generateTours().
 * Les tours 2 et 3 sont générés dynamiquement via generateNextTour().
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

    for (const poule of poules) {
      if (poule.length !== 4) {
        throw new Error(`Chaque poule doit contenir exactement 4 équipes (trouvé ${poule.length})`);
      }
    }

    // Ne générer que le tour 1
    const matchups: Matchup[] = [];
    for (const poule of poules) {
      matchups.push(...this.generateFirstRound(poule));
    }

    return [{ numero: 1, matchups, nom: 'Tour 1 — Poules' }];
  }

  /**
   * Génère le tour suivant de la phase de poules.
   * Tour 2 : gagnants vs gagnants (M3), perdants vs perdants (M4).
   * Tour 3 : barrage M5 entre perdant M3 et gagnant M4.
   */
  generateNextTour(context: PhaseContext, currentTourNumero: number): TourGeneration | null {
    const poules = this.getPoules(context);

    if (currentTourNumero === 1) {
      const matchups: Matchup[] = [];
      for (const poule of poules) {
        matchups.push(...this.generateSecondRound(poule, context.matchResults));
      }
      return { numero: 2, matchups, nom: 'Tour 2 — Gagnants / Perdants' };
    }

    if (currentTourNumero === 2) {
      const matchups: Matchup[] = [];
      for (const poule of poules) {
        const barrageMatchups = this.generateBarrage(poule, context.matchResults);
        matchups.push(...barrageMatchups);
      }
      if (matchups.length === 0) return null;
      return { numero: 3, matchups, nom: 'Tour 3 — Barrage 2e/3e' };
    }

    return null; // Poules terminées
  }

  isPhaseComplete(context: PhaseContext): boolean {
    const poules = this.getPoules(context);
    // 5 matchs par poule de 4 (M1 + M2 + M3 + M4 + M5)
    const totalMatchesExpected = poules.length * 5;
    const completedMatches = context.matchResults.filter(
      (r) => r.vainqueurId !== null,
    ).length;
    return completedMatches >= totalMatchesExpected;
  }

  /**
   * Classement positionnel GSL d'une poule.
   *
   * Identifie les résultats de chaque match spécifique (M1-M5) :
   * - W_M3 (vainqueur du Winners Match, 2V) → rang 1
   * - L_M4 (perdant du Losers Match, 0V) → rang 4
   * - W_M5 (vainqueur du barrage) → rang 2
   * - L_M5 (perdant du barrage) → rang 3
   *
   * Si le barrage n'est pas encore joué, les deux 1V sont ex-aequo rang 2-3.
   */
  getPouleRanking(poule: EntityId[], results: MatchResultEntry[]): EntityId[] {
    const pouleResults = results.filter(
      (r) => poule.includes(r.equipeAId) && r.equipeBId !== null && poule.includes(r.equipeBId),
    );

    // Pas assez de résultats → fallback sur comptage victoires
    if (pouleResults.length < 4) {
      return this.fallbackRanking(poule, pouleResults);
    }

    // Identifier les matchs du Tour 1 (M1, M2) — les 2 premiers
    const m1 = pouleResults[0];
    const m2 = pouleResults[1];

    if (!m1?.vainqueurId || !m2?.vainqueurId) {
      return this.fallbackRanking(poule, pouleResults);
    }

    // Tour 2 : M3 = Winners Match, M4 = Losers Match
    const m3 = pouleResults[2]; // Winners Match
    const m4 = pouleResults[3]; // Losers Match

    if (!m3?.vainqueurId || !m4?.vainqueurId) {
      return this.fallbackRanking(poule, pouleResults);
    }

    const wM3: EntityId = m3.vainqueurId; // 1er = vainqueur du Winners Match
    const lM3: EntityId = m3.vainqueurId === m3.equipeAId ? m3.equipeBId as EntityId : m3.equipeAId;
    const wM4: EntityId = m4.vainqueurId; // gagnant du Losers Match
    const lM4: EntityId = m4.vainqueurId === m4.equipeAId ? m4.equipeBId as EntityId : m4.equipeAId;

    // Tour 3 : M5 = Barrage (lM3 vs wM4)
    if (pouleResults.length < 5 || !pouleResults[4]?.vainqueurId) {
      // Barrage pas encore joué → 1er connu, 4e connu, 2e/3e ex-aequo
      return [wM3, lM3, wM4, lM4];
    }

    const m5 = pouleResults[4];
    const wM5: EntityId = m5.vainqueurId!;
    const lM5: EntityId = m5.vainqueurId === m5.equipeAId ? m5.equipeBId as EntityId : m5.equipeAId;

    return [wM3, wM5, lM5, lM4];
  }

  /**
   * Retourne les qualifiés (1er + 2e) de chaque poule avec leur rang et index de poule.
   */
  getQualifies(context: PhaseContext): QualifiedEntry[] {
    const poules = this.getPoules(context);
    const qualifies: QualifiedEntry[] = [];
    for (let i = 0; i < poules.length; i++) {
      const ranking = this.getPouleRanking(poules[i], context.matchResults);
      qualifies.push(
        { equipeId: ranking[0], pouleIndex: i, rang: 1 },
        { equipeId: ranking[1], pouleIndex: i, rang: 2 },
      );
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

  // --- Private ---

  private fallbackRanking(poule: EntityId[], results: MatchResultEntry[]): EntityId[] {
    const wins = new Map<EntityId, number>();
    for (const eq of poule) wins.set(eq, 0);

    for (const r of results) {
      if (r.vainqueurId && wins.has(r.vainqueurId)) {
        wins.set(r.vainqueurId, (wins.get(r.vainqueurId) ?? 0) + 1);
      }
    }

    return [...poule].sort((a, b) => (wins.get(b) ?? 0) - (wins.get(a) ?? 0));
  }

  private generateFirstRound(poule: EntityId[]): Matchup[] {
    // A-B, C-D (paires consécutives)
    const matchups: Matchup[] = [];
    for (let i = 0; i < poule.length - 1; i += 2) {
      matchups.push({
        equipeAId: poule[i],
        equipeBId: poule[i + 1] ?? null,
      });
    }
    if (poule.length % 2 !== 0) {
      matchups.push({ equipeAId: poule[poule.length - 1], equipeBId: null });
    }
    return matchups;
  }

  private generateSecondRound(poule: EntityId[], results: MatchResultEntry[]): Matchup[] {
    const pouleResults = results.filter(
      (r) => poule.includes(r.equipeAId) && r.equipeBId !== null && poule.includes(r.equipeBId),
    );

    const winners: EntityId[] = [];
    const losers: EntityId[] = [];

    // Prendre les résultats du tour 1 (les 2 premiers matchs de cette poule)
    const tour1Results = pouleResults.slice(0, Math.floor(poule.length / 2));

    for (const r of tour1Results) {
      if (r.vainqueurId) {
        winners.push(r.vainqueurId);
        const loser = r.vainqueurId === r.equipeAId ? r.equipeBId! : r.equipeAId;
        losers.push(loser);
      }
    }

    const matchups: Matchup[] = [];

    // M3 : Gagnants vs gagnants (Winners Match)
    if (winners.length >= 2) {
      matchups.push({ equipeAId: winners[0], equipeBId: winners[1] });
    }

    // M4 : Perdants vs perdants (Losers Match)
    if (losers.length >= 2) {
      matchups.push({ equipeAId: losers[0], equipeBId: losers[1] });
    }

    return matchups;
  }

  private generateBarrage(poule: EntityId[], results: MatchResultEntry[]): Matchup[] {
    const pouleResults = results.filter(
      (r) => poule.includes(r.equipeAId) && r.equipeBId !== null && poule.includes(r.equipeBId),
    );

    // On a besoin des résultats de M3 et M4 pour identifier perdant M3 et gagnant M4
    if (pouleResults.length < 4) return [];

    const m3 = pouleResults[2]; // Winners Match
    const m4 = pouleResults[3]; // Losers Match

    if (!m3?.vainqueurId || !m4?.vainqueurId) return [];

    // Perdant du Winners Match (lM3)
    const lM3 = m3.vainqueurId === m3.equipeAId ? m3.equipeBId! : m3.equipeAId;
    // Gagnant du Losers Match (wM4)
    const wM4 = m4.vainqueurId;

    return [{ equipeAId: lM3, equipeBId: wM4 }];
  }
}

/**
 * Convertit les DrawAssignment (avec pouleIndex) en tableau de poules.
 */
export function assignmentsToPoules(assignments: DrawAssignment[]): EntityId[][] {
  const poulesMap = new Map<number, EntityId[]>();

  for (const a of assignments) {
    const idx = a.pouleIndex ?? 0;
    if (!poulesMap.has(idx)) {
      poulesMap.set(idx, []);
    }
    poulesMap.get(idx)!.push(a.equipeId);
  }

  const sorted = Array.from(poulesMap.entries()).sort((a, b) => a[0] - b[0]);
  return sorted.map(([, equipes]) => equipes);
}

/**
 * Croisement classique KO : 1er poule A vs 2e poule D, etc.
 * Pour 2 poules : 1A vs 2B, 1B vs 2A.
 * Pour 4 poules : 1A vs 2D, 1C vs 2B, 1B vs 2C, 1D vs 2A.
 */
export function buildKoCrossMatchups(qualifies: QualifiedEntry[]): Matchup[] {
  const premiers = qualifies.filter((q) => q.rang === 1).sort((a, b) => a.pouleIndex - b.pouleIndex);
  const seconds = qualifies.filter((q) => q.rang === 2).sort((a, b) => a.pouleIndex - b.pouleIndex);

  const nbPoules = premiers.length;

  if (nbPoules <= 1) {
    // 1 seule poule, pas de croisement
    return premiers.length > 0 && seconds.length > 0
      ? [{ equipeAId: premiers[0].equipeId, equipeBId: seconds[0].equipeId }]
      : [];
  }

  if (nbPoules === 2) {
    // 1A vs 2B, 1B vs 2A
    return [
      { equipeAId: premiers[0].equipeId, equipeBId: seconds[1].equipeId },
      { equipeAId: premiers[1].equipeId, equipeBId: seconds[0].equipeId },
    ];
  }

  // Pour 4 poules (schéma FIFA) : 1A vs 2D, 1C vs 2B, 1B vs 2C, 1D vs 2A
  if (nbPoules === 4) {
    return [
      { equipeAId: premiers[0].equipeId, equipeBId: seconds[3].equipeId }, // 1A vs 2D
      { equipeAId: premiers[2].equipeId, equipeBId: seconds[1].equipeId }, // 1C vs 2B
      { equipeAId: premiers[1].equipeId, equipeBId: seconds[2].equipeId }, // 1B vs 2C
      { equipeAId: premiers[3].equipeId, equipeBId: seconds[0].equipeId }, // 1D vs 2A
    ];
  }

  // Générique : 1er i vs 2e (nbPoules - 1 - i)
  const matchups: Matchup[] = [];
  for (let i = 0; i < nbPoules; i++) {
    const oppositeIdx = nbPoules - 1 - i;
    matchups.push({
      equipeAId: premiers[i].equipeId,
      equipeBId: seconds[oppositeIdx].equipeId,
    });
  }
  return matchups;
}
