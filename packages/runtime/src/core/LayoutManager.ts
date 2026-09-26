/**
 * Heuristic layout dispatch for live SceneElement-based structure animations
 * (array/stack/queue/list/tree/graph), used by ExecutionEngine/AnimationController.
 *
 * This is a separate system from packages/runtime/src/layout/LayoutEngine.ts,
 * which resolves the AQIR SET_LAYOUT_STRATEGY/COMPUTE_LAYOUT opcodes for the
 * newer spatial-syntax feature via explicit name+params dispatch instead of
 * SceneElement-shape heuristics. The two are not interchangeable today — see
 * docs/design/existing-layout-audit.md for why they coexist and which one a
 * given call path should use. Where a layout type exists in both (tree,
 * force-directed, grid), the LayoutEngine version is the deliberately
 * improved/deterministic take (see its strategy files' doc comments); tune
 * both sides together if you change constants here, since they're expected
 * to converge eventually rather than drift apart.
 */
import { SceneManager } from './SceneManager';
import { SceneElement } from '../models/SceneElement';
import { LayoutStrategy } from './layouts/LayoutStrategy';
import { ArrayLayoutStrategy, ArrayLayoutOptions } from './layouts/ArrayLayoutStrategy';
import { TreeLayoutStrategy } from './layouts/TreeLayoutStrategy';
import { GraphLayoutStrategy } from './layouts/GraphLayoutStrategy';
import { GridLayoutStrategy } from './layouts/GridLayoutStrategy';
import { LinkedListLayoutStrategy } from './layouts/LinkedListLayoutStrategy';
import { StackLayoutStrategy } from './layouts/StackLayoutStrategy';
import { QueueLayoutStrategy } from './layouts/QueueLayoutStrategy';
import { PointerTreeLayoutStrategy, PointerContainerLayoutStrategy, TREE_LEVEL_SPACING } from './layouts/PointerTreeLayoutStrategy';

import { HeapLayoutStrategy } from './layouts/HeapLayoutStrategy';
import { RelationshipManager } from './RelationshipManager';

export class LayoutManager {
  private strategies: Map<string, LayoutStrategy> = new Map();
  private defaultStrategy: LayoutStrategy = new ArrayLayoutStrategy();

  private graphStrategy: LayoutStrategy = new GraphLayoutStrategy();
  private gridStrategy: LayoutStrategy = new GridLayoutStrategy();
  private linkedListStrategy: LayoutStrategy = new LinkedListLayoutStrategy();
  private stackStrategy: LayoutStrategy = new StackLayoutStrategy();
  private queueStrategy: LayoutStrategy = new QueueLayoutStrategy();
  private pointerTreeStrategy: LayoutStrategy = new PointerTreeLayoutStrategy();
  private pointerContainerStrategy: LayoutStrategy = new PointerContainerLayoutStrategy();
  private pointerStackColumnStrategy: LayoutStrategy = new PointerContainerLayoutStrategy('column');
  private treeStrategy: LayoutStrategy;
  private arrayHeapStrategy: LayoutStrategy;
  private heapStrategy: LayoutStrategy = new HeapLayoutStrategy();

  private reservedSlots: Map<string, Set<number | string>> = new Map();

  constructor(private sceneManager: SceneManager, private relationshipManager: RelationshipManager) {
    this.treeStrategy = new TreeLayoutStrategy({ startY: 2 });
    this.arrayHeapStrategy = new ArrayLayoutStrategy({ startY: -4 });
  }

  public setStrategy(logicalParent: string, strategy: LayoutStrategy): void {
    this.strategies.set(logicalParent, strategy);
  }

  public reserveSlot(logicalParent: string, slot: number | string): void {
    if (!this.reservedSlots.has(logicalParent)) {
      this.reservedSlots.set(logicalParent, new Set());
    }
    this.reservedSlots.get(logicalParent)!.add(slot);
  }

  public freeSlot(logicalParent: string, slot: number | string): void {
    if (this.reservedSlots.has(logicalParent)) {
      this.reservedSlots.get(logicalParent)!.delete(slot);
    }
  }

