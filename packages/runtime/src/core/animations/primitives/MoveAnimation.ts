import { PrimitiveAnimation, PrimitiveAnimationConfig } from './PrimitiveAnimation';

export interface MoveConfig extends PrimitiveAnimationConfig {
  targetIds: string[];
  position: {
    x?: number | ((el: any, i: number, l: number) => number);
    y?: number | ((el: any, i: number, l: number) => number);
    z?: number | ((el: any, i: number, l: number) => number);
  };
}

export class MoveAnimation extends PrimitiveAnimation<MoveConfig> {
  // Use a premium default easing, like a gentle spring for weight and momentum.
  protected defaultEasing = 'easeOutElastic(1, .8)'; 
  protected defaultDuration = 600;

  execute(config: MoveConfig): void {
    if (!config.targetIds || config.targetIds.length === 0) return;

    const elements = config.targetIds
      .map(id => this.ctx.sceneManager.getElement(id))
      .filter(Boolean) as any[];

    if (elements.length === 0) return;

    // For intelligent path planning, we evaluate the target positions per element
    elements.forEach((el, index) => {
      const startX = el.position.x;
      const startY = el.position.y;
      const startZ = el.position.z;
      
      const l = elements.length;
      
      const targetX = typeof config.position.x === 'function' ? config.position.x(el, index, l) : (config.position.x ?? startX);
      const targetY = typeof config.position.y === 'function' ? config.position.y(el, index, l) : (config.position.y ?? startY);
      const targetZ = typeof config.position.z === 'function' ? config.position.z(el, index, l) : (config.position.z ?? startZ);

      // Calculate euclidean distance to determine intention and momentum
      const dx = targetX - startX;
      const dy = targetY - startY;
      const dz = targetZ - startZ;
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Dynamic duration based on distance to maintain satisfying velocity
      const baseDuration = config.duration ?? this.defaultDuration;
      const distanceFactor = Math.min(distance * 15, 300); // slightly extend duration for longer trips
      const finalDuration = baseDuration + distanceFactor;

      // Intelligent Path Planning: If moving a significant distance (> 2 units),
      // we inject a subtle Z-axis arc so objects step "over" or "around" others.
      if (distance > 2) {
        const arcHeight = Math.min(distance * 0.3, 2.5); // scale arc with distance, cap at 2.5
        const peakZ = Math.max(startZ, targetZ) + arcHeight;

        // Use keyframes for a choreographed arc and settle
        this.ctx.scheduler.enqueue({
          targets: el.position,
          duration: finalDuration,
          keyframes: [
            { 
              // Anticipation and upward arc
              x: startX + dx * 0.5, 
              y: startY + dy * 0.5, 
              z: peakZ, 
              duration: finalDuration * 0.4, 
              easing: 'easeOutSine' 
            },
            { 
              // Settle down to destination with overshoot
              x: targetX, 
              y: targetY, 
              z: targetZ, 
              duration: finalDuration * 0.6, 
              easing: config.easing ?? this.defaultEasing 
            }
          ],
          delay: config.delay ?? 0
        });
      } else {
        // Simple, confident move with spring for short distances
        this.ctx.scheduler.enqueue({
          targets: el.position,
          x: targetX,
          y: targetY,
          z: targetZ,
          duration: finalDuration,
          easing: config.easing ?? this.defaultEasing,
          delay: config.delay ?? 0
        });
      }
    });
  }
}

