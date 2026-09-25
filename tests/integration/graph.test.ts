/**
 * Integration tests for the DFS / BFS built-ins: source -> lex -> parse ->
 * validate -> optimize -> AQIR.
 *
 * Like the sorting integration tests, execution against a live
 * SceneManager/AnimationController is out of scope here — GENERIC_ACTION
 * instructions are legacy, action-based instructions interpreted by
 * AnimationController, not the VM itself. These tests verify the compiler
 * emits the right GENERIC_ACTION shape for `DFS`/`BFS`, and exercise
 * GraphEngine directly against a Graph built from the same edges the
 * compiled source declares (mirroring how GraphAlgorithms builds one from
 * the scene at runtime).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../utils/testHelpers';
import { Graph } from '../../packages/runtime/src/data-structures/Graph';
import { GraphAlgorithm } from '../../packages/runtime/src/core/algorithms/GraphEngine';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function genericActions(instructions: unknown[]): any[] {
  return (instructions as any[]).filter((i) => i.action === 'GENERIC_ACTION');
}

function graphSource(name: string, edges: string[], statement: string): string {
  return `SCENE GraphDemo
DECLARE
  GRAPH ${name} = [${edges.map((e) => `"${e}"`).join(', ')}]

SEQUENCE
  ${statement}
END
`;
}

/** Builds the same undirected Graph the compiled GRAPH declaration above describes, for direct GraphEngine assertions. */
function graphFromEdgeStrings(edges: string[]): Graph {
  const g = new Graph();
  for (const edgeStr of edges) {
    const match = edgeStr.match(/^([^->:]+)(?:(-|>)([^:]+)(?::(.*))?)?$/);
    if (match && match[3]) {
      g.addEdge(match[1].trim(), match[3].trim());
    } else if (match) {
      g.addVertex(match[1].trim());
    }
  }
  return g;
}

/** Same as graphFromEdgeStrings, but carries the "A-B:5" weight through to Graph.addEdge for shortest-path assertions. */
function weightedGraphFromEdgeStrings(edges: string[]): Graph {
  const g = new Graph([], [], false, true);
  for (const edgeStr of edges) {
    const match = edgeStr.match(/^([^->:]+)(?:(-|>)([^:]+)(?::(.*))?)?$/);
    if (match && match[3]) {
      const weight = match[4] !== undefined ? Number(match[4].trim()) : undefined;
      g.addEdge(match[1].trim(), match[3].trim(), weight);
    } else if (match) {
      g.addVertex(match[1].trim());
    }
  }
  return g;
}

describe('DFS / BFS: parsing to GENERIC_ACTION', () => {
  it('parses "DFS graph FROM A" into a GENERIC_ACTION with the graph and start vertex', () => {
    const instructions = compile(graphSource('g', ['A-B', 'B-C'], 'DFS g FROM A'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'DFS',
      args: ['g', 'A'],
      payload: { logicalParent: 'g' },
    });
  });

  it('parses "BFS graph FROM A" into a GENERIC_ACTION with the graph and start vertex', () => {
    const instructions = compile(graphSource('g', ['A-B', 'B-C'], 'BFS g FROM A'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'BFS',
      args: ['g', 'A'],
      payload: { logicalParent: 'g' },
    });
  });

  it('parses a traversal with no explicit start vertex', () => {
    const instructions = compile(graphSource('g', ['A-B'], 'DFS g'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ actionName: 'DFS', args: ['g'] });
  });
});

describe('DFS / BFS: execution produces correct order and levels', () => {
  it('DFS visits a linear graph in depth-first order', () => {
    const edges = ['A-B', 'B-C', 'C-D'];
    const instructions = compile(graphSource('g', edges, 'DFS g FROM A'));
    expect(genericActions(instructions)[0].actionName).toBe('DFS');

    const graph = graphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).depthFirstSearch('A');
    expect(result.order).toEqual(['A', 'B', 'C', 'D']);
  });

  it('BFS visits a tree level by level with correct levels', () => {
    const edges = ['A-B', 'A-C', 'B-D', 'C-E'];
    const instructions = compile(graphSource('g', edges, 'BFS g FROM A'));
    expect(genericActions(instructions)[0].actionName).toBe('BFS');

    const graph = graphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).breadthFirstSearch('A');
    expect(result.order).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(result.level.get('A')).toBe(0);
    expect(result.level.get('B')).toBe(1);
    expect(result.level.get('C')).toBe(1);
    expect(result.level.get('D')).toBe(2);
    expect(result.level.get('E')).toBe(2);
  });

  it('emits a VISIT frame per vertex and an EDGE frame per traversal edge', () => {
    const edges = ['A-B', 'B-C'];
    const graph = graphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).depthFirstSearch('A');

    const visits = result.animationFrames.filter((f) => f.type === 'VISIT');
    const traversedEdges = result.animationFrames.filter((f) => f.type === 'EDGE');
    expect(visits).toHaveLength(3); // A, B, C
    expect(traversedEdges).toHaveLength(2); // A->B, B->C
  });

  it('handles a cycle without looping and visits every reachable vertex exactly once', () => {
    const edges = ['A-B', 'B-C', 'C-A'];
    const instructions = compile(graphSource('g', edges, 'DFS g FROM A'));
    expect(genericActions(instructions)[0].actionName).toBe('DFS');

    const graph = graphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).depthFirstSearch('A');
    expect(result.visited.size).toBe(3);
    expect(new Set(result.order).size).toBe(result.order.length);
  });

  it('a disconnected graph only reaches vertices in the start vertex\'s component', () => {
    const edges = ['A-B', 'C-D'];
    const instructions = compile(graphSource('g', edges, 'BFS g FROM A'));
    expect(genericActions(instructions)[0].actionName).toBe('BFS');

    const graph = graphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).breadthFirstSearch('A');
    expect(result.order.sort()).toEqual(['A', 'B']);
    expect(result.visited.has('C')).toBe(false);
    expect(result.visited.has('D')).toBe(false);
  });
});

