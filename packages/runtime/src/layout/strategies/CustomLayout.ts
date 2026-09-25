import type { LayoutCalculator, LayoutElementInput, Position3D, PositionMap } from '../LayoutEngine';
import { parseOrigin } from '../LayoutEngine';

export class CustomLayoutInvalidReferenceError extends Error {
  constructor(elementId: string, known: string[]) {
    super(
      `CUSTOM layout params reference unknown element "${elementId}". ` +
        `Elements in this structure: ${known.length > 0 ? known.join(', ') : '(none)'}.`
    );
    this.name = 'CustomLayoutInvalidReferenceError';
  }
}

function parseCoord(raw: unknown, fallback: Position3D): Position3D {
  if (Array.isArray(raw) && raw.length === 3) {
    return {
      x: typeof raw[0] === 'number' ? raw[0] : fallback.x,
      y: typeof raw[1] === 'number' ? raw[1] : fallback.y,
      z: typeof raw[2] === 'number' ? raw[2] : fallback.z,
    };
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<Position3D>;
    return {
      x: typeof r.x === 'number' ? r.x : fallback.x,
      y: typeof r.y === 'number' ? r.y : fallback.y,
      z: typeof r.z === 'number' ? r.z : fallback.z,
    };
  }
  return fallback;
}

/**
 * CUSTOM layout strategy (docs/design/spatial-syntax-spec.md §1, "CUSTOM"):
 * disables automatic placement — every element's coordinates come from
 * `params.positions[elementId]` (a `[x, y, z]` tuple or `{x,y,z}` object),
 * passed through unchanged.
 *
 * An element with no entry in `params.positions` falls back to `origin`
 * (default world origin) rather than failing the whole layout pass, per
 * spec §1 ("compile-time warning, not an error — the element still renders
 * at (0,0,0)"); a `positions` entry that names an id outside the given
 * element set is a genuine authoring error and throws
 * `CustomLayoutInvalidReferenceError`.
 */
export class CustomLayout implements LayoutCalculator {
  compute(elements: LayoutElementInput[], params: Record<string, any>): PositionMap {
    const positions: PositionMap = new Map();
    const origin = parseOrigin(params.origin);
    const explicit: Record<string, unknown> = (params.positions as Record<string, unknown>) ?? {};

    const knownIdList = elements.map((el) => el.id);
    const knownIds = new Set(knownIdList);
    for (const id of Object.keys(explicit)) {
      if (!knownIds.has(id)) {
        throw new CustomLayoutInvalidReferenceError(id, knownIdList);
      }
    }

    for (const el of elements) {
      if (Object.prototype.hasOwnProperty.call(explicit, el.id)) {
        positions.set(el.id, parseCoord(explicit[el.id], origin));
      } else {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `CUSTOM layout: element "${el.id}" has no explicit position — rendering at origin (${origin.x}, ${origin.y}, ${origin.z}).`
          );
        }
        positions.set(el.id, { ...origin });
      }
    }

    return positions;
  }
}
