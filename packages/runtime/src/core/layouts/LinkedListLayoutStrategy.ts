import { SceneElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface LinkedListLayoutOptions {
  spacing?: number;
  startX?: number;
  startY?: number;
}

export class LinkedListLayoutStrategy implements LayoutStrategy {
  private spacing: number;
  private startX: number;
  private startY: number;

  constructor(options?: LinkedListLayoutOptions) {
    this.spacing = options?.spacing || 2.5; // wider spacing for arrows
    this.startX = options?.startX || 0;
    this.startY = options?.startY || 0;
  }

  public applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    
    const headNode = elements.find(el => el.originalType === 'HEAD');
    if (!headNode) return map;

    const edges = elements.filter(el => el.type === 'edge');
    
    // Build a map of source -> target
    const adjacency = new Map<string, string>();
    edges.forEach(e => {
      adjacency.set((e as any).sourceId, (e as any).targetId);
    });

    const orderedNodes: SceneElement[] = [];
    let currentId: string | undefined = headNode.id;
    
    // Guard against infinite loops in case of circular lists, though we don't support them yet
    const visited = new Set<string>();
    
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = elements.find(el => el.id === currentId);
      if (node) orderedNodes.push(node);
      currentId = adjacency.get(currentId);
    }

    const totalLength = (orderedNodes.length - 1) * this.spacing;

    orderedNodes.forEach((node, idx) => {
      const x = this.startX - totalLength / 2 + idx * this.spacing;
      const y = this.startY;
      
      map.set(node.id, { x, y, z: 0 });
    });

    return map;
  }
}
