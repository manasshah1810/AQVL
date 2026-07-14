import { TimelineEngine } from './TimelineEngine';

export interface AnimationTask {
  targets: any;
  duration: number;
  easing?: string;
  priority?: number;
  complete?: () => void;
  [key: string]: any;
}

export class AnimationScheduler {
  private currentTasks: AnimationTask[] = [];
  private timelineCursor: number = 0;

  constructor(private timelineEngine: TimelineEngine) {}

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
      this.timelineCursor += duration;
    });

    this.currentTasks = [];
  }

  public advanceCursor(ms: number): void {
    this.timelineEngine.addKeyframe({ targets: {}, duration: ms }, this.timelineCursor);
    this.timelineCursor += ms;
  }

  public getCurrentTime(): number {
    return this.timelineCursor;
  }
}
