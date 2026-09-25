/**
 * Unit tests for GraphAlgorithm (packages/runtime/src/core/algorithms/GraphEngine.ts) —
 * the pure, scene-free DFS / BFS / connected-components implementations that
 * back the AQVL DFS / BFS built-ins.
 */
import { describe, expect, it } from 'vitest';
import { Graph } from '../../packages/runtime/src/data-structures/Graph';
import { GraphAlgorithm } from '../../packages/runtime/src/core/algorithms/GraphEngine';

describe('GraphAlgorithm.depthFirstSearch', () => {
  it('visits a linear graph (A -> B -> C) in order', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    const algo = new GraphAlgorithm(g);
    const result = algo.depthFirstSearch('A');
    expect(result.order).toEqual(['A', 'B', 'C']);
    expect(result.visited).toEqual(new Set(['A', 'B', 'C']));
  });

  it('visits a tree structure depth-first', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('B', 'E');
    const algo = new GraphAlgorithm(g);
    const result = algo.depthFirstSearch('A');
    expect(result.order).toEqual(['A', 'B', 'D', 'E', 'C']);
  });

  it('does not infinite loop on a cycle', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    const algo = new GraphAlgorithm(g);
    const result = algo.depthFirstSearch('A');
    expect(result.order).toEqual(['A', 'B', 'C']);
    expect(result.visited.size).toBe(3);
  });

  it('only reaches vertices in the same component as the start vertex', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addVertex('C'); // disconnected
    g.addVertex('D');
    const algo = new GraphAlgorithm(g);
    const result = algo.depthFirstSearch('A');
    expect(result.order.sort()).toEqual(['A', 'B']);
    expect(result.visited.has('C')).toBe(false);
    expect(result.visited.has('D')).toBe(false);
  });

  it('handles a single vertex with no edges', () => {
    const g = new Graph();
    g.addVertex('A');
    const algo = new GraphAlgorithm(g);
    const result = algo.depthFirstSearch('A');
    expect(result.order).toEqual(['A']);
    expect(result.animationFrames).toEqual([{ type: 'VISIT', vertexId: 'A' }]);
  });

  it('handles an empty graph (start vertex does not exist)', () => {
    const g = new Graph();
    const algo = new GraphAlgorithm(g);
    const result = algo.depthFirstSearch('A');
    expect(result.order).toEqual([]);
    expect(result.visited.size).toBe(0);
    expect(result.animationFrames).toEqual([]);
  });
});

describe('GraphAlgorithm.breadthFirstSearch', () => {
  it('visits a linear graph in breadth order', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    const algo = new GraphAlgorithm(g);
    const result = algo.breadthFirstSearch('A');
    expect(result.order).toEqual(['A', 'B', 'C']);
  });

  it('visits a tree level by level', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'E');
    const algo = new GraphAlgorithm(g);
    const result = algo.breadthFirstSearch('A');
    expect(result.order).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('does not infinite loop on a cycle', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    const algo = new GraphAlgorithm(g);
    const result = algo.breadthFirstSearch('A');
    expect(result.order).toEqual(['A', 'B', 'C']);
    expect(result.visited.size).toBe(3);
  });

  it('computes correct levels (distance from start) for a tree', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('D', 'E');
    const algo = new GraphAlgorithm(g);
    const result = algo.breadthFirstSearch('A');
    expect(result.level.get('A')).toBe(0);
    expect(result.level.get('B')).toBe(1);
    expect(result.level.get('C')).toBe(1);
    expect(result.level.get('D')).toBe(2);
    expect(result.level.get('E')).toBe(3);
  });

  it('handles a single vertex with no edges', () => {
    const g = new Graph();
    g.addVertex('A');
    const algo = new GraphAlgorithm(g);
    const result = algo.breadthFirstSearch('A');
    expect(result.order).toEqual(['A']);
    expect(result.level.get('A')).toBe(0);
  });

  it('handles an empty graph (start vertex does not exist)', () => {
    const g = new Graph();
    const algo = new GraphAlgorithm(g);
    const result = algo.breadthFirstSearch('A');
    expect(result.order).toEqual([]);
    expect(result.level.size).toBe(0);
    expect(result.animationFrames).toEqual([]);
  });
});

