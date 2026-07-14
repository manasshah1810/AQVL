import { SceneElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface QueueLayoutOptions {
  spacing?: number;
  startX?: number;
  startY?: number;
}

export class QueueLayoutStrategy implements LayoutStrategy {
  private spacing: number;
  private startX: number;
  private startY: number;

  constructor(options?: QueueLayoutOptions) {
    this.spacing = options?.spacing || 1.5;
    this.startX = options?.startX || 0;
    this.startY = options?.startY || 0;
  }

  public applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    
    const queueElements = elements.filter(el => el.originalType === 'QUEUE_ELEMENT');
    
    // Group by queue name
    const groups: Record<string, any[]> = {};
    queueElements.forEach(el => {
      const parent = (el as any).logicalParent || 'default';
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(el);
    });

    Object.keys(groups).forEach((parent, groupIdx) => {
      const els = groups[parent];
      const sortedNodes = [...els].sort((a, b) => ((a as any).logicalIndex || 0) - ((b as any).logicalIndex || 0));
      
      const totalLength = (sortedNodes.length - 1) * this.spacing;
      const yOffset = this.startY + groupIdx * 3; // Offset multiple queues vertically
      
      sortedNodes.forEach((node, idx) => {
        // Build rightward from startX, centered
        const x = this.startX - totalLength / 2 + idx * this.spacing;
        const y = yOffset;
        
        map.set(node.id, { x, y, z: 0 });
      });
    });

    return map;
  }
}
