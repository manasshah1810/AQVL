/**
 * Unit tests for ArrayEngine (packages/runtime/src/core/algorithms/ArrayEngine.ts)
 * — the array-targeted branches of bare INSERT/DELETE, extracted from
 * AnimationController.executeInstruction. Exercises the engine directly
 * against real SceneManager/LayoutManager/StateManager/EventDispatcher/
 * RelationshipManager instances (none of which touch animejs/window) plus a
 * synchronous fake AnimationScheduler, without going through
 * AnimationController or a compiled program at all.
 */
import { describe, expect, it } from 'vitest';
import { ArrayEngine } from '../../packages/runtime/src/core/algorithms/ArrayEngine';
import { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';

/** Runs every queued task's `complete` callback synchronously and immediately, modeling an instant-playback timeline (same trick used by makeInstantEngine in the integration suite) without needing a real AnimationScheduler/TimelineEngine/animejs. */
function makeFakeScheduler() {
  let tasks: any[] = [];
  let time = 0;
  return {
    enqueue(task: any) { tasks.push(task); },
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
  return { context, sceneManager, eventDispatcher, stateManager };
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

describe('ArrayEngine.insert', () => {
  it('inserts a new ARRAY_ELEMENT at the given index and shifts elements to its right', () => {
    const { context, sceneManager } = makeContext();
    seedArray(sceneManager, 'arr', [10, 20, 30]);

    const engine = new ArrayEngine();
    engine.insert(context, makeGen('INSERT', [99], { logicalParent: 'arr', logicalIndex: 1 }));

    const els = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 'arr');
    expect(els).toHaveLength(4);

    const byIndex = [...els].sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
    expect(byIndex.map((el: any) => el.value)).toEqual([10, 99, 20, 30]);
  });

  it('saves state and logs an INSERT event once the animation completes', () => {
    const { context, sceneManager, eventDispatcher, stateManager } = makeContext();
    seedArray(sceneManager, 'arr', [1, 2]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new ArrayEngine().insert(context, makeGen('INSERT', [42], { logicalParent: 'arr', logicalIndex: 0 }));

    expect(stateManager.getCurrentState()?.description).toBe('Inserted 42 at index 0');
    expect(logs).toHaveLength(1);
    expect(logs[0].keyword).toBe('INSERT');
  });

  it('does nothing when the instruction has no array payload (e.g. a bare tree/BST INSERT)', () => {
    const { context, sceneManager } = makeContext();
    seedArray(sceneManager, 'arr', [1, 2, 3]);

    new ArrayEngine().insert(context, makeGen('INSERT', [50], undefined));

    expect(sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 'arr')).toHaveLength(3);
  });
});

describe('ArrayEngine.delete', () => {
  it('removes the targeted element and shifts elements to its right back by one, returning true', () => {
    const { context, sceneManager } = makeContext();
    seedArray(sceneManager, 'arr', [10, 20, 30]);

    const handled = new ArrayEngine().delete(
      context,
      makeGen('DELETE', ['arr_1'], { logicalParent: 'arr', logicalIndex: 1 }, 'arr_1')
    );

    expect(handled).toBe(true);
    const els = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 'arr');
    expect(els).toHaveLength(2);
    const byIndex = [...els].sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
    expect(byIndex.map((el: any) => el.value)).toEqual([10, 30]);
  });

  it('returns false and mutates nothing when the instruction does not target an array index (e.g. a TREE_NODE delete)', () => {
    const { context, sceneManager } = makeContext();
    sceneManager.addElement({
      id: 'node_1', type: 'sphere', originalType: 'TREE_NODE', logicalParent: 'tree',
      position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#fff',
      lifecycleState: 'ACTIVE', visible: true, opacity: 1,
    } as any);

    const handled = new ArrayEngine().delete(context, makeGen('DELETE', ['node_1'], undefined, 'node_1'));

    expect(handled).toBe(false);
    expect(sceneManager.getElement('node_1')).toBeDefined();
  });
});