describe('GraphAlgorithm.dijkstra', () => {
  it('finds correct distances on a simple weighted path', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 2);
    const algo = new GraphAlgorithm(g);
    const result = algo.dijkstra('A');
    expect(result.distances.get('A')).toBe(0);
    expect(result.distances.get('B')).toBe(1);
    expect(result.distances.get('C')).toBe(3);
  });

  it('chooses the shortest of multiple paths', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 5);
    g.addEdge('A', 'C', 1);
    g.addEdge('C', 'B', 1);
    const algo = new GraphAlgorithm(g);
    const result = algo.dijkstra('A');
    expect(result.distances.get('B')).toBe(2);
    expect(result.predecessor.get('B')).toBe('C');
    expect(result.predecessor.get('C')).toBe('A');
  });

  it('leaves unreachable vertices at distance Infinity', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addVertex('Z');
    const algo = new GraphAlgorithm(g);
    const result = algo.dijkstra('A');
    expect(result.distances.get('Z')).toBe(Infinity);
    expect(result.predecessor.get('Z')).toBe(null);
  });

  it('handles a single vertex with no edges', () => {
    const g = new Graph();
    g.addVertex('A');
    const algo = new GraphAlgorithm(g);
    const result = algo.dijkstra('A');
    expect(result.distances.get('A')).toBe(0);
    expect(result.animationFrames).toEqual([{ type: 'VISIT', vertexId: 'A' }]);
  });

  it('reconstructs the shortest path from the predecessor map', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 1);
    g.addEdge('A', 'C', 10);
    const algo = new GraphAlgorithm(g);
    const result = algo.dijkstra('A');
    const path = algo.reconstructPath(result.predecessor, 'A', 'C');
    expect(path).toEqual(['A', 'B', 'C']);
  });
});

describe('GraphAlgorithm.bellmanFord', () => {
  it('finds correct distances on a simple weighted path', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 2);
    const algo = new GraphAlgorithm(g);
    const result = algo.bellmanFord('A');
    expect(result.distances.get('C')).toBe(3);
    expect(result.hasNegativeCycle).toBe(false);
  });

  it('chooses the shortest of multiple paths', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 5);
    g.addEdge('A', 'C', 1);
    g.addEdge('C', 'B', 1);
    const algo = new GraphAlgorithm(g);
    const result = algo.bellmanFord('A');
    expect(result.distances.get('B')).toBe(2);
  });

  it('leaves unreachable vertices at distance Infinity', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addVertex('Z');
    const algo = new GraphAlgorithm(g);
    const result = algo.bellmanFord('A');
    expect(result.distances.get('Z')).toBe(Infinity);
  });

  it('handles negative edge weights correctly', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 5);
    g.addEdge('B', 'C', -3);
    const algo = new GraphAlgorithm(g);
    const result = algo.bellmanFord('A');
    expect(result.distances.get('C')).toBe(1);
    expect(result.hasNegativeCycle).toBe(false);
  });

  it('detects a negative-weight cycle', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', -1);
    g.addEdge('C', 'B', -1);
    const algo = new GraphAlgorithm(g);
    const result = algo.bellmanFord('A');
    expect(result.hasNegativeCycle).toBe(true);
  });
});

