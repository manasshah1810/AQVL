/**
 * Unit tests for the array's two layers:
 * - ArrayStructure (packages/runtime/src/data-structures/ArrayStructure.ts),
 *   the pure dynamic array, with no runtime dependencies;
 * - ArrayEngine (packages/runtime/src/core/algorithms/ArrayEngine.ts), the
 *   handler for the array-targeted INSERT / DELETE / UPDATE that replays
 *   ArrayStructure's recorded steps onto the scene, and serves the reads a
 *   program makes of an array. Exercised directly against real runtime
 *   managers plus a synchronous fake AnimationScheduler, without going
 *   through AnimationController or a compiled program at all.
 */
import { describe, expect, it } from 'vitest';
import { ArrayStructure, ARRAY_STEP_PRIMITIVES } from '../../packages/runtime/src/data-structures/ArrayStructure';
import { isPrimitive } from '../../packages/runtime/src/data-structures/steps';
import { ArrayEngine, ArrayIndexOutOfRangeError } from '../../packages/runtime/src/core/algorithms/ArrayEngine';
import { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';

describe('ArrayStructure', () => {
  it('insert shifts later elements right and records the shift', () => {
    const array = new ArrayStructure<number>();
    array.elements = [10, 20, 30];
    array.insert(1, 99);
    expect(array.toArray()).toEqual([10, 99, 20, 30]);
    expect(array.steps).toEqual([{ type: 'INSERT', index: 1, value: 99, shifted: 2 }]);
  });

  it('insert at the end appends with nothing shifted', () => {
    const array = new ArrayStructure<number>();
    array.elements = [1];
    array.insert(1, 2);
    expect(array.steps).toEqual([{ type: 'INSERT', index: 1, value: 2, shifted: 0 }]);
  });

  it('delete removes and returns the element, shifting later ones left', () => {
    const array = new ArrayStructure<number>();
    array.elements = [10, 20, 30];
    expect(array.delete(0)).toBe(10);
    expect(array.toArray()).toEqual([20, 30]);
    expect(array.steps).toEqual([{ type: 'DELETE', index: 0, value: 10, shifted: 2 }]);
  });

  it('delete out of range returns undefined and records nothing', () => {
    const array = new ArrayStructure<number>();
    array.elements = [1];
    expect(array.delete(3)).toBeUndefined();
    expect(array.steps).toEqual([]);
  });

  it('set overwrites a slot and records the previous value; steps reset per call', () => {
    const array = new ArrayStructure<number>();
    array.elements = [5, 6];
    array.insert(0, 4);
    expect(array.set(2, 60)).toBe(6);
    expect(array.steps).toEqual([{ type: 'SET', index: 2, value: 60, previous: 6 }]);
    expect(array.get(2)).toBe(60);
    expect(array.length).toBe(3);
  });

  it('every step type is an AQIR primitive', () => {
    for (const p of Object.values(ARRAY_STEP_PRIMITIVES)) expect(isPrimitive(p)).toBe(true);
    expect(ARRAY_STEP_PRIMITIVES.SET).toEqual({ kind: 'MUTATE', verb: 'set' });
  });
});

/** Runs every queued task's `complete` callback synchronously and immediately, modeling an instant-playback timeline (same trick used by makeInstantEngine in the integration suite) without needing a real AnimationScheduler/TimelineEngine/animejs. */
function makeFakeScheduler() {
  let tasks: any[] = [];
  let time = 0;
  const scheduled: any[] = [];
  return {
    scheduled,
    enqueue(task: any) { tasks.push(task); scheduled.push(task); },
    commitGroup(advance = true) {
      const current = tasks;
      tasks = [];
      const maxDuration = current.reduce((m, t) => Math.max(m, t.duration || 0), 0);
      current.forEach((t) => t.complete?.());
      if (advance) time += maxDuration;
    },
    commitSequential() {
      const current = tasks;
      tasks = [];
      current.forEach((t) => {
        t.complete?.();
        time += t.duration || 0;
      });
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
  const stateManager = new StateManager();
  const scheduler = makeFakeScheduler();

  const context: AlgorithmContext = {
    scheduler,
    sceneManager,
    layoutManager,
    eventDispatcher,
    stateManager,
    relationshipManager,
    activeTreeName: null,
    defaultColor: '#ffffff',
  };
  const logs: any[] = [];
  eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));
  return { context, sceneManager, stateManager, scheduler, logs };
}

function seedArray(sceneManager: SceneManager, name: string, values: number[]) {
  values.forEach((value, logicalIndex) => {
    sceneManager.addElement({
      id: `${name}_${logicalIndex}`,
      type: 'box',
      originalType: 'ARRAY_ELEMENT',
      logicalParent: name,
      logicalIndex,
      value,
      position: { x: logicalIndex, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#fff',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    } as any);
  });
}

function makeGen(actionName: string, args: any[], payload?: any, targetId?: string): any {
  return { action: 'GENERIC_ACTION', actionName, args, payload, targetId };
}

const valuesOf = (sceneManager: SceneManager, name = 'arr') =>
  sceneManager.getSceneGraph()
    .filter((el: any) => el.logicalParent === name)
    .sort((a: any, b: any) => a.logicalIndex - b.logicalIndex)
    .map((el: any) => el.value);

describe('ArrayEngine INSERT', () => {
  it('inserts a new ARRAY_ELEMENT at the given index and shifts elements to its right', () => {
    const { context, sceneManager } = makeContext();
    seedArray(sceneManager, 'arr', [10, 20, 30]);

    new ArrayEngine().execute(context, makeGen('INSERT', [99], { logicalParent: 'arr', logicalIndex: 1 }));

    expect(valuesOf(sceneManager)).toEqual([10, 99, 20, 30]);
  });

  it('saves state and logs an INSERT event once the animation completes', () => {
    const { context, sceneManager, stateManager, logs } = makeContext();
    seedArray(sceneManager, 'arr', [1, 2]);

    new ArrayEngine().execute(context, makeGen('INSERT', [42], { logicalParent: 'arr', logicalIndex: 0 }));

    expect(stateManager.getCurrentState()?.description).toBe('Inserted 42 at index 0');
    expect(logs).toHaveLength(1);
    expect(logs[0].keyword).toBe('INSERT');
  });

  it('does nothing when the instruction has no array payload (e.g. a bare tree/BST INSERT)', () => {
    const { context, sceneManager } = makeContext();
    seedArray(sceneManager, 'arr', [1, 2, 3]);
    const engine = new ArrayEngine();
    const bare = makeGen('INSERT', [50], undefined);

    expect(engine.targetsSlot(context, bare)).toBe(false);
    engine.execute(context, bare);

    expect(valuesOf(sceneManager)).toEqual([1, 2, 3]);
  });
});

describe('ArrayEngine DELETE', () => {
  it('removes the targeted element and shifts elements to its right back by one', () => {
    const { context, sceneManager } = makeContext();
    seedArray(sceneManager, 'arr', [10, 20, 30]);
    const engine = new ArrayEngine();
    const del = makeGen('DELETE', ['arr_1'], { logicalParent: 'arr', logicalIndex: 1 }, 'arr_1');

    expect(engine.targetsSlot(context, del)).toBe(true);
    engine.execute(context, del);

    expect(valuesOf(sceneManager)).toEqual([10, 30]);
  });

  it('does not claim (and does not touch) an instruction that targets no array index (e.g. a TREE_NODE delete)', () => {
    const { context, sceneManager } = makeContext();
    sceneManager.addElement({
      id: 'node_1', type: 'sphere', originalType: 'TREE_NODE', logicalParent: 'tree',
      position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#fff',
      lifecycleState: 'ACTIVE', visible: true, opacity: 1,
    } as any);
    const engine = new ArrayEngine();
    const del = makeGen('DELETE', ['node_1'], undefined, 'node_1');

    expect(engine.targetsSlot(context, del)).toBe(false);
    engine.execute(context, del);

    expect(sceneManager.getElement('node_1')).toBeDefined();
  });
});

describe('ArrayEngine UPDATE', () => {
  it('writes the new value with a MODIFYING pulse, then saves state and logs', () => {
    const { context, sceneManager, stateManager, scheduler, logs } = makeContext();
    seedArray(sceneManager, 'arr', [1, 2, 3]);
    const cell = sceneManager.getElement('arr_1') as any;

    new ArrayEngine().execute(context, makeGen('UPDATE', ['arr_1', 7], { logicalParent: 'arr', logicalIndex: 1 }, 'arr_1'));

    expect(valuesOf(sceneManager)).toEqual([1, 7, 3]);
    // anticipation squash, the MODIFYING pulse, back to rest
    expect(scheduler.scheduled.filter((t: any) => t.targets === cell.scale).map((t: any) => t.x)).toEqual([0.92, 1.2, 1]);
    expect(stateManager.getCurrentState()?.description).toBe('Updated value to 7');
    expect(logs.map((l) => l.message)).toEqual(['Updated value of element to 7.']);
  });
});

describe('ArrayEngine program reads', () => {
  it('valueAt / length / format read the live cells', () => {
    const { context, sceneManager } = makeContext();
    seedArray(sceneManager, 'arr', [1.5, 2, 3]);
    const engine = new ArrayEngine();

    expect(engine.valueAt(context, 'arr', 1)).toBe(2);
    expect(engine.length(context, 'arr')).toBe(3);
    expect(engine.format(context, 'arr')).toBe('[1.5, 2, 3]');
    expect(() => engine.valueAt(context, 'arr', 3)).toThrow(ArrayIndexOutOfRangeError);
  });

  it('bindSlotOperands binds arr[i] to the element there and evaluates the value', () => {
    const { context, sceneManager } = makeContext();
    seedArray(sceneManager, 'arr', [1, 2]);
    const engine = new ArrayEngine();
    const compiled = makeGen('UPDATE', ['arr#1', 'x']);

    const bound = engine.bindSlotOperands(context, compiled, 'arr', 1, () => 42) as any;

    expect(bound.args).toEqual(['arr_1', 42]);
    expect(bound.targetId).toBe('arr_1');
    expect(bound.payload).toEqual({ logicalParent: 'arr', logicalIndex: 1 });
    expect(compiled.args).toEqual(['arr#1', 'x']); // the compiled instruction is not mutated
    expect(() => engine.bindSlotOperands(context, makeGen('UPDATE', ['arr#5', 1]), 'arr', 5, null)).toThrow(ArrayIndexOutOfRangeError);
  });
});