  /**
   * Evaluates the logical states of all objects and computes their 3D coordinates.
   * Returns a map of desired positions.
   */
  public updateLayout(graph: SceneElement[] = this.sceneManager.getSceneGraph()): Map<string, { x: number; y: number; z: number }> {
    const layoutMap = new Map<string, { x: number; y: number; z: number }>();
    
    const linkedListGroups: { subMap: Map<string, { x: number; y: number; z: number }> }[] = [];
    const pointerTreeGroups: Map<string, { x: number; y: number; z: number }>[] = [];
    const pointerContainerGroups: Map<string, { x: number; y: number; z: number }>[] = [];
    // Without a tree to sit under, a stack is drawn as a vertical column.
    const hasPointerTree = graph.some(el => el.originalType === 'BINARYTREE');

    // Group elements by logical parent
    const groupedElements: Record<string, SceneElement[]> = {};
    const unparentedElements: SceneElement[] = [];

    graph.forEach(element => {
      if (element.logicalParent) {
        if (!groupedElements[element.logicalParent]) {
          groupedElements[element.logicalParent] = [];
        }
        groupedElements[element.logicalParent].push(element);
      } else {
        unparentedElements.push(element);
      }
    });

    // Apply specific strategies for grouped elements
    const keys = Object.keys(groupedElements);
    for (let i = 0; i < keys.length; i++) {
      const parent = keys[i];
      const elements = groupedElements[parent];
      
      let strategy = this.strategies.get(parent);
      // Pointer trees (BINARY_TREE / BST, see TreeEngine) and the queues /
      // stacks of a tree program: placed together below, once every
      // group's extent is known.
      if (!strategy && elements.some(el => el.originalType === 'BINARYTREE')) {
        pointerTreeGroups.push(this.pointerTreeStrategy.applyLayout(elements.filter(el => !el.animationLayer), this.relationshipManager));
        continue;
      }
      if (!strategy && elements.some(el => el.originalType === 'CONTAINER')) {
        const isStackColumn = !hasPointerTree && elements.some(el => el.originalType === 'CONTAINER' && (el as any).kind === 'STACK');
        const containerStrategy = isStackColumn ? this.pointerStackColumnStrategy : this.pointerContainerStrategy;
        pointerContainerGroups.push(containerStrategy.applyLayout(elements.filter(el => !el.animationLayer), this.relationshipManager));
        continue;
      }
      if (!strategy) {
        // Infer strategy based on elements
        const hasGraphElements = elements.some(el => el.originalType === 'VERTEX' || el.originalType === 'GRAPH_EDGE' || el.originalType === 'GRAPH');
        const hasEdges = elements.some(el => el.type === 'edge');
        const isGrid = elements.some(el => el.originalType === 'MATRIX' || el.originalType === 'GRID' || (el as any).columns !== undefined || ((el as any).row !== undefined && (el as any).col !== undefined));
        // The list anchor is always present, so an emptied list keeps this
        // strategy (it used to fall through to the tree layout and recurse forever).
        const isLinkedList = elements.some(el => el.originalType === 'LINKEDLIST_NODE' || el.originalType === 'LINKEDLIST');
        const isStack = elements.some(el => el.originalType === 'STACK_ELEMENT');
        const isQueue = elements.some(el => el.originalType === 'QUEUE_ELEMENT');
        const isTree = elements.some(el => el.originalType === 'TREE_NODE' || el.originalType === 'TRIE_NODE');
        const isHeapNode = elements.some(el => el.originalType === 'HEAP_NODE');
        const isHeapArray = elements.some(el => el.originalType === 'HEAP_ARRAY_ELEMENT');
        
        if (isHeapNode || elements.some(el => el.originalType === 'HEAP')) {
          // Tree on top, array row underneath, both placed by index.
          strategy = this.heapStrategy;
        } else if (isHeapArray) {
          strategy = this.arrayHeapStrategy;
        } else if (isTree) {
          strategy = this.treeStrategy;
        } else if (isQueue) {
          strategy = this.queueStrategy;
        } else if (isStack) {
          strategy = this.stackStrategy;
        } else if (isLinkedList) {
          strategy = this.linkedListStrategy;
        } else if (hasGraphElements) {
          strategy = this.graphStrategy;
        } else if (hasEdges) {
          strategy = this.treeStrategy;
        } else if (isGrid) {
          strategy = this.gridStrategy;
        } else {
          strategy = this.defaultStrategy;
        }
      }
      
      // Inject virtual elements for reserved slots
      const reservedForParent = this.reservedSlots.get(parent);
      if (reservedForParent) {
        reservedForParent.forEach(slot => {
          const isOccupied = elements.some(el => (el.layoutSlot ?? (el as any).logicalIndex) === slot && !el.animationLayer);
          if (!isOccupied) {
            elements.push({
              id: `__virtual_${parent}_${slot}`,
              type: 'box',
              layoutSlot: slot,
              logicalIndex: typeof slot === 'number' ? slot : 0,
              position: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              color: '', emissiveIntensity: 0, emissiveColor: ''
            } as any);
          }
        });
      }
      
      // Filter out elements on the animation layer
      const layoutElements = elements.filter(el => !el.animationLayer);
      
      const subMap = strategy.applyLayout(layoutElements, this.relationshipManager);
      if (strategy === this.linkedListStrategy) {
        // Placed side by side (not one behind the other) below, once every
        // list's width is known.
        linkedListGroups.push({ subMap });
        continue;
      }
      const offsetZ = i * -6; // Shift each group backward to prevent overlap
      subMap.forEach((pos, id) => {
        if (!id.startsWith('__virtual_')) {
          pos.z += offsetZ;
          layoutMap.set(id, pos);
          // Also set worldTarget on the actual element in graph
          const el = graph.find(e => e.id === id);
          if (el) el.worldTarget = pos;
        }
      });
    }

    this.placeLinkedListGroups(linkedListGroups, graph, layoutMap);
    this.placePointerTreeGroups(pointerTreeGroups, pointerContainerGroups, graph, layoutMap);

    // Apply default strategy for unparented elements if needed, 
    // or leave them as they are for now.
    if (unparentedElements.length > 0) {
      const unparentedTreeElements = unparentedElements.filter(el => el.originalType === 'TREE_NODE');
      const otherUnparentedElements = unparentedElements.filter(el => el.originalType !== 'TREE_NODE');
      
      if (unparentedTreeElements.length > 0) {
        const subMap = this.treeStrategy.applyLayout(unparentedTreeElements, this.relationshipManager);
        subMap.forEach((pos, id) => layoutMap.set(id, pos));
      }
      
      if (otherUnparentedElements.length > 0) {
        const subMap = this.defaultStrategy.applyLayout(otherUnparentedElements, this.relationshipManager);
        subMap.forEach((pos, id) => layoutMap.set(id, pos));
      }
    }

    return layoutMap;
  }

