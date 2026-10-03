/**
 * Unit tests for the hash map's recorded steps and their replay:
 * - HashMap (packages/runtime/src/data-structures/HashMap.ts) records what
 *   set / lookup / delete / resize did, one step per visualizable
 *   micro-action;
 * - HashMapEngine (packages/runtime/src/core/algorithms/HashMapEngine.ts)
 *   rehydrates a HashMap from the scene and replays those steps. Exercised
 *   directly against real SceneManager/LayoutManager/EventDispatcher/
 *   RelationshipManager instances plus a synchronous fake AnimationScheduler.
 */
import { describe, expect, it } from 'vitest';
import { HashMap, HASHMAP_STEP_PRIMITIVES } from '../../packages/runtime/src/data-structures/HashMap';
import { isPrimitive } from '../../packages/runtime/src/data-structures/steps';
import { HashMapEngine } from '../../packages/runtime/src/core/algorithms/HashMapEngine';
import type { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';

const types = (map: HashMap<any, any>) => map.steps.map((s) => s.type);

describe('HashMap steps', () => {
  it('set of a new key records HASH then APPEND; into a non-empty bucket also COLLISION', () => {
    const map = new HashMap<number, string>(4);
    map.set(1, 'a');
    expect(map.steps).toEqual([
      { type: 'HASH', op: 'SET', key: 1, bucket: 1, capacity: 4 },
      { type: 'APPEND', key: 1, value: 'a', bucket: 1, chainIndex: 0 },
    ]);
    map.set(5, 'b'); // 5 % 4 = 1: chains after 1
    expect(types(map)).toEqual(['HASH', 'COLLISION', 'APPEND']);
    expect(map.steps[1]).toEqual({ type: 'COLLISION', bucket: 1, chainLength: 1 });
    expect(map.steps[2]).toMatchObject({ chainIndex: 1 });
  });

  it('set of an existing key records only UPDATE', () => {
    const map = new HashMap<string, number>();
    map.set('k', 1);
    map.set('k', 2);
    expect(map.steps).toEqual([{ type: 'UPDATE', key: 'k', value: 2, bucket: map.hash('k'), chainIndex: 0 }]);
  });

  it('a set past the load factor records RESIZE with where every stored key now sits', () => {
    const map = new HashMap<number, number>(4);
    [0, 1, 2].forEach((k) => map.set(k, k));
    map.set(3, 3); // 4 / 4 > 0.75
    expect(types(map)).toEqual(['RESIZE', 'HASH', 'APPEND']);
    expect(map.steps[0]).toEqual({
      type: 'RESIZE',
      from: 4,
      to: 8,
      entries: [0, 1, 2].map((k) => ({ key: k, value: k, bucket: k, chainIndex: 0 })),
    });
    expect(map.steps[1]).toMatchObject({ bucket: 3, capacity: 8 });
  });

  it('lookup compares the chain in order and ends with MISS when the key is absent', () => {
    const map = new HashMap<number, string>(4);
    map.set(1, 'a');
    map.set(5, 'b');
    expect(map.lookup(5)).toBe('b');
    expect(map.steps.filter((s) => s.type === 'COMPARE').map((s: any) => s.match)).toEqual([false, true]);
    expect(map.lookup(9)).toBeUndefined();
    expect(types(map)).toEqual(['HASH', 'COMPARE', 'COMPARE', 'MISS', 'RELEASE']);
  });

  it('delete records REMOVE (or MISS) and get / has record nothing', () => {
    const map = new HashMap<string, number>();
    map.set('x', 1);
    expect(map.delete('x')).toBe(true);
    expect(types(map)).toEqual(['HASH', 'REMOVE', 'RELEASE']);
    expect(map.delete('x')).toBe(false);
    expect(types(map)).toEqual(['HASH', 'MISS', 'RELEASE']);
    map.get('x');
    map.has('x');
    expect(types(map)).toEqual(['HASH', 'MISS', 'RELEASE']);
  });

  it('every step type is an AQIR primitive', () => {
    for (const p of Object.values(HASHMAP_STEP_PRIMITIVES)) expect(isPrimitive(p)).toBe(true);
    expect(HASHMAP_STEP_PRIMITIVES.APPEND).toEqual({ kind: 'MUTATE', verb: 'create' });
    expect(HASHMAP_STEP_PRIMITIVES.REMOVE).toEqual({ kind: 'MUTATE', verb: 'destroy' });
    expect(HASHMAP_STEP_PRIMITIVES.COMPARE).toEqual({ kind: 'ANNOTATE', verb: 'contrast' });
  });
});

/** Runs every queued task's `complete` callback synchronously. */
function makeFakeScheduler() {
  let tasks: any[] = [];
  let time = 0;
  return {
    enqueue(task: any) { tasks.push(task); },
    commitGroup() {
      const current = tasks;
      tasks = [];
      current.forEach((t) => t.complete?.());
    },
    commitSequential() {
      const current = tasks;
      tasks = [];
      current.forEach((t) => t.complete?.());
    },
    advanceCursor(ms: number) { time += ms; },
    getCurrentTime() { return time; },
  } as any;
}

function makeContext() {
  const eventDispatcher = new EventDispatcher();
  const sceneManager = new SceneManager(eventDispatcher);
  const relationshipManager = new RelationshipManager(eventDispatcher);
  const layoutManager = new LayoutManager(sceneManager, relationshipManager);
  const context: AlgorithmContext = {
    scheduler: makeFakeScheduler(),
    sceneManager,
    layoutManager,
    eventDispatcher,
    stateManager: new StateManager(),
    relationshipManager,
    defaultColor: '#ffffff',
  };
  const logs: any[] = [];
  eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));
  return { context, sceneManager, logs };
}

