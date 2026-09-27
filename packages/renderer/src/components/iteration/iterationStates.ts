import { BASE_SEMANTIC_TREATMENTS, createTreatment, type VisualTreatment } from '@aqvl/shared';

/**
 * Element state -> visual treatment for the iteration topics (Loops & Control,
 * Searching) — their counterpart to array's `../array/elementStates.ts`.
 *
 * Every state is a variant of one of the shared `BASE_SEMANTIC_TREATMENTS`
 * (packages/shared/src/theme/visualTokens.ts), so "being compared" or "ruled out"
 * looks the same here as anywhere else a viewer might compare topics.
 *
 * The VM already colours cells through `HIGHLIGHT arr[i] 'STATE'`; this table
 * adds the motion cues (lift, scale, dimming) Sorting's cells get, keyed off the
 * canonical semantic state the VM stamps on each element.
 */

export type IterationElementState =
  | 'default'
  | 'active'
  | 'comparing'
  | 'confirmed'
  | 'eliminated'
  | 'marked';

export const ITERATION_ELEMENT_STATES: Record<IterationElementState, VisualTreatment> = {
  default: BASE_SEMANTIC_TREATMENTS.default,
  // Under the loop cursor right now.
  active: createTreatment({
    ...BASE_SEMANTIC_TREATMENTS.comparing,
    pulseHz: null,
    liftY: 0.35,
    scale: 1.1,
  }),
  // The current step's cell (`HIGHLIGHT arr[i]`, amber).
  comparing: BASE_SEMANTIC_TREATMENTS.comparing,
  // Passed the test / found it.
  confirmed: createTreatment({ ...BASE_SEMANTIC_TREATMENTS.confirmed, liftY: 0.15, floorStrip: true }),
  // Ruled out, never looked at again.
  eliminated: BASE_SEMANTIC_TREATMENTS.dimmed,
  // Best so far / the probe (`'MARKED'`, purple).
  marked: BASE_SEMANTIC_TREATMENTS.active,
};

/** Maps a scene element's canonical semantic state (see normalizeSemanticState in @aqvl/shared) onto this table. */
export function iterationStateFor(semanticState: string | undefined, isUnderCursor = false): IterationElementState {
  switch ((semanticState ?? '').toUpperCase()) {
    case 'EVALUATING':
    case 'MODIFYING':
    case 'TRAVERSING':
      return 'comparing';
    case 'SUCCESS':
      return 'confirmed';
    case 'DISCARDED':
    case 'ERROR':
      return 'eliminated';
    case 'AUXILIARY':
    case 'ACTIVE':
      return isUnderCursor ? 'active' : 'marked';
    default:
      return isUnderCursor ? 'active' : 'default';
  }
}

export function getIterationTreatment(state: IterationElementState): VisualTreatment {
  return ITERATION_ELEMENT_STATES[state] ?? ITERATION_ELEMENT_STATES.default;
}
