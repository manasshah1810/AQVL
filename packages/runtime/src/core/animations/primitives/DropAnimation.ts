import { PrimitiveAnimation, PrimitiveAnimationConfig } from './PrimitiveAnimation';

export interface DropConfig extends PrimitiveAnimationConfig {
  targetIds: string[];
  dropAmount?: number; // How much to lower the object (defaults to 0.8 to match LIFT)
  targetY?: number;    // Or specify an exact target Y coordinate
}

export class DropAnimation extends PrimitiveAnimation<DropConfig> {
  // easeOutBounce provides a very small, almost subconscious settling motion.
  // It gives tactile feedback of physical weight without becoming a cartoonish spectacle.
  protected defaultEasing = 'easeOutBounce'; 
  protected defaultDuration = 550; // Slightly longer for a softer landing

  execute(config: DropConfig): void {
    if (!config.targetIds || config.targetIds.length === 0) return;

    const elements = config.targetIds
      .map(id => this.ctx.sceneManager.getElement(id))
      .filter(Boolean) as any[];

    if (elements.length === 0) return;

    elements.forEach(el => {
      // Determine the final resting position
      let finalY: number;
      if (config.targetY !== undefined) {
          finalY = config.targetY;
      } else {
          // Perfectly reverse the default LIFT amount if no explicit target is given
          const amount = config.dropAmount ?? 0.8; 
          finalY = el.position.y - amount;
      }

      // Undo the emissive bump from LIFT to restore the resting appearance
      const targetIntensity = Math.max(0, (el.emissiveIntensity ?? 0) - 0.2);

      this.ctx.scheduler.enqueue({
        targets: [el.position],
        y: finalY,
        duration: config.duration ?? this.defaultDuration,
        easing: config.easing ?? this.defaultEasing,
        delay: config.delay ?? 0
      });

      // Smoothly fade the light out and ensure scale returns to 1.0 (if altered)
      // We avoid bouncy easings for lighting and scale restoration to keep it grounded.
      this.ctx.scheduler.enqueue({
        targets: [el, el.scale],
        emissiveIntensity: targetIntensity,
        x: 1.0,
        y: 1.0,
        z: 1.0,
        duration: config.duration ?? (this.defaultDuration * 0.8), // fades slightly faster than the bounce
        easing: 'easeInOutQuad', 
        delay: config.delay ?? 0
      });
    });
  }
}
