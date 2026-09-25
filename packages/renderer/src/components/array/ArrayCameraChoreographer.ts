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
 */

export type OperationSignificance = 'routine' | 'notable' | 'pivotal';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** One array operation's camera-relevant facts — a subset of what an animation frame's instruction already carries. */
export interface ArrayCameraInstruction {
  /** Descriptive only (e.g. 'COMPARE', 'SWAP', 'PIVOT', 'FINALIZE') — not branched on internally. */
  type: string;
  significance: OperationSignificance;
  /** Live positions of the elements this operation concerns (e.g. the two compared elements). Empty = ignored. */
  participants: Vec3Like[];
  /** How long the operation's own animation runs, ms. Emphasis holds at least this long before settling. */
  durationMs?: number;
}

/** The array's current whole-structure framing, as AUTO_FIT already computes it. */
export interface ArrayBounds {
  center: Vec3Like;
  /** Half of the array's total horizontal extent (max(|x - center.x|) across all its elements). */
  halfSpanX: number;
}

export interface CameraFrame {
  target: Vec3Like;
  distance: number;
}

/** How strongly each significance tier pulls the camera toward the operation's participants (0 = no pull, 1 = full allowed pull). */
export const EMPHASIS_LEVELS: Record<OperationSignificance, number> = {
  routine: 0.15,
  notable: 0.5,
  pivotal: 1.0,
};

/** Emphasis level used for an unrecognized/missing significance tag — treated as routine (safest, most subtle). */
const DEFAULT_EMPHASIS_LEVEL = EMPHASIS_LEVELS.routine;

/** Max pan offset from array center, as a fraction of the array's half-span, at full (pivotal) emphasis. */
export const MAX_PAN_FRACTION = 0.35;

/** Max fraction of the (baseline - visibilityFloor) slack the camera may dolly in, at full (pivotal) emphasis. */
export const MAX_ZOOM_IN_FRACTION = 0.3;

/** How long emphasis holds at its target level after an instruction registers, if the instruction gives no explicit duration. */
export const DEFAULT_HOLD_MS = 350;

/** How long emphasis takes to decay back to zero once its hold window ends. */
export const SETTLE_MS = 600;

/** How quickly emphasis rises to its target level while holding (small = snappy attention, but still eased, never instant). */
const RISE_MS = 120;

/** Matches AQVECanvas's Canvas camera fov (see AQVECanvas.tsx). */
export const DEFAULT_FOV_DEG = 45;

/** Safety margin so the array's edges aren't flush against the frustum boundary. */
const VISIBILITY_MARGIN = 1.15;

/** Never treat an array as needing less than this distance — avoids a degenerate near-zero dolly for 1-2 element arrays. */
const MIN_VISIBILITY_DISTANCE = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function computeMidpoint(points: Vec3Like[]): Vec3Like {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
    { x: 0, y: 0, z: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length };
}

/**
 * The minimum camera distance (along the AUTO_FIT dolly axis) that keeps a span of
 * `2 * halfSpanX` fully inside the frustum at the given field of view, plus a safety margin.
 */
export function requiredVisibilityDistance(halfSpanX: number, fovDeg: number = DEFAULT_FOV_DEG): number {
  const fovRad = (fovDeg * Math.PI) / 180;
  const distance = (halfSpanX * VISIBILITY_MARGIN) / Math.tan(fovRad / 2);
  return Math.max(MIN_VISIBILITY_DISTANCE, distance);
}

/**
 * Drives a bounded, self-settling camera emphasis for array operations. Framework-agnostic
 * (no react-three-fiber / three.js import) so it's directly unit-testable; a caller like
 * CameraController's AUTO_FIT branch calls `update` once per frame and blends `getCameraFrame`'s
 * output into its own target/distance lerp.
 */
export class ArrayCameraChoreographer {
  private readonly fovDeg: number;
  private emphasisLevel = 0;
  private targetEmphasisLevel = 0;
  private holdRemainingMs = 0;
  private participants: Vec3Like[] = [];

  constructor(options: { fovDeg?: number } = {}) {
    this.fovDeg = options.fovDeg ?? DEFAULT_FOV_DEG;
  }

  /** Registers the array operation currently in play. Subsequent calls before the previous one settles simply retarget toward the newer operation. */
  registerInstruction(instruction: ArrayCameraInstruction): void {
    if (!instruction.participants || instruction.participants.length === 0) return;
    this.participants = instruction.participants;
    this.targetEmphasisLevel = EMPHASIS_LEVELS[instruction.significance] ?? DEFAULT_EMPHASIS_LEVEL;
    const holdMs = instruction.durationMs ?? DEFAULT_HOLD_MS;
    this.holdRemainingMs = Math.max(this.holdRemainingMs, holdMs);
  }

  /** Advances the hold/settle state machine. Call once per rendered frame with the elapsed time in milliseconds. */
  update(deltaMs: number): void {
    const dt = Math.max(0, deltaMs);
    if (this.holdRemainingMs > 0) {
      this.holdRemainingMs = Math.max(0, this.holdRemainingMs - dt);
      this.emphasisLevel = lerp(this.emphasisLevel, this.targetEmphasisLevel, dt / RISE_MS);
    } else {
      this.targetEmphasisLevel = 0;
      this.emphasisLevel = lerp(this.emphasisLevel, 0, dt / SETTLE_MS);
      if (this.emphasisLevel < 0.001) {
        this.emphasisLevel = 0;
        this.participants = [];
      }
    }
  }

  /** Current emphasis, 0 (settled, pure baseline) to 1 (fullest allowed pull). */
  getEmphasisLevel(): number {
    return this.emphasisLevel;
  }

  /** True once emphasis has fully decayed and there is no held instruction — i.e. the camera has settled back to the stable overview. */
  isSettled(): boolean {
    return this.emphasisLevel === 0 && this.holdRemainingMs === 0;
  }

  /**
   * Blends `baseline` (the plain AUTO_FIT framing) toward the registered instruction's
   * participants, bounded so the full array (±`bounds.halfSpanX` around the array's center)
   * always stays representable at the returned distance, and the pan never exceeds
   * `MAX_PAN_FRACTION` of the array's own half-span. Returns `baseline` unchanged once settled.
   */
  getCameraFrame(baseline: CameraFrame, bounds: ArrayBounds): CameraFrame {
    if (this.emphasisLevel <= 0 || this.participants.length === 0) {
      return { target: { ...baseline.target }, distance: baseline.distance };
    }

    const mid = computeMidpoint(this.participants);

    const maxPanX = bounds.halfSpanX * MAX_PAN_FRACTION;
    const desiredPanX = clamp(mid.x - baseline.target.x, -maxPanX, maxPanX);
    const panX = desiredPanX * this.emphasisLevel;

    // Mild vertical/depth follow — never clamped against a visibility floor since AUTO_FIT's
    // own y/z framing isn't span-driven the way x is, so a small unclamped blend is safe here.
    const panY = (mid.y - baseline.target.y) * this.emphasisLevel * 0.5;
    const panZ = (mid.z - baseline.target.z) * this.emphasisLevel * 0.3;

    const visibilityFloor = Math.min(requiredVisibilityDistance(bounds.halfSpanX, this.fovDeg), baseline.distance);
    const maxZoomIn = Math.max(0, baseline.distance - visibilityFloor) * MAX_ZOOM_IN_FRACTION;
    const distance = clamp(baseline.distance - maxZoomIn * this.emphasisLevel, visibilityFloor, baseline.distance);

    return {
      target: {
        x: baseline.target.x + panX,
        y: baseline.target.y + panY,
        z: baseline.target.z + panZ,
      },
      distance,
    };
  }
}
