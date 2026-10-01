import type { SemanticState } from '@aqvl/shared';

/**
 * What each state looks like besides its hue. Every state has at least one
 * cue that survives greyscale or colour-blindness: a lift, a finish, a size,
 * a halo shape, or motion. Hue is never the only signal.
 */
export interface StateTreatment {
  /** Height above the resting slot while the node is one of the step's emphasised actors. */
  emphasisLift: number;
  /** Height change that applies whenever the node is in this state (negative sinks). */
  restLift: number;
  /** Uniform scale while in this state. */
  scale: number;
  /** 0 = glossy clear-coated resin, 1 = matte, still, "done". */
  finish: number;
  /** Floor mark under the node when it is emphasised. */
  halo: 'none' | 'solid' | 'dashed' | 'double';
  /** Emissive strength while emphasised (only mutation crosses the bloom threshold). */
  glow: number;
  /** A short word for legends and screen readers. */
  word: string;
}

export const STATE_TREATMENTS: Record<SemanticState, StateTreatment> = {
  NEUTRAL: { emphasisLift: 0.25, restLift: 0, scale: 1, finish: 0, halo: 'none', glow: 0, word: 'idle' },
  // Being compared / read: rises to eye level, and the pair is joined by a bridge naming the relation.
  EVALUATING: { emphasisLift: 0.55, restLift: 0, scale: 1, finish: 0, halo: 'none', glow: 0.05, word: 'compared' },
  // Being written / swapped: the one thing that just changed. Arc motion, flash, floor shockwave, bloom.
  MODIFYING: { emphasisLift: 0.35, restLift: 0, scale: 1.04, finish: 0, halo: 'solid', glow: 1.15, word: 'changed' },
  // Being visited / pointed at: a solid floor ring under it.
  TRAVERSING: { emphasisLift: 0.22, restLift: 0, scale: 1, finish: 0, halo: 'solid', glow: 0.04, word: 'visited' },
  // Settled / sorted / found: matte, slightly smaller, sits still. Locks in with a floor shockwave.
  SUCCESS: { emphasisLift: 0.12, restLift: 0, scale: 0.94, finish: 1, halo: 'none', glow: 0, word: 'settled' },
  // Ruled out: a smaller, matte ghost that shrinks down onto the floor.
  DISCARDED: { emphasisLift: 0, restLift: 0, scale: 0.78, finish: 1, halo: 'none', glow: 0, word: 'ruled out' },
  // Marked (MARKED highlight, probe, boundary): a dashed floor ring.
  AUXILIARY: { emphasisLift: 0.22, restLift: 0, scale: 1, finish: 0.35, halo: 'dashed', glow: 0.03, word: 'marked' },
  // A role (root, leaf, view): a double floor ring.
  STRUCTURAL: { emphasisLift: 0.22, restLift: 0, scale: 1, finish: 0.35, halo: 'double', glow: 0.03, word: 'role' },
};
