/**
 * GraphAlgorithm — traversal, shortest-path, MST, and topological-sort
 * algorithms over a graph: depthFirstSearch, breadthFirstSearch,
 * getComponentsViaDFS, dijkstra, bellmanFord, aStar (+ reconstructPath),
 * prim, kruskal, and topologicalSort.
 *
 * Wraps a pure `Graph` instance (see ../../data-structures/Graph) — no
 * scene or animation dependency here, matching SortEngine's design. The
 * core algorithm entry points (depthFirstSearch, breadthFirstSearch,
 * dijkstra, bellmanFord, aStar, prim, kruskal, topologicalSort) each return
 * both their result and a list of replayable animation steps
 * (GraphTraversalStep / ShortestPathStep / MSTStep / TopoSortStep) for the
 * animation layer (GraphAlgorithms) to walk and turn into scene mutations.
 * Two helpers built on top of those don't carry their own animation steps:
 * getComponentsViaDFS (composes repeated depthFirstSearch calls into a plain
 * Set<Set<string>> of components) and reconstructPath (walks a
 * dijkstra/bellmanFord/aStar predecessor map into a plain string[] path).
 */
import { Graph } from '../../data-structures/Graph';
import { Vertex } from '../../data-structures/Vertex';
import { Edge } from '../../data-structures/Edge';
import { MinHeap } from '../../data-structures/PriorityQueue';
import { UnionFind } from '../../data-structures/UnionFind';

export interface AnimationFrame {
  action: string;
  [key: string]: any;
}

/**
 * A single replayable step of a traversal, in the same "pure step list"
 * spirit as SortEngine's SortStep — the animation layer (GraphAlgorithms)
 * walks this list and turns each entry into scene mutations/animations.
 */
export type GraphTraversalStep =
  | { type: 'VISIT'; vertexId: string; level?: number }
  | { type: 'EDGE'; fromId: string; toId: string };

export interface DFSResult {
  /** Every vertex id reached from the start vertex. */
  visited: Set<string>;
  /** Vertex ids in the order they were visited. */
  order: string[];
  animationFrames: GraphTraversalStep[];
}

export interface BFSResult {
  visited: Set<string>;
  order: string[];
  /** Distance (in edges) of each visited vertex from the start vertex. */
  level: Map<string, number>;
  animationFrames: GraphTraversalStep[];
}

/**
 * A single replayable step of a shortest-path run. VISIT marks a vertex as
 * settled/expanded; RELAX marks a distance improvement across an edge (the
 * animation layer uses this to flash the edge and update the vertex's
 * distance label).
 */
export type ShortestPathStep =
  | { type: 'VISIT'; vertexId: string }
  | { type: 'RELAX'; fromId: string; toId: string; distance: number };

export interface DijkstraResult {
  distances: Map<string, number>;
  predecessor: Map<string, string | null>;
  animationFrames: ShortestPathStep[];
}

export interface BellmanFordResult {
  distances: Map<string, number>;
  predecessor: Map<string, string | null>;
  hasNegativeCycle: boolean;
  animationFrames: ShortestPathStep[];
}

export interface AStarResult {
  path: string[];
  distance: number;
  animationFrames: ShortestPathStep[];
}

export type Heuristic = (vertexId: string, goalId: string) => number;

/**
 * A single replayable step of a Prim/Kruskal MST run. CONSIDER marks an edge
 * being weighed against the current frontier/sort order; ADD_EDGE marks it
 * accepted into the MST; ADD_VERTEX marks a vertex joining Prim's tree;
 * REJECT marks a Kruskal edge skipped because it would close a cycle; SORTED
 * carries Kruskal's edge list once sorted by weight (for an up-front "sorting"
 * animation beat).
 */
export type MSTStep =
  | { type: 'CONSIDER'; fromId: string; toId: string; weight: number }
  | { type: 'ADD_EDGE'; fromId: string; toId: string; weight: number }
  | { type: 'ADD_VERTEX'; vertexId: string }
  | { type: 'REJECT'; fromId: string; toId: string; weight: number }
  | { type: 'SORTED'; order: Array<{ fromId: string; toId: string; weight: number }> };

export interface MSTEdgeResult {
  source: string;
  target: string;
  weight: number;
}

export interface PrimResult {
  mstEdges: MSTEdgeResult[];
  totalWeight: number;
  animationFrames: MSTStep[];
}

