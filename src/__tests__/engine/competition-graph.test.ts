import { describe, it, expect } from 'vitest';
import {
  CompetitionGraph,
  CompetitionGraphBuilder,
  MatchNode,
  Position,
  EdgeType,
  NodeType,
} from '../../engine/bracket/competition-graph.js';

describe('CompetitionGraph', () => {
  it('construit un bracket simple KO à 4 équipes', () => {
    const graph = new CompetitionGraphBuilder()
      .addMatch('semi1', 'match-semi1')
      .addMatch('semi2', 'match-semi2')
      .addMatch('finale', 'match-finale')
      .winnerAdvances('semi1', 'finale', Position.A)
      .winnerAdvances('semi2', 'finale', Position.B)
      .build();

    expect(graph.getRoots()).toHaveLength(2);
    expect(graph.getLeaves()).toHaveLength(1);

    const winnerEdge = graph.getWinnerDestination('semi1');
    expect(winnerEdge).toBeDefined();
    expect(winnerEdge!.to).toBe('finale');
  });

  it('détecte un cycle', () => {
    const graph = new CompetitionGraph();
    graph.addNode(new MatchNode('a', 'm1'));
    graph.addNode(new MatchNode('b', 'm2'));
    graph.addEdge({ from: 'a', to: 'b', type: EdgeType.WINNER_ADVANCES, position: Position.A });
    graph.addEdge({ from: 'b', to: 'a', type: EdgeType.WINNER_ADVANCES, position: Position.A });

    const result = graph.validate();
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Cycle detected in the competition graph.');
  });

  it('supporte un BYE', () => {
    const graph = new CompetitionGraphBuilder()
      .addBye('bye1', 'equipe-bye')
      .addMatch('match1', 'match-real')
      .addMatch('finale', 'match-finale')
      .winnerAdvances('match1', 'finale', Position.A)
      .build();

    const bye = graph.getNode('bye1');
    expect(bye).toBeDefined();
    expect(bye!.nodeType).toBe(NodeType.BYE);
  });

  it('retourne les arêtes sortantes et entrantes', () => {
    const graph = new CompetitionGraphBuilder()
      .addMatch('semi1', 'm1')
      .addMatch('semi2', 'm2')
      .addMatch('finale', 'm3')
      .winnerAdvances('semi1', 'finale', Position.A)
      .winnerAdvances('semi2', 'finale', Position.B)
      .build();

    expect(graph.getOutgoingEdges('semi1')).toHaveLength(1);
    expect(graph.getIncomingEdges('finale')).toHaveLength(2);
  });

  it('tri topologique correct', () => {
    const graph = new CompetitionGraphBuilder()
      .addMatch('q1', 'mq1')
      .addMatch('q2', 'mq2')
      .addMatch('q3', 'mq3')
      .addMatch('q4', 'mq4')
      .addMatch('semi1', 'ms1')
      .addMatch('semi2', 'ms2')
      .addMatch('finale', 'mf')
      .winnerAdvances('q1', 'semi1', Position.A)
      .winnerAdvances('q2', 'semi1', Position.B)
      .winnerAdvances('q3', 'semi2', Position.A)
      .winnerAdvances('q4', 'semi2', Position.B)
      .winnerAdvances('semi1', 'finale', Position.A)
      .winnerAdvances('semi2', 'finale', Position.B)
      .build();

    const sorted = graph.topologicalSort();
    expect(sorted).toHaveLength(7);

    // Quarts avant semis, semis avant finale
    const indexOf = (id: string) => sorted.findIndex(n => n.id === id);
    expect(indexOf('q1')).toBeLessThan(indexOf('semi1'));
    expect(indexOf('q2')).toBeLessThan(indexOf('semi1'));
    expect(indexOf('semi1')).toBeLessThan(indexOf('finale'));
    expect(indexOf('semi2')).toBeLessThan(indexOf('finale'));
  });

  it('refuse une arête vers un noeud inexistant au build', () => {
    expect(() =>
      new CompetitionGraphBuilder()
        .addMatch('m1', 'match1')
        .winnerAdvances('m1', 'inexistant', Position.A)
        .build(),
    ).toThrow();
  });

  it('supporte un bracket avec consolante (loser bracket)', () => {
    const graph = new CompetitionGraphBuilder()
      .addMatch('semi1', 'ms1')
      .addMatch('semi2', 'ms2')
      .addMatch('finale', 'mf')
      .addMatch('consolante', 'mc')
      .winnerAdvances('semi1', 'finale', Position.A)
      .winnerAdvances('semi2', 'finale', Position.B)
      .loserTo('semi1', 'consolante', Position.A)
      .loserTo('semi2', 'consolante', Position.B)
      .build();

    const loserDest = graph.getLoserDestination('semi1');
    expect(loserDest).toBeDefined();
    expect(loserDest!.to).toBe('consolante');
    expect(loserDest!.type).toBe(EdgeType.LOSER_TO_CONSOLANTE);
  });
});
