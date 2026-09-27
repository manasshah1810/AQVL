import { BASE_SEMANTIC_TREATMENTS, createTreatment, type VisualTreatment } from '@aqvl/shared';

/**
 * Element role -> visual treatment for the linear pointer structures (Stacks,
 * Queues, Linked Lists) — their counterpart to array's `../array/elementStates.ts`.
 *
 * Every role is a variant of one of the shared `BASE_SEMANTIC_TREATMENTS`
 * (packages/shared/src/theme/visualTokens.ts), so "the thing you act on next"
 * reads the same here as the active element anywhere else.
 */
export type LinearRole =
  /** Nothing special: the runtime's own colours are kept. */
  | 'default'
  /** A stack's top: what POP / PEEK act on next. */
  | 'top'
  /** A queue's front: what DEQUEUE / FRONT act on next. */
  | 'front'
  /** The linked-list node a traversal pointer is on right now. */
  | 'current'
  /** Just pushed / enqueued / allocated. */
  | 'inserted'
  /** Being popped / dequeued / freed. */
  | 'removed';

export const LINEAR_ROLE_TREATMENTS: Record<LinearRole, VisualTreatment> = {
  default: BASE_SEMANTIC_TREATMENTS.default,
  // The active end: violet, held slightly forward so it reads as "next".
  top: createTreatment({ ...BASE_SEMANTIC_TREATMENTS.active, liftY: 0, scale: 1.08 }),
  front: createTreatment({ ...BASE_SEMANTIC_TREATMENTS.active, liftY: 0, scale: 1.08 }),
  // Under the traversal pointer: amber like a comparison, but steady (a walk isn't a test).
  current: createTreatment({ ...BASE_SEMANTIC_TREATMENTS.comparing, pulseHz: null, liftY: 0.3, scale: 1.12 }),
  inserted: createTreatment({ ...BASE_SEMANTIC_TREATMENTS.confirmed, liftY: 0.12, scale: 1.05 }),
  removed: createTreatment({ ...BASE_SEMANTIC_TREATMENTS.error, flicker: false, opacity: 0.85, scale: 0.95 }),
};

export function getLinearTreatment(role: LinearRole): VisualTreatment {
  return LINEAR_ROLE_TREATMENTS[role] ?? LINEAR_ROLE_TREATMENTS.default;
}

/** Tone for each role's marker / arrow accents (the treatment's emissive colour). */
export function linearRoleAccent(role: LinearRole): string {
  return getLinearTreatment(role).emissiveColor;
}
