import type { AQIRObject } from '@aqvl/shared';
import { SceneElement, BoxElement } from '../models/SceneElement';
import { EventDispatcher } from './EventDispatcher';

export class SceneManager {
  private elements: Map<string, SceneElement> = new Map();
  private sceneGraph: SceneElement[] = [];

  constructor(private eventDispatcher: EventDispatcher) {}

  public loadScene(objects: AQIRObject[]): void {
    this.elements.clear();
    this.sceneGraph = [];

    // Bootstrap visual elements strictly from the compiler's Object payload
    objects.forEach((obj) => {
      if (obj.type === 'ARRAY_ELEMENT' || obj.type === 'TREE_NODE' || obj.type === 'NODE' || obj.type === 'VERTEX' || obj.type === 'MATRIX_ELEMENT' || obj.type === 'GRID_ELEMENT' || obj.type === 'sphere' || obj.type === 'TREE' || obj.type === 'BINARY_TREE') {
        const el: any = {
          id: obj.id, // e.g. obj_001
          type: obj.type === 'sphere' ? 'sphere' : 'box',
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
          color: obj.color || '#4facfe',
          emissiveIntensity: 0,
          emissiveColor: '#000000',
          lifecycleState: 'ACTIVE',
          visible: true,
          opacity: 1,
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
          color: '#888888',
          emissiveIntensity: 0,
          emissiveColor: '#000000',
          lifecycleState: 'ACTIVE',
          visible: true,
          opacity: 1,
          backward: obj.properties?.backward,
          circular: obj.properties?.circular,
          forward: obj.properties?.forward,
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
