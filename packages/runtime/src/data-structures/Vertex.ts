/**
 * Vertex — a node in a Graph.
 *
 * Carries the transient fields used by graph traversal / shortest-path
 * algorithms (DFS, BFS, Dijkstra, Prim, Kruskal, topological sort).
 * These fields are reset by `Graph.resetTraversalState()` between runs.
 */
export class Vertex<T = any> {
  readonly id: string;
  data?: T;

  // Traversal state
  visited?: boolean;
  distance?: number;
  predecessor?: Vertex<T> | null;

  // DFS coloring
  color?: 'white' | 'gray' | 'black';
  discoveryTime?: number;
  finishTime?: number;

  constructor(id: string, data?: T) {
    this.id = id;
    this.data = data;
  }

  /** Reset all transient traversal/algorithm fields to their initial state. */
  resetTraversalState(): void {
    this.visited = false;
    this.distance = Infinity;
    this.predecessor = null;
    this.color = 'white';
    this.discoveryTime = undefined;
    this.finishTime = undefined;
  }
}
