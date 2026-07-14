import { SceneElement, BoxElement } from '../../models/SceneElement';
import { LayoutStrategy } from './LayoutStrategy';
import { RelationshipManager } from '../RelationshipManager';

export interface GraphLayoutOptions {
  iterations?: number;
  repulsion?: number;
  springLength?: number;
  springTension?: number;
  gravity?: number;
}

export class GraphLayoutStrategy implements LayoutStrategy {
  private iterations: number;
  private repulsion: number;
  private springLength: number;
  private springTension: number;
  private gravity: number;

  constructor(options?: GraphLayoutOptions) {
    this.iterations = options?.iterations || 100;
    this.repulsion = options?.repulsion || 5.0;
    this.springLength = options?.springLength || 2.0;
    this.springTension = options?.springTension || 0.1;
    this.gravity = options?.gravity || 0.05;
  }

  public applyLayout(elements: SceneElement[], relationshipManager: RelationshipManager): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    const nodes = elements.filter((el): el is BoxElement => el.type === 'box');
    const edges = relationshipManager.getEdges();

    if (nodes.length === 0) return map;

    // Initialize positions randomly in a small circle to avoid singularity
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = 2.0;
      map.set(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: 0
      });
    });

    const velocities = new Map<string, { x: number, y: number }>();
    nodes.forEach(node => velocities.set(node.id, { x: 0, y: 0 }));

    // Run force-directed simulation loop
    let temperature = 1.0;
    
    for (let iter = 0; iter < this.iterations; iter++) {
      const forces = new Map<string, { dx: number, dy: number }>();
      nodes.forEach(n => forces.set(n.id, { dx: 0, dy: 0 }));

      // Repulsion between all pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          
          const pos1 = map.get(n1.id)!;
          const pos2 = map.get(n2.id)!;
          let dx = pos1.x - pos2.x;
          let dy = pos1.y - pos2.y;
          let distSq = dx * dx + dy * dy;
          
          if (distSq === 0) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            distSq = dx * dx + dy * dy;
          }
          
          const dist = Math.sqrt(distSq);
          // Coulomb repulsion
          const force = this.repulsion / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          forces.get(n1.id)!.dx += fx;
          forces.get(n1.id)!.dy += fy;
          forces.get(n2.id)!.dx -= fx;
          forces.get(n2.id)!.dy -= fy;
        }
      }

      // Spring attraction along edges
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.sourceId);
        const target = nodes.find(n => n.id === edge.targetId);
        if (source && target) {
          const posSource = map.get(source.id)!;
          const posTarget = map.get(target.id)!;
          const dx = posTarget.x - posSource.x;
          const dy = posTarget.y - posSource.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0) {
            // Hooke's law attraction
            const force = this.springTension * (dist - this.springLength);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            forces.get(source.id)!.dx += fx;
            forces.get(source.id)!.dy += fy;
            forces.get(target.id)!.dx -= fx;
            forces.get(target.id)!.dy -= fy;
          }
        }
      });

      // Gravity and Application
      nodes.forEach(node => {
        const f = forces.get(node.id)!;
        const pos = map.get(node.id)!;
        
        // Gravity pulls towards center (0,0)
        f.dx -= pos.x * this.gravity;
        f.dy -= pos.y * this.gravity;

        // Apply forces to position with temperature cooling
        pos.x += f.dx * temperature;
        pos.y += f.dy * temperature;
      });

      // Cool down
      temperature *= 0.95;
    }

    return map;
  }
}
