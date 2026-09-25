import { SceneElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

/** Horizontal distance between neighbouring inorder columns of a pointer tree. */
export const TREE_COLUMN_SPACING = 1.5;
/** Vertical distance between tree levels. */
export const TREE_LEVEL_SPACING = 1.9;
/** Extra gap between a tree's deepest level and its heap-memory row. */
export const TREE_HEAP_GAP = 1.5;
/** Distance between neighbouring boxes of a queue / stack row. */
export const CONTAINER_SPACING = 1.25;
/** Distance between neighbouring boxes of a vertical stack column. */
export const STACK_LEVEL_SPACING = 1.15;

/**
 * Lays out one pointer tree (a `BINARY_TREE` / `BST` — see TreeEngine) in
 * local coordinates, root at the origin:
 *
 * - tree nodes sit at the column / depth TreeEngine computed (`layoutX`,
 *   `layoutDepth`): one column per node in inorder position, so a left
 *   subtree is always entirely left of its parent and subtrees never overlap;
 *   TreeEngine keeps those coordinates fixed while an algorithm has the tree
 *   mid-restructure, so nodes don't jump around between steps;
 * - nodes not in the tree (`inTree === false`: freshly allocated by NEW_NODE,
 *   or unlinked and waiting for FREE) sit in the heap-memory row below;
 * - the anchor (drawn as the tree's name and its call-stack panel) sits
 *   top-left of the tree.
 */
export class PointerTreeLayoutStrategy implements LayoutStrategy {
  public applyLayout(elements: SceneElement[], _relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const nodes = elements.filter((el) => el.originalType === 'TREE_NODE') as any[];
    const anchor = elements.find((el) => el.originalType === 'BINARYTREE');

    const inTree = nodes.filter((n) => n.inTree !== false);
    const heap = nodes.filter((n) => n.inTree === false).sort((a, b) => (a.heapOrder ?? 0) - (b.heapOrder ?? 0));

    let minX = 0;
    let maxX = 0;
    let maxDepth = 0;
    inTree.forEach((n, i) => {
      const x = (n.layoutX ?? i) * TREE_COLUMN_SPACING;
      const depth = n.layoutDepth ?? 0;
      map.set(n.id, { x, y: -depth * TREE_LEVEL_SPACING, z: 0 });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      maxDepth = Math.max(maxDepth, depth);
    });

    const heapY = -(maxDepth + 1) * TREE_LEVEL_SPACING - TREE_HEAP_GAP;
    const heapLeft = -((heap.length - 1) * TREE_COLUMN_SPACING) / 2;
    heap.forEach((n, i) => {
      map.set(n.id, { x: heapLeft + i * TREE_COLUMN_SPACING, y: heapY, z: 0 });
    });

    if (anchor) {
      map.set(anchor.id, { x: Math.min(minX, heap.length ? heapLeft : 0) - 2.2, y: 0.4, z: 0 });
    }
    return map;
  }
}

/**
 * Lays out one queue / stack (see TreeEngine's containers) in local
 * coordinates, its anchor (drawn as the name) just left of the first box:
 *
 * - `row` (a tree program's queues / stacks, drawn under the trees): a
 *   horizontal row, front → rear for a queue, bottom → top for a stack;
 * - `column` (a stack of a program without trees): a vertical column that
 *   grows upwards from the origin, bottom → top, the way a stack is drawn
 *   on a whiteboard.
 */
export class PointerContainerLayoutStrategy implements LayoutStrategy {
  constructor(private readonly direction: 'row' | 'column' = 'row') {}

  public applyLayout(elements: SceneElement[], _relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const items = (elements.filter((el) => el.originalType === 'CONTAINER_ITEM') as any[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const anchor = elements.find((el) => el.originalType === 'CONTAINER');
    items.forEach((item, i) =>
      map.set(item.id, this.direction === 'column' ? { x: 0, y: i * STACK_LEVEL_SPACING, z: 0 } : { x: i * CONTAINER_SPACING, y: 0, z: 0 })
    );
    if (anchor) map.set(anchor.id, { x: -0.9, y: 0, z: 0 });
    return map;
  }
}

