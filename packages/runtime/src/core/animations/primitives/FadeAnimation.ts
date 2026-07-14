import { PrimitiveAnimation, PrimitiveAnimationConfig } from './PrimitiveAnimation';

export interface FadeConfig extends PrimitiveAnimationConfig {
  targetIds: string[];
  opacity: number | ((el: any, i: number, l: number) => number);
  scaleEffect?: boolean; // Default to true for premium organic appearance
}

export class FadeAnimation extends PrimitiveAnimation<FadeConfig> {
  // Opacity transitions feel most natural with a smooth sine or quad curve.
  protected defaultEasing = 'easeInOutSine'; 
  protected defaultDuration = 400;

  execute(config: FadeConfig): void {
    if (!config.targetIds || config.targetIds.length === 0) return;

    const elements = config.targetIds
      .map(id => this.ctx.sceneManager.getElement(id))
      .filter(Boolean) as any[];

    if (elements.length === 0) return;

    const useScale = config.scaleEffect ?? true;

    elements.forEach((el, index) => {
      const l = elements.length;
      const targetOpacity = typeof config.opacity === 'function' ? config.opacity(el, index, l) : config.opacity;
      
      const isFadingIn = targetOpacity > 0.5;

      const animPayload: any = {
        targets: el,
        opacity: targetOpacity,
        duration: config.duration ?? this.defaultDuration,
        easing: config.easing ?? this.defaultEasing,
        delay: config.delay ?? 0
      };

      // Combine with extremely subtle scaling for a more organic, Apple-like premium appearance
      if (useScale) {
        if (isFadingIn) {
          // If fading in and currently hidden, start slightly smaller
          if (el.opacity === 0 || el.opacity === undefined) {
             el.scale.x = 0.9;
             el.scale.y = 0.9;
             el.scale.z = 0.9;
          }
          this.ctx.scheduler.enqueue({
            targets: el.scale,
            x: 1, y: 1, z: 1,
            duration: config.duration ?? this.defaultDuration,
            easing: 'easeOutQuart', // crisp deceleration for settling into place
            delay: config.delay ?? 0
          });
        } else {
          // If fading out, subtly shrink as it disappears
          this.ctx.scheduler.enqueue({
            targets: el.scale,
            x: 0.9, y: 0.9, z: 0.9,
            duration: config.duration ?? this.defaultDuration,
            easing: 'easeInQuart', // smooth acceleration away
            delay: config.delay ?? 0
          });
        }
      }

      this.ctx.scheduler.enqueue(animPayload);
    });
  }
}
