import { PrimitiveAnimation, PrimitiveAnimationConfig } from './PrimitiveAnimation';

export interface RotateConfig extends PrimitiveAnimationConfig {
  targetIds: string[];
  rotation: {
    x?: number | ((el: any, i: number, l: number) => number);
    y?: number | ((el: any, i: number, l: number) => number);
    z?: number | ((el: any, i: number, l: number) => number);
  };
}

export class RotateAnimation extends PrimitiveAnimation<RotateConfig> {
  // A mathematically precise easing (easeInOutQuart) ensures a deliberate, highly controlled spin
  // that avoids dizziness and emphasizes structural clarity.
  protected defaultEasing = 'easeInOutQuart'; 
  // A longer duration ensures the learner can follow the structural transformation without feeling rushed
  protected defaultDuration = 800;

  execute(config: RotateConfig): void {
    if (!config.targetIds || config.targetIds.length === 0) return;

    const elements = config.targetIds
      .map(id => this.ctx.sceneManager.getElement(id))
      .filter(Boolean) as any[];

    if (elements.length === 0) return;

    elements.forEach((el, index) => {
      const l = elements.length;
      
      const startX = el.rotation.x;
      const startY = el.rotation.y;
      const startZ = el.rotation.z;

      const targetX = typeof config.rotation.x === 'function' ? config.rotation.x(el, index, l) : (config.rotation.x ?? startX);
      const targetY = typeof config.rotation.y === 'function' ? config.rotation.y(el, index, l) : (config.rotation.y ?? startY);
      const targetZ = typeof config.rotation.z === 'function' ? config.rotation.z(el, index, l) : (config.rotation.z ?? startZ);

      this.ctx.scheduler.enqueue({
        targets: el.rotation,
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: config.duration ?? this.defaultDuration,
        easing: config.easing ?? this.defaultEasing,
        delay: config.delay ?? 0
      });
    });
  }
}
