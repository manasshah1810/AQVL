/**
 * Array element motion easing curves — array-animation-excellence-spec.md §1.1 ("Weight and
 * anticipation"): real objects don't move at constant velocity, and the absence of any
 * acceleration/deceleration curve is what makes motion read as mechanical rather than alive.
 *
 * Reuses anime.js's own Penner easing implementations (`anime.easing(name)`) rather than
 * reimplementing easing math — `animejs` is already a dependency of this package (and of
 * `@aqvl/runtime`'s `TimelineEngine`/`AnimationScheduler`, which already drive per-element
 * micro-animations with string easing names like `'easeOutExpo'`, `'easeInOutQuad'`,
 * `'easeOutBounce'`, `'easeOutBack'`). Building this module's curves from the exact same
 * `anime.easing()` source keeps the two animation pipelines — the event-driven anime.js
 * timeline (`AnimationScheduler`) and this frame-driven pure interpolator
 * (`ArrayAnimationInterpolator`) — visually consistent instead of each having its own subtly
 * different "easeOutBack."
 *
 * Curve choice per operation (the short design note this file's easing selections implement):
 *
 * - **swapEasing** (`easeOutBack`): swaps are a decisive, physical exchange — §1.1 explicitly
 *   asks for "a slight overshoot-and-bounce rather than stopping dead in the new slot." This
 *   curve overshoots past 1.0 partway through (peaking around t≈0.5-0.6) before settling back
 *   to exactly 1.0 at t=1 — the swapped element visibly "arrives, oscillates once, and settles,"
 *   which reads as weight (it has momentum that has to be absorbed) rather than a element that
 *   simply stops existing at its destination.
 * - **shiftEasing** (`easeInOutQuad`): array compaction/insertion shifts move a whole block of
 *   elements at once — the task brief is explicit that this should be "cleaner," with no
 *   overshoot, since a dozen elements all briefly overshooting and bouncing back would read as
 *   chaotic rather than considered. A plain symmetric ease-in-out (accelerate, then decelerate,
 *   monotonic, never exceeds [0, 1]) gives weight without any risk of visual noise at scale.
 * - **fadeEasing** (`easeInOutCubic`): covers both element appearance (INSERT) and disappearance
 *   (DELETE/OVERWRITE-as-replacement). The excellence spec actually wants these to be
 *   *directionally* different — an ease-out "settle" for arriving, an accelerating ease-in for
 *   leaving — but `ArrayAnimationInterpolator.interpolateFrame` always parametrizes `t` from the
 *   source frame (0) to the destination frame (1) regardless of which direction the *opacity* is
 *   moving, so a single shared curve can't simultaneously be "ease-out" for one direction and
 *   "ease-in" for the other without knowing which case it's in. A symmetric ease-in-out is the
 *   honest middle ground: smooth and deliberate in both directions, never wrong-footed the way a
 *   one-directional curve applied backwards would be. See array-visual-polish-notes.md for the
 *   manual comparison and this tradeoff called out explicitly, with a note that splitting this
 *   into separate fadeInEasing/fadeOutEasing curves is the natural next step if that asymmetry
 *   turns out to matter more than this pass assumed.
 * - **comparisonPulseEasing** (`easeInOutSine`): a compare-without-swap is a "look, then release"
 *   beat, not a decisive action — no overshoot (nothing is being physically thrown across the
 *   array), but also not linear. `easeInOutSine`'s gentle, symmetric S-curve lingers slightly at
 *   both ends and moves fastest through the middle, which reads as a breath/pulse rather than a
 *   a mechanical on/off flick.
 */

import * as animeModule from 'animejs';

const anime = ((animeModule as any).default ?? animeModule) as { easing: (name: string) => (t: number) => number };

export type EasingFunction = (t: number) => number;

function fromAnime(name: string): EasingFunction {
  const fn = anime.easing(name);
  // Clamp the *input* domain to [0, 1] — callers always hand this a normalized progress value —
  // but never clamp the output, since swapEasing's entire purpose is to briefly exceed it.
  return (t: number) => fn(Math.max(0, Math.min(1, t)));
}

/** Weighted arrival with a slight overshoot-and-settle — see the module doc comment. */
export const swapEasing: EasingFunction = fromAnime('easeOutBack');

/** Smooth, symmetric, no overshoot — for moving several elements at once (compaction/shift). */
export const shiftEasing: EasingFunction = fromAnime('easeInOutQuad');

/** Smooth, symmetric, no overshoot — for opacity fade in (INSERT) / fade out (DELETE, OVERWRITE-as-replace). */
export const fadeEasing: EasingFunction = fromAnime('easeInOutCubic');

/** Gentle, lingers at both ends — the "pause and pulse" feel of a compare that doesn't trigger a swap. */
export const comparisonPulseEasing: EasingFunction = fromAnime('easeInOutSine');
