import { EntityId } from '../../shared/types.js';

// Type alias for node identifiers within the graph
export type NodeId = string;

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum EdgeType {
  WINNER_ADVANCES = 'WINNER_ADVANCES',
  LOSER_TO_CONSOLANTE = 'LOSER_TO_CONSOLANTE',
  QUALIFIED_FROM_POOL = 'QUALIFIED_FROM_POOL',
  LOSER_DROPS = 'LOSER_DROPS',
  BYE_ADVANCES = 'BYE_ADVANCES',
}

export enum Position {
  A = 'A',
  B = 'B',
}

export enum NodeType {
  MATCH = 'MATCH',
  PHASE_TRANSITION = 'PHASE_TRANSITION',
  BYE = 'BYE',
}

// ─── Edge ────────────────────────────────────────────────────────────────────

export interface CompetitionEdge {
  from: NodeId;
  to: NodeId;
  type: EdgeType;
  position: Position;
}

// ─── Nodes ───────────────────────────────────────────────────────────────────

export abstract class CompetitionNode {
  abstract readonly nodeType: NodeType;

  constructor(public readonly id: NodeId) {}
}

export class MatchNode extends CompetitionNode {
  readonly nodeType = NodeType.MATCH;

  constructor(
    id: NodeId,
    public readonly matchId: EntityId,
    public readonly equipeASource: NodeId | null = null,
    public readonly equipeBSource: NodeId | null = null,
  ) {
    super(id);
  }
}

export class PhaseTransitionNode extends CompetitionNode {
  readonly nodeType = NodeType.PHASE_TRANSITION;

  constructor(
    id: NodeId,
    public readonly sourcePhaseId: EntityId,
    public readonly targetPhaseId: EntityId,
  ) {
    super(id);
  }
}

export class ByeNode extends CompetitionNode {
  readonly nodeType = NodeType.BYE;

  constructor(
    id: NodeId,
    public readonly equipeId: EntityId,
  ) {
    super(id);
  }
}

// ─── Validation result ───────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── CompetitionGraph ────────────────────────────────────────────────────────

export class CompetitionGraph {
  private nodes: Map<NodeId, CompetitionNode> = new Map();
  private edges: CompetitionEdge[] = [];

  addNode(node: CompetitionNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: CompetitionEdge): void {
    if (!this.nodes.has(edge.from)) {
      throw new Error(
        `Cannot add edge: source node "${edge.from}" does not exist in the graph.`,
      );
    }
    if (!this.nodes.has(edge.to)) {
      throw new Error(
        `Cannot add edge: target node "${edge.to}" does not exist in the graph.`,
      );
    }
    this.edges.push(edge);
  }

  getNode(id: NodeId): CompetitionNode | undefined {
    return this.nodes.get(id);
  }

  getOutgoingEdges(nodeId: NodeId): CompetitionEdge[] {
    return this.edges.filter((e) => e.from === nodeId);
  }

  getIncomingEdges(nodeId: NodeId): CompetitionEdge[] {
    return this.edges.filter((e) => e.to === nodeId);
  }

  getWinnerDestination(nodeId: NodeId): CompetitionEdge | undefined {
    return this.getOutgoingEdges(nodeId).find(
      (e) => e.type === EdgeType.WINNER_ADVANCES,
    );
  }

  getLoserDestination(nodeId: NodeId): CompetitionEdge | undefined {
    return this.getOutgoingEdges(nodeId).find(
      (e) =>
        e.type === EdgeType.LOSER_TO_CONSOLANTE ||
        e.type === EdgeType.LOSER_DROPS,
    );
  }

  getRoots(): CompetitionNode[] {
    const nodesWithIncoming = new Set(this.edges.map((e) => e.to));
    return Array.from(this.nodes.values()).filter(
      (node) => !nodesWithIncoming.has(node.id),
    );
  }

  getLeaves(): CompetitionNode[] {
    const nodesWithOutgoing = new Set(this.edges.map((e) => e.from));
    return Array.from(this.nodes.values()).filter(
      (node) => !nodesWithOutgoing.has(node.id),
    );
  }

