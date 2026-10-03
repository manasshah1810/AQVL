/**
 * Unit tests for the queue's two layers:
 * - Queue (packages/runtime/src/data-structures/Queue.ts), the pure FIFO
 *   structure, with no runtime dependencies;
 * - QueueEngine (packages/runtime/src/core/algorithms/QueueEngine.ts), the
 *   ENQUEUE / DEQUEUE / FRONT / REAR handler that replays Queue's recorded
 *   steps onto the scene. Exercised directly against real runtime managers
 *   plus a synchronous fake AnimationScheduler, without going through
 *   AnimationController.
 */
import { describe, expect, it } from 'vitest';
import { Queue, QUEUE_STEP_PRIMITIVES } from '../../packages/runtime/src/data-structures/Queue';
import { isPrimitive } from '../../packages/runtime/src/data-structures/steps';
import { QueueEngine } from '../../packages/runtime/src/core/algorithms/QueueEngine';
import type { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';
import { LifecycleManager } from '../../packages/runtime/src/core/LifecycleManager';
import { StackUnderflowError } from '../../packages/shared/src/index';

describe('Queue', () => {
  it('dequeues in first-in, first-out order', () => {
    const queue = new Queue<number>();
    [1, 2, 3].forEach((v) => queue.enqueue(v));
    expect([queue.dequeue(), queue.dequeue(), queue.dequeue()]).toEqual([1, 2, 3]);
    expect(queue.isEmpty()).toBe(true);
  });

  it('front and rear read the two ends without removing them', () => {
    const queue = new Queue<number>();
    queue.elements = [4, 5, 6];
    expect(queue.front()).toBe(4);
    expect(queue.rear()).toBe(6);
    expect(queue.size).toBe(3);
  });

  it('records one step per operation, reset on every call', () => {
    const queue = new Queue<number>();
    queue.elements = [7];
    queue.enqueue(8);
    expect(queue.steps).toEqual([{ type: 'ENQUEUE', index: 1, value: 8 }]);
    queue.rear();
    expect(queue.steps).toEqual([{ type: 'REAR', index: 1, value: 8 }]);
    queue.front();
    expect(queue.steps).toEqual([{ type: 'FRONT', index: 0, value: 7 }]);
    queue.dequeue();
    expect(queue.steps).toEqual([{ type: 'DEQUEUE', index: 0, value: 7 }]);
    expect(queue.toArray()).toEqual([8]);
  });

  it('dequeue / front / rear on an empty queue return undefined and record nothing', () => {
    const queue = new Queue<number>();
    expect(queue.dequeue()).toBeUndefined();
    expect(queue.front()).toBeUndefined();
    expect(queue.rear()).toBeUndefined();
    expect(queue.steps).toEqual([]);
  });

  it('every step type is an AQIR primitive', () => {
    for (const p of Object.values(QUEUE_STEP_PRIMITIVES)) expect(isPrimitive(p)).toBe(true);
    expect(QUEUE_STEP_PRIMITIVES.ENQUEUE).toEqual({ kind: 'MUTATE', verb: 'create' });
    expect(QUEUE_STEP_PRIMITIVES.DEQUEUE).toEqual({ kind: 'MUTATE', verb: 'destroy' });
  });
});

/** Runs every queued task's `complete` callback synchronously and records what was scheduled. */
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
  const scheduler = makeFakeScheduler();
  const context: AlgorithmContext = {
    scheduler,
    sceneManager,
    layoutManager,
    eventDispatcher,
    stateManager: new StateManager(),
    relationshipManager,
    lifecycleManager: new LifecycleManager(sceneManager),
    activeTreeName: null,
    defaultColor: '#ffffff',
  };
  const logs: any[] = [];
  eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));
  return { context, sceneManager, scheduler, logs };
}

function seedQueue(sceneManager: SceneManager, name: string, values: number[]): void {
  values.forEach((value, logicalIndex) => {
    sceneManager.addElement({
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
    } as any);
  });
}

const gen = (actionName: string, args: any[]): any => ({ action: 'GENERIC_ACTION', actionName, args });
const queueEls = (sceneManager: SceneManager, name = 'q') =>
  (sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === name && el.originalType === 'QUEUE_ELEMENT') as any[])
    .sort((a, b) => a.logicalIndex - b.logicalIndex);

