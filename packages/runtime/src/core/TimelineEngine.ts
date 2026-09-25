import * as animeModule from 'animejs';

const anime = (animeModule as any).default || animeModule;

export class TimelineEngine {
  private timeline: any = null;
  private isPlaying: boolean = false;
  private pauseTime: number | null = null;
  private onPauseCallback: (() => void) | null = null;

  constructor() {}

  private onCompleteCallback: (() => void) | null = null;

  public init(onComplete?: () => void): void {
    console.log('[TimelineEngine] init() called');
    this.onCompleteCallback = onComplete || null;
    if (this.timeline) {
      console.log('[TimelineEngine] Pausing previous timeline before recreating');
      this.timeline.pause();
    }
    
    this.timeline = anime.timeline({
      autoplay: false,
      easing: 'easeInOutQuad',
      duration: 800,
      update: (anim: any) => {
        if (this.pauseTime !== null && anim.currentTime >= this.pauseTime) {
          console.log(`[TimelineEngine] Paused at ${anim.currentTime}ms (Target: ${this.pauseTime}ms)`);
          anim.pause();
          this.isPlaying = false;
          const targetTime = this.pauseTime;
          this.pauseTime = null;
          anim.seek(targetTime);
          if (this.onPauseCallback) {
            this.onPauseCallback();
            this.onPauseCallback = null;
          }
        }
      },
      complete: () => {
        console.log('[TimelineEngine] Timeline complete');
        this.isPlaying = false;
        if (this.onCompleteCallback) this.onCompleteCallback();
      }
    });
  }

  public triggerComplete(): void {
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }

  public addKeyframe(params: any, offset: string | number = '+=0'): void {
    if (this.timeline) {
      this.timeline.add(params, offset);
    }
  }

  public playUntil(timeMs: number, onPause?: () => void): void {
    if (this.timeline && !this.isPlaying) {
      // If we're already at or past the target time, don't play
      if (this.timeline.currentTime >= timeMs) {
        if (onPause) onPause();
        return;
      }
      this.pauseTime = timeMs;
      this.onPauseCallback = onPause || null;
      this.isPlaying = true;
      this.timeline.play();
    }
  }

  public play(): void {
    if (this.timeline && !this.isPlaying) {
      this.pauseTime = null;
      this.onPauseCallback = null;
      this.isPlaying = true;
      this.timeline.play();
    }
  }

  public pause(): void {
    if (this.timeline && this.isPlaying) {
      this.isPlaying = false;
      this.timeline.pause();
    }
  }

  public seek(time: number): void {
    if (this.timeline) {
      this.timeline.seek(time);
    }
  }

  public setPlaybackRate(rate: number): void {
    // anime.js actually handles speed globally or through instances. 
    // Usually it's `animation.timeScale = rate` or something, let's just assume we can mutate playbackRate or we might need to recreate timeline.
    // wait, anime timeline instances don't have timeScale?
    // According to animejs, we can do: anime.speed = rate; which is global. Or we can adjust tick manually.
    // Wait, the API for instance speed doesn't exist, we just do `anime.speed = rate;`
    // Actually, let's just do anime.speed = rate; but it's not typed. Let's cast to any.
    (anime as any).speed = rate;
  }

  public getCurrentTime(): number {
    return this.timeline ? this.timeline.currentTime : 0;
  }

  public getDuration(): number {
    return this.timeline ? this.timeline.duration : 0;
  }
  
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

/**
 * A timeline with no real time: `play()` completes every queued keyframe
 * immediately, in timeline order, firing each keyframe's `complete`
 * callback (where handlers apply deferred effects such as removing a
 * deleted element or logging). Used for headless execution — the dry run
 * that counts a program's steps, and tests — and never touches anime.js.
 */
export class InstantTimelineEngine extends TimelineEngine {
  private keyframes: { params: any; offset: number; order: number }[] = [];
  private onDone: (() => void) | null = null;

  public init(onComplete?: () => void): void {
    this.keyframes = [];
    this.onDone = onComplete || null;
  }

  public addKeyframe(params: any, offset: string | number = 0): void {
    this.keyframes.push({ params, offset: typeof offset === 'number' ? offset : 0, order: this.keyframes.length });
  }

  public play(): void {
    const frames = this.keyframes.sort((a, b) => a.offset - b.offset || a.order - b.order);
    this.keyframes = [];
    for (const frame of frames) frame.params.complete?.();
    this.triggerComplete();
  }

  public playUntil(_timeMs: number, onPause?: () => void): void {
    this.play();
    onPause?.();
  }

  public triggerComplete(): void {
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  public pause(): void {}
  public seek(_time: number): void {}
  public setPlaybackRate(_rate: number): void {}
  public getCurrentTime(): number { return 0; }
  public getDuration(): number { return 0; }
}
