import { AnimationScheduler } from '../AnimationScheduler';
import { SceneManager } from '../SceneManager';
import { LayoutManager } from '../LayoutManager';

export interface AnimationContext {
  scheduler: AnimationScheduler;
  sceneManager: SceneManager;
  layoutManager: LayoutManager;
}
