import { AnimationScheduler } from '../AnimationScheduler';
import { SceneManager } from '../SceneManager';
import { LayoutManager } from '../LayoutManager';
import { EventDispatcher } from '../EventDispatcher';
import { GenericActionInstruction } from '@aqvl/shared';

export interface AlgorithmContext {
  scheduler: AnimationScheduler;
  sceneManager: SceneManager;
  layoutManager: LayoutManager;
  eventDispatcher: EventDispatcher;
  
  // Expose the current tree being operated on
  activeTreeName?: string;
  defaultColor: string;
}

export interface AlgorithmHandler {
  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void;
}
