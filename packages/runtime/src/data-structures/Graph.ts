import { Vertex } from './Vertex';
import { Edge } from './Edge';

interface AdjacencyEntry<T> {
  target: Vertex<T>;
  weight?: number;
}

/**
 * Graph — adjacency-list backed graph supporting directed/undirected and
 * weighted/unweighted configurations. Pure data structure: no scene or
 * animation dependency. Consumed by GraphEngine for traversal/shortest-path
 * algorithms (DFS, BFS, Dijkstra, Prim, Kruskal, topological sort).
 */
export class Graph<T = any> {
  readonly vertices: Map<string, Vertex<T>> = new Map();
  readonly adjacencyList: Map<string, AdjacencyEntry<T>[]> = new Map();
  readonly edges: Set<Edge<T>> = new Set();
  readonly directed: boolean;
  readonly weighted: boolean;

  constructor(
    vertices: Vertex<T>[] = [],
    edges: { source: string; target: string; weight?: number }[] = [],
    directed: boolean = false,
    weighted: boolean = false
  ) {
    this.directed = directed;
    this.weighted = weighted;

    for (const vertex of vertices) {
      this.vertices.set(vertex.id, vertex);
      this.adjacencyList.set(vertex.id, []);
    }
    for (const e of edges) {
      this.addEdge(e.source, e.target, e.weight);
    }
  }

  addVertex(id: string, data?: T): Vertex<T> {
    const existing = this.vertices.get(id);
    if (existing) return existing;

    const vertex = new Vertex<T>(id, data);
    this.vertices.set(id, vertex);
    this.adjacencyList.set(id, []);
    return vertex;
  }

  addEdge(source: string, target: string, weight?: number): Edge<T> {
    const sourceVertex = this.vertices.get(source) ?? this.addVertex(source);
    const targetVertex = this.vertices.get(target) ?? this.addVertex(target);

    const edge = new Edge<T>(sourceVertex, targetVertex, weight, this.directed);
    this.edges.add(edge);

    this.adjacencyList.get(source)!.push({ target: targetVertex, weight });
    if (!this.directed) {
      this.adjacencyList.get(target)!.push({ target: sourceVertex, weight });
    }

    return edge;
  }

  removeEdge(source: string, target: string): void {
    const sourceList = this.adjacencyList.get(source);
    if (sourceList) {
      const idx = sourceList.findIndex(entry => entry.target.id === target);
      if (idx !== -1) sourceList.splice(idx, 1);
    }
    if (!this.directed) {
      const targetList = this.adjacencyList.get(target);
      if (targetList) {
        const idx = targetList.findIndex(entry => entry.target.id === source);
        if (idx !== -1) targetList.splice(idx, 1);
      }
    }

    for (const edge of this.edges) {
      const matches = this.directed
        ? edge.source.id === source && edge.target.id === target
        : (edge.source.id === source && edge.target.id === target) ||
          (edge.source.id === target && edge.target.id === source);
      if (matches) this.edges.delete(edge);
    }
  }

  getNeighbors(vertexId: string): Vertex<T>[] {
    return (this.adjacencyList.get(vertexId) ?? []).map(entry => entry.target);
  }

  getEdgeWeight(source: string, target: string): number | undefined {
    const entry = (this.adjacencyList.get(source) ?? []).find(e => e.target.id === target);
    return entry?.weight;
  }

  hasEdge(source: string, target: string): boolean {
    return (this.adjacencyList.get(source) ?? []).some(entry => entry.target.id === target);
  }

  getVertexCount(): number {
    return this.vertices.size;
  }

  getEdgeCount(): number {
    return this.edges.size;
  }

  getAllVertices(): Vertex<T>[] {
    return Array.from(this.vertices.values());
  }

  getAllEdges(): Edge<T>[] {
    return Array.from(this.edges);
  }

  /** Resets visited/distance/predecessor/color state on every vertex. */
  resetTraversalState(): void {
    for (const vertex of this.vertices.values()) {
      vertex.resetTraversalState();
    }
  }

  /** Whether every vertex is reachable from any other (undirected reachability). */
  isConnected(): boolean {
    if (this.vertices.size === 0) return true;

    const start = this.vertices.keys().next().value as string;
    const visited = new Set<string>();
    const stack = [start];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const neighbor of this.getNeighbors(current)) {
        if (!visited.has(neighbor.id)) stack.push(neighbor.id);
      }
      // For directed graphs, also traverse incoming edges so isConnected()
      // reflects weak connectivity rather than reachability from `start` alone.
      if (this.directed) {
        for (const edge of this.edges) {
          if (edge.target.id === current && !visited.has(edge.source.id)) {
            stack.push(edge.source.id);
          }
        }
      }
    }

    return visited.size === this.vertices.size;
  }
}
