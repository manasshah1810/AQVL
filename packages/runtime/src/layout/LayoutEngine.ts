/**
 * Runtime layout engine — resolves AQIR SET_LAYOUT_STRATEGY + COMPUTE_LAYOUT
 * into concrete x/y/z coordinates per element (see
 * docs/design/aqir-geometry-spec.md §1.1/§1.3).
 *
 * Strategy calculators are pluggable via registerStrategy() so later phases
 * (FORCE_DIRECTED, ...) can be added without touching this file — LINE,
 * GRID, HIERARCHY, and CIRCULAR are registered by default here.
 *
 * This is a separate system from packages/runtime/src/core/LayoutManager.ts
 * (and its core/layouts/ strategies), which does heuristic, SceneElement-shape-based
 * layout for live algorithm-visualization animations. LayoutEngine only
 * serves the AQIR spatial-syntax opcodes above and is consumed solely by
 * VirtualMachine — it does not replace LayoutManager yet. See
 * docs/design/existing-layout-audit.md for the rationale, and the per-strategy
 * files here for notes on where they intentionally diverge from their
 * core/layouts/ counterparts (e.g. determinism, iterative vs recursive tree walk).
 */

import { LineLayout } from './strategies/LineLayout';
import { GridLayout } from './strategies/GridLayout';
import { HierarchyLayout } from './strategies/HierarchyLayout';
import { CircularLayout } from './strategies/CircularLayout';
import { ForceDirectedLayout } from './strategies/ForceDirectedLayout';
import { CustomLayout } from './strategies/CustomLayout';

export interface LayoutElementInput {
  id: string;
  /** Position within the structure's current element sequence (0-based). */
  logicalIndex: number;
  /**
   * Parent element id, for hierarchical layouts (HIERARCHY). Undefined/null,
   * or an id not present in the given element set, means "root" — ignored by
   * non-hierarchical strategies.
   */
  parentId?: string | null;
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export type PositionMap = Map<string, Position3D>;

/** One edge between two elements of the same structure, for edge-aware strategies (FORCE_DIRECTED). */
export interface LayoutEdgeInput {
  sourceId: string;
  targetId: string;
}

export interface LayoutCalculator {
  compute(elements: LayoutElementInput[], params: Record<string, any>, edges?: LayoutEdgeInput[]): PositionMap;
}

export class UnknownLayoutStrategyError extends Error {
  constructor(strategy: string, structureId: string, known: string[]) {
    super(
      `Unknown layout strategy "${strategy}" for structure "${structureId}". ` +
        `Registered strategies: ${known.length > 0 ? known.join(', ') : '(none)'}.`
    );
    this.name = 'UnknownLayoutStrategyError';
  }
}

/** Parses a LAYOUT `origin=(x,y,z)` param (compiled to a 3-tuple) into a Position3D, defaulting to world origin. */
export function parseOrigin(origin: unknown): Position3D {
  if (Array.isArray(origin) && origin.length === 3) {
    return { x: Number(origin[0]) || 0, y: Number(origin[1]) || 0, z: Number(origin[2]) || 0 };
  }
  return { x: 0, y: 0, z: 0 };
}

export class LayoutEngine {
  private strategies: Map<string, LayoutCalculator> = new Map();

  constructor() {
    this.registerStrategy('LINE', new LineLayout());
    this.registerStrategy('GRID', new GridLayout());
    this.registerStrategy('HIERARCHY', new HierarchyLayout());
    this.registerStrategy('CIRCULAR', new CircularLayout());
    this.registerStrategy('FORCE_DIRECTED', new ForceDirectedLayout());
    this.registerStrategy('CUSTOM', new CustomLayout());
  }

  public registerStrategy(name: string, calculator: LayoutCalculator): void {
    this.strategies.set(name, calculator);
  }

  public computeLayout(
    structureId: string,
    strategy: string,
    params: Record<string, any>,
    elements: LayoutElementInput[],
    edges?: LayoutEdgeInput[]
  ): PositionMap {
    const calculator = this.strategies.get(strategy);
    if (!calculator) {
      throw new UnknownLayoutStrategyError(strategy, structureId, [...this.strategies.keys()]);
    }
    return calculator.compute(elements, params ?? {}, edges);
  }
}
