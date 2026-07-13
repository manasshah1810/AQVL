import * as animeModule from 'animejs';

const anime = (animeModule as any).default || animeModule;

export class TimelineEngine {
  private timeline: any = null;
  private isPlaying: boolean = false;

  constructor() {}

  public init(onComplete?: () => void): void {
    if (this.timeline) {
      this.timeline.pause();
    }
    
    this.timeline = anime.timeline({
      autoplay: false,
      easing: 'easeInOutQuad',
      duration: 800,
      complete: () => {
        this.isPlaying = false;
        if (onComplete) onComplete();
      }
    });
  }

  public addKeyframe(params: any, offset: string = '+=0'): void {
    if (this.timeline) {
      this.timeline.add(params, offset);
    }
  }

  public play(): void {
    if (this.timeline && !this.isPlaying) {
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
  
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
