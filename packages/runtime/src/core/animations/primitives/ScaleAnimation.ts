import { PrimitiveAnimation, PrimitiveAnimationConfig } from './PrimitiveAnimation';

export interface ScaleConfig extends PrimitiveAnimationConfig {
  targetIds: string[];
  scaleFactor?: number; // How much to scale by (e.g., 1.1 for a 10% increase)
  pulse?: boolean; // If true, scales up and then smoothly returns to original size
}

export class ScaleAnimation extends PrimitiveAnimation<ScaleConfig> {
  // A subtle, professional elasticity rather than a cartoon-like bounce
  protected defaultEasing = 'easeOutBack'; 
  protected defaultDuration = 800; // Slightly longer for a more relaxed, educational pace

  execute(config: ScaleConfig): void {
    if (!config.targetIds || config.targetIds.length === 0) return;

    const elements = config.targetIds
      .map(id => this.ctx.sceneManager.getElement(id))
      .filter(Boolean) as any[];

    if (elements.length === 0) return;

    const scaleFactor = config.scaleFactor ?? 1.1; // Subtle 10% increase, within 5-15% range
    const isPulse = config.pulse ?? true;

    elements.forEach(el => {
      // Capture the baseline scale to return to it if pulsing
      const originalScaleX = el.scale.x;
      const originalScaleY = el.scale.y;
      const originalScaleZ = el.scale.z;

      const targetScaleX = originalScaleX * scaleFactor;
      const targetScaleY = originalScaleY * scaleFactor;
      const targetScaleZ = originalScaleZ * scaleFactor;

      const duration = config.duration ?? this.defaultDuration;

      if (isPulse) {
        // Enqueue keyframes for a refined, professional pulse
        this.ctx.scheduler.enqueue({
          targets: el.scale,
          duration: duration,
          keyframes: [
            {
              x: targetScaleX,
              y: targetScaleY,
              z: targetScaleZ,
              duration: duration * 0.45,
              // easeOutBack provides a very slight, elegant overshoot at the peak, mimicking a natural inhale
              easing: 'easeOutBack' 
            },
            {
              x: originalScaleX,
              y: originalScaleY,
              z: originalScaleZ,
              duration: duration * 0.55,
              // easeInOutSine provides a gentle, non-bouncy return to the resting state (exhale)
              easing: 'easeInOutSine' 
            }
          ],
          delay: config.delay ?? 0
        });
      } else {
        // Permanent scale adjustment if pulse is false
        this.ctx.scheduler.enqueue({
          targets: el.scale,
          x: targetScaleX,
          y: targetScaleY,
          z: targetScaleZ,
          duration: duration,
          easing: config.easing ?? this.defaultEasing,
          delay: config.delay ?? 0
        });
      }
    });
  }
}
