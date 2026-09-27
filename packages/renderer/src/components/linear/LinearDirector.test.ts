import { describe, it, expect, vi } from 'vitest';
import { LinearDirector, type LinearEngineSource } from './LinearDirector';
import { diffPointers } from './LinearPointerLayer';
import { LinearCameraChoreographer } from './LinearCameraChoreographer';

function fakeEngine() {
  const handlers = new Map<string, ((p: any) => void)[]>();
  const engine: LinearEngineSource = {
    eventDispatcher: {
      on: (e, h) => handlers.set(e, [...(handlers.get(e) ?? []), h]),
      off: (e, h) => handlers.set(e, (handlers.get(e) ?? []).filter((x) => x !== h)),
    },
  };
  const emit = (e: string, p?: unknown) => (handlers.get(e) ?? []).forEach((h) => h(p));
  const state = (els: any[]) => emit('STATE_UPDATED', { elements: new Map(els.map((el) => [el.id, { position: { x: 0, y: 0, z: 0 }, ...el }])) });
  const log = (keyword: string, message = keyword) => emit('RUNTIME_LOG', { keyword, message });
  return { engine, state, log };
}

const stackAnchor = { id: 'ctr:s', originalType: 'CONTAINER', kind: 'STACK', logicalParent: 's' };
const item = (n: number, value: number, state = 'NEUTRAL') => ({ id: `ctr:s:${n}`, originalType: 'CONTAINER_ITEM', logicalParent: 's', order: n, value, state });

describe('LinearDirector — stacks', () => {
  it('marks the top as the active end, narrates PUSH at the new top and POP at what gets popped next', () => {
    const f = fakeEngine();
    const say = vi.fn();
    const camera = { registerInstruction: vi.fn() };
    const d = new LinearDirector(f.engine, { say, clear: vi.fn() }, camera);
    f.state([stackAnchor]);
    f.state([stackAnchor, item(0, 10, 'MODIFYING')]);
    f.log('PUSH');
    f.state([stackAnchor, item(0, 10), item(1, 20, 'MODIFYING')]);
    f.log('PUSH');
    expect(d.getOverlay().roles).toEqual({ 'ctr:s:1': 'inserted' });
    expect(d.getOverlay().ends).toEqual([{ structureId: 's', kind: 'STACK', elementId: 'ctr:s:1', role: 'top', label: 'next POP' }]);
    expect(say).toHaveBeenLastCalledWith(expect.stringMatching(/^20 lands on top of s/), expect.objectContaining({ pointAt: { elementId: 'ctr:s:1' } }));

    f.state([stackAnchor, item(0, 10), item(1, 20, 'MODIFYING')]);
    f.log('POP');
    expect(d.getOverlay().roles['ctr:s:1']).toBe('removed');
    expect(say).toHaveBeenLastCalledWith(
      'POP takes 20 off the top of s. Now 10 is on top: this is what gets popped next.',
      expect.objectContaining({ pointAt: { elementId: 'ctr:s:0' } })
    );
    expect(camera.registerInstruction).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'POP', significance: 'pivotal' }));
  });
});

describe('LinearDirector — linked lists', () => {
  const list = { id: 'll:l', originalType: 'LINKEDLIST', logicalParent: 'l', headId: 'll:l:0' };
  const node = (n: number, tags: string[] = []) => ({ id: `ll:l:${n}`, originalType: 'LINKEDLIST_NODE', logicalParent: 'l', value: (n + 1) * 10, tags });
  const next = (from: number, to: number) => ({ id: `ll:l:${from}>next`, type: 'edge', pointer: 'next', sourceId: `ll:l:${from}`, targetId: `ll:l:${to}` });

  it('follows the moved pointer variable as the current node, and narrates a reassigned pointer', () => {
    const f = fakeEngine();
    const say = vi.fn();
    const d = new LinearDirector(f.engine, { say, clear: vi.fn() });
    f.state([list, node(0, ['HEAD']), node(1), node(2), next(0, 1), next(1, 2)]);
    f.state([list, node(0, ['HEAD']), node(1, ['curr']), node(2), next(0, 1), next(1, 2)]);
    f.log('POINTER', 'curr = curr.next   ⟹   curr → node 20');
    expect(d.getOverlay().roles).toEqual({ 'll:l:1': 'current' });
    expect(d.getOverlay().ends[0]).toMatchObject({ kind: 'LIST', elementId: 'll:l:1', label: 'curr is here' });
    expect(say).toHaveBeenLastCalledWith('curr = curr.next: curr is on node 20 now.', expect.objectContaining({ pointAt: { elementId: 'll:l:1' } }));

    f.state([list, node(0, ['HEAD']), node(1, ['curr']), node(2), next(0, 2), next(1, 2)]);
    f.log('POINTER', 'head.next = curr.next   ⟹   node 10.next → node 30');
    expect(say).toHaveBeenLastCalledWith(
      "head.next = curr.next: node 10's next now points to 30 instead of 20.",
      expect.objectContaining({ pointAt: { elementId: 'll:l:0' } })
    );
  });
});

describe('diffPointers', () => {
  const conn = (id: string, toId: string) => ({ id, fromId: 'a', toId, from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, style: 'arrow' as const, pointer: 'next' });
  it('retires the old arrow of a reassigned pointer and of a pointer that became NULL', () => {
    const previous = new Map([['a>next', { toId: 'b' }], ['b>next', { toId: 'c' }], ['c>next', { toId: 'd' }]]);
    expect(diffPointers(previous, [conn('a>next', 'c'), conn('c>next', 'd')]).retired).toEqual([
      { id: 'a>next', toId: 'b' },
      { id: 'b>next', toId: 'c' },
    ]);
  });
});

describe('LinearCameraChoreographer', () => {
  it('follows the active end vertically more than the array camera does', () => {
    const cam = new LinearCameraChoreographer();
    cam.registerInstruction({ type: 'PUSH', significance: 'pivotal', participants: [{ x: 0, y: 6, z: 0 }], durationMs: 1000 });
    for (let i = 0; i < 20; i++) cam.update(50);
    const frame = cam.getCameraFrame({ target: { x: 0, y: 0, z: 0 }, distance: 20 }, { center: { x: 0, y: 0, z: 0 }, halfSpanX: 1 });
    expect(frame.target.y).toBeGreaterThan(6 * 0.5 * 0.9);
  });
});
