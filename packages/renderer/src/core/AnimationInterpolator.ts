/**
 * Generic position/rotation/scale interpolation between two discrete
 * StateManager frames, so the renderer can tween continuously between
 * timeline snapshots instead of snap-cutting on each state update.
 *
 * Deliberately structure-agnostic: it only ever reads/writes
 * position/rotation/scale/opacity, so it works identically for arrays,
 * trees, graphs, etc. An element present in only one of the two frames is
 * treated as an insertion (fades in) or deletion (fades out) rather than
 * popping in/out.
 */

const DEFAULT_ROTATION: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * `t` is clamped to this range rather than a strict [0, 1]. A plain caller
 * passing raw playback progress is still effectively [0, 1] (values outside
 * it are almost certainly a bug — NaN, Infinity, an unclamped scrub past the
 * end of a timeline). But a caller feeding an *eased* progress value (see
 * `ArrayAnimationInterpolator`, which applies e.g. an overshoot-and-settle
 * curve to swap motion per array-animation-excellence-spec.md §1.1's
 * "anticipation and follow-through" principle) legitimately produces values
 * briefly outside [0, 1] — that overshoot is the entire point of the curve,
 * and clamping it away here would silently flatten every "bounce on arrival"
 * effect back into a plain linear tween. This range is wide enough to permit
 * normal easing overshoot (Penner's back/elastic families overshoot by at
 * most ~30-40% at their default amplitude) while still catching genuinely
 * out-of-range input.
 */
const MIN_T = -0.5;
const MAX_T = 1.5;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface InterpolatableElement {
  id: string;
  position: Vec3;
  rotation?: Vec3;
  scale: Vec3;
  opacity?: number;
}

export interface InterpolatedElement {
  id: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  opacity: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function interpolateOne<T extends InterpolatableElement>(
  from: T | undefined,
  to: T | undefined,
  t: number
): InterpolatedElement | null {
  if (from && to) {
    return {
      id: to.id,
      position: lerpVec3(from.position, to.position, t),
      rotation: lerpVec3(from.rotation ?? DEFAULT_ROTATION, to.rotation ?? DEFAULT_ROTATION, t),
      scale: lerpVec3(from.scale, to.scale, t),
      opacity: lerp(from.opacity ?? 1, to.opacity ?? 1, t),
    };
  }

  // Present only in the destination frame — this is an insertion; hold its
  // final position/scale and fade opacity in from 0.
  if (!from && to) {
    return {
      id: to.id,
      position: to.position,
      rotation: to.rotation ?? DEFAULT_ROTATION,
      scale: to.scale,
      opacity: lerp(0, to.opacity ?? 1, t),
    };
  }

  // Present only in the source frame — a deletion; hold its last position
  // and fade opacity out to 0.
  if (from && !to) {
    return {
      id: from.id,
      position: from.position,
      rotation: from.rotation ?? DEFAULT_ROTATION,
      scale: from.scale,
      opacity: lerp(from.opacity ?? 1, 0, t),
    };
  }

  return null;
}

/**
 * Interpolates every element across two frames at progress `t` (clamped to
 * [MIN_T, MAX_T] — see the comment on that constant). Elements present in
 * both frames tween linearly; elements present in only one fade in/out
 * rather than popping.
 */
export function interpolateFrame<T extends InterpolatableElement>(
  fromElements: Map<string, T>,
  toElements: Map<string, T>,
  t: number
): Map<string, InterpolatedElement> {
  const clampedT = Math.max(MIN_T, Math.min(MAX_T, t));
  const ids = new Set([...fromElements.keys(), ...toElements.keys()]);
  const result = new Map<string, InterpolatedElement>();
  ids.forEach((id) => {
    const interpolated = interpolateOne(fromElements.get(id), toElements.get(id), clampedT);
    if (interpolated) result.set(id, interpolated);
  });
  return result;
}
