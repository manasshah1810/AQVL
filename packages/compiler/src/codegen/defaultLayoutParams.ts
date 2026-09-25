/**
 * Size-aware default layout parameters — see docs/design/default-tuning-log.md
 * for the full rationale/before-after table this module implements.
 *
 * `generateDefaultLayout` (packages/compiler/src/aqir/generator.ts) backfills a
 * `SET_LAYOUT_STRATEGY` for any structure with no explicit `LAYOUT` statement.
 * Previously those params were flat per-kind constants (spatial-syntax-spec.md
 * §4), tuned only for small examples — a 200-element array got the same
 * 2.2-unit spacing as a 3-element one, producing an unreadably wide line.
 * This module scales each strategy's params by the structure's initial
 * element count so the *default* stays readable across small/medium/large
 * declarations, while leaving every small-structure value (count <= SMALL_MAX)
 * byte-identical to the original constants documented in
 * docs/design/existing-layout-audit.md — no regression for existing programs.
 *
 * Size tiers (informal — the formulas below are continuous in `count`, these
 * bands are just what the tuning log's rationale refers to):
 *   - small:  count < 10
 *   - medium: 10 <= count < 50
 *   - large:  count >= 50
 */
import type { GeometryParamValue } from '../aqir/InstructionSet';

export type SizeTier = 'small' | 'medium' | 'large';

/** Counts at/below this are "small" — every formula below returns the exact legacy constant here. */
const SMALL_MAX = 9;
/** Counts at/below this (and above SMALL_MAX) are "medium"; above is "large". */
const MEDIUM_MAX = 49;

export function getSizeTier(count: number): SizeTier {
  if (count <= SMALL_MAX) return 'small';
  if (count <= MEDIUM_MAX) return 'medium';
  return 'large';
}

/**
 * Smoothly scales `base` down toward `min` as `count` grows past SMALL_MAX,
 * via an inverse-sqrt falloff (halving `count` roughly quarters the excess
 * shrinkage, not halves it — spacing degrades gracefully rather than
 * cliff-diving). Returns exactly `base` for count <= SMALL_MAX.
 */
function scaleDown(base: number, min: number, count: number): number {
  if (count <= SMALL_MAX) return base;
  const scaled = base * Math.sqrt(SMALL_MAX / count);
  return Math.max(min, scaled);
}

/** Inverse of scaleDown — grows `base` up toward (but never past) `max` as `count` increases. */
function scaleUp(base: number, max: number, count: number): number {
  if (count <= SMALL_MAX) return base;
  const grown = base * (1 + 0.15 * Math.log2(count / SMALL_MAX));
  return Math.min(max, grown);
}

// ---------------------------------------------------------------------
// LINE — Array, LinkedList, Stack, Queue, HashMap (bucket row)
// ---------------------------------------------------------------------

export type LineStructureKind = 'ARRAY' | 'LINKEDLIST' | 'STACK' | 'QUEUE' | 'HASHMAP';

interface LineTuning {
  spacing: number;
  min: number;
  axis: 'horizontal' | 'vertical';
  origin: [number, number, number];
}

/** Legacy per-kind constants (existing-layout-audit.md §1-4, §9) — used as the `small`-tier base and the scale-down ceiling. */
const LINE_BASE: Record<LineStructureKind, LineTuning> = {
  ARRAY: { spacing: 2.2, min: 0.6, axis: 'horizontal', origin: [0, 0, 0] },
  LINKEDLIST: { spacing: 2.5, min: 0.9, axis: 'horizontal', origin: [0, 0, 0] },
  STACK: { spacing: 1.2, min: 0.45, axis: 'vertical', origin: [0, -2, 0] },
  QUEUE: { spacing: 1.5, min: 0.5, axis: 'horizontal', origin: [0, 0, 0] },
  HASHMAP: { spacing: 2.2, min: 0.6, axis: 'horizontal', origin: [0, 0, 0] },
};

export function getLineParams(
  kind: LineStructureKind,
  count: number
): { spacing: number; axis: 'horizontal' | 'vertical'; origin: [number, number, number] } {
  const tuning = LINE_BASE[kind];
  return {
    spacing: scaleDown(tuning.spacing, tuning.min, count),
    axis: tuning.axis,
    origin: tuning.origin,
  };
}

// ---------------------------------------------------------------------
// HIERARCHY — Tree, BinaryTree, BST, Heap, Trie
// ---------------------------------------------------------------------

const HIERARCHY_BASE = { levelGap: 2.0, levelGapMax: 3.2, siblingGap: 1.5, siblingGapMin: 0.6, origin: [0, 2, 0] as [number, number, number] };

/**
 * `count` here is initial element count, a proxy for both breadth (more
 * elements => more siblings at each level, `siblingGap` must shrink so wide
 * levels don't explode the scene width) and depth (a roughly-balanced tree
 * of `count` nodes has depth ~log2(count), so `levelGap` grows a little to
 * keep each level visually distinguishable as there are more of them).
 */
export function getHierarchyParams(count: number): { levelGap: number; siblingGap: number; origin: [number, number, number] } {
  return {
    levelGap: scaleUp(HIERARCHY_BASE.levelGap, HIERARCHY_BASE.levelGapMax, count),
    siblingGap: scaleDown(HIERARCHY_BASE.siblingGap, HIERARCHY_BASE.siblingGapMin, count),
    origin: HIERARCHY_BASE.origin,
  };
}

