import { SceneElement } from './SceneElement';
import type { CameraFrameState } from '../aqir/types';

/**
 * One active SET_PARTITION_BOUNDARY..CLEAR_PARTITION_BOUNDARY span for a structure.
 * `depth` is this entry's position in the structure's boundary stack at the time of
 * the snapshot (0 = outermost) — recursive algorithms like quick sort push a new
 * entry per recursive call and pop it on return, so several can be active for the
 * same structureId at once (see docs/design/array-visual-language-spec.md §4.2).
 */
export interface PartitionBoundaryRegion {
  structureId: string;
  startIndex: number;
  endIndex: number;
  label?: string;
  depth: number;
}

/** The current MARK_SORTED_REGION range for a structure (docs/design/array-visual-language-spec.md §4.3). */
export interface SortedRegion {
  structureId: string;
  startIndex: number;
  endIndex: number;
}

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

  /** Every partition boundary currently active (across all structures), sticky across snapshots until cleared. */
  partitionBoundaries?: PartitionBoundaryRegion[];

  /** Every structure's current confirmed-sorted range, sticky across snapshots until the run resets. */
  sortedRegions?: SortedRegion[];
}
