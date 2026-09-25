import { Vertex } from './Vertex';

/**
 * Edge — a connection between two vertices in a Graph.
 *
 * `directed` mirrors the owning Graph's directedness so an Edge remains
 * meaningful in isolation (e.g. when passed to Prim/Kruskal as a plain array).
 */
export class Edge<T = any> {
  readonly source: Vertex<T>;
  readonly target: Vertex<T>;
  readonly weight?: number;
  readonly directed: boolean;

  constructor(source: Vertex<T>, target: Vertex<T>, weight?: number, directed: boolean = false) {
    this.source = source;
    this.target = target;
    this.weight = weight;
    this.directed = directed;
  }
}
