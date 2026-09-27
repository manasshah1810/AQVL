/**
 * BaseCameraChoreographer — the topic-agnostic core of
 * `../array/ArrayCameraChoreographer.ts`, extracted so other topics can get
 * bounded, self-settling camera emphasis (pan/zoom toward the elements an
 * operation is currently touching, eased attack/decay, floor/ceiling so
 * nothing leaves frame) without re-deriving the state machine.
 *
 * A subclass only needs to supply `Instruction` and `Bounds` shapes and, if
 * its notion of "how much attention" differs from array's three-tier
 * routine/notable/pivotal scale, override `emphasisLevelFor`. Everything
 * else — the hold/rise/settle timer, the pan/zoom blending against a
 * baseline AUTO_FIT frame — is shared, so every topic's camera work behaves
 * the same way at the frame-by-frame level even if what counts as
 * "pivotal" differs per topic.
 *
 * See ArrayCameraChoreographer.ts's header comment for the full design
 * rationale (why a bounded pan+dolly hybrid rather than a
 * depth-of-field/postprocessing focus effect).
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface CameraFrame {
  target: Vec3Like;
  distance: number;
}

/** The structure's current whole-scene framing, as AUTO_FIT already computes it. */
export interface StructureBounds {
  center: Vec3Like;
  /** Half of the structure's total horizontal extent. */
  halfSpanX: number;
}

/** Anything a choreographed instruction must supply, regardless of topic. */
export interface BaseCameraInstruction {
  /** Live positions of the elements this operation concerns. Empty = ignored. */
  participants: Vec3Like[];
  /** How long the operation's own animation runs, ms. Emphasis holds at least this long before settling. */
  durationMs?: number;
}

/**
 * What CameraController's AUTO_FIT branch needs from a choreographer: any
 * topic's subclass of `BaseCameraChoreographer` fits.
 */
export interface CameraChoreographer {
  update(deltaMs: number): void;
  getCameraFrame(baseline: CameraFrame, bounds: StructureBounds): CameraFrame;
}

/** How long emphasis holds at its target level after an instruction registers, if the instruction gives no explicit duration. */
export const DEFAULT_HOLD_MS = 350;
/** How long emphasis takes to decay back to zero once its hold window ends. */
export const SETTLE_MS = 600;
/** How quickly emphasis rises to its target level while holding (small = snappy attention, but still eased, never instant). */
export const RISE_MS = 120;
/** Matches AQVECanvas's Canvas camera fov (see AQVECanvas.tsx). */
export const DEFAULT_FOV_DEG = 45;
/** Safety margin so the structure's edges aren't flush against the frustum boundary. */
const VISIBILITY_MARGIN = 1.15;
/** Never treat a structure as needing less than this distance — avoids a degenerate near-zero dolly for tiny structures. */
const MIN_VISIBILITY_DISTANCE = 6;
/** Max pan offset from structure center, as a fraction of its half-span, at full emphasis. */
export const MAX_PAN_FRACTION = 0.35;
/** Max fraction of the (baseline - visibilityFloor) slack the camera may dolly in, at full emphasis. */
export const MAX_ZOOM_IN_FRACTION = 0.3;

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
 * Framework-agnostic (no react-three-fiber / three.js import) so it's directly
 * unit-testable; a caller like CameraController's AUTO_FIT branch calls `update`
 * once per frame and blends `getCameraFrame`'s output into its own target/distance lerp.
 */
export abstract class BaseCameraChoreographer<Instruction extends BaseCameraInstruction, Bounds extends StructureBounds = StructureBounds> {
  protected readonly fovDeg: number;
  protected emphasisLevel = 0;
  protected targetEmphasisLevel = 0;
  protected holdRemainingMs = 0;
  protected participants: Vec3Like[] = [];
  /**
   * How much of the vertical offset to the participants the camera follows at
   * full emphasis. Arrays lie along x, so a mild 0.5 is plenty; a topic whose
   * structures grow upwards (a stack) raises it to keep the active end framed.
   */
  protected verticalFollow = 0.5;

  constructor(options: { fovDeg?: number } = {}) {
    this.fovDeg = options.fovDeg ?? DEFAULT_FOV_DEG;
  }

  /** Maps an instruction to how strongly it should pull the camera, 0 (no pull) to 1 (full allowed pull). Subclasses define their own significance vocabulary. */
  protected abstract emphasisLevelFor(instruction: Instruction): number;

  /** Registers the operation currently in play. Subsequent calls before the previous one settles simply retarget toward the newer operation. */
  registerInstruction(instruction: Instruction): void {
    if (!instruction.participants || instruction.participants.length === 0) return;
    this.participants = instruction.participants;
    this.targetEmphasisLevel = this.emphasisLevelFor(instruction);
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
   * participants, bounded so the full structure (±`bounds.halfSpanX` around its center)
   * always stays representable at the returned distance, and the pan never exceeds
   * `MAX_PAN_FRACTION` of the structure's own half-span. Returns `baseline` unchanged once settled.
   */
  getCameraFrame(baseline: CameraFrame, bounds: Bounds): CameraFrame {
    if (this.emphasisLevel <= 0 || this.participants.length === 0) {
      return { target: { ...baseline.target }, distance: baseline.distance };
    }

    const mid = computeMidpoint(this.participants);

    const maxPanX = bounds.halfSpanX * MAX_PAN_FRACTION;
    const desiredPanX = clamp(mid.x - baseline.target.x, -maxPanX, maxPanX);
    const panX = desiredPanX * this.emphasisLevel;

    // Mild vertical/depth follow — never clamped against a visibility floor since AUTO_FIT's
    // own y/z framing isn't span-driven the way x is, so a small unclamped blend is safe here.
    const panY = (mid.y - baseline.target.y) * this.emphasisLevel * this.verticalFollow;
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
