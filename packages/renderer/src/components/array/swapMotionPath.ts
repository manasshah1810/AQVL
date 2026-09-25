/**
 * The swap arc path — array-visual-language-spec.md §3.1 ("Swap — the arc path").
 *
 * The spec is explicit that a swap must never travel in a straight line through the other
 * element's old position (reads as a glitch/pass-through). Both elements lift to `y+1.8` and
 * move along X toward each other's slot as usual, but they're also pushed to opposite sides of
 * the Z axis — one to `Z=+1.5` (in front of the baseline), the other to `Z=-1.5` (behind it) —
 * so their paths never intersect on screen, even viewed dead-on. That depth split, not a
 * vertical over/under split, is what the spec resolved on: it's what makes two simultaneous
 * swap motions read as "these two traded places" instead of "one vanished as the other
 * appeared," per §3.1's closing paragraph.
 */

import type { Vec3 } from '../../core/AnimationInterpolator';

/** Peak height (world units) an arcing element rises to above its start/end `y`. */
export const SWAP_ARC_LIFT = 1.8;

/** Peak depth offset (world units) an arcing element is pushed to on either side of Z=0. */
export const SWAP_ARC_DEPTH = 1.5;

/** Which side of the baseline an element's arc bulges toward — see module doc comment. */
export type SwapArcSide = 'front' | 'back';

/**
 * 0 at t=0 and t=1, peaking at 1 around t=0.5 — a smooth, symmetric hump used to modulate both
 * the lift and the depth offset so they rise and fall together with the crossing, rather than
 * lingering at full height/offset once the element has already landed.
 *
 * Clamped to t in [0, 1] before evaluating: `ArrayAnimationInterpolator` feeds this an *eased*
 * t that briefly overshoots past 1 (swapEasing's landing bounce, see arrayEasing.ts). Without
 * the clamp, `Math.sin` would swing negative during that overshoot and pull the element back
 * up/sideways after it has already effectively landed — the bounce is meant to read in X
 * (weight settling into the new slot), not as a second arc.
 */
function arcHump(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return Math.sin(Math.PI * clamped);
}

/**
 * Computes one element's position at progress `t` along the swap arc from `start` to `end`.
 *
 * `t` is expected to already be eased (see `ArrayAnimationInterpolator`'s `swapEasing`) — X is
 * lerped directly off it (so the same landing overshoot the rest of the interpolator relies on
 * carries through here), while the lift/depth are modulated by `arcHump(t)` so they stay
 * well-behaved across that overshoot.
 */
export function computeSwapArcPosition(start: Vec3, end: Vec3, t: number, side: SwapArcSide): Vec3 {
  const hump = arcHump(t);
  const depthSign = side === 'front' ? 1 : -1;
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t + SWAP_ARC_LIFT * hump,
    z: start.z + (end.z - start.z) * t + depthSign * SWAP_ARC_DEPTH * hump,
  };
}

/**
 * Deterministically assigns each element of a swap pair to opposite arc sides, so the same pair
 * of ids always gets the same front/back treatment across frames (and across re-renders) instead
 * of it depending on iteration/insertion order.
 */
export function assignSwapArcSides(idA: string, idB: string): { aSide: SwapArcSide; bSide: SwapArcSide } {
  const aIsFront = idA < idB;
  return { aSide: aIsFront ? 'front' : 'back', bSide: aIsFront ? 'back' : 'front' };
}
