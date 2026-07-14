import { SceneElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface LinkedListLayoutOptions {
  spacing?: number;
  startX?: number;
  startY?: number;
}

export class LinkedListLayoutStrategy implements LayoutStrategy {
  private spacing: number;
  private startX: number;
  private startY: number;

  constructor(options?: LinkedListLayoutOptions) {
    this.spacing = options?.spacing || 2.5; // wider spacing for arrows
    this.startX = options?.startX || 0;
    this.startY = options?.startY || 0;
  }

  public applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    
    // For linked lists, we just want to sort the nodes by logicalIndex and lay them out linearly.
    // The EdgeRenderer will handle the curved arrows.
    const nodes = elements.filter(el => el.type !== 'edge' && el.originalType === 'LINKEDLIST_NODE') as any[];
    const sortedNodes = [...nodes].sort((a, b) => (a.logicalIndex || 0) - (b.logicalIndex || 0));

    if (sortedNodes.length === 0) return map;

    const totalLength = (sortedNodes.length - 1) * this.spacing;

    sortedNodes.forEach((node, idx) => {
      // Center the list around startX
      const x = this.startX - totalLength / 2 + idx * this.spacing;
      const y = this.startY;
      
      map.set(node.id, { x, y, z: 0 });
    });

    return map;
  }
}
