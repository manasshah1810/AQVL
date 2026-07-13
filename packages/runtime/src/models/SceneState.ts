import { SceneElement } from './SceneElement';

export interface SceneState {
  /**
   * A map of element IDs to their state at this point in time.
   */
  elements: Map<string, SceneElement>;
  
  /**
   * Optional description of the action that caused this state (e.g., 'Swap arr[0] and arr[1]')
   */
  description?: string;
}
