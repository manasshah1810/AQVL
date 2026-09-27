import { TimelineEngine } from './TimelineEngine';
import type { EventDispatcher } from './EventDispatcher';

/** Payload for the 'NARRATIVE_CUE' event — a caption ready to be spoken/displayed, plus which live elements it concerns (for a narrator to point at). */
export interface NarrativeCuePayload {
  text: string;
  targets: unknown;
}

export interface AnimationTask {
  targets: any;
  duration: number;
  easing?: string;
  priority?: number;
  complete?: () => void;
  /**
   * Human-readable caption text (docs/design/array-narrative-ux-spec.md §1) describing
   * why this frame is happening, populated by ArrayNarrativeGenerator where applicable.
   * Optional — most animation frames (position/scale/color tweens with no narrative
   * meaning of their own) simply omit it.
   */
  narrativeText?: string;
  /**
   * Pacing hint (docs/design/array-narrative-ux-spec.md §4) derived from the source
   * instruction's `significance` tag via PacingConfig — e.g. 2.5 for a pivotal event.
   * Purely advisory: this frame's own `duration` is unchanged: a renderer that wants
   * significance-aware dwell time multiplies its own timing by this value itself.
   */
  suggestedDurationMultiplier?: number;
  [key: string]: any;
}

export class AnimationScheduler {
  private currentTasks: AnimationTask[] = [];
  private timelineCursor: number = 0;

  constructor(private timelineEngine: TimelineEngine, private eventDispatcher?: EventDispatcher) {}

  public init(onComplete?: () => void): void {
    console.log('[AnimationScheduler] init() called - Resetting timeline cursor to 0');
    this.timelineCursor = 0;
    this.currentTasks = [];
    this.timelineEngine.init(onComplete);
  }

  public play(): void {
    if (this.timelineCursor === 0) {
      // No animations scheduled, resolve immediately
      this.timelineEngine.triggerComplete();
    } else {
      this.timelineEngine.play();
    }
  }

  public enqueue(task: AnimationTask): void {
    this.currentTasks.push(task);
  }

  public commitGroup(advanceCursor: boolean = true): void {
    if (this.currentTasks.length === 0) return;

    let maxDuration = 0;
    
    // Lower priority tasks added first, higher priority tasks added later override them in AnimeJS
    this.currentTasks.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    this.currentTasks.forEach(task => {
      const { complete, priority, ...animeParams } = task;
      const duration = task.duration || 0;

      if (complete) {
          animeParams.complete = complete;
      }

      this.timelineEngine.addKeyframe(animeParams, this.timelineCursor);
      this.emitNarrativeCue(task);

      if (duration > maxDuration) {
        maxDuration = duration;
      }
    });

    if (advanceCursor) {
      this.timelineCursor += maxDuration;
    }
    
    this.currentTasks = [];
  }

  public commitSequential(): void {
    if (this.currentTasks.length === 0) return;

    this.currentTasks.forEach(task => {
      const { complete, priority, ...animeParams } = task;
      const duration = task.duration || 0;
      
      if (complete) {
          animeParams.complete = complete;
      }

      this.timelineEngine.addKeyframe(animeParams, this.timelineCursor);
      this.emitNarrativeCue(task);
      this.timelineCursor += duration;
    });

    this.currentTasks = [];
  }

  /**
   * Surfaces a task's `narrativeText` (populated at the start of its beat, per
   * docs/design/array-narrative-ux-spec.md §1) as a 'NARRATIVE_CUE' event, so a
   * narrator/caption UI can react without polling the animation internals. A
   * no-op when this scheduler wasn't given an EventDispatcher (e.g. tests, or
   * the headless dry run ExecutionEngine uses to count steps).
   */
  private emitNarrativeCue(task: AnimationTask): void {
    if (!task.narrativeText || !this.eventDispatcher) return;
    this.eventDispatcher.dispatch('NARRATIVE_CUE', { text: task.narrativeText, targets: task.targets } satisfies NarrativeCuePayload);
  }

  public advanceCursor(ms: number): void {
    this.timelineEngine.addKeyframe({ targets: {}, duration: ms }, this.timelineCursor);
    this.timelineCursor += ms;
  }

  public getCurrentTime(): number {
    return this.timelineCursor;
  }
}
