import type { AQIRObject } from '@aqvl/shared';
import { getSemanticColorToken } from '@aqvl/shared';
import { SceneElement, BoxElement } from '../models/SceneElement';
import { EventDispatcher } from './EventDispatcher';

export class SceneManager {
  private elements: Map<string, SceneElement> = new Map();
  private sceneGraph: SceneElement[] = [];

  constructor(private eventDispatcher: EventDispatcher) {}

  public loadScene(objects: AQIRObject[]): void {
    this.elements.clear();
    this.sceneGraph = [];

    const neutralToken = getSemanticColorToken('NEUTRAL');

    // Bootstrap visual elements strictly from the compiler's Object payload
    objects.forEach((obj) => {
      if (obj.type === 'ARRAY_ELEMENT' || obj.type === 'TREE_NODE' || obj.type === 'NODE' || obj.type === 'VERTEX' || obj.type === 'MATRIX_ELEMENT' || obj.type === 'GRID_ELEMENT' || obj.type === 'sphere' || obj.type === 'TREE' || obj.type === 'BINARY_TREE' || obj.type === 'BST' || obj.type === 'STACK_ELEMENT' || obj.type === 'QUEUE_ELEMENT' || obj.type === 'HEAP_NODE' || obj.type === 'HEAP_ARRAY_ELEMENT') {
        const el: any = {
          id: obj.id, // e.g. obj_001
          type: obj.type === 'sphere' ? 'sphere' : (['TREE', 'BINARY_TREE', 'BST'].includes(obj.type) ? obj.type : 'box'),
          value: obj.value,
          index: obj.logicalIndex || 0,
          logicalIndex: obj.logicalIndex,
          logicalParent: obj.logicalParent,
          originalType: obj.originalType || obj.type,
          row: obj.properties?.row,
          col: obj.properties?.col,
          columns: obj.properties?.columns,
          label: obj.label || (obj.logicalParent ? `${obj.logicalParent}[${obj.logicalIndex || 0}]` : obj.id),
          position: { x: 0, y: 0, z: 0 }, // LayoutManager handles this
          scale: { x: 1, y: 1, z: 1 },
          state: 'NEUTRAL',
          color: obj.color || neutralToken.color,
          emissiveIntensity: neutralToken.emissiveIntensity,
          emissiveColor: neutralToken.emissiveColor,
          lifecycleState: 'ACTIVE',
          visible: true,
          opacity: 1,
        };
        if (obj.originalType === 'LINKEDLIST_NODE') {
          // Linked-list nodes: `slot` orders them along the list's row, `inList`
          // is false while a node sits in the heap-memory area (see LinkedListEngine).
          el.label = '';
          el.slot = obj.properties?.slot ?? 0;
          el.inList = true;
          el.pointerVars = [];
          el.tags = [];
        }
        if (obj.originalType === 'TREE_NODE' && /^bt:/.test(obj.id)) {
          // Pointer-tree nodes (see TreeEngine): the value is drawn on the
          // sphere; tags (ROOT, pointer variables) and layout come from the engine.
          el.label = '';
          el.inTree = true;
          el.tags = [];
        }
        this.elements.set(el.id, el);
        this.sceneGraph.push(el);
      } else if (obj.type === 'BINARYTREE' || obj.type === 'CONTAINER') {
        // A pointer tree's anchor (root pointer + kind) or a tree program's
        // queue / stack anchor (kind): not drawn as a node.
        const el: any = {
          id: obj.id,
          type: obj.type,
          originalType: obj.type,
          logicalParent: obj.logicalParent,
          label: obj.label,
          kind: obj.properties?.kind,
          rootId: obj.properties?.rootId ?? null,
          nextNodeNumber: obj.properties?.nextNodeNumber ?? 0,
          nextItemNumber: obj.properties?.nextItemNumber ?? 0,
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          color: '',
          emissiveIntensity: 0,
          emissiveColor: '',
          visible: false,
        };
        this.elements.set(el.id, el);
        this.sceneGraph.push(el);
      } else if (obj.type === 'CONTAINER_ITEM') {
        const token = getSemanticColorToken('STRUCTURAL');
        const el: any = {
          id: obj.id,
          type: 'box',
          originalType: 'CONTAINER_ITEM',
          logicalParent: obj.logicalParent,
          value: obj.value,
          ref: null,
          order: obj.properties?.order ?? 0,
          label: '',
          tags: [],
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          state: 'NEUTRAL',
          color: token.color,
          emissiveIntensity: token.emissiveIntensity,
          emissiveColor: token.emissiveColor,
          lifecycleState: 'ACTIVE',
          visible: true,
          opacity: 1,
        };
        this.elements.set(el.id, el);
        this.sceneGraph.push(el);
      } else if (obj.type === 'LINKEDLIST') {
        // A linked list's anchor: not drawn, holds the head pointer + variant.
        const el: any = {
          id: obj.id,
          type: 'LINKEDLIST',
          originalType: 'LINKEDLIST',
          logicalParent: obj.logicalParent,
          label: obj.label,
          variant: obj.properties?.variant ?? 'SINGLY',
          headId: obj.properties?.headId ?? null,
          nextNodeNumber: obj.properties?.nextNodeNumber ?? 0,
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          color: '',
          emissiveIntensity: 0,
          emissiveColor: '',
          visible: false,
        };
        this.elements.set(el.id, el);
        this.sceneGraph.push(el);
      } else if (obj.type === 'EDGE' || obj.type === 'GRAPH_EDGE') {
        const sourceId = obj.properties?.sourceId || (obj.args && obj.args[0]) || '';
        const targetId = obj.properties?.targetId || (obj.args && obj.args[1]) || '';
        const directed = obj.properties?.directed ?? true;
        
        const el: any = { // Use any or cast to EdgeElement
          id: obj.id,
          type: 'edge',
          sourceId,
          targetId,
          directed,
          logicalParent: obj.logicalParent,
          originalType: obj.type,
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          state: 'NEUTRAL',
          color: neutralToken.color,
          emissiveIntensity: neutralToken.emissiveIntensity,
          emissiveColor: neutralToken.emissiveColor,
          lifecycleState: 'ACTIVE',
          visible: true,
          opacity: 1,
          backward: obj.properties?.backward,
          circular: obj.properties?.circular,
          forward: obj.properties?.forward,
          pointer: obj.properties?.pointer,
          // e.g. a tree edge's { label: 'L' | 'R' }, read by the tree algorithms.
          properties: obj.properties,
        };
        this.elements.set(el.id, el);
        this.sceneGraph.push(el);
      }
    });

    this.eventDispatcher.dispatch('SCENE_LOADED', this.sceneGraph);
  }

  public getElement(id: string): SceneElement | undefined {
    return this.elements.get(id);
  }

  public getSceneGraph(): SceneElement[] {
    return this.sceneGraph;
  }

  public addElement(element: SceneElement): void {
    if (!this.elements.has(element.id)) {
      this.elements.set(element.id, element);
      this.sceneGraph.push(element);
    }
  }

  public removeElement(id: string): void {
    if (this.elements.has(id)) {
      this.elements.delete(id);
      this.sceneGraph = this.sceneGraph.filter(el => el.id !== id);
    }
  }
}
