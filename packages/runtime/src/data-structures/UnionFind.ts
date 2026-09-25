/**
 * UnionFind (disjoint-set) — backs Kruskal's MST algorithm (see
 * ../core/algorithms/GraphEngine), which needs "are these two vertices
 * already connected?" and "merge their components" in near-constant time.
 * Uses path compression (find) and union by rank to keep both operations
 * close to O(alpha(n)).
 */
export class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  constructor(elements: Iterable<string> = []) {
    for (const el of elements) {
      this.makeSet(el);
    }
  }

  makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  /** Returns the representative (root) of x's set, path-compressing along the way. */
  find(x: string): string {
    this.makeSet(x);
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }

    let current = x;
    while (this.parent.get(current) !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }

    return root;
  }

  /** Merges x's and y's sets. Returns false if they were already in the same set. */
  union(x: string, y: string): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return false;

    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }

    return true;
  }

  connected(x: string, y: string): boolean {
    return this.find(x) === this.find(y);
  }
}