export interface KruskalResult {
  mstEdges: MSTEdgeResult[];
  totalWeight: number;
  animationFrames: MSTStep[];
}

/**
 * A single replayable step of a topological sort's DFS pass. VISIT marks a
 * vertex entering the recursion stack (gray); FINISH marks it fully explored
 * (black) and appended to the ordering; CYCLE marks a back-edge to a vertex
 * still on the stack (gray), which is what makes the graph not a DAG.
 */
export type TopoSortStep =
  | { type: 'VISIT'; vertexId: string }
  | { type: 'FINISH'; vertexId: string }
  | { type: 'CYCLE'; vertexId: string };

export interface TopologicalSortResult {
  ordering: string[];
  hasCycle: boolean;
  animationFrames: TopoSortStep[];
}

export class GraphAlgorithm<T = any> {
  graph: Graph<T>;
  animationFrames: AnimationFrame[] = [];

  constructor(graph: Graph<T>) {
    this.graph = graph;
  }

  /**
   * Iterative depth-first search using an explicit stack (no recursion, so
   * arbitrarily deep/cyclic graphs never blow the call stack). Each
   * neighbor is pushed in reverse adjacency order so visitation order
   * matches the natural (recursive) DFS order.
   */
  depthFirstSearch(startVertex: string): DFSResult {
    const visited = new Set<string>();
    const order: string[] = [];
    const animationFrames: GraphTraversalStep[] = [];

    if (!this.graph.vertices.has(startVertex)) {
      return { visited, order, animationFrames };
    }

    const stack: Array<{ id: string; from: string | null }> = [{ id: startVertex, from: null }];

    while (stack.length > 0) {
      const { id, from } = stack.pop()!;
      if (visited.has(id)) continue;

      visited.add(id);
      order.push(id);
      if (from) animationFrames.push({ type: 'EDGE', fromId: from, toId: id });
      animationFrames.push({ type: 'VISIT', vertexId: id });

      const neighbors = this.graph.getNeighbors(id);
      for (let i = neighbors.length - 1; i >= 0; i--) {
        const neighbor = neighbors[i];
        if (!visited.has(neighbor.id)) {
          stack.push({ id: neighbor.id, from: id });
        }
      }
    }

    return { visited, order, animationFrames };
  }

