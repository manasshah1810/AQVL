import type { LayoutCalculator, LayoutElementInput, LayoutEdgeInput, PositionMap } from '../LayoutEngine';
import { parseOrigin } from '../LayoutEngine';

/**
 * FORCE_DIRECTED layout strategy (docs/design/spatial-syntax-spec.md §1,
 * "FORCE_DIRECTED"): a Fruchterman-Reingold-style physics simulation in the
 * X-Z plane (fixed Y, matching GRID/CIRCULAR), centered on `origin`.
 *
 * Every pair of elements repels (Coulomb's law, inverse-square), every edge
 * pulls its two endpoints toward `springLength` apart (Hooke's law), and a
 * linearly-decreasing "temperature" caps how far a node can move per
 * iteration so the simulation settles instead of oscillating forever.
 *
 * Params: repulsion (number, default 5), attraction (number, default 0.1),
 * springLength (number, default 2), iterations (integer, default 100),
 * origin ([x,y,z], default [0,0,0]).
 *
 * Deliberately diverges from its core/layouts/GraphLayoutStrategy.ts
 * counterpart (same physics model, used for live SceneElement graphs): no
 * Math.random() anywhere (coincident nodes are nudged deterministically by
 * index instead), no gravity-to-center term, and linear cooling instead of
 * exponential — chosen so runs are reproducible. If you retune the force
 * constants here, check whether GraphLayoutStrategy should follow.
 */
interface Vec2 {
  x: number;
  z: number;
}

const MIN_DISTANCE = 0.01;

export class ForceDirectedLayout implements LayoutCalculator {
  compute(elements: LayoutElementInput[], params: Record<string, any>, edges?: LayoutEdgeInput[]): PositionMap {
    const positions: PositionMap = new Map();
    const n = elements.length;
    if (n === 0) return positions;

    const origin = parseOrigin(params.origin);

    if (n === 1) {
      positions.set(elements[0].id, { x: origin.x, y: origin.y, z: origin.z });
      return positions;
    }

    const repulsion = typeof params.repulsion === 'number' ? params.repulsion : 5;
    const attraction = typeof params.attraction === 'number' ? params.attraction : 0.1;
    const springLength = typeof params.springLength === 'number' ? params.springLength : 2;
    const iterations =
      typeof params.iterations === 'number' && params.iterations > 0 ? Math.floor(params.iterations) : 100;

    const ordered = [...elements].sort((a, b) => a.logicalIndex - b.logicalIndex);
    const idSet = new Set(ordered.map((el) => el.id));

    const edgeList = (edges ?? []).filter(
      (e) => e.sourceId !== e.targetId && idSet.has(e.sourceId) && idSet.has(e.targetId)
    );

    // Deterministic initial placement on a circle: guarantees every node
    // starts at a distinct point (no zero-distance repulsion at step 0)
    // without relying on Math.random(), so runs are reproducible.
    const pos = new Map<string, Vec2>();
    const initRadius = Math.max(1, Math.sqrt(n));
    ordered.forEach((el, i) => {
      const angle = (2 * Math.PI * i) / n;
      pos.set(el.id, { x: initRadius * Math.cos(angle), z: initRadius * Math.sin(angle) });
    });

    for (let iter = 0; iter < iterations; iter++) {
      const disp = new Map<string, Vec2>();
      ordered.forEach((el) => disp.set(el.id, { x: 0, z: 0 }));

      // Repulsion: every pair pushes apart, force inversely proportional to distance^2.
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          const a = ordered[i].id;
          const b = ordered[j].id;
          const pa = pos.get(a)!;
          const pb = pos.get(b)!;
          let dx = pa.x - pb.x;
          let dz = pa.z - pb.z;
          let dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < MIN_DISTANCE) {
            // Coincident (or near-coincident) nodes: nudge apart deterministically
            // rather than dividing by ~0.
            dx = (i - j) * MIN_DISTANCE || MIN_DISTANCE;
            dz = MIN_DISTANCE;
            dist = Math.sqrt(dx * dx + dz * dz);
          }
          const force = repulsion / (dist * dist);
          const ux = dx / dist;
          const uz = dz / dist;
          const da = disp.get(a)!;
          const db = disp.get(b)!;
          da.x += ux * force;
          da.z += uz * force;
          db.x -= ux * force;
          db.z -= uz * force;
        }
      }

      // Attraction: connected pairs pulled toward `springLength` apart.
      edgeList.forEach((e) => {
        const pa = pos.get(e.sourceId)!;
        const pb = pos.get(e.targetId)!;
        const dx = pb.x - pa.x;
        const dz = pb.z - pa.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || MIN_DISTANCE;
        const force = attraction * (dist - springLength);
        const ux = dx / dist;
        const uz = dz / dist;
        const da = disp.get(e.sourceId)!;
        const db = disp.get(e.targetId)!;
        da.x += ux * force;
        da.z += uz * force;
        db.x -= ux * force;
        db.z -= uz * force;
      });

      // Cooling schedule: max displacement per iteration shrinks linearly so the
      // simulation settles instead of oscillating.
      const temperature = Math.max(0.01, 1 - iter / iterations);
      ordered.forEach((el) => {
        const d = disp.get(el.id)!;
        const dlen = Math.sqrt(d.x * d.x + d.z * d.z) || MIN_DISTANCE;
        const capped = Math.min(dlen, temperature);
        const p = pos.get(el.id)!;
        p.x += (d.x / dlen) * capped;
        p.z += (d.z / dlen) * capped;
      });
    }

    ordered.forEach((el) => {
      const p = pos.get(el.id)!;
      positions.set(el.id, { x: origin.x + p.x, y: origin.y, z: origin.z + p.z });
    });

    return positions;
  }
}