describe('GraphAlgorithm.aStar', () => {
  it('finds a simple path with a heuristic', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 1);
    g.addEdge('A', 'C', 10);
    const coords: Record<string, number> = { A: 0, B: 1, C: 2 };
    const algo = new GraphAlgorithm(g);
    const result = algo.aStar('A', 'C', (v, goal) => Math.abs(coords[v] - coords[goal]));
    expect(result.path).toEqual(['A', 'B', 'C']);
    expect(result.distance).toBe(2);
  });

  it('returns an empty path when the goal is unreachable', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addVertex('Z');
    const algo = new GraphAlgorithm(g);
    const result = algo.aStar('A', 'Z');
    expect(result.path).toEqual([]);
    expect(result.distance).toBe(Infinity);
  });

  it('finds the same optimal path with or without a heuristic', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'D', 1);
    g.addEdge('A', 'C', 1);
    g.addEdge('C', 'D', 1);
    g.addEdge('A', 'D', 5);
    const algo = new GraphAlgorithm(g);
    const withHeuristic = algo.aStar('A', 'D', () => 0);
    const withoutHeuristic = algo.aStar('A', 'D');
    expect(withHeuristic.distance).toBe(2);
    expect(withoutHeuristic.distance).toBe(2);
  });

  it('finds the optimal (shortest) path among several options', () => {
    const g = new Graph([], [], true, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 1);
    g.addEdge('A', 'D', 1);
    g.addEdge('D', 'C', 1);
    g.addEdge('A', 'C', 5);
    const algo = new GraphAlgorithm(g);
    const result = algo.aStar('A', 'C');
    expect(result.distance).toBe(2);
    expect(result.path[0]).toBe('A');
    expect(result.path[result.path.length - 1]).toBe('C');
  });
});

describe('GraphAlgorithm.getComponentsViaDFS', () => {
  it('finds a single component in a fully connected graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    const algo = new GraphAlgorithm(g);
    const components = algo.getComponentsViaDFS();
    expect(components.size).toBe(1);
    const [component] = components;
    expect([...component].sort()).toEqual(['A', 'B', 'C']);
  });

  it('finds two components in a graph split into two halves', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('C', 'D');
    const algo = new GraphAlgorithm(g);
    const components = algo.getComponentsViaDFS();
    expect(components.size).toBe(2);
    const sizes = [...components].map((c) => c.size).sort();
    expect(sizes).toEqual([2, 2]);
  });

  it('finds multiple components including isolated vertices', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addVertex('C');
    g.addVertex('D');
    g.addEdge('E', 'F');
    const algo = new GraphAlgorithm(g);
    const components = algo.getComponentsViaDFS();
    expect(components.size).toBe(4);
    const sizes = [...components].map((c) => c.size).sort();
    expect(sizes).toEqual([1, 1, 2, 2]);
  });
});

describe('GraphAlgorithm.prim', () => {
  it('finds the MST of a tree graph (every edge is already the MST)', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'C', 2);
    g.addEdge('B', 'D', 3);
    const algo = new GraphAlgorithm(g);
    const result = algo.prim('A');
    expect(result.totalWeight).toBe(6);
    expect(result.mstEdges).toHaveLength(3);
  });

  it('chooses the minimum-weight edge among multiple paths', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 5);
    g.addEdge('A', 'C', 1);
    g.addEdge('C', 'B', 1);
    const algo = new GraphAlgorithm(g);
    const result = algo.prim('A');
    expect(result.totalWeight).toBe(2);
    expect(result.mstEdges).toContainEqual({ source: 'A', target: 'C', weight: 1 });
    expect(result.mstEdges).toContainEqual({ source: 'C', target: 'B', weight: 1 });
  });

  it('only spans the start vertex\'s component on a disconnected graph', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('C', 'D', 1);
    const algo = new GraphAlgorithm(g);
    const result = algo.prim('A');
    expect(result.mstEdges).toHaveLength(1);
    expect(result.totalWeight).toBe(1);
  });

  it('handles a single vertex with no edges', () => {
    const g = new Graph();
    g.addVertex('A');
    const algo = new GraphAlgorithm(g);
    const result = algo.prim('A');
    expect(result.mstEdges).toEqual([]);
    expect(result.totalWeight).toBe(0);
  });

  it('finds the MST of a complete graph', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'C', 3);
    g.addEdge('A', 'D', 4);
    g.addEdge('B', 'C', 2);
    g.addEdge('B', 'D', 5);
    g.addEdge('C', 'D', 6);
    const algo = new GraphAlgorithm(g);
    const result = algo.prim('A');
    expect(result.mstEdges).toHaveLength(3);
    expect(result.totalWeight).toBe(1 + 2 + 4);
  });
});

