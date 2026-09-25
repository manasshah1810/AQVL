import { describe, it, expect } from 'vitest';
import { interpolateFrame, lerpVec3, type InterpolatableElement } from './AnimationInterpolator';

function el(id: string, x: number, opacity = 1): InterpolatableElement {
  return { id, position: { x, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, opacity };
}

function mapOf(elements: InterpolatableElement[]): Map<string, InterpolatableElement> {
  return new Map(elements.map((e) => [e.id, e]));
}

describe('lerpVec3', () => {
  it('interpolates each axis independently', () => {
    expect(lerpVec3({ x: 0, y: 0, z: 0 }, { x: 10, y: -10, z: 5 }, 0.5)).toEqual({ x: 5, y: -5, z: 2.5 });
  });
});

describe('interpolateFrame', () => {
  it('linearly tweens position for an element present in both frames', () => {
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);
    const result = interpolateFrame(from, to, 0.5);
    expect(result.get('a')?.position.x).toBe(5);
  });

  it('fades an element present only in the destination frame in from opacity 0', () => {
    const from = mapOf([]);
    const to = mapOf([el('b', 3, 1)]);
    const result = interpolateFrame(from, to, 0.5);
    expect(result.get('b')?.opacity).toBe(0.5);
    expect(result.get('b')?.position.x).toBe(3); // held at final position, not interpolated from nowhere
  });

  it('fades an element present only in the source frame out to opacity 0', () => {
    const from = mapOf([el('c', 7, 1)]);
    const to = mapOf([]);
    const result = interpolateFrame(from, to, 0.5);
    expect(result.get('c')?.opacity).toBe(0.5);
    expect(result.get('c')?.position.x).toBe(7); // held at its last position, not interpolated toward nowhere
  });

  it('clamps t within its normal [0, 1] domain', () => {
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);
    expect(interpolateFrame(from, to, 0).get('a')?.position.x).toBe(0);
    expect(interpolateFrame(from, to, 1).get('a')?.position.x).toBe(10);
  });

  it('permits a moderately overshooting t (e.g. from an eased curve) rather than flattening it back to the endpoint', () => {
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);
    // t = 1.125 is a typical easeOutBack overshoot value — should extrapolate past the destination, not clamp to it.
    const result = interpolateFrame(from, to, 1.125);
    expect(result.get('a')?.position.x).toBeCloseTo(11.25, 5);
  });

  it('still guards against wildly out-of-range t', () => {
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);
    const high = interpolateFrame(from, to, 1000);
    const low = interpolateFrame(from, to, -1000);
    expect(high.get('a')?.position.x).toBeLessThan(20); // clamped well short of a 1000x extrapolation
    expect(low.get('a')?.position.x).toBeGreaterThan(-10);
  });
});
