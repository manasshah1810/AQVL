/**
 * PacingConfig — turns a SortStep's `significance` tag (2.1) into a
 * `suggestedDurationMultiplier` an animation frame can carry, per
 * docs/design/array-narrative-ux-spec.md §4 ("pacing tied to narrative
 * significance"): routine events should read fast, pivotal ones (a decisive
 * compare, a swap's lock-in, FINALIZE, pivot selection/lock-in) deserve a
 * longer on-screen dwell so the viewer has time to register them.
 *
 * Today, every animation duration in SortAlgorithms.ts is a fixed literal
 * (e.g. 250ms for a compare, 300ms for a swap) — timing is not derived from
 * significance at all. This module doesn't change those literals; it adds a
 * *suggested multiplier* alongside them so a renderer can scale its own
 * durations (`duration * suggestedDurationMultiplier`) without having to
 * reimplement "which events are decisive" itself. Whether/how a renderer
 * applies it is a frontend decision — the backend only supplies the hint.
 *
 * Deliberately configurable rather than a set of scattered constants: Phase
 * 6's user-facing speed controls will need to layer their own global speed
 * multiplier on top of (or override) these per-significance defaults, so
 * this is a small class with overridable multipliers instead of exported
 * numeric literals referenced directly from handler code.
 */
import type { OperationSignificance } from '../core/algorithms/SortEngine';

export interface PacingMultipliers {
  routine: number;
  notable: number;
  pivotal: number;
}

/** Defaults per docs/design/array-narrative-ux-spec.md §4 — routine fastest, pivotal most emphasized. */
export const DEFAULT_PACING_MULTIPLIERS: PacingMultipliers = {
  routine: 1,
  notable: 1.5,
  pivotal: 2.5,
};

/** Multiplier used when an instruction carries no significance tag at all, or one this config doesn't recognize. */
export const DEFAULT_UNTAGGED_MULTIPLIER = 1;

export class PacingConfig {
  private readonly multipliers: PacingMultipliers;
  private readonly untaggedMultiplier: number;

  constructor(overrides: Partial<PacingMultipliers> = {}, untaggedMultiplier: number = DEFAULT_UNTAGGED_MULTIPLIER) {
    this.multipliers = { ...DEFAULT_PACING_MULTIPLIERS, ...overrides };
    this.untaggedMultiplier = untaggedMultiplier;
  }

  /**
   * Resolves the suggested duration multiplier for a given significance tag.
   * Never throws: `undefined`/`null`/an unrecognized string all resolve to
   * `untaggedMultiplier` (1x by default) rather than producing `NaN` or crashing.
   */
  getMultiplier(significance?: OperationSignificance | string | null): number {
    if (typeof significance === 'string' && this.isKnownTier(significance)) {
      return this.multipliers[significance];
    }
    return this.untaggedMultiplier;
  }

  /** Returns a new PacingConfig with the given tiers overridden, leaving this one untouched (Phase 6 user speed controls can layer on top without mutating shared defaults). */
  withOverrides(overrides: Partial<PacingMultipliers>, untaggedMultiplier: number = this.untaggedMultiplier): PacingConfig {
    return new PacingConfig({ ...this.multipliers, ...overrides }, untaggedMultiplier);
  }

  toMultipliers(): PacingMultipliers {
    return { ...this.multipliers };
  }

  private isKnownTier(value: string): value is OperationSignificance {
    return value === 'routine' || value === 'notable' || value === 'pivotal';
  }
}

/** Shared default instance — used wherever no explicit PacingConfig is supplied. */
export const DEFAULT_PACING_CONFIG = new PacingConfig();
