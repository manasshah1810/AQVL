/**
 * Unit tests for the CIRCULAR layout strategy (Phase 3.2 — see
 * docs/design/aqir-geometry-spec.md §1.1/§3: CIRCULAR lays out n elements
 * evenly around a ring in the X-Z plane at a fixed Y). Pure math, no
 * VM/compiler involved.
 */
import { describe, expect, it } from 'vitest';
import { CircularLayout } from '../../packages/runtime/src/layout/strategies/CircularLayout';
import type { LayoutElementInput } from '../../packages/runtime/src/layout/LayoutEngine';

function elements(n: number): LayoutElementInput[] {
  return Array.from({ length: n }, (_, i) => ({ id: `el${i}`, logicalIndex: i }));
}

function distance(p: { x: number; y: number; z: number }, center: { x: number; y: number; z: number }): number {
  return Math.sqrt((p.x - center.x) ** 2 + (p.y - center.y) ** 2 + (p.z - center.z) ** 2);
}

describe('CircularLayout', () => {
  const circular = new CircularLayout();

  it('4 elements, radius=5, startAngle=0 -> exact trigonometric positions', () => {
    const positions = circular.compute(elements(4), { radius: 5, startAngle: 0 });
    expect(positions.size).toBe(4);
    // Angles: 0, 90, 180, 270 degrees.
    const el0 = positions.get('el0')!;
    const el1 = positions.get('el1')!;
    const el2 = positions.get('el2')!;
    const el3 = positions.get('el3')!;

    expect(el0.x).toBeCloseTo(5, 10);
    expect(el0.z).toBeCloseTo(0, 10);

    expect(el1.x).toBeCloseTo(0, 10);
    expect(el1.z).toBeCloseTo(5, 10);

    expect(el2.x).toBeCloseTo(-5, 10);
    expect(el2.z).toBeCloseTo(0, 10);

    expect(el3.x).toBeCloseTo(0, 10);
    expect(el3.z).toBeCloseTo(-5, 10);

    // Fixed Y (default origin.y = 0).
    [el0, el1, el2, el3].forEach((p) => expect(p.y).toBe(0));
  });

  it('1 element -> sits at radius, not at the center', () => {
    const positions = circular.compute(elements(1), { radius: 4, startAngle: 0 });
    const p = positions.get('el0')!;
    expect(p).not.toEqual({ x: 0, y: 0, z: 0 });
    expect(distance(p, { x: 0, y: 0, z: 0 })).toBeCloseTo(4, 10);
  });

  it('0 elements -> empty map', () => {
    const positions = circular.compute(elements(0), { radius: 5 });
    expect(positions.size).toBe(0);
  });

  it('all elements are equidistant from the center (radius correctness)', () => {
    const positions = circular.compute(elements(7), { radius: 3.5, startAngle: 20 });
    const center = { x: 0, y: 0, z: 0 };
    positions.forEach((p) => {
      expect(distance(p, center)).toBeCloseTo(3.5, 10);
    });
  });

  it('startAngle rotates the whole ring', () => {
    const base = circular.compute(elements(4), { radius: 5, startAngle: 0 });
    const rotated = circular.compute(elements(4), { radius: 5, startAngle: 90 });
    // Rotating startAngle by 90 degrees should move element 0 to where element 1 was.
    expect(rotated.get('el0')!.x).toBeCloseTo(base.get('el1')!.x, 10);
    expect(rotated.get('el0')!.z).toBeCloseTo(base.get('el1')!.z, 10);
  });

  it('elements are evenly spaced by angle (equal chord lengths)', () => {
    const positions = circular.compute(elements(6), { radius: 2, startAngle: 0 });
    const pts = Array.from({ length: 6 }, (_, i) => positions.get(`el${i}`)!);
    const chord = (a: typeof pts[0], b: typeof pts[0]) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
    const chords = pts.map((p, i) => chord(p, pts[(i + 1) % pts.length]));
    chords.forEach((c) => expect(c).toBeCloseTo(chords[0], 10));
  });

  it('honors a non-zero origin (center of the ring shifts)', () => {
    const positions = circular.compute(elements(1), { radius: 5, startAngle: 0, origin: [10, 2, -3] });
    const p = positions.get('el0')!;
    expect(p).toEqual({ x: 15, y: 2, z: -3 });
  });

  it('defaults radius to 3 and startAngle to 0 when omitted', () => {
    const positions = circular.compute(elements(1), {});
    const p = positions.get('el0')!;
    expect(p.x).toBeCloseTo(3, 10);
    expect(p.z).toBeCloseTo(0, 10);
  });

  it('orders by logicalIndex regardless of input array order', () => {
    const input: LayoutElementInput[] = [
      { id: 'b', logicalIndex: 1 },
      { id: 'a', logicalIndex: 0 },
    ];
    const positions = circular.compute(input, { radius: 5, startAngle: 0 });
    // el at logicalIndex 0 ('a') should be at angle 0 -> (radius, 0); logicalIndex 1 ('b') at angle 180.
    expect(positions.get('a')!.x).toBeCloseTo(5, 10);
    expect(positions.get('b')!.x).toBeCloseTo(-5, 10);
  });
});