  /**
   * Places each linked list's locally-laid-out group in a grid, two lists per
   * row, side by side on the same depth plane so every list is readable from
   * the default camera. Rows go downward, leaving room for each list's
   * heap-memory row.
   */
  private placeLinkedListGroups(
    groups: { subMap: Map<string, { x: number; y: number; z: number }> }[],
    graph: SceneElement[],
    layoutMap: Map<string, { x: number; y: number; z: number }>
  ): void {
    const PER_ROW = 2;
    const GAP_X = 3;
    const ROW_HEIGHT = 8.5;
    for (let rowStart = 0; rowStart < groups.length; rowStart += PER_ROW) {
      const rowGroups = groups.slice(rowStart, rowStart + PER_ROW).map(({ subMap }) => {
        let minX = Infinity;
        let maxX = -Infinity;
        subMap.forEach((pos) => {
          minX = Math.min(minX, pos.x);
          maxX = Math.max(maxX, pos.x);
        });
        if (!Number.isFinite(minX)) { minX = 0; maxX = 0; }
        return { subMap, minX, maxX };
      });
      const totalWidth = rowGroups.reduce((sum, g) => sum + (g.maxX - g.minX), 0) + GAP_X * (rowGroups.length - 1);
      let cursor = -totalWidth / 2;
      const offsetY = -(rowStart / PER_ROW) * ROW_HEIGHT;
      for (const g of rowGroups) {
        const shiftX = cursor - g.minX;
        g.subMap.forEach((pos, id) => {
          const placed = { x: pos.x + shiftX, y: pos.y + offsetY, z: pos.z };
          layoutMap.set(id, placed);
          const el = graph.find(e => e.id === id);
          if (el) el.worldTarget = placed;
        });
        cursor += g.maxX - g.minX + GAP_X;
      }
    }
  }

