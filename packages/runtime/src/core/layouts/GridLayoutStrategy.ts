import { SceneElement, BoxElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface GridLayoutOptions {
  spacingX?: number;
  spacingY?: number;
  startX?: number;
  startY?: number;
  startZ?: number;
}

export class GridLayoutStrategy implements LayoutStrategy {
  private spacingX: number;
  private spacingY: number;
  private startX: number;
  private startY: number;
  private startZ: number;

  constructor(options?: GridLayoutOptions) {
    this.spacingX = options?.spacingX || 1.5;
    this.spacingY = options?.spacingY || 1.5;
    this.startX = options?.startX || 0;
    this.startY = options?.startY || 0;
    this.startZ = options?.startZ || 0;
  }

  public applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const boxes = elements.filter((el): el is BoxElement => el.type === 'box');
    if (boxes.length === 0) return map;

    // Determine dimensions to center the grid
    let maxRow = 0;
    let maxCol = 0;
    let minRow = Infinity;
    let minCol = Infinity;

    // If explicit rows and cols aren't set, try to infer from `columns`
    const columnsLimit = boxes[0].columns;

    boxes.forEach(box => {
      let row = box.row;
      let col = box.col;

      if (row === undefined || col === undefined) {
        if (columnsLimit && columnsLimit > 0) {
          const index = box.logicalIndex || 0;
          row = Math.floor(index / columnsLimit);
          col = index % columnsLimit;
        } else {
          // Fallback: lay out horizontally
          row = 0;
          col = box.logicalIndex || 0;
        }
      }

      // Cache for second pass
      (box as any)._resolvedRow = row;
      (box as any)._resolvedCol = col;

      if (row > maxRow) maxRow = row;
      if (row < minRow) minRow = row;
      if (col > maxCol) maxCol = col;
      if (col < minCol) minCol = col;
    });

    if (minRow === Infinity) minRow = 0;
    if (minCol === Infinity) minCol = 0;

    const totalWidth = (maxCol - minCol) * this.spacingX;
    const totalHeight = (maxRow - minRow) * this.spacingY;

    // Apply positions
    boxes.forEach(box => {
      const row = (box as any)._resolvedRow;
      const col = (box as any)._resolvedCol;

      const x = this.startX - (totalWidth / 2) + (col - minCol) * this.spacingX;
      const y = this.startY + (totalHeight / 2) - (row - minRow) * this.spacingY;
      const z = this.startZ;
      
      map.set(box.id, { x, y, z });
    });

    return map;
  }
}
