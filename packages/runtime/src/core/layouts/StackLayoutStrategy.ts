import { SceneElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface StackLayoutOptions {
  spacing?: number;
  startX?: number;
  startY?: number;
}

export class StackLayoutStrategy implements LayoutStrategy {
  private spacing: number;
  private startX: number;
  private startY: number;

  constructor(options?: StackLayoutOptions) {
    this.spacing = options?.spacing || 1.2;
    this.startX = options?.startX || 0;
    this.startY = options?.startY || -2; // Start from bottom of the screen
  }

  public applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    
    const stackElements = elements.filter(el => el.originalType === 'STACK_ELEMENT' || el.originalType === 'ARRAY_ELEMENT'); // Allow array elements in stack layout if needed, though they usually have 'STACK_ELEMENT'
    
    // Group by stack name if there are multiple stacks, though for now we assume one or position them together
    const groups: Record<string, any[]> = {};
    stackElements.forEach(el => {
      const parent = (el as any).logicalParent || 'default';
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(el);
    });

    Object.keys(groups).forEach((parent, groupIdx) => {
      const els = groups[parent];
      const sortedNodes = [...els].sort((a, b) => ((a as any).logicalIndex || 0) - ((b as any).logicalIndex || 0));
      
      const xOffset = this.startX + groupIdx * 3; // Offset multiple stacks horizontally
      
      sortedNodes.forEach((node, idx) => {
        // Build upward from startY
        const x = xOffset;
        const y = this.startY + idx * this.spacing;
        
        map.set(node.id, { x, y, z: 0 });
      });
    });

    return map;
  }
}
