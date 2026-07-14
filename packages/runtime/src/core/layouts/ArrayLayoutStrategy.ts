import { SceneElement, BoxElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface ArrayLayoutOptions {
  direction?: 'horizontal' | 'vertical';
  spacing?: number;
  startX?: number;
  startY?: number;
  startZ?: number;
}

export class ArrayLayoutStrategy implements LayoutStrategy {
  private direction: 'horizontal' | 'vertical';
  private spacing: number;
  private startX: number;
  private startY: number;
  private startZ: number;

  constructor(options?: ArrayLayoutOptions) {
    this.direction = options?.direction || 'horizontal';
    this.spacing = options?.spacing || 2.2;
    this.startX = options?.startX || 0;
    this.startY = options?.startY || 0;
    this.startZ = options?.startZ || 0;
  }

  public applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const boxes = elements.filter((el): el is BoxElement => el.type === 'box');
    
    if (boxes.length === 0) return map;

    const sortedElements = boxes.sort((a, b) => {
      const indexA = (a as any).layoutSlot ?? a.logicalIndex ?? 0;
      const indexB = (b as any).layoutSlot ?? b.logicalIndex ?? 0;
      return indexA - indexB;
    });

    const totalLength = (sortedElements.length - 1) * this.spacing;
    
    sortedElements.forEach((element, i) => {
      let x = 0;
      let y = 0;

      if (this.direction === 'horizontal') {
        x = this.startX - totalLength / 2 + i * this.spacing;
        y = this.startY;
      } else {
        x = this.startX;
        y = this.startY + totalLength / 2 - i * this.spacing;
      }

      map.set(element.id, { x, y, z: this.startZ });
    });

    return map;
  }
}
