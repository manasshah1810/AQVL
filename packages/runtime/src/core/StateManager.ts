import { SceneState, PartitionBoundaryRegion, SortedRegion } from '../models/SceneState';
import { SceneElement } from '../models/SceneElement';

export class StateManager {
  private timeline: SceneState[] = [];
  private currentIndex: number = -1;

  /** structureId -> stack of active boundaries, outermost first (see PartitionBoundaryRegion). */
  private partitionBoundaryStacks: Map<string, PartitionBoundaryRegion[]> = new Map();
  /** structureId -> its current sorted range. */
  private sortedRegions: Map<string, SortedRegion> = new Map();

  constructor() {}

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

  /** Snapshots the current region/boundary state, for baking into a SceneState. */
  private currentRegions(): Pick<SceneState, 'partitionBoundaries' | 'sortedRegions'> {
    const partitionBoundaries: PartitionBoundaryRegion[] = [];
    this.partitionBoundaryStacks.forEach((stack) => partitionBoundaries.push(...stack.map((entry) => ({ ...entry }))));
    return {
      partitionBoundaries,
      sortedRegions: Array.from(this.sortedRegions.values()).map((r) => ({ ...r })),
    };
  }

  /**
   * Initializes the state manager with the base scene graph state.
   */
  public initialize(initialElements: SceneElement[]): void {
    this.timeline = [];
    
    // Create the initial state snapshot
    const state = this.createSnapshot(initialElements, 'Initial State', 0);
    this.timeline.push(state);
    this.currentIndex = 0;
  }

  /**
   * Saves a new state snapshot based on the current scene graph.
   * Discards any "future" states if we've traveled back in time.
   */
  public saveState(elements: SceneElement[], description?: string, timeMs: number = 0): void {
    // If we are not at the end of the timeline, discard future states
    if (this.currentIndex < this.timeline.length - 1) {
      this.timeline = this.timeline.slice(0, this.currentIndex + 1);
    }

    const newState = this.createSnapshot(elements, description, timeMs);
    this.timeline.push(newState);
    this.currentIndex++;
  }

  /**
   * A snapshot of `elements` that is not recorded on the timeline — for
   * handlers that show several intermediate frames within one step (e.g. a
   * linked-list walk): each frame is captured when computed and broadcast
   * when its animation beat plays.
   */
  public captureSnapshot(elements: SceneElement[], description?: string, timeMs?: number): SceneState {
    return this.createSnapshot(elements, description, timeMs);
  }

  /**
   * Deep clones the elements to create an immutable snapshot.
   */
  private createSnapshot(elements: SceneElement[], description?: string, timeMs?: number): SceneState {
    const clonedElements = new Map<string, SceneElement>();
    for (const el of elements) {
      // Shallow clone is sufficient as long as properties are primitives
      clonedElements.set(el.id, { ...el });
    }
    return {
      elements: clonedElements,
      description,
      timeMs,
      ...this.currentRegions(),
    };
  }

  // --- Timeline Controls ---

  public getCurrentState(): SceneState | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.timeline.length) {
      return this.timeline[this.currentIndex];
    }
    return null;
  }

  public stepForward(): SceneState | null {
    if (this.currentIndex < this.timeline.length - 1) {
      this.currentIndex++;
      return this.getCurrentState();
    }
    return null;
  }

  public stepBackward(): SceneState | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.getCurrentState();
    }
    return null;
  }

  public jumpTo(index: number): SceneState | null {
    if (index >= 0 && index < this.timeline.length) {
      this.currentIndex = index;
      return this.getCurrentState();
    }
    return null;
  }

  public getStateAtTime(timeMs: number): SceneState | null {
    if (this.timeline.length === 0) return null;
    
    // Find the state that is closest to but not exceeding timeMs
    let bestIndex = 0;
    for (let i = 0; i < this.timeline.length; i++) {
      if ((this.timeline[i].timeMs || 0) <= timeMs) {
        bestIndex = i;
      } else {
        break;
      }
    }
    
    this.currentIndex = bestIndex;
    return this.timeline[bestIndex];
  }

  public getNextStateTime(currentTimeMs: number): number | null {
    for (let i = 0; i < this.timeline.length; i++) {
      const t = this.timeline[i].timeMs || 0;
      // Use a small epsilon to avoid floating point issues or being stuck
      if (t > currentTimeMs + 10) {
        return t;
      }
    }
    return null;
  }

  public getTimelineLength(): number {
    return this.timeline.length;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }
}
