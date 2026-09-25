/**
 * Unit tests for StackEngine (packages/runtime/src/core/algorithms/StackEngine.ts)
 * — PUSH/POP/PEEK, extracted from AnimationController.buildAnimations.
 * Exercises the engine directly against real SceneManager/LayoutManager/
 * StateManager/EventDispatcher/RelationshipManager/LifecycleManager
 * instances (none of which touch animejs/window) plus a synchronous fake
 * AnimationScheduler and a plain-array virtualGraph, without going through
 * AnimationController at all.
 */
import { describe, expect, it } from 'vitest';
import { StackEngine, StackAnimationContext } from '../../packages/runtime/src/core/algorithms/StackEngine';
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

function makeContext(): { context: StackAnimationContext; sceneManager: SceneManager; eventDispatcher: EventDispatcher } {
  const eventDispatcher = new EventDispatcher();
  const sceneManager = new SceneManager(eventDispatcher);
  const relationshipManager = new RelationshipManager(eventDispatcher);
  const layoutManager = new LayoutManager(sceneManager, relationshipManager);
  const stateManager = new StateManager();
  const lifecycleManager = new LifecycleManager(sceneManager);
  const scheduler = makeFakeScheduler();

  const context: StackAnimationContext = {
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

function seedStack(sceneManager: SceneManager, name: string, values: number[]): any[] {
  const virtualGraph: any[] = [];
  values.forEach((value, logicalIndex) => {
    const el: any = {
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
    };
    sceneManager.addElement(el);
    virtualGraph.push(el);
  });
  return virtualGraph;
}

function makeGen(actionName: string, args: any[]): any {
  return { action: 'GENERIC_ACTION', actionName, args };
}

describe('StackEngine.push', () => {
  it('spawns a new active STACK_ELEMENT on top of the stack, in both the live scene and virtualGraph', () => {
    const { context, sceneManager } = makeContext();
    const virtualGraph = seedStack(sceneManager, 's', [1, 2]);

    new StackEngine().push(context, makeGen('PUSH', ['s', 3]), virtualGraph);

    const stackEls = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 's' && el.originalType === 'STACK_ELEMENT');
    expect(stackEls).toHaveLength(3);

    const newEl = stackEls.find((el: any) => el.value === 3) as any;
    expect(newEl).toBeDefined();
    expect(newEl.logicalIndex).toBe(2);
    expect(newEl.lifecycleState).toBe('ACTIVE');

    expect(virtualGraph.some((el: any) => el.value === 3)).toBe(true);
  });

  it('logs a PUSH event with the new stack size', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    const virtualGraph = seedStack(sceneManager, 's', [1]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new StackEngine().push(context, makeGen('PUSH', ['s', 9]), virtualGraph);

    const pushLog = logs.find((l) => l.keyword === 'PUSH');
    expect(pushLog?.message).toContain('Stack size: 2');
  });
});

describe('StackEngine.pop', () => {
  it('removes the top element from the live scene and the virtualGraph', () => {
    const { context, sceneManager } = makeContext();
    const virtualGraph = seedStack(sceneManager, 's', [1, 2, 3]);

    new StackEngine().pop(context, makeGen('POP', ['s']), virtualGraph);

    const stackEls = sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 's' && el.originalType === 'STACK_ELEMENT');
    expect(stackEls).toHaveLength(2);
    expect(stackEls.some((el: any) => el.value === 3)).toBe(false);
    expect(virtualGraph).toHaveLength(2);
  });

  it('throws StackUnderflowError when the stack is empty', () => {
    const { context, sceneManager } = makeContext();
    const virtualGraph = seedStack(sceneManager, 's', []);

    expect(() => new StackEngine().pop(context, makeGen('POP', ['s']), virtualGraph)).toThrow(StackUnderflowError);
  });
});

describe('StackEngine.peek', () => {
  it('logs the top value without mutating the stack', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    seedStack(sceneManager, 's', [1, 2, 3]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new StackEngine().peek(context, makeGen('PEEK', ['s']));

    expect(sceneManager.getSceneGraph().filter((el: any) => el.logicalParent === 's')).toHaveLength(3);
    const peekLog = logs.find((l) => l.keyword === 'PEEK');
    expect(peekLog?.message).toContain('3');
  });

  it('does nothing when the stack is empty', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    seedStack(sceneManager, 's', []);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new StackEngine().peek(context, makeGen('PEEK', ['s']));

    expect(logs).toHaveLength(0);
  });
});
