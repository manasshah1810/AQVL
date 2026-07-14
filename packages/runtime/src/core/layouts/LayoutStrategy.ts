import { SceneElement } from '../../models/SceneElement';
import { RelationshipManager } from '../RelationshipManager';

export interface LayoutStrategy {
  /**
   * Applies the layout algorithm to a given set of scene elements.
   * Returns a map of element IDs to their new positions.
   */
  applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }>;
}
