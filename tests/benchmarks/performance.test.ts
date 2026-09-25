/**
 * Performance baseline tests for the AQVL runtime's core engines
 * (packages/runtime/src/core/algorithms/*, packages/runtime/src/data-structures/*).
 *
 * IMPORTANT — these are BASELINE benchmarks, not strict performance gates.
 * Timings vary across machines, CI load, JIT warm-up, etc. The upper-bound
 * assertions below are deliberately generous (order-of-magnitude headroom
 * over what these workloads should take on any reasonable machine) — their
 * purpose is to catch gross regressions (e.g. an O(n^2) algorithm
 * accidentally becoming O(n^3), or an infinite loop), not to enforce a tight
 * perf budget. Every test logs the real measured time via console.log so a
 * human can track trends across runs; see docs/PERFORMANCE.md for numbers
 * captured from an actual run of this file.
 */
import { describe, expect, it } from 'vitest';
import { SortAlgorithm } from '../../packages/runtime/src/core/algorithms/SortEngine';
import { Graph } from '../../packages/runtime/src/data-structures/Graph';
import { GraphAlgorithm } from '../../packages/runtime/src/core/algorithms/GraphEngine';
import { AVLTree } from '../../packages/runtime/src/data-structures/AVLTree';
import { RedBlackTree } from '../../packages/runtime/src/data-structures/RedBlackTree';
import { HashMap } from '../../packages/runtime/src/data-structures/HashMap';
import { BSTEngine } from '../../packages/runtime/src/core/algorithms/BSTEngine';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) so benchmark input is reproducible across runs. */
function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomIntArray(n: number, rng: () => number, max = 1_000_000): number[] {
  return Array.from({ length: n }, () => Math.floor(rng() * max));
}

function timeIt<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { result, ms };
}

/** Builds an undirected, weighted, connected graph: a ring over `n` vertices plus `extraEdges` random chords. */
function buildRandomConnectedGraph(n: number, extraEdges: number, rng: () => number): Graph {
  const g = new Graph([], [], false, true);
  for (let i = 0; i < n; i++) g.addVertex(`v${i}`);
  // Ring guarantees connectivity.
  for (let i = 0; i < n; i++) {
    const weight = 1 + Math.floor(rng() * 20);
    g.addEdge(`v${i}`, `v${(i + 1) % n}`, weight);
  }
  // Random extra chords for a denser, more realistic graph.
  for (let i = 0; i < extraEdges; i++) {
    const a = Math.floor(rng() * n);
    const b = Math.floor(rng() * n);
    if (a === b) continue;
    const weight = 1 + Math.floor(rng() * 20);
    g.addEdge(`v${a}`, `v${b}`, weight);
  }
  return g;
}

