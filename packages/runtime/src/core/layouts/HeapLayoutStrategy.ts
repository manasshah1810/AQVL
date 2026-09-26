import { SceneElement } from '../../models/SceneElement';
import { RelationshipManager } from '../RelationshipManager';
import { LayoutStrategy } from './LayoutStrategy';

/**
 * A heap is a complete binary tree stored in an array, so both views are
 * placed from the index alone: index i sits on level floor(log2(i + 1)),
 * spread evenly across that level (the tree), and the array cells form a
 * row underneath in index order. Unlike the edge-driven tree layout, a node
 * appended by `INSERT h value` lands in the right place immediately.
 */
export class HeapLayoutStrategy implements LayoutStrategy {
  constructor(
    private readonly leafSpacing = 1.6,
    private readonly levelGap = 1.8,
    private readonly cellSpacing = 1.3,
    private readonly startY = 3
  ) {}

  applyLayout(elements: SceneElement[], _relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const nodes = elements.filter((el) => el.originalType === 'HEAP_NODE');
    const cells = elements.filter((el) => el.originalType === 'HEAP_ARRAY_ELEMENT');
    const count = Math.max(nodes.length, cells.length);
    const levels = count === 0 ? 1 : Math.floor(Math.log2(count)) + 1;
    const bottomSlots = 2 ** (levels - 1);

    for (const node of nodes) {
      const i = (node as any).logicalIndex as number;
      const level = Math.floor(Math.log2(i + 1));
      const posInLevel = i - (2 ** level - 1);
      const slotsPerNode = 2 ** (levels - 1 - level);
      const x = ((posInLevel + 0.5) * slotsPerNode - bottomSlots / 2) * this.leafSpacing;
      map.set(node.id, { x, y: this.startY - level * this.levelGap, z: 0 });
    }

    const rowY = this.startY - (levels - 1) * this.levelGap - 2.4;
    for (const cell of cells) {
      const i = (cell as any).logicalIndex as number;
      map.set(cell.id, { x: (i - (count - 1) / 2) * this.cellSpacing, y: rowY, z: 0 });
    }
    return map;
  }
}
