import { PrimitiveAnimation, PrimitiveAnimationConfig } from './PrimitiveAnimation';

export interface LiftConfig extends PrimitiveAnimationConfig {
  targetIds: string[];
  liftAmount?: number; // How high the object is lifted
}

export class LiftAnimation extends PrimitiveAnimation<LiftConfig> {
  // A calm, controlled easing creates a sense of preparation rather than sudden excitement.
  // easeOutQuad gives a gentle but definitive rise.
  protected defaultEasing = 'easeOutQuad'; 
  protected defaultDuration = 450;

  execute(config: LiftConfig): void {
    if (!config.targetIds || config.targetIds.length === 0) return;

    const elements = config.targetIds
      .map(id => this.ctx.sceneManager.getElement(id))
      .filter(Boolean) as any[];

    if (elements.length === 0) return;

    // A subtle lift amount ensures the object doesn't feel detached from the visualization
    const liftAmount = config.liftAmount ?? 0.8; 

    elements.forEach(el => {
      // In a PBR 3D scene, physically lifting the object naturally softens its cast shadow.
      // We can also add a subtle emissive bump to reinforce the active state.
      const targetIntensity = (el.emissiveIntensity ?? 0) + 0.2;

      this.ctx.scheduler.enqueue({
        targets: [el.position],
        y: el.position.y + liftAmount,
        duration: config.duration ?? this.defaultDuration,
        easing: config.easing ?? this.defaultEasing,
        delay: config.delay ?? 0
      });

      // Subtle glow increase to reinforce the sensation that it is active
      this.ctx.scheduler.enqueue({
        targets: el,
        emissiveIntensity: targetIntensity,
        duration: config.duration ?? this.defaultDuration,
        easing: config.easing ?? this.defaultEasing,
        delay: config.delay ?? 0
      });
    });
  }
}