// ───────────────────────────────────────────────────────────────────────────
// Sorting: 1000 random ints — bubble vs merge vs quick
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: sorting (1000 random ints)', () => {
  const N = 1000;

  it('bubbleSort completes within a generous bound', () => {
    const rng = makeRng(1);
    const input = randomIntArray(N, rng);
    const { result, ms } = timeIt(() => SortAlgorithm.bubbleSort(input.slice()));
    console.log(`[perf] bubbleSort(${N}) => ${ms.toFixed(2)}ms, comparisons=${result.comparisons}, swaps=${result.swaps}`);
    expect(result.array).toEqual([...input].sort((a, b) => a - b));
    // O(n^2) but pure JS array ops on 1000 elements — generous 2s ceiling.
    expect(ms).toBeLessThan(2000);
  });

  it('mergeSort completes within a generous bound', () => {
    const rng = makeRng(2);
    const input = randomIntArray(N, rng);
    const { result, ms } = timeIt(() => SortAlgorithm.mergeSort(input.slice()));
    console.log(`[perf] mergeSort(${N}) => ${ms.toFixed(2)}ms, comparisons=${result.comparisons}, swaps=${result.swaps}`);
    expect(result.array).toEqual([...input].sort((a, b) => a - b));
    expect(ms).toBeLessThan(500);
  });

  it('quickSort completes within a generous bound', () => {
    const rng = makeRng(3);
    const input = randomIntArray(N, rng);
    const { result, ms } = timeIt(() => SortAlgorithm.quickSort(input.slice()));
    console.log(`[perf] quickSort(${N}) => ${ms.toFixed(2)}ms, comparisons=${result.comparisons}, swaps=${result.swaps}`);
    expect(result.array).toEqual([...input].sort((a, b) => a - b));
    expect(ms).toBeLessThan(500);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Graph traversal: 100 vertices — DFS vs BFS
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: graph traversal (100-vertex random connected graph)', () => {
  it('DFS visits all vertices within a generous bound', () => {
    const rng = makeRng(10);
    const g = buildRandomConnectedGraph(100, 150, rng);
    const algo = new GraphAlgorithm(g);
    const { result, ms } = timeIt(() => algo.depthFirstSearch('v0'));
    console.log(`[perf] DFS(100 vertices) => ${ms.toFixed(2)}ms, visited=${result.visited.size}`);
    expect(result.visited.size).toBe(100);
    expect(ms).toBeLessThan(200);
  });

  it('BFS visits all vertices within a generous bound', () => {
    const rng = makeRng(11);
    const g = buildRandomConnectedGraph(100, 150, rng);
    const algo = new GraphAlgorithm(g);
    const { result, ms } = timeIt(() => algo.breadthFirstSearch('v0'));
    console.log(`[perf] BFS(100 vertices) => ${ms.toFixed(2)}ms, visited=${result.visited.size}`);
    expect(result.visited.size).toBe(100);
    expect(ms).toBeLessThan(200);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Dijkstra: 500-vertex weighted graph
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: Dijkstra (500-vertex weighted graph)', () => {
  it('computes shortest paths from a source within a generous bound', () => {
    const rng = makeRng(20);
    const g = buildRandomConnectedGraph(500, 1000, rng);
    const algo = new GraphAlgorithm(g);
    const { result, ms } = timeIt(() => algo.dijkstra('v0'));
    console.log(`[perf] Dijkstra(500 vertices, ~1500 edges) => ${ms.toFixed(2)}ms`);
    // Source distance is 0; every vertex is reachable (ring + chords => connected).
    expect(result.distances.get('v0')).toBe(0);
    for (const [, dist] of result.distances) {
      expect(dist).toBeLessThan(Infinity);
    }
    expect(ms).toBeLessThan(1000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AVL tree: insert 1000 values, verify balance
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: AVL tree (1000 inserts)', () => {
  it('stays balanced after 1000 inserts, within a generous bound', () => {
    const rng = makeRng(30);
    const values = randomIntArray(1000, rng, 1_000_000);
    const tree = new AVLTree();
    const { ms } = timeIt(() => {
      for (const v of values) tree.insert(v);
    });
    console.log(`[perf] AVLTree insert(1000) => ${ms.toFixed(2)}ms, height=${tree.height}`);
    expect(tree.isBalanced()).toBe(true);
    // Sorted inorder confirms BST property held through every rotation.
    const inorder = tree.inorder();
    for (let i = 1; i < inorder.length; i++) {
      expect(inorder[i]).toBeGreaterThan(inorder[i - 1]);
    }
    expect(ms).toBeLessThan(1000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red-Black tree: insert 1000 values, verify invariants
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: Red-Black tree (1000 inserts)', () => {
  it('maintains valid colors/black-height after 1000 inserts, within a generous bound', () => {
    const rng = makeRng(40);
    const values = randomIntArray(1000, rng, 1_000_000);
    const tree = new RedBlackTree();
    const { ms } = timeIt(() => {
      for (const v of values) tree.insert(v);
    });
    console.log(`[perf] RedBlackTree insert(1000) => ${ms.toFixed(2)}ms, blackHeight=${tree.blackHeight()}`);
    expect(tree.hasValidColors()).toBe(true);
    expect(tree.blackHeight()).toBeGreaterThan(-1);
    expect(tree.isValid()).toBe(true);
    expect(ms).toBeLessThan(1000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// HashMap: insert 10000 pairs, then look them all up
// ───────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// BSTEngine: 1000 inserts + 1000 searches on a scene-graph-backed BST.
//
// BSTEngine.getLeftChild/getRightChild/getParent each re-scan the full scene
// graph (getEdges → array filter) to resolve a single child/parent, so
// naively calling them once per node inside an O(depth) traversal makes
// every insert/search O(n·depth) instead of O(depth). BSTEngine now builds
// an O(n) index (buildIndex) once per operation and does O(1) map lookups
// for the rest of that traversal. This benchmark drives insert/search
// through a roughly balanced 1000-node tree (shuffled input keeps depth
// near log2(1000)≈10) and asserts the *average* per-op time stays close to
// what O(depth) work should cost, not the O(n·depth) a re-scan-per-step
// implementation would produce.
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: BSTEngine (1000-node tree, insert + search)', () => {
  function makeTree() {
    const dispatcher = new EventDispatcher();
    const sceneManager = new SceneManager(dispatcher);
    const relationshipManager = new RelationshipManager(dispatcher);
    return { sceneManager, relationshipManager };
  }

  it('inserts 1000 shuffled values within a generous bound', () => {
    const rng = makeRng(50);
    // Shuffle 0..999 so the resulting tree stays roughly balanced (depth ~log2(n)).
    const values = Array.from({ length: 1000 }, (_, i) => i);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }

    const { sceneManager, relationshipManager } = makeTree();
    const treeName = 'bst';

    const { ms } = timeIt(() => {
      for (const v of values) {
        const plan = BSTEngine.computeInsertPath(sceneManager, treeName, v);
        expect(plan.success).toBe(true);
        BSTEngine.insertNode(sceneManager, relationshipManager, treeName, v, plan.parentNode ?? null, plan.edgeLabel ?? null);
      }
    });
    console.log(`[perf] BSTEngine insert(1000 shuffled) => ${ms.toFixed(2)}ms (avg ${(ms / 1000).toFixed(4)}ms/op)`);

    expect(BSTEngine.getNodes(sceneManager, treeName).length).toBe(1000);
    // Each insert does O(n) index build + O(depth) walk; with depth ~10 and
    // n=1000 that's roughly a million map ops total — comfortably under 1s.
    // An O(n·depth) re-scan-per-step implementation (n^2-ish here) would be
    // far slower than this bound on any reasonable machine.
    expect(ms).toBeLessThan(1000);
  });

  it('searches all 1000 inserted values within a generous bound', () => {
    const rng = makeRng(51);
    const values = Array.from({ length: 1000 }, (_, i) => i);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }

    const { sceneManager, relationshipManager } = makeTree();
    const treeName = 'bst';
    for (const v of values) {
      const plan = BSTEngine.computeInsertPath(sceneManager, treeName, v);
      BSTEngine.insertNode(sceneManager, relationshipManager, treeName, v, plan.parentNode ?? null, plan.edgeLabel ?? null);
    }

    const { ms } = timeIt(() => {
      for (const v of values) {
        const result = BSTEngine.computeSearchPath(sceneManager, treeName, v);
        expect(result.found).toBe(true);
      }
    });
    console.log(`[perf] BSTEngine search(1000 lookups on 1000-node tree) => ${ms.toFixed(2)}ms (avg ${(ms / 1000).toFixed(4)}ms/op)`);
    expect(ms).toBeLessThan(1000);
  });
});

describe('Performance: HashMap (10000 insert + lookup)', () => {
  it('inserts and looks up 10000 key-value pairs within a generous bound', () => {
    const N = 10_000;
    const keys = Array.from({ length: N }, (_, i) => `key-${i}`);
    const map = new HashMap<string, number>();

    const { ms: insertMs } = timeIt(() => {
      for (let i = 0; i < N; i++) map.set(keys[i], i);
    });
    console.log(`[perf] HashMap insert(${N}) => ${insertMs.toFixed(2)}ms, capacity=${map.capacity}, loadFactor=${map.currentLoadFactor.toFixed(3)}`);
    expect(map.size).toBe(N);
    expect(insertMs).toBeLessThan(2000);

    let found = 0;
    const { ms: lookupMs } = timeIt(() => {
      for (let i = 0; i < N; i++) {
        if (map.get(keys[i]) === i) found++;
      }
    });
    console.log(`[perf] HashMap lookup(${N}) => ${lookupMs.toFixed(2)}ms`);
    expect(found).toBe(N);
    expect(lookupMs).toBeLessThan(2000);
  });
});
