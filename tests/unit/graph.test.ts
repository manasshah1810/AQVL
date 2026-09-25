/**
 * Unit tests for Graph / Vertex / Edge (packages/runtime/src/data-structures) —
 * the pure, scene-free adjacency-list graph structure that backs the
 * upcoming DFS / BFS / Dijkstra / Prim / Kruskal / topological-sort engines.
 */
import { describe, expect, it } from 'vitest';
import { Graph } from '../../packages/runtime/src/data-structures/Graph';
import { Vertex } from '../../packages/runtime/src/data-structures/Vertex';

describe('Graph', () => {
  it('starts empty', () => {
    const g = new Graph();
    expect(g.getVertexCount()).toBe(0);
    expect(g.getEdgeCount()).toBe(0);
    expect(g.getAllVertices()).toEqual([]);
    expect(g.getAllEdges()).toEqual([]);
  });

  it('adds vertices', () => {
    const g = new Graph();
    const a = g.addVertex('A');
    expect(a.id).toBe('A');
    expect(g.getVertexCount()).toBe(1);
    expect(g.getAllVertices().map(v => v.id)).toEqual(['A']);
  });

  it('returns the same vertex instance when addVertex is called twice for the same id', () => {
    const g = new Graph();
    const a1 = g.addVertex('A');
    const a2 = g.addVertex('A');
    expect(a1).toBe(a2);
    expect(g.getVertexCount()).toBe(1);
  });

  it('adds an undirected edge and implicitly creates missing vertices', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    expect(g.getVertexCount()).toBe(2);
    expect(g.getEdgeCount()).toBe(1);
    expect(g.hasEdge('A', 'B')).toBe(true);
    expect(g.hasEdge('B', 'A')).toBe(true); // undirected → symmetric
  });

  it('adds a directed edge that is only traversable one way', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    expect(g.hasEdge('A', 'B')).toBe(true);
    expect(g.hasEdge('B', 'A')).toBe(false);
  });

  it('getNeighbors returns correct vertices', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    const neighbors = g.getNeighbors('A').map(v => v.id).sort();
    expect(neighbors).toEqual(['B', 'C']);
  });

  it('getEdgeWeight returns the correct weight for weighted graphs', () => {
    const g = new Graph([], [], false, true);
    g.addEdge('A', 'B', 5);
    expect(g.getEdgeWeight('A', 'B')).toBe(5);
    expect(g.getEdgeWeight('B', 'A')).toBe(5); // undirected → symmetric
  });

  it('getEdgeWeight returns undefined for unweighted edges', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    expect(g.getEdgeWeight('A', 'B')).toBeUndefined();
  });

  it('getEdgeWeight returns undefined for a nonexistent edge', () => {
    const g = new Graph();
    g.addVertex('A');
    g.addVertex('B');
    expect(g.getEdgeWeight('A', 'B')).toBeUndefined();
  });

  it('removeEdge removes an undirected edge symmetrically', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.removeEdge('A', 'B');
    expect(g.hasEdge('A', 'B')).toBe(false);
    expect(g.hasEdge('B', 'A')).toBe(false);
    expect(g.getEdgeCount()).toBe(0);
  });

  it('removeEdge on a directed graph only removes the one direction', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'A');
    g.removeEdge('A', 'B');
    expect(g.hasEdge('A', 'B')).toBe(false);
    expect(g.hasEdge('B', 'A')).toBe(true);
  });

  it('builds the adjacency list correctly from constructor edges', () => {
    const g = new Graph(
      [new Vertex('A'), new Vertex('B'), new Vertex('C')],
      [
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
      ]
    );
    expect(g.getNeighbors('A').map(v => v.id)).toEqual(['B']);
    expect(g.getNeighbors('B').map(v => v.id).sort()).toEqual(['A', 'C']);
    expect(g.getNeighbors('C').map(v => v.id)).toEqual(['B']);
  });

  it('isConnected is true for an empty graph', () => {
    const g = new Graph();
    expect(g.isConnected()).toBe(true);
  });

  it('isConnected is true for a single vertex', () => {
    const g = new Graph();
    g.addVertex('A');
    expect(g.isConnected()).toBe(true);
  });

  it('isConnected detects a connected undirected graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    expect(g.isConnected()).toBe(true);
  });

  it('isConnected detects a disconnected undirected graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addVertex('C'); // isolated
    expect(g.isConnected()).toBe(false);
  });

  it('isConnected treats a directed graph as weakly connected', () => {
    const g = new Graph([], [], true);
    g.addEdge('A', 'B');
    g.addEdge('C', 'B'); // no path A -> C directed, but weakly connected
    expect(g.isConnected()).toBe(true);
  });

  it('getAllEdges reflects the edges added', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    expect(g.getAllEdges().length).toBe(2);
  });

  it('resetTraversalState clears visited/distance/predecessor on every vertex', () => {
    const g = new Graph();
    const a = g.addVertex('A');
    a.visited = true;
    a.distance = 3;
    a.predecessor = g.addVertex('B');

    g.resetTraversalState();

    expect(a.visited).toBe(false);
    expect(a.distance).toBe(Infinity);
    expect(a.predecessor).toBeNull();
    expect(a.color).toBe('white');
  });
});
