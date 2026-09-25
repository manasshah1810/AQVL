/**
 * Unit tests for the CUSTOM layout strategy calculator (Phase 3.3 — see
 * docs/design/spatial-syntax-spec.md §1 "CUSTOM"). Pure math, no VM/compiler
 * involved.
 */
import { describe, expect, it, vi } from 'vitest';
import { CustomLayout, CustomLayoutInvalidReferenceError } from '../../packages/runtime/src/layout/strategies/CustomLayout';
import type { LayoutElementInput } from '../../packages/runtime/src/layout/LayoutEngine';

function elements(ids: string[]): LayoutElementInput[] {
  return ids.map((id, i) => ({ id, logicalIndex: i }));
}

describe('CustomLayout', () => {
  const strategy = new CustomLayout();

  it('explicit coords for all elements -> exact positions returned, unchanged', () => {
    const positions = strategy.compute(elements(['a', 'b', 'c']), {
      positions: {
        a: [-3, 0, 0],
        b: [0, 2, 0],
        c: [3, 0, 0],
      },
    });
    expect(positions.get('a')).toEqual({ x: -3, y: 0, z: 0 });
    expect(positions.get('b')).toEqual({ x: 0, y: 2, z: 0 });
    expect(positions.get('c')).toEqual({ x: 3, y: 0, z: 0 });
  });

  it('accepts {x,y,z} object coordinates in addition to [x,y,z] tuples', () => {
    const positions = strategy.compute(elements(['a']), {
      positions: { a: { x: 1, y: 2, z: 3 } },
    });
    expect(positions.get('a')).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('invalid element reference -> throws a clear error', () => {
    expect(() =>
      strategy.compute(elements(['a', 'b']), {
        positions: { a: [0, 0, 0], ghost: [1, 1, 1] },
      })
    ).toThrow(CustomLayoutInvalidReferenceError);

    expect(() =>
      strategy.compute(elements(['a', 'b']), {
        positions: { ghost: [1, 1, 1] },
      })
    ).toThrow(/ghost/);
  });

  it('partial specification -> unspecified elements fall back to origin, specified ones pass through unchanged', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const positions = strategy.compute(elements(['a', 'b']), {
      positions: { a: [5, 5, 5] },
    });
    expect(positions.get('a')).toEqual({ x: 5, y: 5, z: 5 });
    expect(positions.get('b')).toEqual({ x: 0, y: 0, z: 0 });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('partial specification with a non-zero origin -> fallback uses that origin', () => {
    const positions = strategy.compute(elements(['a', 'b']), {
      positions: { a: [5, 5, 5] },
      origin: [1, 2, 3],
    });
    expect(positions.get('b')).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('no positions param at all -> every element falls back to origin', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const positions = strategy.compute(elements(['a', 'b', 'c']), {});
    expect(positions.size).toBe(3);
    [...positions.values()].forEach((p) => expect(p).toEqual({ x: 0, y: 0, z: 0 }));
    warnSpy.mockRestore();
  });

  it('0 elements -> empty map, no crash', () => {
    const positions = strategy.compute(elements([]), { positions: {} });
    expect(positions.size).toBe(0);
  });
});
