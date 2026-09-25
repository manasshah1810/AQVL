import type { LayoutCalculator, LayoutElementInput, PositionMap } from '../LayoutEngine';
import { parseOrigin } from '../LayoutEngine';

/**
 * GRID layout strategy (docs/design/aqir-geometry-spec.md §1.1): elements
 * arranged in a row/column grid in the X-Z plane (§3 — GRID lays out in
 * X-Z at a fixed Y), centered on `origin`.
 *
 * Params: rows? (number), columns? (number), cellSpacing (number, default 1),
 * origin ([x,y,z], default [0,0,0]).
 *
 * - Only one of rows/columns given -> the other is computed from element count.
 * - Neither given -> a roughly-square grid (columns = ceil(sqrt(n))).
 */
export class GridLayout implements LayoutCalculator {
  compute(elements: LayoutElementInput[], params: Record<string, any>): PositionMap {
    const positions: PositionMap = new Map();
    const n = elements.length;
    if (n === 0) return positions;

    const spacing = typeof params.cellSpacing === 'number' ? params.cellSpacing : 1;
    const origin = parseOrigin(params.origin);

    let columns = typeof params.columns === 'number' && params.columns > 0 ? params.columns : undefined;
    let rows = typeof params.rows === 'number' && params.rows > 0 ? params.rows : undefined;

    if (columns === undefined && rows === undefined) {
      columns = Math.ceil(Math.sqrt(n));
      rows = Math.ceil(n / columns);
    } else if (columns === undefined) {
      columns = Math.ceil(n / rows!);
    } else if (rows === undefined) {
      rows = Math.ceil(n / columns);
    }

    const finalColumns = columns!;
    const finalRows = rows!;
    const colCenter = (finalColumns - 1) / 2;
    const rowCenter = (finalRows - 1) / 2;

    const ordered = [...elements].sort((a, b) => a.logicalIndex - b.logicalIndex);
    ordered.forEach((el, i) => {
      const row = Math.floor(i / finalColumns);
      const col = i % finalColumns;
      positions.set(el.id, {
        x: origin.x + (col - colCenter) * spacing,
        y: origin.y,
        z: origin.z + (row - rowCenter) * spacing,
      });
    });

    return positions;
  }
}
