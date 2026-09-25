import { describe, it, expect } from 'vitest';
import { swapEasing, shiftEasing, fadeEasing, comparisonPulseEasing } from './arrayEasing';

const POINTS = [0, 0.25, 0.5, 0.75, 1];

function sample(fn: (t: number) => number) {
  return POINTS.map((t) => fn(t));
}

describe('swapEasing (easeOutBack — weighted overshoot-and-settle)', () => {
  it('starts at exactly 0 and ends at exactly 1', () => {
    const [start, , , , end] = sample(swapEasing);
    expect(start).toBe(0);
    expect(end).toBeCloseTo(1, 5);
  });

  it('overshoots past 1.0 in the middle of the curve', () => {
    const [, , mid] = sample(swapEasing);
    expect(mid).toBeGreaterThan(1);
  });

  it('is still above 1.0 late in the curve, then settles back down toward it by t=1', () => {
    const [, , mid, late, end] = sample(swapEasing);
    expect(late).toBeGreaterThan(1); // still overshooting
    expect(late).toBeLessThan(mid); // settling back down from the peak
    expect(end).toBeLessThan(late); // and fully settled to 1.0 by the end
  });

  it('rises quickly early on (25% time already covers most of the approach to 1.0)', () => {
    const [, quarter] = sample(swapEasing);
    expect(quarter).toBeGreaterThan(0.5);
    expect(quarter).toBeLessThan(1); // hasn't overshot yet this early
  });

  it('matches the known easeOutBack values at each sample point (regression pin)', () => {
    const values = sample(swapEasing);
    expect(values[0]).toBeCloseTo(0, 4);
    expect(values[1]).toBeCloseTo(0.85938, 4);
    expect(values[2]).toBeCloseTo(1.125, 4);
    expect(values[3]).toBeCloseTo(1.07813, 4);
    expect(values[4]).toBeCloseTo(1, 4);
  });
});

describe('shiftEasing (easeInOutQuad — smooth, no overshoot)', () => {
  it('starts at 0 and ends at 1', () => {
    const values = sample(shiftEasing);
    expect(values[0]).toBe(0);
    expect(values[4]).toBeCloseTo(1, 5);
  });

  it('never exceeds 1 or drops below 0 at any sampled point', () => {
    for (const v of sample(shiftEasing)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is exactly 0.5 at the midpoint (symmetric ease-in-out)', () => {
    const [, , mid] = sample(shiftEasing);
    expect(mid).toBeCloseTo(0.5, 5);
  });

  it('is monotonically increasing across all sample points', () => {
    const values = sample(shiftEasing);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('matches the known easeInOutQuad values at each sample point (regression pin)', () => {
    const values = sample(shiftEasing);
    expect(values[1]).toBeCloseTo(0.125, 4);
    expect(values[3]).toBeCloseTo(0.875, 4);
  });
});

describe('fadeEasing (easeInOutCubic — smooth, no overshoot, symmetric for both fade directions)', () => {
  it('starts at 0 and ends at 1', () => {
    const values = sample(fadeEasing);
    expect(values[0]).toBe(0);
    expect(values[4]).toBeCloseTo(1, 5);
  });

  it('never exceeds 1 or drops below 0 (no overshoot — opacity must never leave [0, 1] territory)', () => {
    for (const v of sample(fadeEasing)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is exactly 0.5 at the midpoint (symmetric, no directional bias between fade-in and fade-out)', () => {
    const [, , mid] = sample(fadeEasing);
    expect(mid).toBeCloseTo(0.5, 5);
  });

  it('accelerates faster through the middle than shiftEasing does (a more pronounced ease, per its cubic vs. quad power)', () => {
    const fadeQuarter = sample(fadeEasing)[1];
    const shiftQuarter = sample(shiftEasing)[1];
    expect(fadeQuarter).toBeLessThan(shiftQuarter);
  });
});

describe('comparisonPulseEasing (easeInOutSine — gentle pause-and-pulse, no overshoot)', () => {
  it('starts at 0 and ends at 1', () => {
    const values = sample(comparisonPulseEasing);
    expect(values[0]).toBe(0);
    expect(values[4]).toBeCloseTo(1, 5);
  });

  it('never exceeds 1 or drops below 0', () => {
    for (const v of sample(comparisonPulseEasing)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is exactly 0.5 at the midpoint (symmetric)', () => {
    const [, , mid] = sample(comparisonPulseEasing);
    expect(mid).toBeCloseTo(0.5, 5);
  });

  it('matches the known easeInOutSine values at each sample point (regression pin)', () => {
    const values = sample(comparisonPulseEasing);
    expect(values[1]).toBeCloseTo(0.14645, 4);
    expect(values[3]).toBeCloseTo(0.85355, 4);
  });
});

describe('all easing functions', () => {
  it('clamp out-of-range input to [0, 1] before evaluating (never crash or extrapolate on bad input)', () => {
    for (const fn of [swapEasing, shiftEasing, fadeEasing, comparisonPulseEasing]) {
      expect(fn(-5)).toBe(fn(0));
      expect(fn(5)).toBe(fn(1));
    }
  });

  it('are pure functions — the same input always produces the same output', () => {
    for (const fn of [swapEasing, shiftEasing, fadeEasing, comparisonPulseEasing]) {
      expect(fn(0.37)).toBe(fn(0.37));
    }
  });
});
