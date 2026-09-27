import { describe, it, expect, vi } from 'vitest';
import { IterationDirector, type IterationEngineSource } from './IterationDirector';
import { parseSourceStructure } from './sourceStructure';

const NESTED = `SCENE Nested
DECLARE
  ARRAY a = [5, 3, 8]
SEQUENCE
  total = 0
  LOOP i FROM 0 TO 2
    LOOP j FROM 0 TO 1
      HIGHLIGHT a[j]
    END
    total = total + a[i]
    IF a[i] >= 5
      HIGHLIGHT a[i] 'SUCCESS'
    END
  END
END`;

const BINARY = `SCENE B
DECLARE
  ARRAY p = [1, 2, 3, 4, 5]
  FUNCTION find(target)
    low = 0
    high = 4
    WHILE low <= high
      mid = 2
      HIGHLIGHT p[mid] 'MARKED'
      low = mid + 1
    END
  END
SEQUENCE
  find(5)
END`;

function fakeEngine(lines: number[]) {
  const handlers = new Map<string, ((p: any) => void)[]>();
  let vars: Record<string, unknown> = {};
  const engine: IterationEngineSource = {
    eventDispatcher: {
      on: (e, h) => handlers.set(e, [...(handlers.get(e) ?? []), h]),
      off: (e, h) => handlers.set(e, (handlers.get(e) ?? []).filter((x) => x !== h)),
    },
    getProgramInstructions: () => lines.map((lineNumber) => ({ lineNumber })),
    getVisibleVariables: () => vars,
  };
  const emit = (e: string, p?: unknown) => (handlers.get(e) ?? []).forEach((h) => h(p));
  return {
    engine,
    /** Runs the instruction on `line` with these variables visible. */
    at(line: number, v: Record<string, unknown>) {
      vars = v;
      emit('INSTRUCTION_START', lines.indexOf(line));
    },
    scene(name: string, values: number[], states: Record<number, string> = {}) {
      const elements = new Map(
        values.map((value, i) => [
          `${name}_${i}`,
          { id: `${name}_${i}`, originalType: 'ARRAY_ELEMENT', logicalParent: name, logicalIndex: i, value, state: states[i] ?? 'NEUTRAL', position: { x: i * 2, y: 0, z: 0 } },
        ])
      );
      emit('STATE_UPDATED', { elements });
    },
  };
}

describe('parseSourceStructure', () => {
  it('reports the loops enclosing each line, outermost first', () => {
    const s = parseSourceStructure(NESTED);
    expect(s.loopsAt(5)).toEqual([]);
    expect(s.loopsAt(8).map((l) => l.variable)).toEqual(['i', 'j']);
    expect(s.loopsAt(10).map((l) => l.variable)).toEqual(['i']);
    expect(s.loopsAt(12).map((l) => l.variable)).toEqual(['i']);
    expect(s.loopsAt(15)).toEqual([]);
  });
});

describe('IterationDirector', () => {
  it('gives nested loops their own cursors by depth, and drops the inner one when its loop ends', () => {
    const f = fakeEngine([5, 6, 7, 8, 10, 11, 12]);
    const d = new IterationDirector(f.engine, NESTED, 'loops');
    f.scene('a', [5, 3, 8]);
    f.at(8, { total: 0, i: 1, j: 0 });
    expect(d.getOverlay().cursors).toEqual([
      { structureId: 'a', index: 1, depth: 0, label: 'i = 1' },
      { structureId: 'a', index: 0, depth: 1, label: 'j = 0' },
    ]);
    f.at(10, { total: 0, i: 1 });
    expect(d.getOverlay().cursors.map((c) => c.depth)).toEqual([0]);
  });

  it('narrates comparisons with live values, accumulators, and passes', () => {
    const f = fakeEngine([5, 6, 7, 8, 10, 11, 12]);
    const say = vi.fn();
    new IterationDirector(f.engine, NESTED, 'loops', { say, clear: vi.fn() });
    f.scene('a', [5, 3, 8]);
    f.at(10, { total: 0, i: 0 });
    f.at(11, { total: 5, i: 0 });
    expect(say).toHaveBeenCalledWith('total: 0 → 5', expect.anything());
    expect(say).toHaveBeenCalledWith('a[i] >= 5  →  5 >= 5 ?', expect.objectContaining({ emotion: 'thinking' }));
    f.at(12, { total: 5, i: 0 });
    f.scene('a', [5, 3, 8], { 0: 'SUCCESS' });
    expect(say).toHaveBeenLastCalledWith('✓ a[0] = 5', expect.objectContaining({ emotion: 'celebrating' }));
  });

  it('shows the binary-search window and reacts to "too low"', () => {
    const f = fakeEngine([5, 6, 7, 8, 9, 10, 14]);
    const say = vi.fn();
    const camera = { registerInstruction: vi.fn() };
    const d = new IterationDirector(f.engine, BINARY, 'searching', { say, clear: vi.fn() }, camera);
    f.scene('p', [1, 2, 3, 4, 5]);
    f.at(9, { target: 5, low: 0, high: 4, mid: 2 });
    expect(d.getOverlay().windows).toEqual([{ structureId: 'p', startIndex: 0, endIndex: 4, label: 'low = 0 … high = 4' }]);
    f.scene('p', [1, 2, 3, 4, 5], { 2: 'AUXILIARY' });
    expect(d.getOverlay().cursors[0]).toMatchObject({ index: 2, label: 'mid = 2' });
    f.at(7, { target: 5, low: 3, high: 4, mid: 2 });
    expect(say).toHaveBeenCalledWith(expect.stringMatching(/^Too low: p\[2\] = 3 < 5/), expect.objectContaining({ emotion: 'confused' }));
    expect(d.getOverlay().windows[0]).toMatchObject({ startIndex: 3, endIndex: 4 });
    expect(camera.registerInstruction).toHaveBeenCalledWith(expect.objectContaining({ type: 'WINDOW', significance: 'notable' }));
  });
});
