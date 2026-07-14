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

import { RelationshipManager } from './RelationshipManager';

export class LayoutManager {
  private strategies: Map<string, LayoutStrategy> = new Map();
  private defaultStrategy: LayoutStrategy = new ArrayLayoutStrategy();

  private graphStrategy: LayoutStrategy = new GraphLayoutStrategy();
  private gridStrategy: LayoutStrategy = new GridLayoutStrategy();
  private linkedListStrategy: LayoutStrategy = new LinkedListLayoutStrategy();
  private stackStrategy: LayoutStrategy = new StackLayoutStrategy();
  private queueStrategy: LayoutStrategy = new QueueLayoutStrategy();
  private treeStrategy: LayoutStrategy;
  private arrayHeapStrategy: LayoutStrategy;

  private reservedSlots: Map<string, Set<number | string>> = new Map();

  constructor(private sceneManager: SceneManager, private relationshipManager: RelationshipManager) {
    this.treeStrategy = new TreeLayoutStrategy({ startY: 4 });
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
      if (!strategy) {
        // Infer strategy based on elements
        const hasGraphElements = elements.some(el => el.originalType === 'VERTEX' || el.originalType === 'GRAPH_EDGE' || el.originalType === 'GRAPH');
        const hasEdges = elements.some(el => el.type === 'edge');
        const isGrid = elements.some(el => el.originalType === 'MATRIX' || el.originalType === 'GRID' || (el as any).columns !== undefined || ((el as any).row !== undefined && (el as any).col !== undefined));
        const isLinkedList = elements.some(el => el.originalType === 'LINKEDLIST_NODE');
        const isStack = elements.some(el => el.originalType === 'STACK_ELEMENT');
        const isQueue = elements.some(el => el.originalType === 'QUEUE_ELEMENT');
        const isTree = elements.some(el => el.originalType === 'TREE_NODE' || el.originalType === 'TRIE_NODE');
        const isHeapNode = elements.some(el => el.originalType === 'HEAP_NODE');
        const isHeapArray = elements.some(el => el.originalType === 'HEAP_ARRAY_ELEMENT');
        
        if (isHeapNode) {
          strategy = this.treeStrategy;
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
      subMap.forEach((pos, id) => {
        if (!id.startsWith('__virtual_')) {
          layoutMap.set(id, pos);
          // Also set worldTarget on the actual element in graph
          const el = graph.find(e => e.id === id);
          if (el) el.worldTarget = pos;
        }
      });
    }

    // Apply default strategy for unparented elements if needed, 
    // or leave them as they are for now.
    if (unparentedElements.length > 0) {
      const subMap = this.defaultStrategy.applyLayout(unparentedElements, this.relationshipManager);
      subMap.forEach((pos, id) => layoutMap.set(id, pos));
    }

    return layoutMap;
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
