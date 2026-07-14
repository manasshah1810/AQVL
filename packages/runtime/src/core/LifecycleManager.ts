import { SceneElement } from '../models/SceneElement';
import { SceneManager } from './SceneManager';

export class LifecycleManager {
  constructor(private sceneManager: SceneManager) {}

  public spawn(element: SceneElement, animateIn: boolean = true): void {
    if (animateIn) {
      element.lifecycleState = 'SPAWNING';
      element.visible = true;
      element.opacity = 0; // Start hidden for animation
      element.scale = { x: 0.01, y: 0.01, z: 0.01 }; // Start small
    } else {
      element.lifecycleState = 'ACTIVE';
      element.visible = true;
      element.opacity = 1;
      element.scale = { x: 1, y: 1, z: 1 };
    }
    
    this.sceneManager.addElement(element);
  }

  public activate(id: string): void {
    const el = this.sceneManager.getElement(id);
    if (el && el.lifecycleState === 'SPAWNING') {
      el.lifecycleState = 'ACTIVE';
      el.opacity = 1;
      el.scale = { x: 1, y: 1, z: 1 };
    }
  }

  public remove(id: string): void {
    const el = this.sceneManager.getElement(id);
    if (el) {
      el.lifecycleState = 'REMOVING';
    }
  }

  public destroy(id: string): void {
    const el = this.sceneManager.getElement(id);
    if (el) {
      el.lifecycleState = 'DESTROYED';
      el.visible = false;
      this.sceneManager.removeElement(id);
    }
  }
}
