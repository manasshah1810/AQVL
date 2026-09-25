/**
 * Performance benchmarks for the runtime's spatial LayoutEngine strategies
 * (packages/runtime/src/layout/strategies/*).
 *
 * IMPORTANT — these are BASELINE benchmarks, not strict performance gates.
 * Timings vary across machines, CI load, JIT warm-up, etc. The upper-bound
 * assertions below are deliberately generous — their purpose is to catch
 * gross regressions (e.g. an accidental O(n^3) blowup or an infinite loop),
 * not to enforce a tight perf budget. Every test logs the real measured
 * time via console.log; see docs/design/spatial-performance-report.md for
 * numbers captured from an actual run of this file plus derived safe limits.
 */
import { describe, expect, it } from 'vitest';
import { LineLayout } from '../../packages/runtime/src/layout/strategies/LineLayout';
import { GridLayout } from '../../packages/runtime/src/layout/strategies/GridLayout';
import { HierarchyLayout } from '../../packages/runtime/src/layout/strategies/HierarchyLayout';
import { CircularLayout } from '../../packages/runtime/src/layout/strategies/CircularLayout';
import { ForceDirectedLayout } from '../../packages/runtime/src/layout/strategies/ForceDirectedLayout';
import type { LayoutElementInput, LayoutEdgeInput } from '../../packages/runtime/src/layout/LayoutEngine';

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function timeIt<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { result, ms };
}

/** Flat element list (no parent relationships) — LINE/GRID/CIRCULAR/FORCE_DIRECTED input shape. */
function makeFlatElements(n: number): LayoutElementInput[] {
  return Array.from({ length: n }, (_, i) => ({ id: `e${i}`, logicalIndex: i }));
}

/** Balanced binary tree of n nodes: node i's parent is floor((i-1)/2), matching common tree-structure input. */
function makeBalancedTree(n: number): LayoutElementInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    logicalIndex: i,
    parentId: i === 0 ? null : `n${Math.floor((i - 1) / 2)}`,
  }));
}

/** Degenerate tree of n nodes: a single chain (worst case for recursion depth). */
function makeChainTree(n: number): LayoutElementInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    logicalIndex: i,
    parentId: i === 0 ? null : `n${i - 1}`,
  }));
}

/** Ring of edges over n elements plus a handful of random chords, for FORCE_DIRECTED (needs a connected-ish graph). */
function makeRingEdges(n: number, extraEdges: number): LayoutEdgeInput[] {
  const edges: LayoutEdgeInput[] = [];
  for (let i = 0; i < n; i++) edges.push({ sourceId: `e${i}`, targetId: `e${(i + 1) % n}` });
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < extraEdges; i++) {
    const a = Math.floor(rand() * n);
    const b = Math.floor(rand() * n);
    if (a !== b) edges.push({ sourceId: `e${a}`, targetId: `e${b}` });
  }
  return edges;
}

function assertAllPlaced(positions: Map<string, unknown>, n: number) {
  expect(positions.size).toBe(n);
}