describe('DIJKSTRA / BELLMAN_FORD / ASTAR: parsing to GENERIC_ACTION', () => {
  it('parses "DIJKSTRA graph FROM A" into a GENERIC_ACTION with the graph and source vertex', () => {
    const instructions = compile(graphSource('g', ['A-B:1', 'B-C:2'], 'DIJKSTRA g FROM A'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'DIJKSTRA',
      args: ['g', 'A'],
      payload: { logicalParent: 'g' },
    });
  });

  it('parses "BELLMAN_FORD graph FROM A" into a GENERIC_ACTION with the graph and source vertex', () => {
    const instructions = compile(graphSource('g', ['A-B:1', 'B-C:2'], 'BELLMAN_FORD g FROM A'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'BELLMAN_FORD',
      args: ['g', 'A'],
      payload: { logicalParent: 'g' },
    });
  });

  it('parses "ASTAR graph FROM A TO C" into a GENERIC_ACTION with source and goal vertices', () => {
    const instructions = compile(graphSource('g', ['A-B:1', 'B-C:2'], 'ASTAR g FROM A TO C'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'ASTAR',
      args: ['g', 'A', 'C'],
      payload: { logicalParent: 'g' },
    });
  });
});

describe('DIJKSTRA / BELLMAN_FORD / ASTAR: execution produces correct distances / paths', () => {
  it('DIJKSTRA finds correct shortest-path distances on a weighted graph', () => {
    const edges = ['A-B:1', 'B-C:2', 'A-C:10'];
    const instructions = compile(graphSource('g', edges, 'DIJKSTRA g FROM A'));
    expect(genericActions(instructions)[0].actionName).toBe('DIJKSTRA');

    const graph = weightedGraphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).dijkstra('A');
    expect(result.distances.get('A')).toBe(0);
    expect(result.distances.get('B')).toBe(1);
    expect(result.distances.get('C')).toBe(3);
  });

  it('BELLMAN_FORD finds correct shortest-path distances on a weighted graph', () => {
    const edges = ['A-B:1', 'B-C:2', 'A-C:10'];
    const instructions = compile(graphSource('g', edges, 'BELLMAN_FORD g FROM A'));
    expect(genericActions(instructions)[0].actionName).toBe('BELLMAN_FORD');

    const graph = weightedGraphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).bellmanFord('A');
    expect(result.distances.get('C')).toBe(3);
    expect(result.hasNegativeCycle).toBe(false);
  });

  it('BELLMAN_FORD detects a negative-weight cycle', () => {
    const edges = ['A>B:1', 'B>C:-1', 'C>B:-1'];
    const graph = new Graph([], [], true, true);
    graph.addEdge('A', 'B', 1);
    graph.addEdge('B', 'C', -1);
    graph.addEdge('C', 'B', -1);

    const instructions = compile(graphSource('g', edges, 'BELLMAN_FORD g FROM A'));
    expect(genericActions(instructions)[0].actionName).toBe('BELLMAN_FORD');

    const result = new GraphAlgorithm(graph).bellmanFord('A');
    expect(result.hasNegativeCycle).toBe(true);
  });

  it('ASTAR finds the shortest path between source and goal', () => {
    const edges = ['A-B:1', 'B-C:1', 'A-C:10'];
    const instructions = compile(graphSource('g', edges, 'ASTAR g FROM A TO C'));
    expect(genericActions(instructions)[0].actionName).toBe('ASTAR');

    const graph = weightedGraphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).aStar('A', 'C');
    expect(result.path).toEqual(['A', 'B', 'C']);
    expect(result.distance).toBe(2);
  });

  it('handles graph sizes of 5, 20, and 100 vertices for Dijkstra', () => {
    for (const size of [5, 20, 100]) {
      const graph = new Graph([], [], true, true);
      for (let i = 0; i < size - 1; i++) {
        graph.addEdge(`V${i}`, `V${i + 1}`, 1);
      }
      const result = new GraphAlgorithm(graph).dijkstra('V0');
      expect(result.distances.get(`V${size - 1}`)).toBe(size - 1);
    }
  });
});

