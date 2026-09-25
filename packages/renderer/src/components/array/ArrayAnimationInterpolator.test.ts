import { describe, it, expect } from 'vitest';
import { ArrayAnimationInterpolator, selectEasingForOperation } from './ArrayAnimationInterpolator';
import { swapEasing, shiftEasing, fadeEasing, comparisonPulseEasing } from './arrayEasing';
import type { InterpolatableElement } from '../../core/AnimationInterpolator';

function el(id: string, x: number): InterpolatableElement {
  return { id, position: { x, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, opacity: 1 };
}

function mapOf(elements: InterpolatableElement[]): Map<string, InterpolatableElement> {
  return new Map(elements.map((e) => [e.id, e]));
}

describe('selectEasingForOperation', () => {
  it('selects swapEasing for a SWAP-typed operation with a swap intent', () => {
    expect(selectEasingForOperation({ type: 'SWAP', intent: 'adjacent-swap' })).toBe(swapEasing);
    expect(selectEasingForOperation({ type: 'SWAP', intent: 'selection-swap' })).toBe(swapEasing);
    expect(selectEasingForOperation({ type: 'SWAP', intent: 'partition-swap' })).toBe(swapEasing);
  });

  it("selects shiftEasing for insertion sort's 'shift' intent even though its type is SWAP", () => {
    expect(selectEasingForOperation({ type: 'SWAP', intent: 'shift' })).toBe(shiftEasing);
  });

  it('selects comparisonPulseEasing for a COMPARE-typed operation', () => {
    expect(selectEasingForOperation({ type: 'COMPARE', intent: 'adjacent-check' })).toBe(comparisonPulseEasing);
    expect(selectEasingForOperation({ type: 'COMPARE' })).toBe(comparisonPulseEasing);
  });

  it('selects fadeEasing for OVERWRITE/INSERT/DELETE operations', () => {
    expect(selectEasingForOperation({ type: 'OVERWRITE' })).toBe(fadeEasing);
    expect(selectEasingForOperation({ type: 'INSERT' })).toBe(fadeEasing);
    expect(selectEasingForOperation({ type: 'DELETE' })).toBe(fadeEasing);
  });

  it('selects swapEasing for FINALIZE (a pivotal lock-in, per array-animation-excellence-spec.md §1.5)', () => {
    expect(selectEasingForOperation({ type: 'FINALIZE', intent: 'final-placement' })).toBe(swapEasing);
  });

  it('falls back to shiftEasing for an unrecognized type with no intent', () => {
    expect(selectEasingForOperation({ type: 'SOMETHING_UNKNOWN' })).toBe(shiftEasing);
  });

  it("prioritizes intent over type when they'd disagree", () => {
    // A COMPARE-typed step tagged with a swap intent (hypothetical) should still follow the intent.
    expect(selectEasingForOperation({ type: 'COMPARE', intent: 'adjacent-swap' })).toBe(swapEasing);
  });
});

describe('ArrayAnimationInterpolator', () => {
  it('applies swapEasing (with overshoot) for a SWAP operation', () => {
    const interpolator = new ArrayAnimationInterpolator();
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);

    // t=0.5 under easeOutBack overshoots to 1.125 → position should extrapolate past 10.
    const result = interpolator.interpolateFrame(from, to, 0.5, { type: 'SWAP', intent: 'adjacent-swap' });
    expect(result.get('a')?.position.x).toBeGreaterThan(10);
  });

  it('applies shiftEasing (no overshoot) for a shift operation, never exceeding the destination', () => {
    const interpolator = new ArrayAnimationInterpolator();
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);

    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const result = interpolator.interpolateFrame(from, to, t, { type: 'SWAP', intent: 'shift' });
      const x = result.get('a')!.position.x;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(10);
    }
  });

  it('matches interpolateFrame(t=0)/(t=1) exactly at the endpoints regardless of operation (every easing curve is 0 at 0 and 1 at 1)', () => {
    const interpolator = new ArrayAnimationInterpolator();
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);

    for (const operation of [
      { type: 'SWAP', intent: 'adjacent-swap' },
      { type: 'COMPARE' },
      { type: 'OVERWRITE' },
    ]) {
      expect(interpolator.interpolateFrame(from, to, 0, operation).get('a')?.position.x).toBe(0);
      expect(interpolator.interpolateFrame(from, to, 1, operation).get('a')?.position.x).toBeCloseTo(10, 5);
    }
  });

  it('clamps its own raw t input to [0, 1] before easing (defensive against bad playback progress)', () => {
    const interpolator = new ArrayAnimationInterpolator();
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);

    const overRaw = interpolator.interpolateFrame(from, to, 5, { type: 'SWAP', intent: 'shift' });
    const atOne = interpolator.interpolateFrame(from, to, 1, { type: 'SWAP', intent: 'shift' });
    expect(overRaw.get('a')?.position.x).toBe(atOne.get('a')?.position.x);
  });

  it('routes a genuine two-element swap through the arc path (position leaves the X/Z=0 plane mid-motion)', () => {
    const interpolator = new ArrayAnimationInterpolator();
    const from = mapOf([el('a', 0), el('b', 10)]);
    const to = mapOf([el('a', 10), el('b', 0)]);

    const result = interpolator.interpolateFrame(from, to, 0.2, { type: 'SWAP', intent: 'adjacent-swap' });
    expect(result.get('a')?.position.y).toBeGreaterThan(0.5);
    expect(result.get('b')?.position.y).toBeGreaterThan(0.5);
    expect(Math.abs(result.get('a')!.position.z)).toBeGreaterThan(0.5);
    expect(Math.abs(result.get('b')!.position.z)).toBeGreaterThan(0.5);
  });

  it('sends the two swapping elements down opposite-depth arcs (never the same Z mid-motion)', () => {
    const interpolator = new ArrayAnimationInterpolator();
    const from = mapOf([el('a', 0), el('b', 10)]);
    const to = mapOf([el('a', 10), el('b', 0)]);

    // raw t=0.2 keeps swapEasing's eased output (~0.74) within [0, 1], so the depth hump is
    // still substantially engaged rather than already having settled from the landing overshoot.
    const result = interpolator.interpolateFrame(from, to, 0.2, { type: 'SWAP', intent: 'adjacent-swap' });
    const zA = result.get('a')!.position.z;
    const zB = result.get('b')!.position.z;
    expect(zA).toBeCloseTo(-zB, 10);
    expect(Math.abs(zA - zB)).toBeGreaterThan(1);
  });

  it('does not arc a lone moving element under a SWAP-tagged operation (no partner to trade places with)', () => {
    const interpolator = new ArrayAnimationInterpolator();
    const from = mapOf([el('a', 0)]);
    const to = mapOf([el('a', 10)]);

    const result = interpolator.interpolateFrame(from, to, 0.5, { type: 'SWAP', intent: 'adjacent-swap' });
    expect(result.get('a')?.position.z).toBe(0);
  });

  it('both swap-arced elements land exactly on their destination at t=1', () => {
    const interpolator = new ArrayAnimationInterpolator();
    const from = mapOf([el('a', 0), el('b', 10)]);
    const to = mapOf([el('a', 10), el('b', 0)]);

    const result = interpolator.interpolateFrame(from, to, 1, { type: 'SWAP', intent: 'adjacent-swap' });
    const posA = result.get('a')!.position;
    const posB = result.get('b')!.position;
    expect(posA.x).toBeCloseTo(10, 10);
    expect(posA.y).toBeCloseTo(0, 10);
    expect(posA.z).toBeCloseTo(0, 10);
    expect(posB.x).toBeCloseTo(0, 10);
    expect(posB.y).toBeCloseTo(0, 10);
    expect(posB.z).toBeCloseTo(0, 10);
  });
});
