import type { LayoutCalculator, LayoutElementInput, PositionMap } from '../LayoutEngine';
import { parseOrigin } from '../LayoutEngine';

/**
 * CIRCULAR layout strategy (docs/design/aqir-geometry-spec.md §1.1): n
 * elements distributed evenly around a ring in the X-Z plane (§3 — CIRCULAR
 * lays out in X-Z at a fixed Y), centered on `origin`.
 *
 * Params: radius (number, default 3), startAngle (degrees, default 0),
 * origin ([x,y,z], default [0,0,0]).
 */
export class CircularLayout implements LayoutCalculator {
  compute(elements: LayoutElementInput[], params: Record<string, any>): PositionMap {
    const positions: PositionMap = new Map();
    const n = elements.length;
    if (n === 0) return positions;

    const radius = typeof params.radius === 'number' ? params.radius : 3;
    const startAngleDeg = typeof params.startAngle === 'number' ? params.startAngle : 0;
    const origin = parseOrigin(params.origin);

    const ordered = [...elements].sort((a, b) => a.logicalIndex - b.logicalIndex);
    const angleStepDeg = 360 / n;

    ordered.forEach((el, i) => {
      const angleRad = ((startAngleDeg + i * angleStepDeg) * Math.PI) / 180;
      positions.set(el.id, {
        x: origin.x + radius * Math.cos(angleRad),
        y: origin.y,
        z: origin.z + radius * Math.sin(angleRad),
      });
    });

    return positions;
  }
}
