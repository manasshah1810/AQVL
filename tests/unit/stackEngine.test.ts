/**
 * Unit tests for the stack's two layers:
 * - Stack (packages/runtime/src/data-structures/Stack.ts), the pure LIFO
 *   structure, with no runtime dependencies;
 * - StackEngine (packages/runtime/src/core/algorithms/StackEngine.ts), the
 *   PUSH / POP / PEEK handler that replays Stack's recorded steps onto the
 *   scene. Exercised directly against real SceneManager/LayoutManager/
 *   StateManager/EventDispatcher/RelationshipManager/LifecycleManager
 *   instances (none of which touch animejs/window) plus a synchronous fake
 *   AnimationScheduler, without going through AnimationController.
 */
import { describe, expect, it } from 'vitest';
import { Stack, STACK_STEP_PRIMITIVES } from '../../packages/runtime/src/data-structures/Stack';
import { isPrimitive } from '../../packages/runtime/src/data-structures/steps';
import { StackEngine } from '../../packages/runtime/src/core/algorithms/StackEngine';
import type { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';
import { LifecycleManager } from '../../packages/runtime/src/core/LifecycleManager';
import { StackUnderflowError } from '../../packages/shared/src/index';

describe('Stack', () => {
  it('pops in last-in, first-out order', () => {
    const stack = new Stack<number>();
    [1, 2, 3].forEach((v) => stack.push(v));
    expect(stack.toArray()).toEqual([1, 2, 3]);
    expect([stack.pop(), stack.pop(), stack.pop()]).toEqual([3, 2, 1]);
    expect(stack.isEmpty()).toBe(true);
  });

  it('peek returns the top without removing it', () => {
    const stack = new Stack<number>();
    stack.elements = [4, 5];
    expect(stack.peek()).toBe(5);
    expect(stack.size).toBe(2);
  });

  it('records one step per operation, reset on every call', () => {
    const stack = new Stack<number>();
    stack.elements = [7];
    stack.push(8);
    expect(stack.steps).toEqual([{ type: 'PUSH', index: 1, value: 8 }]);
    stack.peek();
    expect(stack.steps).toEqual([{ type: 'PEEK', index: 1, value: 8 }]);
    stack.pop();
    expect(stack.steps).toEqual([{ type: 'POP', index: 1, value: 8 }]);
  });

  it('pop and peek on an empty stack return undefined and record nothing', () => {
    const stack = new Stack<number>();
    expect(stack.pop()).toBeUndefined();
    expect(stack.steps).toEqual([]);
    expect(stack.peek()).toBeUndefined();
    expect(stack.steps).toEqual([]);
  });

  it('every step type is an AQIR primitive', () => {
    for (const p of Object.values(STACK_STEP_PRIMITIVES)) expect(isPrimitive(p)).toBe(true);
    expect(STACK_STEP_PRIMITIVES.PUSH).toEqual({ kind: 'MUTATE', verb: 'create' });
    expect(STACK_STEP_PRIMITIVES.POP).toEqual({ kind: 'MUTATE', verb: 'destroy' });
    expect(STACK_STEP_PRIMITIVES.PEEK).toEqual({ kind: 'ANNOTATE', verb: 'focus' });
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

function seedStack(sceneManager: SceneManager, name: string, values: number[]): void {
  values.forEach((value, logicalIndex) => {
    sceneManager.addElement({
      id: `${name}_${logicalIndex}`,
      type: 'box',
      originalType: 'STACK_ELEMENT',
      logicalParent: name,
      logicalIndex,
      value,
      position: { x: 0, y: logicalIndex, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#fff',
      lifecycleState: 'ACTIVE',
      visible: true,
      opacity: 1,
    } as any);
  });
}

const gen = (actionName: string, args: any[]): any => ({ action: 'GENERIC_ACTION', actionName, args });
const stackEls = (sceneManager: SceneManager, name = 's') =>
  sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === name && el.originalType === 'STACK_ELEMENT') as any[];

describe('StackEngine PUSH', () => {
  it('spawns a new active STACK_ELEMENT on top of the stack', () => {
    const { context, sceneManager } = makeContext();
    seedStack(sceneManager, 's', [1, 2]);

    new StackEngine().execute(context, gen('PUSH', ['s', 3]));

    expect(stackEls(sceneManager)).toHaveLength(3);
    const newEl = stackEls(sceneManager).find((el) => el.value === 3);
    expect(newEl).toBeDefined();
    expect(newEl.logicalIndex).toBe(2);
    expect(newEl.lifecycleState).toBe('ACTIVE');
  });

  it('drops the new box in from above with a bounce and fades it in', () => {
    const { context, sceneManager, scheduler } = makeContext();
    seedStack(sceneManager, 's', [1]);

    new StackEngine().execute(context, gen('PUSH', ['s', 9]));

    const newEl = stackEls(sceneManager).find((el) => el.value === 9);
    const drop = scheduler.scheduled.find((t: any) => t.targets === newEl.position);
    const fade = scheduler.scheduled.find((t: any) => t.targets === newEl && 'opacity' in t);
    expect(drop).toMatchObject({ duration: 500, easing: 'easeOutBounce', y: newEl.worldTarget.y });
    expect(fade).toMatchObject({ opacity: 1, duration: 300 });
    expect(newEl.color).toBe(StackEngine.NODE_COLOR);
  });

  it('logs a PUSH event with the new stack size', () => {
    const { context, sceneManager, logs } = makeContext();
    seedStack(sceneManager, 's', [1]);

    new StackEngine().execute(context, gen('PUSH', ['s', 9]));

    expect(logs.find((l) => l.keyword === 'PUSH')?.message).toBe('Pushed 9 onto stack "s".\nStack size: 2');
  });
});

describe('StackEngine POP', () => {
  it('removes the top element from the scene', () => {
    const { context, sceneManager } = makeContext();
    seedStack(sceneManager, 's', [1, 2, 3]);

    new StackEngine().execute(context, gen('POP', ['s']));

    expect(stackEls(sceneManager)).toHaveLength(2);
    expect(stackEls(sceneManager).some((el) => el.value === 3)).toBe(false);
  });

  it('lifts the top away and fades it out in red before removing it', () => {
    const { context, sceneManager, scheduler } = makeContext();
    seedStack(sceneManager, 's', [1, 2]);
    const top = stackEls(sceneManager).find((el) => el.value === 2);

    new StackEngine().execute(context, gen('POP', ['s']));

    expect(scheduler.scheduled.find((t: any) => t.targets === top.position)).toMatchObject({ y: 4, duration: 400, easing: 'easeInQuad' });
    expect(scheduler.scheduled.find((t: any) => t.targets === top)).toMatchObject({ opacity: 0, color: '#f44336', duration: 400 });
  });

  it('logs the popped value and the new size', () => {
    const { context, sceneManager, logs } = makeContext();
    seedStack(sceneManager, 's', [1, 2, 3]);

    new StackEngine().execute(context, gen('POP', ['s']));

    expect(logs.find((l) => l.keyword === 'POP')?.message).toBe('Popped "3" from stack "s".\nStack size: 2');
  });

  it('throws StackUnderflowError when the stack is empty', () => {
    const { context, sceneManager } = makeContext();
    seedStack(sceneManager, 's', []);

    expect(() => new StackEngine().execute(context, gen('POP', ['s']))).toThrow(StackUnderflowError);
  });
});

describe('StackEngine PEEK', () => {
  it('logs the top value without mutating the stack', () => {
    const { context, sceneManager, logs } = makeContext();
    seedStack(sceneManager, 's', [1, 2, 3]);

    new StackEngine().execute(context, gen('PEEK', ['s']));

    expect(stackEls(sceneManager)).toHaveLength(3);
    expect(logs.find((l) => l.keyword === 'PEEK')?.message).toBe('Top of stack "s": 3');
  });

  it('does nothing when the stack is empty', () => {
    const { context, sceneManager, logs, scheduler } = makeContext();
    seedStack(sceneManager, 's', []);

    new StackEngine().execute(context, gen('PEEK', ['s']));

    expect(logs).toHaveLength(0);
    expect(scheduler.scheduled).toHaveLength(0);
  });
});
