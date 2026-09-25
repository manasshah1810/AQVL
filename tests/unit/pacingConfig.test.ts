/**
 * Tests for PacingConfig (packages/runtime/src/narrative/PacingConfig.ts) —
 * verifies the default routine/notable/pivotal multipliers from
 * docs/design/array-narrative-ux-spec.md §4, graceful defaulting for
 * untagged/unrecognized significance values, and that overrides work
 * without mutating the shared default instance.
 */
import { describe, expect, it } from 'vitest';
import {
  PacingConfig,
  DEFAULT_PACING_CONFIG,
  DEFAULT_PACING_MULTIPLIERS,
  DEFAULT_UNTAGGED_MULTIPLIER,
} from '../../packages/runtime/src/narrative/PacingConfig';

describe('PacingConfig — default tiers', () => {
  it('resolves "routine" to the fastest default multiplier (1x)', () => {
    expect(DEFAULT_PACING_CONFIG.getMultiplier('routine')).toBe(1);
  });

  it('resolves "notable" to the moderate default multiplier (1.5x)', () => {
    expect(DEFAULT_PACING_CONFIG.getMultiplier('notable')).toBe(1.5);
  });

  it('resolves "pivotal" to the slowest, most-emphasized default multiplier (2.5x)', () => {
    expect(DEFAULT_PACING_CONFIG.getMultiplier('pivotal')).toBe(2.5);
  });

  it('orders the three tiers correctly: routine < notable < pivotal', () => {
    const routine = DEFAULT_PACING_CONFIG.getMultiplier('routine');
    const notable = DEFAULT_PACING_CONFIG.getMultiplier('notable');
    const pivotal = DEFAULT_PACING_CONFIG.getMultiplier('pivotal');
    expect(routine).toBeLessThan(notable);
    expect(notable).toBeLessThan(pivotal);
  });

  it('exposes DEFAULT_PACING_MULTIPLIERS matching the same values a fresh PacingConfig uses', () => {
    expect(DEFAULT_PACING_MULTIPLIERS).toEqual({ routine: 1, notable: 1.5, pivotal: 2.5 });
    const fresh = new PacingConfig();
    expect(fresh.getMultiplier('routine')).toBe(DEFAULT_PACING_MULTIPLIERS.routine);
    expect(fresh.getMultiplier('notable')).toBe(DEFAULT_PACING_MULTIPLIERS.notable);
    expect(fresh.getMultiplier('pivotal')).toBe(DEFAULT_PACING_MULTIPLIERS.pivotal);
  });
});

describe('PacingConfig — untagged / unrecognized significance', () => {
  it('defaults to 1x for undefined significance (no crash)', () => {
    expect(() => DEFAULT_PACING_CONFIG.getMultiplier(undefined)).not.toThrow();
    expect(DEFAULT_PACING_CONFIG.getMultiplier(undefined)).toBe(DEFAULT_UNTAGGED_MULTIPLIER);
  });

  it('defaults to 1x for null significance (no crash)', () => {
    expect(DEFAULT_PACING_CONFIG.getMultiplier(null)).toBe(1);
  });

  it('defaults to 1x for an unrecognized significance string, never NaN or a crash', () => {
    const result = DEFAULT_PACING_CONFIG.getMultiplier('some-future-tier');
    expect(result).toBe(1);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('respects a custom untagged multiplier when configured', () => {
    const config = new PacingConfig({}, 0.75);
    expect(config.getMultiplier(undefined)).toBe(0.75);
    expect(config.getMultiplier('not-a-real-tier')).toBe(0.75);
  });
});

describe('PacingConfig — overrides', () => {
  it('constructor overrides replace only the specified tier(s), leaving the rest at defaults', () => {
    const config = new PacingConfig({ pivotal: 4 });
    expect(config.getMultiplier('pivotal')).toBe(4);
    expect(config.getMultiplier('routine')).toBe(DEFAULT_PACING_MULTIPLIERS.routine);
    expect(config.getMultiplier('notable')).toBe(DEFAULT_PACING_MULTIPLIERS.notable);
  });

  it('supports overriding all three tiers at once (e.g. a Phase 6 "slow mode" preset)', () => {
    const slowMode = new PacingConfig({ routine: 1.5, notable: 2.5, pivotal: 4 });
    expect(slowMode.getMultiplier('routine')).toBe(1.5);
    expect(slowMode.getMultiplier('notable')).toBe(2.5);
    expect(slowMode.getMultiplier('pivotal')).toBe(4);
  });

  it('withOverrides returns a new, independent instance and does not mutate the original', () => {
    const base = new PacingConfig({ pivotal: 2.5 });
    const fast = base.withOverrides({ routine: 0.5, notable: 0.75, pivotal: 1 });

    expect(fast.getMultiplier('routine')).toBe(0.5);
    expect(fast.getMultiplier('pivotal')).toBe(1);
    // The original instance (and the shared default) must be untouched.
    expect(base.getMultiplier('routine')).toBe(DEFAULT_PACING_MULTIPLIERS.routine);
    expect(base.getMultiplier('pivotal')).toBe(2.5);
    expect(DEFAULT_PACING_CONFIG.getMultiplier('pivotal')).toBe(2.5);
  });

  it('toMultipliers returns a plain snapshot reflecting any overrides applied', () => {
    const config = new PacingConfig({ notable: 2 });
    expect(config.toMultipliers()).toEqual({ routine: 1, notable: 2, pivotal: 2.5 });
  });
});