const gen = (actionName: string, args: any[]): any => ({ action: 'GENERIC_ACTION', actionName, args });
const live = (sceneManager: SceneManager, type: string) =>
  sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 'h' && el.originalType === type && !el.pendingRemoval) as any[];

describe('HashMapEngine', () => {
  it('replays inserts as chained entries under their buckets', () => {
    const { context, sceneManager } = makeContext();
    const engine = new HashMapEngine();
    engine.execute(context, gen('HASHMAP_INIT', ['h']));
    engine.execute(context, gen('HASHMAP_INSERT', ['h', 1, 'a']));
    engine.execute(context, gen('HASHMAP_INSERT', ['h', 9, 'b'])); // 9 % 8 = 1
    const entries = live(sceneManager, 'HASHMAP_ENTRY').map((el) => [el.key, el.bucketIndex, el.chainIndex]);
    expect(entries).toEqual([[1, 1, 0], [9, 1, 1]]);
  });

  it('replays a resize: a doubled bucket row, every key rehashed', () => {
    const { context, sceneManager, logs } = makeContext();
    const engine = new HashMapEngine();
    for (let k = 0; k < 7; k++) engine.execute(context, gen('HASHMAP_INSERT', ['h', k, k]));
    expect(live(sceneManager, 'HASHMAP_BUCKET')).toHaveLength(16);
    expect(live(sceneManager, 'HASHMAP_ENTRY').map((el) => el.bucketIndex).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(logs.some((l) => l.message === 'Rehashed 6 entries into 16 buckets.')).toBe(true);
  });

  it('replays a delete: the entry goes and the rest of its chain moves up', () => {
    const { context, sceneManager, logs } = makeContext();
    const engine = new HashMapEngine();
    [1, 9, 17].forEach((k) => engine.execute(context, gen('HASHMAP_INSERT', ['h', k, k])));
    engine.execute(context, gen('HASHMAP_DELETE', ['h', 1]));
    expect(live(sceneManager, 'HASHMAP_ENTRY').map((el) => [el.key, el.chainIndex])).toEqual([[9, 0], [17, 1]]);
    engine.execute(context, gen('HASHMAP_LOOKUP', ['h', 17]));
    expect(logs.at(-1).message).toBe('Found "17" -> 17');
  });
});