  /**
   * Iterative breadth-first search using an explicit queue. Vertices are
   * marked visited at enqueue time (not dequeue time) so the same vertex
   * is never queued twice, which is what keeps cyclic graphs from looping.
   */
  breadthFirstSearch(startVertex: string): BFSResult {
    const visited = new Set<string>();
    const order: string[] = [];
    const level = new Map<string, number>();
    const animationFrames: GraphTraversalStep[] = [];

    if (!this.graph.vertices.has(startVertex)) {
      return { visited, order, level, animationFrames };
    }

    const queue: Array<{ id: string; from: string | null; depth: number }> = [
      { id: startVertex, from: null, depth: 0 },
    ];
    visited.add(startVertex);

    while (queue.length > 0) {
      const { id, from, depth } = queue.shift()!;

      order.push(id);
      level.set(id, depth);
      if (from) animationFrames.push({ type: 'EDGE', fromId: from, toId: id });
      animationFrames.push({ type: 'VISIT', vertexId: id, level: depth });

      for (const neighbor of this.graph.getNeighbors(id)) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ id: neighbor.id, from: id, depth: depth + 1 });
        }
      }
    }

    return { visited, order, level, animationFrames };
  }

  /** Finds every connected component by running DFS from each not-yet-visited vertex. */
  getComponentsViaDFS(): Set<Set<string>> {
    const globallyVisited = new Set<string>();
    const components = new Set<Set<string>>();

    for (const vertexId of this.graph.vertices.keys()) {
      if (globallyVisited.has(vertexId)) continue;

      const { order } = this.depthFirstSearch(vertexId);
      const component = new Set(order);
      for (const id of component) globallyVisited.add(id);
      components.add(component);
    }

    return components;
  }

  /**
   * Dijkstra's algorithm via an indexed min-heap (see ../../data-structures/PriorityQueue).
   * Assumes non-negative edge weights (unweighted edges default to weight 1);
   * negative weights should use `bellmanFord` instead.
   */
  dijkstra(sourceVertex: string): DijkstraResult {
    const distances = new Map<string, number>();
    const predecessor = new Map<string, string | null>();
    const animationFrames: ShortestPathStep[] = [];

    if (!this.graph.vertices.has(sourceVertex)) {
      return { distances, predecessor, animationFrames };
    }

    for (const id of this.graph.vertices.keys()) {
      distances.set(id, Infinity);
      predecessor.set(id, null);
    }
    distances.set(sourceVertex, 0);

    const pq = new MinHeap<string>();
    pq.push(sourceVertex, 0);
    const settled = new Set<string>();

    while (!pq.isEmpty()) {
      const currentId = pq.pop()!;
      if (settled.has(currentId)) continue;
      settled.add(currentId);
      animationFrames.push({ type: 'VISIT', vertexId: currentId });

      const currentDist = distances.get(currentId)!;
      if (currentDist === Infinity) continue;

      for (const neighbor of this.graph.getNeighbors(currentId)) {
        if (settled.has(neighbor.id)) continue;

        const weight = this.graph.getEdgeWeight(currentId, neighbor.id) ?? 1;
        const newDist = currentDist + weight;

        if (newDist < (distances.get(neighbor.id) ?? Infinity)) {
          distances.set(neighbor.id, newDist);
          predecessor.set(neighbor.id, currentId);
          animationFrames.push({ type: 'RELAX', fromId: currentId, toId: neighbor.id, distance: newDist });

          if (pq.contains(neighbor.id)) {
            pq.updatePriority(neighbor.id, newDist);
          } else {
            pq.push(neighbor.id, newDist);
          }
        }
      }
    }

    return { distances, predecessor, animationFrames };
  }

  /**
   * Bellman-Ford: relaxes every edge |V|-1 times (tolerating negative
   * weights, unlike Dijkstra), then does one more relaxation pass to detect
   * a negative-weight cycle reachable from the source.
   */
  bellmanFord(sourceVertex: string): BellmanFordResult {
    const distances = new Map<string, number>();
    const predecessor = new Map<string, string | null>();
    const animationFrames: ShortestPathStep[] = [];
    let hasNegativeCycle = false;

    if (!this.graph.vertices.has(sourceVertex)) {
      return { distances, predecessor, hasNegativeCycle, animationFrames };
    }

    for (const id of this.graph.vertices.keys()) {
      distances.set(id, Infinity);
      predecessor.set(id, null);
    }
    distances.set(sourceVertex, 0);

    // Undirected edges relax in both directions; directed edges relax once.
    const directedEdges: Array<{ source: string; target: string; weight: number }> = [];
    for (const edge of this.graph.edges) {
      const weight = edge.weight ?? 1;
      directedEdges.push({ source: edge.source.id, target: edge.target.id, weight });
      if (!this.graph.directed) {
        directedEdges.push({ source: edge.target.id, target: edge.source.id, weight });
      }
    }

    const vertexCount = this.graph.vertices.size;
    for (let i = 0; i < vertexCount - 1; i++) {
      let relaxedAny = false;

      for (const { source, target, weight } of directedEdges) {
        const sourceDist = distances.get(source)!;
        if (sourceDist === Infinity) continue;

        const newDist = sourceDist + weight;
        if (newDist < distances.get(target)!) {
          distances.set(target, newDist);
          predecessor.set(target, source);
          animationFrames.push({ type: 'RELAX', fromId: source, toId: target, distance: newDist });
          relaxedAny = true;
        }
      }

      if (!relaxedAny) break;
    }

    for (const { source, target, weight } of directedEdges) {
      const sourceDist = distances.get(source)!;
      if (sourceDist === Infinity) continue;
      if (sourceDist + weight < distances.get(target)!) {
        hasNegativeCycle = true;
        break;
      }
    }

    return { distances, predecessor, hasNegativeCycle, animationFrames };
  }

  /**
   * A* search: Dijkstra guided by an admissible `heuristic(vertexId, goalId)`
   * (defaults to 0, which degrades to plain Dijkstra restricted to the goal).
   * Stops as soon as the goal is popped off the frontier rather than
   * computing distances to every vertex.
   */
  aStar(sourceVertex: string, goalVertex: string, heuristic?: Heuristic): AStarResult {
    const animationFrames: ShortestPathStep[] = [];

    if (!this.graph.vertices.has(sourceVertex) || !this.graph.vertices.has(goalVertex)) {
      return { path: [], distance: Infinity, animationFrames };
    }

    const h = heuristic ?? (() => 0);

    const gScore = new Map<string, number>();
    const predecessor = new Map<string, string | null>();
    for (const id of this.graph.vertices.keys()) {
      gScore.set(id, Infinity);
      predecessor.set(id, null);
    }
    gScore.set(sourceVertex, 0);

    const pq = new MinHeap<string>();
    pq.push(sourceVertex, h(sourceVertex, goalVertex));
    const closed = new Set<string>();

    while (!pq.isEmpty()) {
      const currentId = pq.pop()!;

      if (currentId === goalVertex) {
        const path = this.reconstructPath(predecessor, sourceVertex, goalVertex);
        return { path, distance: gScore.get(goalVertex)!, animationFrames };
      }

      if (closed.has(currentId)) continue;
      closed.add(currentId);
      animationFrames.push({ type: 'VISIT', vertexId: currentId });

      const currentG = gScore.get(currentId)!;
      for (const neighbor of this.graph.getNeighbors(currentId)) {
        if (closed.has(neighbor.id)) continue;

        const weight = this.graph.getEdgeWeight(currentId, neighbor.id) ?? 1;
        const tentativeG = currentG + weight;

        if (tentativeG < (gScore.get(neighbor.id) ?? Infinity)) {
          gScore.set(neighbor.id, tentativeG);
          predecessor.set(neighbor.id, currentId);
          animationFrames.push({ type: 'RELAX', fromId: currentId, toId: neighbor.id, distance: tentativeG });

          const priority = tentativeG + h(neighbor.id, goalVertex);
          if (pq.contains(neighbor.id)) {
            pq.updatePriority(neighbor.id, priority);
          } else {
            pq.push(neighbor.id, priority);
          }
        }
      }
    }

    return { path: [], distance: Infinity, animationFrames };
  }

  /** Traces a path from `start` to `end` via a predecessor map (as produced by dijkstra/bellmanFord/aStar). Returns [] if unreachable. */
  reconstructPath(predecessor: Map<string, string | null>, start: string, end: string): string[] {
    if (start === end) return [start];

    const path: string[] = [];
    const seen = new Set<string>();
    let current: string | null = end;

    while (current !== null) {
      if (seen.has(current)) return []; // cycle in predecessor chain — bail out
      seen.add(current);
      path.unshift(current);
      if (current === start) return path;
      current = predecessor.get(current) ?? null;
    }

    return []; // end is unreachable from start
  }

  /**
   * Prim's algorithm: grows a single tree from `startVertex` (defaulting to
   * an arbitrary vertex), repeatedly adding the cheapest edge that connects
   * the tree to a new vertex. Only reaches the start vertex's connected
   * component, matching depthFirstSearch/breadthFirstSearch's behavior on
   * disconnected graphs.
   */
  prim(startVertex?: string): PrimResult {
    const animationFrames: MSTStep[] = [];
    const mstEdges: MSTEdgeResult[] = [];
    let totalWeight = 0;

    if (this.graph.vertices.size === 0) {
      return { mstEdges, totalWeight, animationFrames };
    }

    const start = startVertex && this.graph.vertices.has(startVertex)
      ? startVertex
      : (this.graph.vertices.keys().next().value as string);

    const inMST = new Set<string>();
    const bestEdgeTo = new Map<string, { from: string; weight: number }>();
    const pq = new MinHeap<string>();

    inMST.add(start);
    animationFrames.push({ type: 'ADD_VERTEX', vertexId: start });

    const addFrontierEdges = (vertexId: string) => {
      for (const neighbor of this.graph.getNeighbors(vertexId)) {
        if (inMST.has(neighbor.id)) continue;

        const weight = this.graph.getEdgeWeight(vertexId, neighbor.id) ?? 1;
        animationFrames.push({ type: 'CONSIDER', fromId: vertexId, toId: neighbor.id, weight });

        const existing = bestEdgeTo.get(neighbor.id);
        if (!existing || weight < existing.weight) {
          bestEdgeTo.set(neighbor.id, { from: vertexId, weight });
          if (pq.contains(neighbor.id)) {
            pq.updatePriority(neighbor.id, weight);
          } else {
            pq.push(neighbor.id, weight);
          }
        }
      }
    };

    addFrontierEdges(start);

    while (!pq.isEmpty()) {
      const nextId = pq.pop()!;
      if (inMST.has(nextId)) continue;

      const best = bestEdgeTo.get(nextId)!;
      inMST.add(nextId);
      mstEdges.push({ source: best.from, target: nextId, weight: best.weight });
      totalWeight += best.weight;
      animationFrames.push({ type: 'ADD_EDGE', fromId: best.from, toId: nextId, weight: best.weight });
      animationFrames.push({ type: 'ADD_VERTEX', vertexId: nextId });

      addFrontierEdges(nextId);
    }

    return { mstEdges, totalWeight, animationFrames };
  }

  /**
   * Kruskal's algorithm: sorts every edge by weight, then greedily accepts
   * each one that connects two different components (tracked via UnionFind),
   * rejecting any that would close a cycle. Builds a minimum spanning
   * *forest* across the whole graph, not just one component — so on a
   * disconnected graph its total weight differs from prim()'s.
   */
  kruskal(): KruskalResult {
    const animationFrames: MSTStep[] = [];
    const mstEdges: MSTEdgeResult[] = [];
    let totalWeight = 0;

    const uf = new UnionFind(this.graph.vertices.keys());

    const seen = new Set<string>();
    const edgeList: MSTEdgeResult[] = [];
    for (const edge of this.graph.edges) {
      const a = edge.source.id;
      const b = edge.target.id;
      const key = this.graph.directed ? `${a}->${b}` : [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edgeList.push({ source: a, target: b, weight: edge.weight ?? 1 });
    }

    edgeList.sort((x, y) => x.weight - y.weight);
    animationFrames.push({
      type: 'SORTED',
      order: edgeList.map((e) => ({ fromId: e.source, toId: e.target, weight: e.weight })),
    });

    for (const edge of edgeList) {
      animationFrames.push({ type: 'CONSIDER', fromId: edge.source, toId: edge.target, weight: edge.weight });

      if (uf.connected(edge.source, edge.target)) {
        animationFrames.push({ type: 'REJECT', fromId: edge.source, toId: edge.target, weight: edge.weight });
        continue;
      }

      uf.union(edge.source, edge.target);
      mstEdges.push(edge);
      totalWeight += edge.weight;
      animationFrames.push({ type: 'ADD_EDGE', fromId: edge.source, toId: edge.target, weight: edge.weight });
    }

    return { mstEdges, totalWeight, animationFrames };
  }

  /**
   * Topological sort via iterative DFS (explicit stack, so it shares the
   * same "no recursion" safety as depthFirstSearch) with white/gray/black
   * vertex coloring: a gray-to-gray edge is a back edge, which means the
   * graph has a cycle and no valid topological ordering exists. Vertices are
   * appended to `ordering` as they finish (post-order), then reversed.
   */
  topologicalSort(): TopologicalSortResult {
    const animationFrames: TopoSortStep[] = [];
    const ordering: string[] = [];
    let hasCycle = false;

    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const id of this.graph.vertices.keys()) color.set(id, WHITE);

    for (const startId of this.graph.vertices.keys()) {
      if (color.get(startId) !== WHITE) continue;

      const stack: Array<{ id: string; neighbors: Vertex<T>[]; idx: number }> = [
        { id: startId, neighbors: this.graph.getNeighbors(startId), idx: 0 },
      ];
      color.set(startId, GRAY);
      animationFrames.push({ type: 'VISIT', vertexId: startId });

      while (stack.length > 0) {
        const frame = stack[stack.length - 1];

        if (frame.idx < frame.neighbors.length) {
          const neighbor = frame.neighbors[frame.idx++];
          const neighborColor = color.get(neighbor.id);

          if (neighborColor === WHITE) {
            color.set(neighbor.id, GRAY);
            animationFrames.push({ type: 'VISIT', vertexId: neighbor.id });
            stack.push({ id: neighbor.id, neighbors: this.graph.getNeighbors(neighbor.id), idx: 0 });
          } else if (neighborColor === GRAY) {
            hasCycle = true;
            animationFrames.push({ type: 'CYCLE', vertexId: neighbor.id });
          }
        } else {
          color.set(frame.id, BLACK);
          animationFrames.push({ type: 'FINISH', vertexId: frame.id });
          ordering.push(frame.id);
          stack.pop();
        }
      }
    }

    ordering.reverse();
    return { ordering, hasCycle, animationFrames };
  }
}
