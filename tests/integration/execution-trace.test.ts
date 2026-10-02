/**
 * recordTrace: a program run once, headlessly, recorded as one frame per
 * visible step (plus WAIT beats and LAYOUT / POSITION / CAMERA changes).
 * The renderer draws any moment of playback from these frames alone, so
 * they must be complete, deterministic and classified correctly.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine, recordTrace, type ExecutionTrace } from '../../packages/runtime/src';
import { EXAMPLES, getExampleById } from '../../packages/demo/src/examples/registry';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

async function traceOf(id: string): Promise<ExecutionTrace> {
  const example = getExampleById(id);
  if (!example) throw new Error(`no example ${id}`);
  return recordTrace(compile(example.source) as any);
}

describe('recordTrace', () => {
  it('records bubble sort as compares and swaps that really reorder the array', async () => {
    const trace = await traceOf('sorting-bubble-sort');
    expect(trace.error).toBeNull();
    expect(trace.frames[0].event.kind).toBe('init');

    const first = trace.frames[1];
    expect(first.event.kind).toBe('compare');
    expect(first.event.actors).toHaveLength(2);
    expect(first.event.relation).toBe('>'); // 64 > 34
    expect(first.line).toBe(14);

    const swap = trace.frames[2];
    expect(swap.event.kind).toBe('swap');
    const [a, b] = swap.event.actors;
    const before = new Map(trace.frames[1].nodes.map((n) => [n.id, n.pos.x]));
    const after = new Map(swap.nodes.map((n) => [n.id, n.pos.x]));
    // The two cells traded places.
    expect(after.get(a)).toBeCloseTo(before.get(b)!);
    expect(after.get(b)).toBeCloseTo(before.get(a)!);

    // The array ends sorted, left to right.
    const last = trace.frames[trace.frames.length - 1];
    const values = [...last.nodes].sort((p, q) => p.pos.x - q.pos.x).map((n) => n.numeric);
    expect(values).toEqual([...values].sort((p, q) => (p ?? 0) - (q ?? 0)));
    expect(last.nodes.every((n) => n.state === 'SUCCESS')).toBe(true);
  });

  it('matches the step count of the live engine for a visible-steps-only program', async () => {
    const example = getExampleById('sorting-bubble-sort')!;
    const engine = new ExecutionEngine({ headless: true });
    let steps = 0;
    engine.eventDispatcher.on('ANIMATED_STEP', ({ current }: { current: number }) => (steps = current));
    engine.loadProgram(compile(example.source) as any);
    await engine.execute();
    const trace = await recordTrace(compile(example.source) as any);
    expect(trace.frames.length - 1).toBe(steps);
  });

  it('is deterministic: two recordings of the same program are identical', async () => {
    const a = await traceOf('graphs-dijkstra');
    const b = await traceOf('graphs-dijkstra');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('classifies graph steps: pointer visits, field writes and traversed edges', async () => {
    const trace = await traceOf('graphs-dijkstra');
    const kinds = new Set(trace.frames.map((f) => f.event.kind));
    expect(kinds.has('visit')).toBe(true);
    expect(kinds.has('write')).toBe(true);
    expect(kinds.has('traverse')).toBe(true);
    const write = trace.frames.find((f) => f.event.kind === 'write' && f.event.writes.length === 0 && f.caption.includes('dist'));
    expect(write?.event.actors.length).toBeGreaterThan(0);
    const traverse = trace.frames.find((f) => f.event.kind === 'traverse')!;
    expect(traverse.event.edges.length).toBeGreaterThan(0);
  });

  it('records the call stack of a recursive tree traversal', async () => {
    const trace = await traceOf('tree-traversals');
    const deepest = Math.max(...trace.frames.map((f) => f.callStack.length));
    expect(deepest).toBeGreaterThanOrEqual(3);
    const call = trace.frames.find((f) => f.event.kind === 'call')!;
    expect(call.callStack[call.callStack.length - 1]).toMatch(/preorder/);
  });

  it('honours LAYOUT statements: a CIRCULAR ring is a ring from the first frame', async () => {
    const trace = await traceOf('layout-ring');
    const radii = trace.frames[0].nodes.map((n) => Math.hypot(n.pos.x, n.pos.z));
    for (const r of radii) expect(r).toBeCloseTo(4, 3);
  });

  it('turns a LAYOUT change mid-program into a layout step', async () => {
    const trace = await traceOf('layout-graph-ring');
    const layout = trace.frames.find((f) => f.event.kind === 'layout');
    expect(layout?.event.actors.length).toBe(3);
    expect(trace.frames.some((f) => f.event.kind === 'hold')).toBe(true);
  });

  it('carries CAMERA statements into the frames', async () => {
    const orbit = await traceOf('camera-orbit');
    expect(orbit.frames[0].camera?.mode).toBe('ORBIT');
    expect(orbit.frames[orbit.frames.length - 1].camera?.mode).toBe('AUTO_FIT');
    const fixed = await traceOf('camera-fixed-angle');
    expect(fixed.frames[0].camera).toMatchObject({ mode: 'POSITION', position: { x: 0, y: 6, z: 14 } });
  });

  it('places a POSITION-pinned element where the program put it', async () => {
    const trace = await traceOf('layout-pin-release');
    const pinned = trace.frames[0].nodes.find((n) => n.text === '8')!;
    expect(pinned.pos).toEqual({ x: 5, y: 2, z: 0 });
  });

  it('reports a runtime error instead of throwing, after the frames that ran', async () => {
    const source = `SCENE Broken
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  HIGHLIGHT arr[0]
  i = 7
  HIGHLIGHT arr[i]
END
`;
    const trace = await recordTrace(compile(source) as any);
    expect(trace.frames.length).toBeGreaterThanOrEqual(2);
    expect(trace.error?.message).toMatch(/out of bounds/i);
  });

  it('stops at the step cap and says so', async () => {
    const trace = await recordTrace(compile(getExampleById('sorting-bubble-sort')!.source) as any, { maxSteps: 10 });
    expect(trace.frames.length).toBe(11);
    expect(trace.truncated).toBe(true);
  });

  it('records every example without an unexpected error', async () => {
    const failures: string[] = [];
    for (const example of EXAMPLES) {
      const trace = await recordTrace(compile(example.source) as any);
      if (trace.error) failures.push(`${example.id}: ${trace.error.message}`);
      if (trace.frames.length < 2) failures.push(`${example.id}: no steps`);
    }
    expect(failures).toEqual([]);
  }, 120_000);
});
