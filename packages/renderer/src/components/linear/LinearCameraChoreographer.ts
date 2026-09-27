/**
 * LinearCameraChoreographer — the camera for Stacks, Queues and Linked Lists.
 *
 * The same bounded pan/dolly as `../array/ArrayCameraChoreographer.ts` (both
 * are thin subclasses of `../camera/BaseCameraChoreographer.ts`), aimed at a
 * structure's ACTIVE END instead of a comparison: a stack's top, a queue's
 * front, the node a traversal pointer is on. It follows vertically more than
 * array does, because a stack grows upwards.
 */
import {
  BaseCameraChoreographer,
  type BaseCameraInstruction,
  type StructureBounds,
} from '../camera/BaseCameraChoreographer';

/**
 * - `step`: one traversal move (`curr = curr.next`) — a gentle follow.
 * - `operation`: PUSH / POP / ENQUEUE / DEQUEUE / a pointer write — a clear pull.
 * - `pivotal`: the structure empties, or a pop/dequeue exposes a new active end.
 */
export type LinearSignificance = 'step' | 'operation' | 'pivotal';

export interface LinearCameraInstruction extends BaseCameraInstruction {
  /** Descriptive only (e.g. 'PUSH', 'TRAVERSE', 'RELINK'). */
  type: string;
  significance: LinearSignificance;
}

export const LINEAR_EMPHASIS_LEVELS: Record<LinearSignificance, number> = {
  step: 0.3,
  operation: 0.6,
  pivotal: 0.9,
};

export class LinearCameraChoreographer extends BaseCameraChoreographer<LinearCameraInstruction, StructureBounds> {
  protected verticalFollow = 0.85;

  protected emphasisLevelFor(instruction: LinearCameraInstruction): number {
    return LINEAR_EMPHASIS_LEVELS[instruction.significance] ?? LINEAR_EMPHASIS_LEVELS.step;
  }
}
