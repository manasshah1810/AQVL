/**
 * Unit tests for the HIERARCHY layout strategy (Phase 3.2 — see
 * docs/design/aqir-geometry-spec.md §1.1 and the subtree-width algorithm
 * documented in packages/runtime/src/layout/strategies/HierarchyLayout.ts,
 * generalized from the production TreeLayoutStrategy audited in
 * docs/design/existing-layout-audit.md §5). Pure math, no VM/compiler/scene
 * involved — parent/child relationships are supplied directly via
 * `LayoutElementInput.parentId`.
 */
import { describe, expect, it } from 'vitest';
import { HierarchyLayout } from '../../packages/runtime/src/layout/strategies/HierarchyLayout';
import type { LayoutElementInput, Position3D } from '../../packages/runtime/src/layout/LayoutEngine';

/** Builds a node list from a parent-pointer description: [id, parentId|null]. */
function nodes(entries: [string, string | null][]): LayoutElementInput[] {
  return entries.map(([id, parentId], logicalIndex) => ({ id, logicalIndex, parentId }));
}

/** Every pairwise distance between leaf x-coordinates at the same depth must exceed a minimum gap (no overlap). */
function assertNoHorizontalOverlap(xs: number[], minGap: number): void {
  const sorted = [...xs].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(minGap - 1e-9);
  }
}

