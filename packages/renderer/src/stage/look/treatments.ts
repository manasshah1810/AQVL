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
  /** Emissive strength while emphasised (kept at zero: the scene has no glow). */
  glow: number;
  /** A short word for legends and screen readers. */
  word: string;
}

export const STATE_TREATMENTS: Record<SemanticState, StateTreatment> = {
  NEUTRAL: { emphasisLift: 0.2, restLift: 0, scale: 1, finish: 0, halo: 'none', glow: 0, word: 'idle' },
  // Being compared / read: rises a little, and the pair is joined by a caption naming the relation.
  EVALUATING: { emphasisLift: 0.38, restLift: 0, scale: 1, finish: 0, halo: 'none', glow: 0, word: 'compared' },
  // Being written / swapped: the one thing that just changed. Coral, a short arc and one ripple.
  MODIFYING: { emphasisLift: 0.3, restLift: 0, scale: 1.04, finish: 0, halo: 'solid', glow: 0, word: 'changed' },
  // Being visited / pointed at: a solid ring under it.
  TRAVERSING: { emphasisLift: 0.2, restLift: 0, scale: 1, finish: 0, halo: 'solid', glow: 0, word: 'visited' },
  // Settled / sorted / found: matte, slightly smaller, sits still.
  SUCCESS: { emphasisLift: 0.1, restLift: 0, scale: 0.95, finish: 1, halo: 'none', glow: 0, word: 'settled' },
  // Ruled out: a smaller, matte grey body.
  DISCARDED: { emphasisLift: 0, restLift: 0, scale: 0.8, finish: 1, halo: 'none', glow: 0, word: 'ruled out' },
  // Marked (MARKED highlight, probe, boundary): a dashed ring.
  AUXILIARY: { emphasisLift: 0.2, restLift: 0, scale: 1, finish: 0.4, halo: 'dashed', glow: 0, word: 'marked' },
  // A role (root, leaf, view): a double ring.
  STRUCTURAL: { emphasisLift: 0.2, restLift: 0, scale: 1, finish: 0.4, halo: 'double', glow: 0, word: 'role' },
};
