/**
 * ArrayCameraChoreographer — turns the significance tag an array operation already
 * carries (docs/design/array-narrative-ux-spec.md §4 / SortEngine's `OperationSignificance`,
 * 'routine' | 'notable' | 'pivotal') into a bounded camera emphasis that nudges the
 * CameraController's AUTO_FIT framing toward the elements currently in play, then eases
 * back to the stable whole-array overview once the operation's moment passes.
 *
 * Design decision — attention vs. whole-array-visibility (array-animation-excellence-spec.md
 * §1.3): this deliberately does NOT implement a depth-of-field/lighting-based focus effect
 * (the alternative the task brief floats), because AQVL's renderer has no post-processing
 * composer today — adding one (e.g. @react-three/postprocessing) to get a blur pass is a much
 * larger footprint than a camera-work feature warrants, and would be its own dependency to
 * maintain. Instead this is a HYBRID of literal camera movement and hard geometric bounds:
 *
 *   - The camera's look-at TARGET pans from the array's center toward the operation's
 *     participants, but the pan offset is capped at a fraction of the array's own half-span
 *     (MAX_PAN_FRACTION), scaled by how significant the operation is. Since every comparison's
 *     participants are, by definition, elements *within* the array, and AUTO_FIT's baseline
 *     framing already contains the whole array, a bounded pan toward any two in-array elements
 *     can never on its own push the array's outer edge out of frame — the risk is entirely on
 *     the zoom axis, which is bounded separately below.
 *   - The camera's DISTANCE (dolly) can pull in from the AUTO_FIT baseline, but only down to a
 *     computed `requiredVisibilityDistance` — the actual minimum distance, given the array's
 *     span and camera FOV, that keeps the full array width inside the frustum. Emphasis can
 *     never zoom in past that floor, and never zooms OUT past the baseline AUTO_FIT already
 *     chose (this module only ever tightens the frame, never fights AUTO_FIT's own choice by
 *     widening beyond it).
 *   - Both axes ease in/out (never snap) and decay back to zero emphasis a short settle window
 *     after the operation's own animation duration elapses, so between operations the camera
 *     always returns to the plain AUTO_FIT overview.
 *
 * This is intentionally "mostly wide/stable, subtle directional nudge" rather than aggressive
 * cinematography — array-animation-excellence-spec.md §1.3 explicitly warns that over-eager
 * camera movement is as bad as a static one ("seasickness instead of guidance").
 *
 * As of this file's shared-infra pass, the hold/rise/settle timer and pan/zoom-bounding math
 * live in `../camera/BaseCameraChoreographer.ts` — this class is now just that base class with
 * array's own three-tier `OperationSignificance` -> emphasis mapping plugged in, so other
 * topics can get the same bounded camera behavior via their own thin subclass.
 */

import {
  BaseCameraChoreographer,
  type BaseCameraInstruction,
  type StructureBounds,
  type Vec3Like,
  type CameraFrame,
  requiredVisibilityDistance,
  DEFAULT_FOV_DEG,
  DEFAULT_HOLD_MS,
  SETTLE_MS,
  MAX_PAN_FRACTION,
  MAX_ZOOM_IN_FRACTION,
} from '../camera/BaseCameraChoreographer';

export type { Vec3Like, CameraFrame };
export { requiredVisibilityDistance, DEFAULT_FOV_DEG, DEFAULT_HOLD_MS, SETTLE_MS, MAX_PAN_FRACTION, MAX_ZOOM_IN_FRACTION };

export type OperationSignificance = 'routine' | 'notable' | 'pivotal';

/** One array operation's camera-relevant facts — a subset of what an animation frame's instruction already carries. */
export interface ArrayCameraInstruction extends BaseCameraInstruction {
  /** Descriptive only (e.g. 'COMPARE', 'SWAP', 'PIVOT', 'FINALIZE') — not branched on internally. */
  type: string;
  significance: OperationSignificance;
}

/** The array's current whole-structure framing, as AUTO_FIT already computes it. */
export type ArrayBounds = StructureBounds;

/** How strongly each significance tier pulls the camera toward the operation's participants (0 = no pull, 1 = full allowed pull). */
export const EMPHASIS_LEVELS: Record<OperationSignificance, number> = {
  routine: 0.1,
  notable: 0.35,
  pivotal: 0.7,
};

/** Emphasis level used for an unrecognized/missing significance tag — treated as routine (safest, most subtle). */
const DEFAULT_EMPHASIS_LEVEL = EMPHASIS_LEVELS.routine;

export class ArrayCameraChoreographer extends BaseCameraChoreographer<ArrayCameraInstruction, ArrayBounds> {
  protected emphasisLevelFor(instruction: ArrayCameraInstruction): number {
    return EMPHASIS_LEVELS[instruction.significance] ?? DEFAULT_EMPHASIS_LEVEL;
  }
}