describe('QueueEngine ENQUEUE', () => {
  it('spawns a new active QUEUE_ELEMENT at the back of the queue', () => {
    const { context, sceneManager } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2]);

    new QueueEngine().execute(context, gen('ENQUEUE', ['q', 3]));

    expect(queueEls(sceneManager).map((el) => el.value)).toEqual([1, 2, 3]);
    const newEl = queueEls(sceneManager)[2];
    expect(newEl.logicalIndex).toBe(2);
    expect(newEl.lifecycleState).toBe('ACTIVE');
  });

  it('drops the new box into line with a bounce, fades it in, and settles the others', () => {
    const { context, sceneManager, scheduler } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2]);

    new QueueEngine().execute(context, gen('ENQUEUE', ['q', 3]));

    const [first, , newEl] = queueEls(sceneManager);
    expect(scheduler.scheduled.find((t: any) => t.targets === newEl.position)).toMatchObject({ duration: 500, easing: 'easeOutBounce' });
    expect(scheduler.scheduled.find((t: any) => t.targets === newEl && 'opacity' in t)).toMatchObject({ opacity: 1, duration: 300 });
    expect(scheduler.scheduled.find((t: any) => t.targets === first.position)).toMatchObject({ duration: 400, easing: 'easeInOutQuad' });
  });

  it('logs an ENQUEUE event with the new queue size', () => {
    const { context, sceneManager, logs } = makeContext();
    seedQueue(sceneManager, 'q', [1]);

    new QueueEngine().execute(context, gen('ENQUEUE', ['q', 9]));

    expect(logs.find((l) => l.keyword === 'ENQUEUE')?.message).toBe('Enqueued 9 into queue "q".\nQueue size: 2');
  });
});

describe('QueueEngine DEQUEUE', () => {
  it('removes the front element (lowest logicalIndex) from the scene', () => {
    const { context, sceneManager } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2, 3]);

    new QueueEngine().execute(context, gen('DEQUEUE', ['q']));

    expect(queueEls(sceneManager)).toHaveLength(2);
    expect(queueEls(sceneManager).some((el) => el.value === 1)).toBe(false);
  });

  it('moves the remaining elements one place forward', () => {
    const { context, sceneManager } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2, 3]);

    new QueueEngine().execute(context, gen('DEQUEUE', ['q']));

    expect(queueEls(sceneManager).map((el) => el.value)).toEqual([2, 3]);
    expect(queueEls(sceneManager).map((el) => el.logicalIndex)).toEqual([0, 1]);
  });

  it('slides the front out to the left and fades it out in red', () => {
    const { context, sceneManager, scheduler } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2]);
    const front = queueEls(sceneManager)[0];

    new QueueEngine().execute(context, gen('DEQUEUE', ['q']));

    expect(scheduler.scheduled.find((t: any) => t.targets === front.position)).toMatchObject({ x: -3, duration: 400, easing: 'easeInQuad' });
    expect(scheduler.scheduled.find((t: any) => t.targets === front)).toMatchObject({ opacity: 0, color: '#f44336', duration: 400 });
  });

  it('throws StackUnderflowError when the queue is empty', () => {
    const { context, sceneManager } = makeContext();
    seedQueue(sceneManager, 'q', []);

    expect(() => new QueueEngine().execute(context, gen('DEQUEUE', ['q']))).toThrow(StackUnderflowError);
  });

  it('logs a DEQUEUE event naming the removed front value and new size', () => {
    const { context, sceneManager, logs } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2]);

    new QueueEngine().execute(context, gen('DEQUEUE', ['q']));

    expect(logs.find((l) => l.keyword === 'DEQUEUE')?.message).toBe('Dequeued "1" from front of queue "q".\nQueue size: 1');
  });
});

describe('QueueEngine FRONT / REAR', () => {
  it('logs FRONT for the lowest-index element without mutating the queue', () => {
    const { context, sceneManager, logs } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2, 3]);

    new QueueEngine().execute(context, gen('FRONT', ['q']));

    expect(queueEls(sceneManager)).toHaveLength(3);
    expect(logs.find((l) => l.keyword === 'FRONT')?.message).toBe('FRONT of queue "q": 1');
  });

  it('logs REAR for the highest-index element without mutating the queue', () => {
    const { context, sceneManager, logs } = makeContext();
    seedQueue(sceneManager, 'q', [1, 2, 3]);

    new QueueEngine().execute(context, gen('REAR', ['q']));

    expect(queueEls(sceneManager)).toHaveLength(3);
    expect(logs.find((l) => l.keyword === 'REAR')?.message).toBe('REAR of queue "q": 3');
  });

  it('does nothing when the queue is empty', () => {
    const { context, sceneManager, logs, scheduler } = makeContext();
    seedQueue(sceneManager, 'q', []);

    new QueueEngine().execute(context, gen('FRONT', ['q']));

    expect(logs).toHaveLength(0);
    expect(scheduler.scheduled).toHaveLength(0);
  });
});
