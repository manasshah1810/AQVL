import { SceneElement } from './SceneElement';
import type { CameraFrameState } from '../aqir/types';

export interface SceneState {
  /**
   * A map of element IDs to their state at this point in time.
   */
  elements: Map<string, SceneElement>;

  /**
   * Optional description of the action that caused this state (e.g., 'Swap arr[0] and arr[1]')
   */
  description?: string;

  /**
   * The timeline position in milliseconds when this state snapshot was created.
   */
  timeMs?: number;

  /**
   * Current camera mode/params (AQIR SET_CAMERA). Absent = AUTO_FIT — the
   * always-on reactive CameraRig behavior, unchanged (see
   * docs/design/aqir-geometry-spec.md §2).
   */
  camera?: CameraFrameState;

  /**
   * Domain-owned extension bag, keyed by domain/decoration key. The generic
   * core never reads it; a domain writes its own slices (e.g. the array
   * domain's region annotations, see
   * domains/array/regions.ts) and its decoration provider reads them back.
   */
  metadata?: Record<string, unknown>;
}
