/**
 * Unit tests for the runtime LayoutEngine + its LINE/GRID strategy
 * calculators (Phase 3.1 — see docs/design/aqir-geometry-spec.md §1.1/§1.3).
 * Pure math, no VM/compiler involved.
 */
import { describe, expect, it } from 'vitest';
import { LayoutEngine, UnknownLayoutStrategyError } from '../../packages/runtime/src/layout/LayoutEngine';
import { LineLayout } from '../../packages/runtime/src/layout/strategies/LineLayout';
import { GridLayout } from '../../packages/runtime/src/layout/strategies/GridLayout';
import type { LayoutElementInput, LayoutCalculator, PositionMap } from '../../packages/runtime/src/layout/LayoutEngine';

function elements(n: number): LayoutElementInput[] {
  return Array.from({ length: n }, (_, i) => ({ id: `el${i}`, logicalIndex: i }));
}

describe('LineLayout', () => {
  const line = new LineLayout();

  it('5 elements, spacing=1.5, horizontal -> x varies, y/z constant', () => {
    const positions = line.compute(elements(5), { spacing: 1.5, axis: 'horizontal' });
    expect(positions.size).toBe(5);
    // Centered: offsets are -3, -1.5, 0, 1.5, 3
    expect(positions.get('el0')).toEqual({ x: -3, y: 0, z: 0 });
    expect(positions.get('el1')).toEqual({ x: -1.5, y: 0, z: 0 });
    expect(positions.get('el2')).toEqual({ x: 0, y: 0, z: 0 });
    expect(positions.get('el3')).toEqual({ x: 1.5, y: 0, z: 0 });
    expect(positions.get('el4')).toEqual({ x: 3, y: 0, z: 0 });
  });

  it('1 element -> sits exactly at origin (not offset)', () => {
    const positions = line.compute(elements(1), { spacing: 2, axis: 'horizontal' });
    expect(positions.get('el0')).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('0 elements -> empty map', () => {
    const positions = line.compute(elements(0), { spacing: 2 });
    expect(positions.size).toBe(0);
  });

  it('vertical axis spreads along y, x/z constant', () => {
    const positions = line.compute(elements(3), { spacing: 2, axis: 'vertical' });
    expect(positions.get('el0')).toEqual({ x: 0, y: -2, z: 0 });
    expect(positions.get('el1')).toEqual({ x: 0, y: 0, z: 0 });
    expect(positions.get('el2')).toEqual({ x: 0, y: 2, z: 0 });
  });

  it('diagonal axis spreads equally along x and y', () => {
    const positions = line.compute(elements(3), { spacing: 2, axis: 'diagonal' });
    const p0 = positions.get('el0')!;
    const p2 = positions.get('el2')!;
    expect(p0.x).toBeCloseTo(p0.y, 10);
    expect(p2.x).toBeCloseTo(p2.y, 10);
    expect(p0.x).toBeLessThan(0);
    expect(p2.x).toBeGreaterThan(0);
    expect(positions.get('el1')).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('honors a non-zero origin', () => {
    const positions = line.compute(elements(1), { spacing: 2, axis: 'horizontal', origin: [5, 1, -2] });
    expect(positions.get('el0')).toEqual({ x: 5, y: 1, z: -2 });
  });

  it('defaults spacing to 1 and axis to horizontal when omitted', () => {
    const positions = line.compute(elements(2), {});
    expect(positions.get('el0')).toEqual({ x: -0.5, y: 0, z: 0 });
    expect(positions.get('el1')).toEqual({ x: 0.5, y: 0, z: 0 });
  });

  it('orders by logicalIndex regardless of input array order', () => {
    const input: LayoutElementInput[] = [
      { id: 'b', logicalIndex: 1 },
      { id: 'a', logicalIndex: 0 },
    ];
    const positions = line.compute(input, { spacing: 2, axis: 'horizontal' });
    expect(positions.get('a')).toEqual({ x: -1, y: 0, z: 0 });
    expect(positions.get('b')).toEqual({ x: 1, y: 0, z: 0 });
  });
});

describe('GridLayout', () => {
  const grid = new GridLayout();

  it('9 elements, 3x3 -> correct grid coordinates in the X-Z plane', () => {
    const positions = grid.compute(elements(9), { columns: 3, cellSpacing: 1 });
    // Row-major: el0..el2 = row 0, el3..el5 = row 1, el6..el8 = row 2
    expect(positions.get('el0')).toEqual({ x: -1, y: 0, z: -1 });
    expect(positions.get('el1')).toEqual({ x: 0, y: 0, z: -1 });
    expect(positions.get('el2')).toEqual({ x: 1, y: 0, z: -1 });
    expect(positions.get('el4')).toEqual({ x: 0, y: 0, z: 0 });
    expect(positions.get('el8')).toEqual({ x: 1, y: 0, z: 1 });
  });

  it('10 elements, auto-compute -> roughly square grid covering all elements', () => {
    const positions = grid.compute(elements(10), { cellSpacing: 1 });
    expect(positions.size).toBe(10);
    // sqrt(10) ~ 3.16 -> columns = 4, rows = ceil(10/4) = 3
    const xs = [...positions.values()].map((p) => p.x);
    const uniqueCols = new Set(xs.map((x) => Math.round(x * 1000)));
    expect(uniqueCols.size).toBeLessThanOrEqual(4);
  });

  it('rows given, columns computed from element count', () => {
    const positions = grid.compute(elements(6), { rows: 2, cellSpacing: 1 });
    // 6 elements / 2 rows -> 3 columns; row 0: el0,el1,el2; row 1: el3,el4,el5
    expect(positions.get('el0')!.z).toBe(positions.get('el1')!.z);
    expect(positions.get('el0')!.z).not.toBe(positions.get('el3')!.z);
  });

  it('1 element -> at origin', () => {
    const positions = grid.compute(elements(1), { cellSpacing: 2 });
    expect(positions.get('el0')).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('0 elements -> empty map', () => {
    const positions = grid.compute(elements(0), { columns: 3 });
    expect(positions.size).toBe(0);
  });

  it('non-filling last row still places every element without throwing', () => {
    const positions = grid.compute(elements(7), { columns: 3, cellSpacing: 1 });
    expect(positions.size).toBe(7);
    // Last row (row 2) only has el6 -> col 0.
    expect(positions.get('el6')).toEqual({ x: -1, y: 0, z: 1 });
  });

  it('honors a non-zero origin', () => {
    const positions = grid.compute(elements(1), { cellSpacing: 2, origin: [3, 4, 5] });
    expect(positions.get('el0')).toEqual({ x: 3, y: 4, z: 5 });
  });
});

describe('LayoutEngine', () => {
  it('comes pre-registered with LINE and GRID', () => {
    const engine = new LayoutEngine();
    const linePositions = engine.computeLayout('s', 'LINE', { spacing: 1 }, elements(2));
    const gridPositions = engine.computeLayout('s', 'GRID', { columns: 2 }, elements(2));
    expect(linePositions.size).toBe(2);
    expect(gridPositions.size).toBe(2);
  });

  it('registerStrategy() registers a new strategy that computeLayout() then uses', () => {
    const engine = new LayoutEngine();
    class ConstantLayout implements LayoutCalculator {
      compute(els: LayoutElementInput[]): PositionMap {
        const map: PositionMap = new Map();
        els.forEach((el) => map.set(el.id, { x: 42, y: 42, z: 42 }));
        return map;
      }
    }
    engine.registerStrategy('CONSTANT', new ConstantLayout());
    const positions = engine.computeLayout('s', 'CONSTANT', {}, elements(2));
    expect(positions.get('el0')).toEqual({ x: 42, y: 42, z: 42 });
    expect(positions.get('el1')).toEqual({ x: 42, y: 42, z: 42 });
  });

  it('registerStrategy() can override an existing strategy name', () => {
    const engine = new LayoutEngine();
    class ZeroLayout implements LayoutCalculator {
      compute(els: LayoutElementInput[]): PositionMap {
        const map: PositionMap = new Map();
        els.forEach((el) => map.set(el.id, { x: 0, y: 0, z: 0 }));
        return map;
      }
    }
    engine.registerStrategy('LINE', new ZeroLayout());
    const positions = engine.computeLayout('s', 'LINE', { spacing: 5 }, elements(3));
    expect(positions.get('el2')).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('an unregistered strategy throws a clear error', () => {
    const engine = new LayoutEngine();
    expect(() => engine.computeLayout('myStruct', 'NOT_A_STRATEGY', {}, elements(2))).toThrow(
      UnknownLayoutStrategyError
    );
    expect(() => engine.computeLayout('myStruct', 'NOT_A_STRATEGY', {}, elements(2))).toThrow(/myStruct/);
  });

  it('comes pre-registered with FORCE_DIRECTED and CUSTOM', () => {
    const engine = new LayoutEngine();
    const forcePositions = engine.computeLayout('s', 'FORCE_DIRECTED', { iterations: 5 }, elements(3));
    const customPositions = engine.computeLayout('s', 'CUSTOM', {}, elements(2));
    expect(forcePositions.size).toBe(3);
    expect(customPositions.size).toBe(2);
  });
});
