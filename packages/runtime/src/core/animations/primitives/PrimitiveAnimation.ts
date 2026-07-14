import { AnimationContext } from '../AnimationContext';

export interface PrimitiveAnimationConfig {
  duration?: number;
  easing?: string;
  delay?: number;
}

export abstract class PrimitiveAnimation<T extends PrimitiveAnimationConfig> {
  protected defaultDuration = 600;
  protected defaultEasing = 'easeInOutCubic';

  constructor(protected ctx: AnimationContext) {}

  /**
   * Executes the primitive animation.
   * @param config Configuration parameters for the animation
   */
  abstract execute(config: T): void;
}