  /**
   * Places pointer trees side by side (tops aligned, on one depth plane) and
   * the tree program's queues / stacks as rows underneath them, left-aligned
   * with the trees.
   */
  private placePointerTreeGroups(
    trees: Map<string, { x: number; y: number; z: number }>[],
    containers: Map<string, { x: number; y: number; z: number }>[],
    graph: SceneElement[],
    layoutMap: Map<string, { x: number; y: number; z: number }>
  ): void {
    if (trees.length === 0 && containers.length === 0) return;
    if (trees.length === 0) {
      const isQueueRow = (subMap: Map<string, { x: number; y: number; z: number }>) =>
        [...subMap.keys()].some(id => (graph.find(e => e.id === id) as any)?.kind === 'QUEUE');
      this.placeQueueRows(containers.filter(isQueueRow), graph, layoutMap);
      this.placeStackColumns(containers.filter(m => !isQueueRow(m)), graph, layoutMap);
      return;
    }
    const TOP_Y = 3.2;
    const GAP_X = 3.5;
    const place = (subMap: Map<string, { x: number; y: number; z: number }>, dx: number, dy: number) => {
      subMap.forEach((pos, id) => {
        const placed = { x: pos.x + dx, y: pos.y + dy, z: pos.z };
        layoutMap.set(id, placed);
        const el = graph.find(e => e.id === id);
        if (el) el.worldTarget = placed;
      });
    };
    const bounds = (subMap: Map<string, { x: number; y: number; z: number }>) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity;
      subMap.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
      });
      return Number.isFinite(minX) ? { minX, maxX, minY } : { minX: 0, maxX: 0, minY: 0 };
    };

    const treeBounds = trees.map(bounds);
    const totalWidth = treeBounds.reduce((sum, b) => sum + (b.maxX - b.minX), 0) + GAP_X * Math.max(0, trees.length - 1);
    let cursor = -totalWidth / 2;
    let bottom = TOP_Y;
    let left = Infinity;
    trees.forEach((subMap, i) => {
      const b = treeBounds[i];
      const dx = cursor - b.minX;
      place(subMap, dx, TOP_Y);
      left = Math.min(left, b.minX + dx);
      bottom = Math.min(bottom, b.minY + TOP_Y);
      cursor += b.maxX - b.minX + GAP_X;
    });
    if (!Number.isFinite(left)) left = 0;

    let rowY = bottom - TREE_LEVEL_SPACING * 1.15;
    for (const subMap of containers) {
      const b = bounds(subMap);
      place(subMap, left + 1.6 - b.minX - 0.9, rowY);
      rowY -= 1.9;
    }
  }

  /**
   * The queues of a program without trees: horizontal rows (front on the
   * left, rear on the right), one under another, all starting at the same x
   * so FRONT stays put while elements join at the rear. On their own they
   * start left of the origin; next to other structures (an array, ...) they
   * go underneath everything already placed.
   */
  private placeQueueRows(
    rows: Map<string, { x: number; y: number; z: number }>[],
    graph: SceneElement[],
    layoutMap: Map<string, { x: number; y: number; z: number }>
  ): void {
    if (rows.length === 0) return;
    const ROW_GAP = 2.4;
    let othersMinX = Infinity;
    let othersMinY = Infinity;
    layoutMap.forEach((pos) => {
      othersMinX = Math.min(othersMinX, pos.x);
      othersMinY = Math.min(othersMinY, pos.y);
    });
    const alone = !Number.isFinite(othersMinX);
    const startX = alone ? -3 : othersMinX + 1.5;
    const firstY = alone ? ((rows.length - 1) * ROW_GAP) / 2 : othersMinY - 3;
    rows.forEach((subMap, i) => {
      subMap.forEach((pos, id) => {
        const placed = { x: pos.x + startX, y: pos.y + firstY - i * ROW_GAP, z: pos.z };
        layoutMap.set(id, placed);
        const el = graph.find(e => e.id === id);
        if (el) el.worldTarget = placed;
      });
    });
  }

  /**
   * The stacks of a program without trees: vertical columns side by side,
   * bottoms on one line. On their own they are centred on the origin; next
   * to other structures (an array being reversed, ...) they stand to the
   * right of everything already placed, so nothing overlaps.
   */
  private placeStackColumns(
    columns: Map<string, { x: number; y: number; z: number }>[],
    graph: SceneElement[],
    layoutMap: Map<string, { x: number; y: number; z: number }>
  ): void {
    const COLUMN_GAP = 4.5;
    const BASE_Y = -2;
    let othersMaxX = -Infinity;
    layoutMap.forEach((pos) => {
      othersMaxX = Math.max(othersMaxX, pos.x);
    });
    const firstX = Number.isFinite(othersMaxX) ? othersMaxX + 4 : -((columns.length - 1) * COLUMN_GAP) / 2;
    columns.forEach((subMap, i) => {
      subMap.forEach((pos, id) => {
        const placed = { x: pos.x + firstX + i * COLUMN_GAP, y: pos.y + BASE_Y, z: pos.z };
        layoutMap.set(id, placed);
        const el = graph.find(e => e.id === id);
        if (el) el.worldTarget = placed;
      });
    });
  }

  public applyLayoutInstantly(map: Map<string, { x: number; y: number; z: number }>, graph: SceneElement[] = this.sceneManager.getSceneGraph()): void {
    graph.forEach(el => {
      const pos = map.get(el.id);
      if (pos) {
        el.position.x = pos.x;
        el.position.y = pos.y;
        el.position.z = pos.z;
      }
    });
  }

  // Maintaining this for backward compatibility or direct positional queries
  public getPositionForLogicalIndex(index: number, logicalParent?: string): { x: number; y: number; z: number } {
    // Ideally this would query the strategy, but for a simple array layout we can mock it
    // Or we could build a dummy element and pass it through the strategy.
    // For now, keeping the old hardcoded logic as fallback, but centered.
    return { x: index * 1.5, y: 0, z: 0 };
  }
}
