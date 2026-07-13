import { SceneState } from '../models/SceneState';
import { SceneElement } from '../models/SceneElement';

export class StateManager {
  private timeline: SceneState[] = [];
  private currentIndex: number = -1;

  constructor() {}

  /**
   * Initializes the state manager with the base scene graph state.
   */
  public initialize(initialElements: SceneElement[]): void {
    this.timeline = [];
    
    // Create the initial state snapshot
    const state = this.createSnapshot(initialElements, 'Initial State');
    this.timeline.push(state);
    this.currentIndex = 0;
  }

  /**
   * Saves a new state snapshot based on the current scene graph.
   * Discards any "future" states if we've traveled back in time.
   */
  public saveState(elements: SceneElement[], description?: string): void {
    // If we are not at the end of the timeline, discard future states
    if (this.currentIndex < this.timeline.length - 1) {
      this.timeline = this.timeline.slice(0, this.currentIndex + 1);
    }

    const newState = this.createSnapshot(elements, description);
    this.timeline.push(newState);
    this.currentIndex++;
  }

  /**
   * Deep clones the elements to create an immutable snapshot.
   */
  private createSnapshot(elements: SceneElement[], description?: string): SceneState {
    const clonedElements = new Map<string, SceneElement>();
    for (const el of elements) {
      // Shallow clone is sufficient as long as properties are primitives
      clonedElements.set(el.id, { ...el });
    }
    return {
      elements: clonedElements,
      description
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

  public getTimelineLength(): number {
    return this.timeline.length;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }
}
