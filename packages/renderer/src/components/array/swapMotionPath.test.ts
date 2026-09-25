import { describe, it, expect } from 'vitest';
import { computeSwapArcPosition, assignSwapArcSides, SWAP_ARC_LIFT, SWAP_ARC_DEPTH } from './swapMotionPath';
import type { Vec3 } from '../../core/AnimationInterpolator';

function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function straightLerp(start: Vec3, end: Vec3, t: number): Vec3 {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
  };
}

describe('computeSwapArcPosition', () => {
  const start: Vec3 = { x: 0, y: 0, z: 0 };
  const end: Vec3 = { x: 10, y: 0, z: 0 };

  it('matches the start position exactly at t=0', () => {
    const pos = computeSwapArcPosition(start, end, 0, 'front');
    expect(pos).toEqual(start);
  });

  it('matches the end position exactly at t=1 (lift/depth fully settled)', () => {
    const pos = computeSwapArcPosition(start, end, 1, 'front');
    expect(pos.x).toBeCloseTo(10, 10);
    expect(pos.y).toBeCloseTo(0, 10);
    expect(pos.z).toBeCloseTo(0, 10);
  });

  it('genuinely deviates from a straight line at the midpoint (proves it arcs, not still linear)', () => {
    const arced = computeSwapArcPosition(start, end, 0.5, 'front');
    const linear = straightLerp(start, end, 0.5);
    expect(dist(arced, linear)).toBeGreaterThan(0.5);
  });

  it('lifts to the full SWAP_ARC_LIFT height at the midpoint', () => {
    const pos = computeSwapArcPosition(start, end, 0.5, 'front');
    expect(pos.y).toBeCloseTo(SWAP_ARC_LIFT, 5);
  });

  it('pushes to +SWAP_ARC_DEPTH for the "front" side and -SWAP_ARC_DEPTH for the "back" side at the midpoint', () => {
    const front = computeSwapArcPosition(start, end, 0.5, 'front');
    const back = computeSwapArcPosition(start, end, 0.5, 'back');
    expect(front.z).toBeCloseTo(SWAP_ARC_DEPTH, 5);
    expect(back.z).toBeCloseTo(-SWAP_ARC_DEPTH, 5);
  });

  it('produces distinct paths for the two sides at every intermediate t (front and back never coincide mid-motion)', () => {
    for (const t of [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
      const front = computeSwapArcPosition(start, end, t, 'front');
      const back = computeSwapArcPosition(start, end, t, 'back');
      expect(dist(front, back)).toBeGreaterThan(0);
    }
  });

  it('never lets the arc dip below the baseline y (hump is clamped, never negative)', () => {
    for (const t of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      const pos = computeSwapArcPosition(start, end, t, 'front');
      expect(pos.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps the lift/depth hump for eased t outside [0, 1] (overshoot from swapEasing settles cleanly, no extra arc)', () => {
    const overshoot = computeSwapArcPosition(start, end, 1.125, 'front');
    expect(overshoot.y).toBeCloseTo(0, 5);
    expect(overshoot.z).toBeCloseTo(0, 5);
  });
});

describe('assignSwapArcSides', () => {
  it('assigns the two elements of a pair to opposite sides', () => {
    const { aSide, bSide } = assignSwapArcSides('el-3', 'el-7');
    expect(aSide).not.toBe(bSide);
  });

  it('is deterministic regardless of argument order (same pair always gets the same assignment)', () => {
    const forward = assignSwapArcSides('el-3', 'el-7');
    const reversed = assignSwapArcSides('el-7', 'el-3');
    expect(forward.aSide).toBe(reversed.bSide);
    expect(forward.bSide).toBe(reversed.aSide);
  });

  it('never lets the two swapping elements collide at the midpoint of a real swap (min separation stays well above zero)', () => {
    const posA: Vec3 = { x: 0, y: 0, z: 0 };
    const posB: Vec3 = { x: 10, y: 0, z: 0 };
    const { aSide, bSide } = assignSwapArcSides('el-a', 'el-b');

    let minDistance = Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const a = computeSwapArcPosition(posA, posB, t, aSide);
      const b = computeSwapArcPosition(posB, posA, t, bSide);
      minDistance = Math.min(minDistance, dist(a, b));
    }

    // Even at the crossing point (t=0.5, where a plain straight-line swap would have both
    // elements occupying the same spot), the depth split keeps them apart by a safe margin.
    expect(minDistance).toBeGreaterThan(1.0);
  });
});