describe('HierarchyLayout', () => {
  const hierarchy = new HierarchyLayout();

  it('single node -> at origin', () => {
    const positions = hierarchy.compute(nodes([['root', null]]), { levelGap: 2, siblingGap: 1.5 });
    expect(positions.get('root')).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('empty input -> empty map', () => {
    const positions = hierarchy.compute([], { levelGap: 2, siblingGap: 1.5 });
    expect(positions.size).toBe(0);
  });

  it('balanced binary tree (7 nodes, 3 levels): correct depths, no overlap', () => {
    // root -> {a,b}; a -> {c,d}; b -> {e,f}
    const input = nodes([
      ['root', null],
      ['a', 'root'],
      ['b', 'root'],
      ['c', 'a'],
      ['d', 'a'],
      ['e', 'b'],
      ['f', 'b'],
    ]);
    const positions = hierarchy.compute(input, { levelGap: 2, siblingGap: 1.5 });
    expect(positions.size).toBe(7);

    const y = (id: string) => positions.get(id)!.y;
    expect(y('root')).toBe(0);
    expect(y('a')).toBe(-2);
    expect(y('b')).toBe(-2);
    expect(y('c')).toBe(-4);
    expect(y('f')).toBe(-4);

    // Level-2 (a,b) don't overlap; level-3 leaves (c,d,e,f) don't overlap.
    assertNoHorizontalOverlap([positions.get('a')!.x, positions.get('b')!.x], 1.5);
    assertNoHorizontalOverlap(
      ['c', 'd', 'e', 'f'].map((id) => positions.get(id)!.x),
      1.5
    );
  });

  it('unbalanced tree (deep chain + a wide subtree hanging off the chain): no overlap anywhere', () => {
    // root -> chain1 -> chain2 -> chain3; chain3 also has 4 leaf children (wide subtree).
    const input = nodes([
      ['root', null],
      ['chain1', 'root'],
      ['chain2', 'chain1'],
      ['chain3', 'chain2'],
      ['leaf1', 'chain3'],
      ['leaf2', 'chain3'],
      ['leaf3', 'chain3'],
      ['leaf4', 'chain3'],
    ]);
    const positions = hierarchy.compute(input, { levelGap: 2, siblingGap: 1.5 });
    expect(positions.size).toBe(8);

    const leafXs = ['leaf1', 'leaf2', 'leaf3', 'leaf4'].map((id) => positions.get(id)!.x);
    assertNoHorizontalOverlap(leafXs, 1.5);

    // The chain sits directly above the wide subtree's centroid (no lateral drift).
    const chainX = positions.get('chain3')!.x;
    const centroid = leafXs.reduce((a, b) => a + b, 0) / leafXs.length;
    expect(chainX).toBeCloseTo(centroid, 10);
  });

  it('linked-list-shaped tree (every node has exactly one child): sensible vertical layout, no overlaps', () => {
    const input = nodes([
      ['n1', null],
      ['n2', 'n1'],
      ['n3', 'n2'],
      ['n4', 'n3'],
      ['n5', 'n4'],
    ]);
    const positions = hierarchy.compute(input, { levelGap: 1.5, siblingGap: 1 });
    expect(positions.size).toBe(5);

    // A pure chain never branches -> every node sits on the same x (the chain's own centroid).
    const xs = ['n1', 'n2', 'n3', 'n4', 'n5'].map((id) => positions.get(id)!.x);
    xs.forEach((x) => expect(x).toBeCloseTo(xs[0], 10));

    // Depth strictly increases (y strictly decreases) down the chain.
    const ys = ['n1', 'n2', 'n3', 'n4', 'n5'].map((id) => positions.get(id)!.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeLessThan(ys[i - 1]);
    }
  });

  it('a parent sits above its children\'s subtree-width-weighted centroid (rule consistency, asymmetric case)', () => {
    // root -> {a (leaf, subtree width 1), b (2 leaf children, subtree width 2)} — asymmetric.
    const input = nodes([
      ['root', null],
      ['a', 'root'],
      ['b', 'root'],
      ['b1', 'b'],
      ['b2', 'b'],
    ]);
    const positions = hierarchy.compute(input, { levelGap: 2, siblingGap: 1.5 });

    // b's two equal-width leaf children -> b sits at their simple (== weighted) average.
    const bCentroid = (positions.get('b1')!.x + positions.get('b2')!.x) / 2;
    expect(positions.get('b')!.x).toBeCloseTo(bCentroid, 10);

    // root's children (a, b) have unequal subtree widths (1 leaf-slot vs. 2)
    // -> root sits at their width-weighted centroid, not the naive midpoint.
    const aWidth = 1;
    const bWidth = 2;
    const weightedCentroid =
      (positions.get('a')!.x * aWidth + positions.get('b')!.x * bWidth) / (aWidth + bWidth);
    expect(positions.get('root')!.x).toBeCloseTo(weightedCentroid, 10);
  });

  it('multiple disconnected roots (a forest) are laid out side by side without overlap', () => {
    const input = nodes([
      ['r1', null],
      ['r1a', 'r1'],
      ['r1b', 'r1'],
      ['r2', null],
      ['r2a', 'r2'],
    ]);
    const positions = hierarchy.compute(input, { levelGap: 2, siblingGap: 1.5 });
    expect(positions.size).toBe(5);
    assertNoHorizontalOverlap(
      ['r1a', 'r1b', 'r2a'].map((id) => positions.get(id)!.x),
      1.5
    );
    expect(positions.get('r2')!.x).toBeGreaterThan(positions.get('r1')!.x);
  });

  it('honors a non-zero origin', () => {
    const positions = hierarchy.compute(nodes([['root', null]]), { levelGap: 2, siblingGap: 1.5, origin: [5, 3, -1] });
    expect(positions.get('root')).toEqual({ x: 5, y: 3, z: -1 });
  });

  it('z is constant (flat, X-Y tree plane) across all nodes', () => {
    const input = nodes([
      ['root', null],
      ['a', 'root'],
      ['b', 'root'],
    ]);
    const positions = hierarchy.compute(input, { levelGap: 2, siblingGap: 1.5, origin: [0, 0, 4] });
    const zs = [...positions.values()].map((p: Position3D) => p.z);
    zs.forEach((z) => expect(z).toBe(4));
  });

  it('defaults levelGap to 2 and siblingGap to 1.5 when omitted', () => {
    const input = nodes([
      ['root', null],
      ['a', 'root'],
    ]);
    const positions = hierarchy.compute(input, {});
    expect(positions.get('root')!.y - positions.get('a')!.y).toBe(2);
  });

  it('children are ordered by logicalIndex, not input array order', () => {
    const input: LayoutElementInput[] = [
      { id: 'root', logicalIndex: 0, parentId: null },
      { id: 'right', logicalIndex: 2, parentId: 'root' },
      { id: 'left', logicalIndex: 1, parentId: 'root' },
    ];
    const positions = hierarchy.compute(input, { levelGap: 2, siblingGap: 1.5 });
    expect(positions.get('left')!.x).toBeLessThan(positions.get('right')!.x);
  });

  it('an orphaned parentId (points outside the given element set) is treated as a root, not an error', () => {
    const input = nodes([['n1', 'ghost-parent']]);
    expect(() => hierarchy.compute(input, {})).not.toThrow();
    expect(hierarchy.compute(input, {}).get('n1')).toEqual({ x: 0, y: 0, z: 0 });
  });
});