  /**
   * Kahn's algorithm — returns nodes in topological order.
   * Throws if a cycle is detected.
   */
  topologicalSort(): CompetitionNode[] {
    // Build in-degree map
    const inDegree = new Map<NodeId, number>();
    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
    }
    for (const edge of this.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    // Start with nodes that have no incoming edges
    const queue: NodeId[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const sorted: CompetitionNode[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = this.nodes.get(currentId);
      if (node) {
        sorted.push(node);
      }

      for (const edge of this.getOutgoingEdges(currentId)) {
        const newDegree = (inDegree.get(edge.to) ?? 1) - 1;
        inDegree.set(edge.to, newDegree);
        if (newDegree === 0) {
          queue.push(edge.to);
        }
      }
    }

    if (sorted.length !== this.nodes.size) {
      throw new Error(
        'Cycle detected in competition graph: topological sort could not complete.',
      );
    }

    return sorted;
  }

  validate(): ValidationResult {
    const errors: string[] = [];

    // Check that all edge endpoints reference existing nodes
    for (const edge of this.edges) {
      if (!this.nodes.has(edge.from)) {
        errors.push(
          `Edge references non-existent source node "${edge.from}".`,
        );
      }
      if (!this.nodes.has(edge.to)) {
        errors.push(
          `Edge references non-existent target node "${edge.to}".`,
        );
      }
    }

    // Check that match nodes have at most 2 incoming edges
    for (const node of this.nodes.values()) {
      if (node.nodeType === NodeType.MATCH) {
        const incoming = this.getIncomingEdges(node.id);
        if (incoming.length > 2) {
          errors.push(
            `MatchNode "${node.id}" has ${incoming.length} incoming edges (maximum is 2).`,
          );
        }
      }
    }

    // Check for cycles (only if no edge-reference errors, to avoid noise)
    if (errors.length === 0) {
      try {
        this.topologicalSort();
      } catch {
        errors.push('Cycle detected in the competition graph.');
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// ─── CompetitionGraphBuilder ─────────────────────────────────────────────────

export class CompetitionGraphBuilder {
  private graph: CompetitionGraph = new CompetitionGraph();

  addMatch(id: NodeId, matchId: EntityId): CompetitionGraphBuilder {
    this.graph.addNode(new MatchNode(id, matchId));
    return this;
  }

  addBye(id: NodeId, equipeId: EntityId): CompetitionGraphBuilder {
    this.graph.addNode(new ByeNode(id, equipeId));
    return this;
  }

  addPhaseTransition(
    id: NodeId,
    sourcePhaseId: EntityId,
    targetPhaseId: EntityId,
  ): CompetitionGraphBuilder {
    this.graph.addNode(new PhaseTransitionNode(id, sourcePhaseId, targetPhaseId));
    return this;
  }

  winnerAdvances(
    from: NodeId,
    to: NodeId,
    position: Position,
  ): CompetitionGraphBuilder {
    this.graph.addEdge({ from, to, type: EdgeType.WINNER_ADVANCES, position });
    return this;
  }

  loserTo(
    from: NodeId,
    to: NodeId,
    position: Position,
  ): CompetitionGraphBuilder {
    this.graph.addEdge({
      from,
      to,
      type: EdgeType.LOSER_TO_CONSOLANTE,
      position,
    });
    return this;
  }

  qualifiedFromPool(
    from: NodeId,
    to: NodeId,
    position: Position,
  ): CompetitionGraphBuilder {
    this.graph.addEdge({
      from,
      to,
      type: EdgeType.QUALIFIED_FROM_POOL,
      position,
    });
    return this;
  }

  /**
   * Validates the graph and returns it. Throws if validation fails.
   */
  build(): CompetitionGraph {
    const result = this.graph.validate();
    if (!result.valid) {
      throw new Error(
        `CompetitionGraph validation failed:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`,
      );
    }
    return this.graph;
  }
}
