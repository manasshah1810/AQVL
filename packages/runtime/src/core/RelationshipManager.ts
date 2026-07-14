import { EventDispatcher } from './EventDispatcher';

export interface RelationshipEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  directed: boolean;
  relationType?: string;
}

export class RelationshipManager {
  private edges: Map<string, RelationshipEdge> = new Map();

  constructor(private eventDispatcher: EventDispatcher) {}

  public addRelationship(edge: RelationshipEdge): void {
    this.edges.set(edge.id, edge);
    this.eventDispatcher.dispatch('RELATIONSHIP_ADDED', edge);
  }

  public removeRelationship(id: string): void {
    const edge = this.edges.get(id);
    if (edge) {
      this.edges.delete(id);
      this.eventDispatcher.dispatch('RELATIONSHIP_REMOVED', edge);
    }
  }

  public getEdges(): RelationshipEdge[] {
    return Array.from(this.edges.values());
  }

  public getEdgesForNode(nodeId: string): RelationshipEdge[] {
    return this.getEdges().filter(e => e.sourceId === nodeId || e.targetId === nodeId);
  }

  public getChildren(parentId: string): string[] {
    return this.getEdges()
      .filter(e => e.sourceId === parentId && e.directed)
      .map(e => e.targetId);
  }

  public clear(): void {
    this.edges.clear();
    this.eventDispatcher.dispatch('RELATIONSHIPS_CLEARED', null);
  }

  public loadFromScene(elements: any[]): void {
    this.clear();
    elements.forEach(el => {
      if (el.type === 'edge') {
        this.edges.set(el.id, {
          id: el.id,
          sourceId: el.sourceId,
          targetId: el.targetId,
          type: el.type,
          directed: el.directed,
          relationType: el.relationType
        });
      }
    });
  }
}
