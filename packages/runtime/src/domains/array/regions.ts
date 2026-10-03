import type { SceneState } from '../../models/SceneState';

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

/** The array domain's slice of `SceneState.metadata`. */
export interface ArrayRegionMetadata {
  partitionBoundaries: PartitionBoundaryRegion[];
  sortedRegions: SortedRegion[];
}

/** `SceneState.metadata` key for the array domain's region slice. */
export const ARRAY_REGIONS_KEY = 'arrayRegions';

/** Reads the array region slice off a scene; empty lists when the scene has none. */
export function getArrayRegions(scene: Pick<SceneState, 'metadata'> | null | undefined): ArrayRegionMetadata {
  const slice = scene?.metadata?.[ARRAY_REGIONS_KEY] as Partial<ArrayRegionMetadata> | undefined;
  return { partitionBoundaries: slice?.partitionBoundaries ?? [], sortedRegions: slice?.sortedRegions ?? [] };
}

/** Sticky boundary/region bookkeeping for the array domain; StateManager bakes `snapshot()` into each SceneState. */
export class ArrayRegionTracker {
  /** structureId -> stack of active boundaries, outermost first (see PartitionBoundaryRegion). */
  private partitionBoundaryStacks: Map<string, PartitionBoundaryRegion[]> = new Map();
  /** structureId -> its current sorted range. */
  private sortedRegions: Map<string, SortedRegion> = new Map();

  /** Pushes a new active boundary for `structureId` (SET_PARTITION_BOUNDARY). */
  public setPartitionBoundary(structureId: string, startIndex: number, endIndex: number, label?: string): void {
    const stack = this.partitionBoundaryStacks.get(structureId) ?? [];
    stack.push({ structureId, startIndex, endIndex, label, depth: stack.length });
    this.partitionBoundaryStacks.set(structureId, stack);
  }

  /** Pops the most recently set active boundary for `structureId` (CLEAR_PARTITION_BOUNDARY). */
  public clearPartitionBoundary(structureId: string): void {
    const stack = this.partitionBoundaryStacks.get(structureId);
    if (stack && stack.length > 0) stack.pop();
  }

  /** Replaces `structureId`'s current sorted range (MARK_SORTED_REGION). */
  public markSortedRegion(structureId: string, startIndex: number, endIndex: number): void {
    this.sortedRegions.set(structureId, { structureId, startIndex, endIndex });
  }

  /** A copy of the current boundaries/regions, safe to bake into an immutable snapshot. */
  public snapshot(): ArrayRegionMetadata {
    const partitionBoundaries: PartitionBoundaryRegion[] = [];
    this.partitionBoundaryStacks.forEach((stack) => partitionBoundaries.push(...stack.map((entry) => ({ ...entry }))));
    return {
      partitionBoundaries,
      sortedRegions: Array.from(this.sortedRegions.values()).map((r) => ({ ...r })),
    };
  }
}
