import type { LayoutCalculator, LayoutElementInput, PositionMap } from '../LayoutEngine';
import { parseOrigin } from '../LayoutEngine';

export type LineAxis = 'horizontal' | 'vertical' | 'diagonal';

/**
 * LINE layout strategy (docs/design/aqir-geometry-spec.md §1.1): n elements
 * spread evenly along one axis, spacing apart, centered on `origin`.
 *
 * Params: spacing (number, default 1), axis ('horizontal'|'vertical'|'diagonal',
 * default 'horizontal'), origin ([x,y,z], default [0,0,0]).
 */
export class LineLayout implements LayoutCalculator {
  compute(elements: LayoutElementInput[], params: Record<string, any>): PositionMap {
    const positions: PositionMap = new Map();
    if (elements.length === 0) return positions;

    const spacing = typeof params.spacing === 'number' ? params.spacing : 1;
    const axis: LineAxis = params.axis === 'vertical' || params.axis === 'diagonal' ? params.axis : 'horizontal';
    const origin = parseOrigin(params.origin);

    const ordered = [...elements].sort((a, b) => a.logicalIndex - b.logicalIndex);
    const center = (ordered.length - 1) / 2;

    ordered.forEach((el, i) => {
      // 1 element -> i === center === 0 -> offset 0 -> sits exactly at origin.
      const offset = spacing * (i - center);
      let x = origin.x;
      let y = origin.y;
      const z = origin.z;

      if (axis === 'horizontal') {
        x += offset;
      } else if (axis === 'vertical') {
        y += offset;
      } else {
        // diagonal: equal parts along X and Y so the line runs at 45 degrees.
        const component = offset * Math.SQRT1_2;
        x += component;
        y += component;
      }

      positions.set(el.id, { x, y, z });
    });

    return positions;
  }
}