describe('PRIM / KRUSKAL / TOPO_SORT: parsing to GENERIC_ACTION', () => {
  it('parses "PRIM graph FROM A" into a GENERIC_ACTION with the graph and start vertex', () => {
    const instructions = compile(graphSource('g', ['A-B:1', 'B-C:2'], 'PRIM g FROM A'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'PRIM',
      args: ['g', 'A'],
      payload: { logicalParent: 'g' },
    });
  });

  it('parses "KRUSKAL graph" into a GENERIC_ACTION with the graph', () => {
    const instructions = compile(graphSource('g', ['A-B:1', 'B-C:2'], 'KRUSKAL g'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'KRUSKAL',
      args: ['g'],
      payload: { logicalParent: 'g' },
    });
  });

  it('parses "TOPO_SORT graph" into a GENERIC_ACTION with the graph', () => {
    const instructions = compile(graphSource('g', ['A>B', 'B>C'], 'TOPO_SORT g'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'TOPO_SORT',
      args: ['g'],
      payload: { logicalParent: 'g' },
    });
  });
});

describe('PRIM / KRUSKAL / TOPO_SORT: execution produces correct results', () => {
  it('PRIM finds the correct MST weight on a weighted graph', () => {
    const edges = ['A-B:1', 'A-C:3', 'B-C:2'];
    const instructions = compile(graphSource('g', edges, 'PRIM g FROM A'));
    expect(genericActions(instructions)[0].actionName).toBe('PRIM');

    const graph = weightedGraphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).prim('A');
    expect(result.totalWeight).toBe(3);
    expect(result.mstEdges).toHaveLength(2);
  });

  it('KRUSKAL finds the correct MST weight on a weighted graph', () => {
    const edges = ['A-B:1', 'A-C:3', 'B-C:2'];
    const instructions = compile(graphSource('g', edges, 'KRUSKAL g'));
    expect(genericActions(instructions)[0].actionName).toBe('KRUSKAL');

    const graph = weightedGraphFromEdgeStrings(edges);
    const result = new GraphAlgorithm(graph).kruskal();
    expect(result.totalWeight).toBe(3);
    expect(result.mstEdges).toHaveLength(2);
  });

  it('PRIM and KRUSKAL agree on total MST weight for the same connected graph', () => {
    const edges = ['A-B:1', 'A-C:3', 'A-D:4', 'B-C:2', 'B-D:5', 'C-D:6'];
    const graph = weightedGraphFromEdgeStrings(edges);
    const algo = new GraphAlgorithm(graph);
    expect(algo.prim('A').totalWeight).toBe(algo.kruskal().totalWeight);
  });

  it('TOPO_SORT produces a valid ordering for a DAG', () => {
    const edges = ['A>B', 'A>C', 'B>D', 'C>D'];
    const graph = new Graph([], [], true);
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');
    graph.addEdge('B', 'D');
    graph.addEdge('C', 'D');

    const instructions = compile(graphSource('g', edges, 'TOPO_SORT g'));
    expect(genericActions(instructions)[0].actionName).toBe('TOPO_SORT');

    const result = new GraphAlgorithm(graph).topologicalSort();
    expect(result.hasCycle).toBe(false);
    expect(result.ordering.indexOf('A')).toBeLessThan(result.ordering.indexOf('D'));
  });

  it('TOPO_SORT detects a cycle in a non-DAG graph', () => {
    const graph = new Graph([], [], true);
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');
    graph.addEdge('C', 'A');

    const instructions = compile(graphSource('g', ['A>B', 'B>C', 'C>A'], 'TOPO_SORT g'));
    expect(genericActions(instructions)[0].actionName).toBe('TOPO_SORT');

    const result = new GraphAlgorithm(graph).topologicalSort();
    expect(result.hasCycle).toBe(true);
  });

  it('emits MST animation frames for edge consideration and acceptance', () => {
    const graph = weightedGraphFromEdgeStrings(['A-B:1', 'A-C:3', 'B-C:2']);
    const result = new GraphAlgorithm(graph).kruskal();
    const sorted = result.animationFrames.filter((f) => f.type === 'SORTED');
    const addEdges = result.animationFrames.filter((f) => f.type === 'ADD_EDGE');
    expect(sorted).toHaveLength(1);
    expect(addEdges.length).toBeGreaterThan(0);
  });

  it('handles graph sizes of 5, 20, and 100 vertices for Kruskal', () => {
    for (const size of [5, 20, 100]) {
      const graph = new Graph([], [], false, true);
      for (let i = 0; i < size - 1; i++) {
        graph.addEdge(`V${i}`, `V${i + 1}`, 1);
      }
      const result = new GraphAlgorithm(graph).kruskal();
      expect(result.mstEdges).toHaveLength(size - 1);
      expect(result.totalWeight).toBe(size - 1);
    }
  });
});
