/**
 * Unit tests for QueueEngine (packages/runtime/src/core/algorithms/QueueEngine.ts)
 * — ENQUEUE/DEQUEUE/FRONT/REAR, extracted from AnimationController.buildAnimations.
 * Exercises the engine directly against real SceneManager/LayoutManager/
 * StateManager/EventDispatcher/RelationshipManager/LifecycleManager
 * instances (none of which touch animejs/window) plus a synchronous fake
 * AnimationScheduler and a plain-array virtualGraph, without going through
 * AnimationController at all.
 */
import { describe, expect, it } from 'vitest';
import { QueueEngine, QueueAnimationContext } from '../../packages/runtime/src/core/algorithms/QueueEngine';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';
import { LifecycleManager } from '../../packages/runtime/src/core/LifecycleManager';
import { StackUnderflowError } from '../../packages/shared/src/index';

/** Runs every queued task's `complete` callback synchronously, modeling an instant-playback timeline without a real AnimationScheduler/TimelineEngine/animejs. */
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

function makeContext(): { context: QueueAnimationContext; sceneManager: SceneManager; eventDispatcher: EventDispatcher } {
  const eventDispatcher = new EventDispatcher();
  const sceneManager = new SceneManager(eventDispatcher);
  const relationshipManager = new RelationshipManager(eventDispatcher);
  const layoutManager = new LayoutManager(sceneManager, relationshipManager);
  const stateManager = new StateManager();
  const lifecycleManager = new LifecycleManager(sceneManager);
  const scheduler = makeFakeScheduler();

  const context: QueueAnimationContext = {
    scheduler,
    sceneManager,
    layoutManager,
    eventDispatcher,
    stateManager,
    relationshipManager,
    activeTreeName: null,
    defaultColor: '#ffffff',
    lifecycleManager,
  };
  return { context, sceneManager, eventDispatcher };
}

function seedQueue(sceneManager: SceneManager, name: string, values: number[]): any[] {
  const virtualGraph: any[] = [];
  values.forEach((value, logicalIndex) => {
    const el: any = {
      id: `${name}_${logicalIndex}`,
      type: 'box',
      originalType: 'QUEUE_ELEMENT',
      logicalParent: name,
      logicalIndex,
      value,
      position: { x: logicalIndex, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#fff',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    };
    sceneManager.addElement(el);
    virtualGraph.push(el);
  });
  return virtualGraph;
}

function makeGen(actionName: string, args: any[]): any {
  return { action: 'GENERIC_ACTION', actionName, args };
}

describe('QueueEngine.enqueue', () => {
  it('spawns a new active QUEUE_ELEMENT at the back of the queue, in both the live scene and virtualGraph', () => {
    const { context, sceneManager } = makeContext();
    const virtualGraph = seedQueue(sceneManager, 'q', [1, 2]);

    new QueueEngine().enqueue(context, makeGen('ENQUEUE', ['q', 3]), virtualGraph);

    const queueEls = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 'q' && el.originalType === 'QUEUE_ELEMENT');
    expect(queueEls).toHaveLength(3);

    const newEl = queueEls.find((el: any) => el.value === 3) as any;
    expect(newEl).toBeDefined();
    expect(newEl.logicalIndex).toBe(2);
    expect(newEl.lifecycleState).toBe('ACTIVE');

    expect(virtualGraph.some((el: any) => el.value === 3)).toBe(true);
  });

  it('logs an ENQUEUE event with the new queue size', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    const virtualGraph = seedQueue(sceneManager, 'q', [1]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new QueueEngine().enqueue(context, makeGen('ENQUEUE', ['q', 9]), virtualGraph);

    const enqueueLog = logs.find((l) => l.keyword === 'ENQUEUE');
    expect(enqueueLog?.message).toContain('Queue size: 2');
  });
});

describe('QueueEngine.dequeue', () => {
  it('removes the front element (lowest logicalIndex) from the live scene and the virtualGraph', () => {
    const { context, sceneManager } = makeContext();
    const virtualGraph = seedQueue(sceneManager, 'q', [1, 2, 3]);

    new QueueEngine().dequeue(context, makeGen('DEQUEUE', ['q']), virtualGraph);

    const queueEls = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 'q' && el.originalType === 'QUEUE_ELEMENT');
    expect(queueEls).toHaveLength(2);
    expect(queueEls.some((el: any) => el.value === 1)).toBe(false);
    expect(virtualGraph).toHaveLength(2);
  });

  it('shifts remaining elements down in logicalIndex after dequeue', () => {
    const { context, sceneManager } = makeContext();
    const virtualGraph = seedQueue(sceneManager, 'q', [1, 2, 3]);

    new QueueEngine().dequeue(context, makeGen('DEQUEUE', ['q']), virtualGraph);

    const remaining = virtualGraph.filter((el: any) => el.logicalParent === 'q').sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
    expect(remaining.map((el: any) => el.value)).toEqual([2, 3]);
    expect(remaining.map((el: any) => el.logicalIndex)).toEqual([0, 1]);
  });

  it('throws StackUnderflowError when the queue is empty', () => {
    const { context, sceneManager } = makeContext();
    const virtualGraph = seedQueue(sceneManager, 'q', []);

    expect(() => new QueueEngine().dequeue(context, makeGen('DEQUEUE', ['q']), virtualGraph)).toThrow(StackUnderflowError);
  });

  it('logs a DEQUEUE event naming the removed front value and new size', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    const virtualGraph = seedQueue(sceneManager, 'q', [1, 2]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new QueueEngine().dequeue(context, makeGen('DEQUEUE', ['q']), virtualGraph);

    const dequeueLog = logs.find((l) => l.keyword === 'DEQUEUE');
    expect(dequeueLog?.message).toContain('"1"');
    expect(dequeueLog?.message).toContain('Queue size: 1');
  });
});

describe('QueueEngine.peek', () => {
  it('logs FRONT for the lowest-index element without mutating the queue', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2, 3]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new QueueEngine().peek(context, makeGen('FRONT', ['q']));

    expect(sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 'q')).toHaveLength(3);
    const frontLog = logs.find((l) => l.keyword === 'FRONT');
    expect(frontLog?.message).toContain('1');
  });

  it('logs REAR for the highest-index element without mutating the queue', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2, 3]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new QueueEngine().peek(context, makeGen('REAR', ['q']));

    expect(sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 'q')).toHaveLength(3);
    const rearLog = logs.find((l) => l.keyword === 'REAR');
    expect(rearLog?.message).toContain('3');
  });

  it('does nothing when the queue is empty', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    seedQueue(sceneManager, 'q', []);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new QueueEngine().peek(context, makeGen('FRONT', ['q']));

    expect(logs).toHaveLength(0);
  });
});