// ---------------------------------------------------------------------
// CIRCULAR — not currently a structure default, but part of the shared
// size-aware param surface (used by explicit `LAYOUT x AS CIRCULAR(...)`
// callers that want a sensible starting radius for their element count).
// ---------------------------------------------------------------------

const CIRCULAR_MIN_RADIUS = 3; // matches CircularLayout.ts's own runtime default for small n
const CIRCULAR_ARC_SPACING = 1.4; // desired arc-length between adjacent elements

/** radius such that n elements spaced CIRCULAR_ARC_SPACING apart fit around the ring, floored so small rings don't collapse. */
export function getCircularParams(count: number): { radius: number; startAngle: number; origin: [number, number, number] } {
  const circumference = CIRCULAR_ARC_SPACING * Math.max(count, 1);
  const radius = Math.max(CIRCULAR_MIN_RADIUS, circumference / (2 * Math.PI));
  return { radius, startAngle: 0, origin: [0, 0, 0] };
}

// ---------------------------------------------------------------------
// GRID — not currently a structure default; same rationale as CIRCULAR above.
// ---------------------------------------------------------------------

const GRID_BASE_SPACING = 1.8;
const GRID_MIN_SPACING = 0.8;

/** Roughly-square dimensions for `count` cells (mirrors GridLayout.ts's own no-args fallback, exposed here so callers/tests can reason about it without a live layout pass). */
export function getGridDimensions(count: number): { rows: number; columns: number } {
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(count, 1))));
  const rows = Math.max(1, Math.ceil(Math.max(count, 1) / columns));
  return { rows, columns };
}

export function getGridParams(count: number): { cellSpacing: number; rows: number; columns: number; origin: [number, number, number] } {
  const { rows, columns } = getGridDimensions(count);
  return {
    cellSpacing: scaleDown(GRID_BASE_SPACING, GRID_MIN_SPACING, count),
    rows,
    columns,
    origin: [0, 0, 0],
  };
}

// ---------------------------------------------------------------------
// FORCE_DIRECTED — Graph
// ---------------------------------------------------------------------

const FORCE_DIRECTED_BASE = { repulsion: 5.0, repulsionMin: 1.5, springLength: 2.0, attraction: 0.1, iterations: 100 };

/**
 * repulsion scales down with count: the simulation is O(count^2) pairwise
 * repulsion, so a naive fixed constant either crowds small graphs (too weak)
 * or flings large ones apart (too strong / too slow to settle) — shrinking
 * it keeps total repulsive force, and per-iteration cost, in a sane range.
 * iterations/springLength step by tier: fewer iterations for large graphs
 * (perf — this simulation is a synchronous, blocking O(n^2 * iterations)
 * loop, see existing-layout-audit.md §6), more spring length so nodes don't
 * visually crowd once there are many of them.
 */
export function getForceDirectedParams(count: number): {
  repulsion: number;
  springLength: number;
  attraction: number;
  iterations: number;
  origin: [number, number, number];
} {
  const tier = getSizeTier(count);
  const repulsion = scaleDown(FORCE_DIRECTED_BASE.repulsion, FORCE_DIRECTED_BASE.repulsionMin, count);
  const springLength = tier === 'small' ? FORCE_DIRECTED_BASE.springLength : tier === 'medium' ? 2.2 : 2.6;
  const iterations = tier === 'small' ? FORCE_DIRECTED_BASE.iterations : tier === 'medium' ? 70 : 40;
  return {
    repulsion,
    springLength,
    attraction: FORCE_DIRECTED_BASE.attraction,
    iterations,
    origin: [0, 0, 0],
  };
}

// ---------------------------------------------------------------------
// Unified entry point used by generateDefaultLayout
// ---------------------------------------------------------------------

export type DefaultLayoutStrategy = 'LINE' | 'HIERARCHY' | 'FORCE_DIRECTED';

const STRATEGY_BY_KIND: Record<string, DefaultLayoutStrategy> = {
  ARRAY: 'LINE',
  LINKEDLIST: 'LINE',
  STACK: 'LINE',
  QUEUE: 'LINE',
  HASHMAP: 'LINE',
  TREE: 'HIERARCHY',
  BINARYTREE: 'HIERARCHY',
  BST: 'HIERARCHY',
  HEAP: 'HIERARCHY',
  TRIE: 'HIERARCHY',
  GRAPH: 'FORCE_DIRECTED',
};

/**
 * Resolves a DECLARE structure kind (e.g. "ARRAY", "BST") + its initial
 * element count to the strategy/params pair `generateDefaultLayout` emits.
 * Returns undefined for a kind with no default (matches the pre-existing
 * behavior of structures absent from spatial-syntax-spec.md §4's table).
 */
export function computeDefaultLayoutParams(
  kind: string,
  count: number
): { strategy: DefaultLayoutStrategy; params: Record<string, GeometryParamValue> } | undefined {
  const strategy = STRATEGY_BY_KIND[kind];
  if (!strategy) return undefined;

  switch (strategy) {
    case 'LINE':
      return { strategy, params: getLineParams(kind as LineStructureKind, count) };
    case 'HIERARCHY':
      return { strategy, params: getHierarchyParams(count) };
    case 'FORCE_DIRECTED':
      return { strategy, params: getForceDirectedParams(count) };
  }
}
