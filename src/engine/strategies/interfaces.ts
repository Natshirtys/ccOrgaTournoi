import { EntityId } from '../../shared/types.js';
import { MethodeAppariement } from '../../domain/shared/enums.js';

// ---------------------------------------------------------------------------
// Draw strategy types
// ---------------------------------------------------------------------------

export interface DrawConstraints {
  protectionClub: boolean;
  clubsByEquipe: Map<EntityId, EntityId>;
}

export interface DrawContext {
  equipeIds: EntityId[];
  constraints: DrawConstraints;
  tetesDeSerieIds?: EntityId[];
}

export interface DrawAssignment {
  equipeId: EntityId;
  position: number;
  pouleIndex?: number;
}

export interface DrawResult {
  assignments: DrawAssignment[];
  byes: EntityId[];
}

export interface DrawStrategy {
  execute(context: DrawContext): DrawResult;
}

// ---------------------------------------------------------------------------
// Phase strategy types
// ---------------------------------------------------------------------------

export interface PhaseConfig {
  nbPoules?: number;
  taillePoule?: number;
  qualifiesParPoule?: number;
  nbTours?: number;
}

export interface Matchup {
  equipeAId: EntityId;
  equipeBId: EntityId | null;
}

export interface MatchResultEntry {
  matchId: EntityId;
  equipeAId: EntityId;
  equipeBId: EntityId | null;
  scoreA: number;
  scoreB: number;
  vainqueurId: EntityId | null;
}

export interface PhaseContext {
  phaseId: EntityId;
  equipeIds: EntityId[];
  matchResults: MatchResultEntry[];
  config: PhaseConfig;
}

export interface TourGeneration {
  numero: number;
  matchups: Matchup[];
  nom?: string;
}

export interface QualifiedEntry {
  equipeId: EntityId;
  pouleIndex: number;
  rang: number; // 1 = 1er de poule, 2 = 2e de poule
}

export interface PhaseStrategy {
  generateTours(context: PhaseContext): TourGeneration[];
  isPhaseComplete(context: PhaseContext): boolean;
  generateNextTour?(context: PhaseContext, currentTourNumero: number): TourGeneration | null;
  getQualifies?(context: PhaseContext): QualifiedEntry[];
}

// ---------------------------------------------------------------------------
// Ranking strategy types
// ---------------------------------------------------------------------------

export interface RankingEntry {
  equipeId: EntityId;
  matchesJoues: number;
  victoires: number;
  nuls: number;
  defaites: number;
  pointsMarques: number;
  pointsEncaisses: number;
  points: number;
}

export interface RankedEntry extends RankingEntry {
  rang: number;
  qualifiee: boolean;
}

export interface RankingStrategy {
  calculate(entries: RankingEntry[]): RankedEntry[];
}

// ---------------------------------------------------------------------------
// Pairing strategy types
// ---------------------------------------------------------------------------

export interface PairingContext {
  equipeIds: EntityId[];
  previousMatchups: Set<string>;
  rankings?: RankedEntry[];
  methode: MethodeAppariement;
}

export interface PairingStrategy {
  pair(context: PairingContext): Matchup[];
}

// ---------------------------------------------------------------------------
// Tiebreak strategy types
// ---------------------------------------------------------------------------

export interface TiebreakStrategy {
  name: string;
  resolve(tied: RankedEntry[], allMatches: MatchResultEntry[]): RankedEntry[];
}

// ---------------------------------------------------------------------------
// Strategy registry
// ---------------------------------------------------------------------------

export class StrategyRegistry {
  private drawStrategies = new Map<string, DrawStrategy>();
  private phaseStrategies = new Map<string, PhaseStrategy>();
  private rankingStrategies = new Map<string, RankingStrategy>();
  private pairingStrategies = new Map<string, PairingStrategy>();
  private tiebreakStrategies = new Map<string, TiebreakStrategy>();

  registerDraw(name: string, strategy: DrawStrategy): void {
    this.drawStrategies.set(name, strategy);
  }

  registerPhase(name: string, strategy: PhaseStrategy): void {
    this.phaseStrategies.set(name, strategy);
  }

  registerRanking(name: string, strategy: RankingStrategy): void {
    this.rankingStrategies.set(name, strategy);
  }

  registerPairing(name: string, strategy: PairingStrategy): void {
    this.pairingStrategies.set(name, strategy);
  }

  registerTiebreak(name: string, strategy: TiebreakStrategy): void {
    this.tiebreakStrategies.set(name, strategy);
  }

  getDraw(name: string): DrawStrategy {
    const strategy = this.drawStrategies.get(name);
    if (!strategy) {
      throw new Error(`DrawStrategy not found: "${name}"`);
    }
    return strategy;
  }

  getPhase(name: string): PhaseStrategy {
    const strategy = this.phaseStrategies.get(name);
    if (!strategy) {
      throw new Error(`PhaseStrategy not found: "${name}"`);
    }
    return strategy;
  }

  getRanking(name: string): RankingStrategy {
    const strategy = this.rankingStrategies.get(name);
    if (!strategy) {
      throw new Error(`RankingStrategy not found: "${name}"`);
    }
    return strategy;
  }

  getPairing(name: string): PairingStrategy {
    const strategy = this.pairingStrategies.get(name);
    if (!strategy) {
      throw new Error(`PairingStrategy not found: "${name}"`);
    }
    return strategy;
  }

  getTiebreak(name: string): TiebreakStrategy {
    const strategy = this.tiebreakStrategies.get(name);
    if (!strategy) {
      throw new Error(`TiebreakStrategy not found: "${name}"`);
    }
    return strategy;
  }
}