// ───────────────────────────────────────────────────────────────────────────
// LINE — O(n): sort + single pass
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: LINE layout', () => {
  const strategy = new LineLayout();
  for (const n of [100, 1000, 10000]) {
    it(`lays out ${n} elements within a generous bound`, () => {
      const elements = makeFlatElements(n);
      const { result, ms } = timeIt(() => strategy.compute(elements, {}));
      console.log(`[perf] LINE(${n}) => ${ms.toFixed(2)}ms`);
      assertAllPlaced(result, n);
      expect(ms).toBeLessThan(1000);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GRID — O(n): single pass, row/col from index
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: GRID layout', () => {
  const strategy = new GridLayout();
  for (const n of [100, 1000, 10000]) {
    it(`lays out ${n} elements within a generous bound`, () => {
      const elements = makeFlatElements(n);
      const { result, ms } = timeIt(() => strategy.compute(elements, {}));
      console.log(`[perf] GRID(${n}) => ${ms.toFixed(2)}ms`);
      assertAllPlaced(result, n);
      expect(ms).toBeLessThan(1000);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// CIRCULAR — O(n): single pass around a circle
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: CIRCULAR layout', () => {
  const strategy = new CircularLayout();
  for (const n of [100, 1000, 10000]) {
    it(`lays out ${n} elements within a generous bound`, () => {
      const elements = makeFlatElements(n);
      const { result, ms } = timeIt(() => strategy.compute(elements, {}));
      console.log(`[perf] CIRCULAR(${n}) => ${ms.toFixed(2)}ms`);
      assertAllPlaced(result, n);
      expect(ms).toBeLessThan(1000);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// HIERARCHY — recursive post-order/pre-order tree walk: check both a
// balanced tree (typical case) and a degenerate chain (worst case for
// recursion depth — this is what would stack-overflow first, not scale).
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: HIERARCHY layout (balanced tree)', () => {
  const strategy = new HierarchyLayout();
  for (const n of [100, 1000, 10000]) {
    it(`lays out a balanced tree of ${n} nodes within a generous bound`, () => {
      const elements = makeBalancedTree(n);
      const { result, ms } = timeIt(() => strategy.compute(elements, {}));
      console.log(`[perf] HIERARCHY balanced(${n}) => ${ms.toFixed(2)}ms`);
      assertAllPlaced(result, n);
      expect(ms).toBeLessThan(1000);
    });
  }
});

describe('Performance: HIERARCHY layout (degenerate chain — stack-depth worst case)', () => {
  const strategy = new HierarchyLayout();
  for (const n of [100, 1000, 10000]) {
    it(`lays out a ${n}-node chain without stack overflow, within a generous bound`, () => {
      const elements = makeChainTree(n);
      const { result, ms } = timeIt(() => strategy.compute(elements, {}));
      console.log(`[perf] HIERARCHY chain(${n}) => ${ms.toFixed(2)}ms`);
      assertAllPlaced(result, n);
      expect(ms).toBeLessThan(2000);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// FORCE_DIRECTED — O(n^2) per iteration (all-pairs repulsion): the
// benchmark this suite exists to characterize. Sweep node count and
// iteration count independently so the report can separate "graph is too
// big" from "iterations are too high".
// ───────────────────────────────────────────────────────────────────────────

describe('Performance: FORCE_DIRECTED layout (node count, default 100 iterations)', () => {
  const strategy = new ForceDirectedLayout();
  for (const n of [50, 200, 500]) {
    it(`lays out ${n} nodes within a generous bound`, () => {
      const elements = makeFlatElements(n);
      const edges = makeRingEdges(n, Math.floor(n * 1.5));
      const { result, ms } = timeIt(() => strategy.compute(elements, {}, edges));
      console.log(`[perf] FORCE_DIRECTED(${n} nodes, 100 iterations) => ${ms.toFixed(2)}ms`);
      assertAllPlaced(result, n);
      // Generous ceiling at this scale; the report documents the actual
      // measured numbers and the derived safe limit.
      expect(ms).toBeLessThan(15000);
    });
  }
});

describe('Performance: FORCE_DIRECTED layout (iteration count, fixed 200 nodes)', () => {
  const strategy = new ForceDirectedLayout();
  const n = 200;
  for (const iterations of [50, 100, 200]) {
    it(`runs ${iterations} iterations over ${n} nodes within a generous bound`, () => {
      const elements = makeFlatElements(n);
      const edges = makeRingEdges(n, Math.floor(n * 1.5));
      const { result, ms } = timeIt(() => strategy.compute(elements, { iterations }, edges));
      console.log(`[perf] FORCE_DIRECTED(${n} nodes, ${iterations} iterations) => ${ms.toFixed(2)}ms`);
      assertAllPlaced(result, n);
      expect(ms).toBeLessThan(15000);
    });
  }
});