describe('GraphAlgorithm.kruskal', () => {
  it('finds the MST of a tree graph (every edge is already the MST)', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'C', 2);
    g.addEdge('B', 'D', 3);
    const algo = new GraphAlgorithm(g);
    const result = algo.kruskal();
    expect(result.totalWeight).toBe(6);
    expect(result.mstEdges).toHaveLength(3);
  });

  it('chooses the minimum-weight edge among multiple paths', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 5);
    g.addEdge('A', 'C', 1);
    g.addEdge('C', 'B', 1);
    const algo = new GraphAlgorithm(g);
    const result = algo.kruskal();
    expect(result.totalWeight).toBe(2);
  });

  it('builds a minimum spanning forest across a disconnected graph', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('C', 'D', 2);
    const algo = new GraphAlgorithm(g);
    const result = algo.kruskal();
    expect(result.mstEdges).toHaveLength(2);
    expect(result.totalWeight).toBe(3);
  });

  it('finds the MST of a complete graph and rejects cycle-forming edges', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'C', 3);
    g.addEdge('A', 'D', 4);
    g.addEdge('B', 'C', 2);
    g.addEdge('B', 'D', 5);
    g.addEdge('C', 'D', 6);
    const algo = new GraphAlgorithm(g);
    const result = algo.kruskal();
    expect(result.mstEdges).toHaveLength(3);
    expect(result.totalWeight).toBe(1 + 2 + 4);
    const rejects = result.animationFrames.filter((f) => f.type === 'REJECT');
    expect(rejects.length).toBeGreaterThan(0);
  });

  it('agrees with prim() on the total MST weight for a connected graph', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'C', 3);
    g.addEdge('A', 'D', 4);
    g.addEdge('B', 'C', 2);
    g.addEdge('B', 'D', 5);
    g.addEdge('C', 'D', 6);
    const algo = new GraphAlgorithm(g);
    expect(algo.kruskal().totalWeight).toBe(algo.prim('A').totalWeight);
  });
});

describe('GraphAlgorithm.topologicalSort', () => {
  it('orders a linear DAG (A -> B -> C -> D)', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    const algo = new GraphAlgorithm(g);
    const result = algo.topologicalSort();
    expect(result.hasCycle).toBe(false);
    expect(result.ordering).toEqual(['A', 'B', 'C', 'D']);
  });

  it('orders a diamond DAG (A -> B, A -> C, B -> D, C -> D)', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'D');
    const algo = new GraphAlgorithm(g);
    const result = algo.topologicalSort();
    expect(result.hasCycle).toBe(false);
    expect(result.ordering.indexOf('A')).toBeLessThan(result.ordering.indexOf('B'));
    expect(result.ordering.indexOf('A')).toBeLessThan(result.ordering.indexOf('C'));
    expect(result.ordering.indexOf('B')).toBeLessThan(result.ordering.indexOf('D'));
    expect(result.ordering.indexOf('C')).toBeLessThan(result.ordering.indexOf('D'));
  });

  it('orders independent branches, each internally consistent', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('C', 'D');
    const algo = new GraphAlgorithm(g);
    const result = algo.topologicalSort();
    expect(result.hasCycle).toBe(false);
    expect(result.ordering.sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(result.ordering.indexOf('A')).toBeLessThan(result.ordering.indexOf('B'));
    expect(result.ordering.indexOf('C')).toBeLessThan(result.ordering.indexOf('D'));
  });

  it('detects a cycle and reports hasCycle', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    const algo = new GraphAlgorithm(g);
    const result = algo.topologicalSort();
    expect(result.hasCycle).toBe(true);
  });

  it('handles a single vertex with no edges', () => {
    const g = new Graph([], [], true);
    g.addVertex('A');
    const algo = new GraphAlgorithm(g);
    const result = algo.topologicalSort();
    expect(result.hasCycle).toBe(false);
    expect(result.ordering).toEqual(['A']);
  });
});
