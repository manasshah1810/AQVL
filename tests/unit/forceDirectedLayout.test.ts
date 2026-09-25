/**
 * Unit tests for the FORCE_DIRECTED layout strategy calculator (Phase 3.3 —
 * see docs/design/spatial-syntax-spec.md §1 "FORCE_DIRECTED"). Pure math, no
 * VM/compiler involved.
 */
import { describe, expect, it } from 'vitest';
import { ForceDirectedLayout } from '../../packages/runtime/src/layout/strategies/ForceDirectedLayout';
import type { LayoutElementInput, LayoutEdgeInput } from '../../packages/runtime/src/layout/LayoutEngine';

function elements(n: number): LayoutElementInput[] {
  return Array.from({ length: n }, (_, i) => ({ id: `el${i}`, logicalIndex: i }));
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

describe('ForceDirectedLayout', () => {
  const strategy = new ForceDirectedLayout();

  it('simple 4-node graph: connected nodes end up closer than disconnected pairs', () => {
    // Two disjoint edges: el0-el1 and el2-el3. No cross edges.
    const edges: LayoutEdgeInput[] = [
      { sourceId: 'el0', targetId: 'el1' },
      { sourceId: 'el2', targetId: 'el3' },
    ];
    const positions = strategy.compute(elements(4), { iterations: 200, repulsion: 5, attraction: 0.2, springLength: 2 }, edges);

    const connectedDist1 = dist(positions.get('el0')!, positions.get('el1')!);
    const connectedDist2 = dist(positions.get('el2')!, positions.get('el3')!);
    const crossDists = [
      dist(positions.get('el0')!, positions.get('el2')!),
      dist(positions.get('el0')!, positions.get('el3')!),
      dist(positions.get('el1')!, positions.get('el2')!),
      dist(positions.get('el1')!, positions.get('el3')!),
    ];
    const avgCross = crossDists.reduce((a, b) => a + b, 0) / crossDists.length;

    expect(connectedDist1).toBeLessThan(avgCross);
    expect(connectedDist2).toBeLessThan(avgCross);
  });

  it('no duplicate positions across all nodes (repulsion keeps them apart)', () => {
    const edges: LayoutEdgeInput[] = [
      { sourceId: 'el0', targetId: 'el1' },
      { sourceId: 'el1', targetId: 'el2' },
      { sourceId: 'el2', targetId: 'el3' },
      { sourceId: 'el3', targetId: 'el4' },
    ];
    const positions = strategy.compute(elements(5), { iterations: 150 }, edges);
    const pts = [...positions.values()];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(dist(pts[i], pts[j])).toBeGreaterThan(0.001);
      }
    }
  });

  it('disconnected components spread apart instead of collapsing to the same point', () => {
    // el0-el1 form one component, el2-el3 form another, no connections between.
    const edges: LayoutEdgeInput[] = [
      { sourceId: 'el0', targetId: 'el1' },
      { sourceId: 'el2', targetId: 'el3' },
    ];
    const positions = strategy.compute(elements(4), { iterations: 150 }, edges);
    const centroidA = {
      x: (positions.get('el0')!.x + positions.get('el1')!.x) / 2,
      z: (positions.get('el0')!.z + positions.get('el1')!.z) / 2,
    };
    const centroidB = {
      x: (positions.get('el2')!.x + positions.get('el3')!.x) / 2,
      z: (positions.get('el2')!.z + positions.get('el3')!.z) / 2,
    };
    expect(dist(centroidA, centroidB)).toBeGreaterThan(0.5);
  });

  it('single node -> at/near the origin', () => {
    const positions = strategy.compute(elements(1), {});
    expect(positions.get('el0')).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('single node honors a non-zero origin', () => {
    const positions = strategy.compute(elements(1), { origin: [3, 1, -2] });
    expect(positions.get('el0')).toEqual({ x: 3, y: 1, z: -2 });
  });

  it('0 nodes -> empty map, no crash', () => {
    const positions = strategy.compute(elements(0), {}, []);
    expect(positions.size).toBe(0);
  });

  it('no edges at all -> nodes still spread apart via pure repulsion', () => {
    const positions = strategy.compute(elements(5), { iterations: 100 });
    expect(positions.size).toBe(5);
    const pts = [...positions.values()];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(dist(pts[i], pts[j])).toBeGreaterThan(0.001);
      }
    }
  });

  it('more iterations settle to a lower total residual force than fewer iterations', () => {
    const edges: LayoutEdgeInput[] = [
      { sourceId: 'el0', targetId: 'el1' },
      { sourceId: 'el1', targetId: 'el2' },
      { sourceId: 'el2', targetId: 'el3' },
    ];

    const totalForce = (positions: Map<string, { x: number; y: number; z: number }>): number => {
      const ids = [...positions.keys()];
      let total = 0;
      // Residual repulsion (all pairs) minus attraction (edges) at the final configuration.
      for (let i = 0; i < ids.length; i++) {
        let fx = 0;
        let fz = 0;
        for (let j = 0; j < ids.length; j++) {
          if (i === j) continue;
          const a = positions.get(ids[i])!;
          const b = positions.get(ids[j])!;
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          const d = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
          const f = 5 / (d * d);
          fx += (dx / d) * f;
          fz += (dz / d) * f;
        }
        total += Math.sqrt(fx * fx + fz * fz);
      }
      return total;
    };

    const few = strategy.compute(elements(4), { iterations: 2, attraction: 0.2 }, edges);
    const many = strategy.compute(elements(4), { iterations: 300, attraction: 0.2 }, edges);

    expect(totalForce(many)).toBeLessThan(totalForce(few));
  });

  it('ignores edges referencing element ids outside the given set', () => {
    const edges: LayoutEdgeInput[] = [{ sourceId: 'el0', targetId: 'ghost' }];
    expect(() => strategy.compute(elements(2), { iterations: 10 }, edges)).not.toThrow();
  });

  it('y stays at origin.y for every node (layout happens in the X-Z plane)', () => {
    const positions = strategy.compute(elements(3), { iterations: 20, origin: [0, 4, 0] });
    [...positions.values()].forEach((p) => expect(p.y).toBe(4));
  });
});
