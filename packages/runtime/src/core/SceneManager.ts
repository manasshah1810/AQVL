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
      if (obj.type === 'ARRAY_ELEMENT') {
        const el: BoxElement = {
          id: obj.id, // e.g. obj_001
          type: 'box',
          value: obj.value,
          index: obj.logicalIndex || 0,
          logicalIndex: obj.logicalIndex,
          label: `${obj.logicalParent}[${obj.logicalIndex}]`,
          position: { x: 0, y: 0, z: 0 }, // LayoutManager handles this
          scale: { x: 1, y: 1, z: 1 },
          color: '#4facfe',
          emissiveIntensity: 0,
          emissiveColor: '#000000',
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
}
