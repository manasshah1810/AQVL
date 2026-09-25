/**
 * Wraps the structure-agnostic `AnimationInterpolator` (packages/renderer/src/core) with
 * array-specific easing selection, so a swap, a compaction shift, an insert/delete fade, and a
 * plain compare-pulse each get the motion curve described in arrayEasing.ts instead of one
 * generic tween applied to everything.
 *
 * Easing is selected from the operation's `intent` tag first, falling back to its `type` —
 * `intent` takes priority because it isn't always redundant with `type`: insertion sort's
 * "shift" step is carried on a `type: 'SWAP'` SortStep (SortEngine.ts:195) even though it should
 * read as a smooth shift, not a weighted swap-with-overshoot, since it's really "make room," not
 * "trade two values." Reading `type` alone would misclassify it.
 */

import {
  interpolateFrame,
  type InterpolatableElement,
  type InterpolatedElement,
  type Vec3,
} from '../../core/AnimationInterpolator';
import { swapEasing, shiftEasing, fadeEasing, comparisonPulseEasing, type EasingFunction } from './arrayEasing';
import { computeSwapArcPosition, assignSwapArcSides } from './swapMotionPath';

/** The array operation type, per SortStep.type / AQIR instruction action (SortEngine.ts, ArrayEngine.ts). */
export type ArrayOperationType =
  | 'SWAP'
  | 'COMPARE'
  | 'OVERWRITE'
  | 'INSERT'
  | 'DELETE'
  | 'PIVOT'
  | 'FINALIZE'
  | (string & {});

/** The subset of a step/instruction this module needs to pick an easing curve — see SortEngine.ts's `SortStep.intent`. */
export interface ArrayOperationDescriptor {
  type: ArrayOperationType;
  /** Phase 2.1's per-step intent tag (e.g. 'adjacent-swap', 'shift', 'merge-write'). Takes priority over `type` — see module doc comment. */
  intent?: string;
}

/** Intents that are structurally a swap (two elements trading places) — see SortEngine.ts. */
const SWAP_INTENTS = new Set(['adjacent-swap', 'selection-swap', 'partition-swap', 'final-placement']);

/** Intents that are a smooth positional shift rather than a weighted exchange. */
const SHIFT_INTENTS = new Set(['shift', 'shift-check']);

/** Intents that are a comparison beat (look, don't act). */
const COMPARE_INTENTS = new Set(['adjacent-check', 'candidate-check', 'merge-comparison', 'partition-boundary']);

/**
 * Resolves the easing curve for one array operation. Unrecognized/absent type or intent falls
 * back to `shiftEasing` — the one curve with no overshoot and no directional assumption, the
 * safest default for "some position changed, animate it" when the specific operation kind isn't
 * known.
 */
export function selectEasingForOperation(operation: ArrayOperationDescriptor): EasingFunction {
  if (operation.intent) {
    if (SHIFT_INTENTS.has(operation.intent)) return shiftEasing;
    if (SWAP_INTENTS.has(operation.intent)) return swapEasing;
    if (COMPARE_INTENTS.has(operation.intent)) return comparisonPulseEasing;
  }

  switch (operation.type) {
    case 'SWAP':
      return swapEasing;
    case 'COMPARE':
    case 'PIVOT':
      return comparisonPulseEasing;
    case 'OVERWRITE':
    case 'INSERT':
    case 'DELETE':
      return fadeEasing;
    case 'FINALIZE':
      return swapEasing;
    default:
      return shiftEasing;
  }
}

const POSITION_EPSILON = 1e-6;

function positionsApproxEqual(a: Vec3, b: Vec3): boolean {
  return (
    Math.abs(a.x - b.x) < POSITION_EPSILON &&
    Math.abs(a.y - b.y) < POSITION_EPSILON &&
    Math.abs(a.z - b.z) < POSITION_EPSILON
  );
}

/**
 * Finds pairs of elements that are trading positions between the two frames — i.e. A's
 * destination is B's origin and vice versa — so swap-arc motion (§3.1) can be applied to exactly
 * the two elements actually crossing, not to every element touched by a SWAP-tagged operation
 * (a SWAP step's frame may include other elements that merely hold still). Each id is consumed
 * by at most one pair; an element whose position didn't change at all is never treated as half
 * of a swap.
 */
function findSwapPairs<T extends InterpolatableElement>(
  fromElements: Map<string, T>,
  toElements: Map<string, T>
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const consumed = new Set<string>();
  const ids = [...fromElements.keys()].filter((id) => toElements.has(id));

  for (let i = 0; i < ids.length; i++) {
    const idA = ids[i];
    if (consumed.has(idA)) continue;
    const fromA = fromElements.get(idA)!;
    const toA = toElements.get(idA)!;
    if (positionsApproxEqual(fromA.position, toA.position)) continue;

    for (let j = i + 1; j < ids.length; j++) {
      const idB = ids[j];
      if (consumed.has(idB)) continue;
      const fromB = fromElements.get(idB)!;
      const toB = toElements.get(idB)!;

      if (positionsApproxEqual(toA.position, fromB.position) && positionsApproxEqual(toB.position, fromA.position)) {
        pairs.push([idA, idB]);
        consumed.add(idA);
        consumed.add(idB);
        break;
      }
    }
  }

  return pairs;
}

/**
 * Array-aware frame interpolator: applies the operation-appropriate easing curve to the raw
 * playback progress before delegating to the base `interpolateFrame` for the actual
 * position/rotation/scale/opacity lerp. Reuses the base interpolator rather than duplicating its
 * insert/delete fade-handling logic.
 *
 * For a genuine two-element swap (operation resolves to `swapEasing` *and* the frames contain a
 * pair of elements literally trading positions), position is overridden with the depth-split arc
 * path from `swapMotionPath.ts` instead of the base interpolator's straight-line lerp — per
 * array-visual-language-spec.md §3.1, a swap must never move an element in a straight line
 * through the other element's old slot. Rotation/scale/opacity for those elements still come
 * from the base lerp; only position changes.
 */
export class ArrayAnimationInterpolator {
  interpolateFrame<T extends InterpolatableElement>(
    fromElements: Map<string, T>,
    toElements: Map<string, T>,
    t: number,
    operation: ArrayOperationDescriptor
  ): Map<string, InterpolatedElement> {
    const easing = selectEasingForOperation(operation);
    const rawT = Math.max(0, Math.min(1, t));
    const easedT = easing(rawT);
    const result = interpolateFrame(fromElements, toElements, easedT);

    if (easing === swapEasing) {
      const pairs = findSwapPairs(fromElements, toElements);
      for (const [idA, idB] of pairs) {
        const fromA = fromElements.get(idA)!;
        const toA = toElements.get(idA)!;
        const fromB = fromElements.get(idB)!;
        const toB = toElements.get(idB)!;
        const { aSide, bSide } = assignSwapArcSides(idA, idB);

        const interpolatedA = result.get(idA);
        const interpolatedB = result.get(idB);
        if (interpolatedA) {
          result.set(idA, { ...interpolatedA, position: computeSwapArcPosition(fromA.position, toA.position, easedT, aSide) });
        }
        if (interpolatedB) {
          result.set(idB, { ...interpolatedB, position: computeSwapArcPosition(fromB.position, toB.position, easedT, bSide) });
        }
      }
    }

    return result;
  }
}
