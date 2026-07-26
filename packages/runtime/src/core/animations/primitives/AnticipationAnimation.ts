import { PrimitiveAnimation, PrimitiveAnimationConfig } from './PrimitiveAnimation';
import { getAnticipationConfig, AnticipationType, getSemanticColorToken } from '@aqvl/shared';
import { AnimationScheduler } from '../../AnimationScheduler';

export interface AnticipationConfigOptions extends PrimitiveAnimationConfig {
  targetIds: string[];
  type: AnticipationType | string;
  customScale?: number;
  customNudge?: { x?: number; y?: number; z?: number };
}

export class AnticipationAnimation extends PrimitiveAnimation<AnticipationConfigOptions> {
  protected defaultDuration = 150;
  protected defaultEasing = 'easeInQuad';

  execute(config: AnticipationConfigOptions): void {
    if (!config.targetIds || config.targetIds.length === 0) return;

    const elements = config.targetIds
      .map(id => this.ctx.sceneManager.getElement(id))
      .filter(Boolean) as any[];

    if (elements.length === 0) return;

    AnticipationAnimation.applyAnticipation(
      this.ctx.scheduler,
      elements,
      config.type,
      {
        duration: config.duration,
        easing: config.easing,
        delay: config.delay,
        customScale: config.customScale,
        customNudge: config.customNudge
      }
    );
  }

  /**
   * Schedules a subtle 100-200ms anticipation phase for the target elements
   * before the primary algorithmic movement/state change begins.
   */
  public static applyAnticipation(
    scheduler: AnimationScheduler,
    elements: any[],
    typeOrAlias: AnticipationType | string,
    options?: {
      duration?: number;
      easing?: string;
      delay?: number;
      customScale?: number;
      customNudge?: { x?: number; y?: number; z?: number };
      advanceCursor?: boolean;
    }
  ): void {
    const validElements = (elements || []).filter(Boolean);
    if (validElements.length === 0) return;

    const baseConfig = getAnticipationConfig(typeOrAlias);
    const duration = options?.duration ?? baseConfig.duration;
    const easing = options?.easing ?? baseConfig.easing;
    const delay = options?.delay ?? 0;
    const scaleFactor = options?.customScale ?? baseConfig.scaleMultiplier;
    const nudge = options?.customNudge ?? baseConfig.positionNudge;

    const previewToken = getSemanticColorToken(baseConfig.previewSemanticState);

    validElements.forEach(el => {
      if (!el) return;

      const currentScaleX = el.scale?.x ?? 1;
      const currentScaleY = el.scale?.y ?? 1;
      const currentScaleZ = el.scale?.z ?? 1;

      const targetScaleX = currentScaleX * scaleFactor;
      const targetScaleY = currentScaleY * scaleFactor;
      const targetScaleZ = currentScaleZ * scaleFactor;

      const currentX = el.position?.x ?? 0;
      const currentY = el.position?.y ?? 0;
      const currentZ = el.position?.z ?? 0;

      const targetX = currentX + (nudge.x ?? 0);
      const targetY = currentY + (nudge.y ?? 0);
      const targetZ = currentZ + (nudge.z ?? 0);

      const targetEmissive = (el.emissiveIntensity ?? 0) + baseConfig.emissiveBoost;

      // Scale anticipation keyframe
      scheduler.enqueue({
        targets: el.scale,
        x: targetScaleX,
        y: targetScaleY,
        z: targetScaleZ,
        duration: duration,
        easing: easing,
        delay: delay
      });

      // Position nudge anticipation keyframe (if position nudge is non-zero)
      if ((nudge.x ?? 0) !== 0 || (nudge.y ?? 0) !== 0 || (nudge.z ?? 0) !== 0) {
        scheduler.enqueue({
          targets: el.position,
          x: targetX,
          y: targetY,
          z: targetZ,
          duration: duration,
          easing: easing,
          delay: delay
        });
      }

      // Emissive glow & preview color anticipation keyframe
      scheduler.enqueue({
        targets: el,
        emissiveIntensity: targetEmissive,
        emissiveColor: previewToken.emissiveColor,
        opacity: baseConfig.opacityPrep !== undefined ? baseConfig.opacityPrep : (el.opacity ?? 1),
        duration: duration,
        easing: easing,
        delay: delay
      });
    });

    scheduler.commitGroup(options?.advanceCursor ?? true);
  }
}
