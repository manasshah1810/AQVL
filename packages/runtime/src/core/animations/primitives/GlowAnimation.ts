import { PrimitiveAnimation, PrimitiveAnimationConfig } from './PrimitiveAnimation';
import { getSemanticColorToken } from '@aqvl/shared';

export interface GlowConfig extends PrimitiveAnimationConfig {
  targetIds: string[];
  color?: string; // e.g., semantic state or color string
  intensity?: number; // How bright it gets (e.g., 0.5)
  pulse?: boolean; // If true, glows and then fades back to normal
}

export class GlowAnimation extends PrimitiveAnimation<GlowConfig> {
  // A smooth sine wave provides a natural "breathing" light effect
  protected defaultEasing = 'easeInOutSine'; 
  protected defaultDuration = 800; // Relaxed pace for educational clarity

  execute(config: GlowConfig): void {
    if (!config.targetIds || config.targetIds.length === 0) return;

    const elements = config.targetIds
      .map(id => this.ctx.sceneManager.getElement(id))
      .filter(Boolean) as any[];

    if (elements.length === 0) return;

    const activeToken = getSemanticColorToken('ACTIVE');
    const neutralToken = getSemanticColorToken('NEUTRAL');

    const intensity = config.intensity ?? activeToken.emissiveIntensity;
    const isPulse = config.pulse ?? true;
    const glowToken = config.color ? getSemanticColorToken(config.color) : activeToken;
    const glowColor = config.color ? (glowToken.color) : activeToken.emissiveColor;


    elements.forEach(el => {
      // Capture the baseline state to ensure non-destructive emphasis
      const originalIntensity = el.emissiveIntensity ?? 0;
      const originalColor = el.emissiveColor ?? '#000000';

      // If the object isn't currently glowing, prep the color instantly so the 
      // transition is purely intensity-based, avoiding weird color interpolation jumps.
      if (originalIntensity === 0) {
        el.emissiveColor = glowColor;
      }

      const duration = config.duration ?? this.defaultDuration;

      if (isPulse) {
        // Enqueue keyframes for a natural breathing pulse
        this.ctx.scheduler.enqueue({
          targets: el,
          duration: duration,
          keyframes: [
            {
              emissiveIntensity: intensity,
              emissiveColor: glowColor,
              duration: duration * 0.4,
              easing: 'easeOutQuad' // Brighten smoothly but attentively
            },
            {
              emissiveIntensity: originalIntensity,
              // If it returns to 0 intensity, keeping the glowColor prevents flickering
              emissiveColor: originalIntensity === 0 ? glowColor : originalColor,
              duration: duration * 0.6,
              easing: 'easeInOutSine' // Fade the light out naturally
            }
          ],
          delay: config.delay ?? 0
        });
      } else {
        // Permanent glow adjustment if pulse is false
        this.ctx.scheduler.enqueue({
          targets: el,
          emissiveIntensity: intensity,
          emissiveColor: glowColor,
          duration: duration,
          easing: config.easing ?? this.defaultEasing,
          delay: config.delay ?? 0
        });
      }
    });
  }
}
