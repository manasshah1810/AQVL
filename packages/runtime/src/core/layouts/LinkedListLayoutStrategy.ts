import { SceneElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface LinkedListLayoutOptions {
  spacing?: number;
  startX?: number;
  startY?: number;
}

/** How far below its list a list's heap-memory row (unlinked nodes) sits. */
export const LINKED_LIST_HEAP_OFFSET_Y = -3.6;

/**
 * Lays out one linked list (its anchor, nodes and pointer edges):
 *
 * - nodes that are part of the list (`inList`) sit on one row, ordered by
 *   their `slot` — LinkedListEngine re-numbers slots to follow the next
 *   pointers from the head whenever the whole list is reachable from it, and
 *   leaves them alone while an algorithm (e.g. in-place reversal) has the
 *   list temporarily split, so nodes don't jump around mid-algorithm;
 * - nodes that are not (`inList === false`: freshly allocated by NEW_NODE,
 *   or unlinked and waiting for FREE) sit in the heap-memory row below;
 * - the anchor (the list itself, drawn as the list's name) sits just left of the row.
 */
export class LinkedListLayoutStrategy implements LayoutStrategy {
  private spacing: number;
  private startX: number;
  private startY: number;

  constructor(options?: LinkedListLayoutOptions) {
    this.spacing = options?.spacing || 2.6;
    this.startX = options?.startX || 0;
    this.startY = options?.startY || 0;
  }

  public applyLayout(elements: SceneElement[], _relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const nodes = elements.filter((el) => el.originalType === 'LINKEDLIST_NODE') as any[];
    const anchor = elements.find((el) => el.originalType === 'LINKEDLIST');

    const row = nodes.filter((n) => n.inList !== false).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    const heap = nodes.filter((n) => n.inList === false).sort((a, b) => (a.heapOrder ?? 0) - (b.heapOrder ?? 0));

    const rowLeft = this.startX - ((row.length - 1) * this.spacing) / 2;
    row.forEach((node, i) => {
      map.set(node.id, { x: rowLeft + i * this.spacing, y: this.startY, z: 0 });
    });

    const heapLeft = this.startX - ((heap.length - 1) * this.spacing) / 2;
    heap.forEach((node, i) => {
      map.set(node.id, { x: heapLeft + i * this.spacing, y: this.startY + LINKED_LIST_HEAP_OFFSET_Y, z: 0 });
    });

    if (anchor) {
      const left = row.length > 0 ? rowLeft : this.startX;
      map.set(anchor.id, { x: left - this.spacing * 0.95, y: this.startY, z: 0 });
    }

    return map;
  }
}
