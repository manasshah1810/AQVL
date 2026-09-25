/**
 * Unit tests for LinkedListEngine (packages/runtime/src/core/algorithms/LinkedListEngine.ts)
 * — INSERT_HEAD/INSERT_TAIL/DELETE_HEAD/DELETE_TAIL/REVERSE, extracted from
 * AnimationController.executeInstruction. Exercises the engine directly
 * against real SceneManager/LayoutManager/StateManager/EventDispatcher/
 * RelationshipManager instances (none of which touch animejs/window) plus a
 * synchronous fake AnimationScheduler, without going through
 * AnimationController or a compiled program at all.
 */
import { describe, expect, it } from 'vitest';
import { LinkedListEngine } from '../../packages/runtime/src/core/algorithms/LinkedListEngine';
import { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';

/** Runs every queued task's `complete` callback synchronously and immediately, modeling an instant-playback timeline without needing a real AnimationScheduler/TimelineEngine/animejs. */
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

/** Seeds a singly (or doubly/circular) linked list: HEAD -> data nodes -> NULL (or back to head, if circular). */
function seedLinkedList(sceneManager: SceneManager, name: string, values: number[], opts: { doubly?: boolean; circular?: boolean } = {}) {
  const { doubly = false, circular = false } = opts;

  const node = (id: string, originalType: string, value: any): any => ({
    id, type: 'sphere', originalType, logicalParent: name, value, label: String(value),
    position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#fff',
    lifecycleState: 'ACTIVE', visible: true, opacity: 1,
  });
  const edge = (id: string, sourceId: string, targetId: string, extra: any = {}): any => ({
    id, type: 'edge', originalType: 'EDGE', logicalParent: name, sourceId, targetId, directed: true,
    position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888888',
    lifecycleState: 'ACTIVE', visible: true, opacity: 1, ...extra,
  });

  const headId = `${name}_head`;
  const nullId = `${name}_null`;
  sceneManager.addElement(node(headId, 'HEAD', 'HEAD'));

  const dataIds = values.map((v, i) => `${name}_n${i}`);
  dataIds.forEach((id, i) => sceneManager.addElement(node(id, 'LINKEDLIST_NODE', values[i])));

  if (!circular || dataIds.length === 0) {
    sceneManager.addElement(node(nullId, 'NULL', 'NULL'));
  }

  let prevId = headId;
  for (const id of dataIds) {
    sceneManager.addElement(edge(`e_${prevId}_${id}`, prevId, id));
    if (doubly) sceneManager.addElement(edge(`e_${id}_${prevId}`, id, prevId, { backward: true }));
    prevId = id;
  }

  if (circular && dataIds.length > 0) {
    sceneManager.addElement(edge(`e_${prevId}_${dataIds[0]}`, prevId, dataIds[0], { circular: true }));
  } else {
    sceneManager.addElement(edge(`e_${prevId}_${nullId}`, prevId, nullId));
    if (doubly) sceneManager.addElement(edge(`e_${nullId}_${prevId}`, nullId, prevId, { backward: true }));
  }

  return { headId, nullId, dataIds };
}

/** Walks forward edges from HEAD, returning data node values in list order. */
function readOrder(sceneManager: SceneManager, name: string, headId: string, nullId: string | undefined): any[] {
  const scene = sceneManager.getSceneGraph() as any[];
  const forwardEdges = scene.filter((el) => el.logicalParent === name && el.type === 'edge' && !el.backward);
  const values: any[] = [];
  let currentId = forwardEdges.find((e) => e.sourceId === headId)?.targetId;
  const visited = new Set<string>();
  while (currentId && currentId !== nullId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = scene.find((el) => el.id === currentId);
    if (!node || node.originalType === 'NULL' || node.originalType === 'HEAD') break;
    values.push(node.value);
    currentId = forwardEdges.find((e) => e.sourceId === currentId)?.targetId;
  }
  return values;
}

function makeGen(actionName: string, args: any[], logicalParent: string): any {
  return { action: 'GENERIC_ACTION', actionName, args, payload: { logicalParent } };
}

describe('LinkedListEngine.insert', () => {
  it('INSERT_HEAD adds a new node before the current first node', () => {
    const { context, sceneManager } = makeContext();
    const { headId, nullId } = seedLinkedList(sceneManager, 'list', [10, 20]);

    new LinkedListEngine().insert(context, makeGen('INSERT_HEAD', ['list', 5], 'list'), 'INSERT_HEAD');

    expect(readOrder(sceneManager, 'list', headId, nullId)).toEqual([5, 10, 20]);
    const newNode = sceneManager.getSceneGraph().find((el: any) => el.value === 5 && el.originalType === 'LINKEDLIST_NODE');
    expect(newNode).toBeDefined();
  });

  it('INSERT_TAIL adds a new node after the current last node', () => {
    const { context, sceneManager } = makeContext();
    const { headId, nullId } = seedLinkedList(sceneManager, 'list', [10, 20]);

    new LinkedListEngine().insert(context, makeGen('INSERT_TAIL', ['list', 30], 'list'), 'INSERT_TAIL');

    expect(readOrder(sceneManager, 'list', headId, nullId)).toEqual([10, 20, 30]);
  });

  it('INSERT_HEAD on an empty list links HEAD -> new node -> NULL', () => {
    const { context, sceneManager } = makeContext();
    const { headId, nullId } = seedLinkedList(sceneManager, 'list', []);

    new LinkedListEngine().insert(context, makeGen('INSERT_HEAD', ['list', 42], 'list'), 'INSERT_HEAD');

    expect(readOrder(sceneManager, 'list', headId, nullId)).toEqual([42]);
  });

  it('logs a RESULT event when insertion completes', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    seedLinkedList(sceneManager, 'list', [10]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new LinkedListEngine().insert(context, makeGen('INSERT_TAIL', ['list', 20], 'list'), 'INSERT_TAIL');

    expect(logs.some((l) => l.keyword === 'RESULT' && l.message.includes('Insertion Complete'))).toBe(true);
  });
});

describe('LinkedListEngine.remove', () => {
  it('DELETE_HEAD removes the first data node and relinks HEAD to the next node', () => {
    const { context, sceneManager } = makeContext();
    const { headId, nullId } = seedLinkedList(sceneManager, 'list', [10, 20, 30]);

    new LinkedListEngine().remove(context, makeGen('DELETE_HEAD', ['list'], 'list'), 'DELETE_HEAD');

    expect(readOrder(sceneManager, 'list', headId, nullId)).toEqual([20, 30]);
    expect(sceneManager.getSceneGraph().some((el: any) => el.value === 10)).toBe(false);
  });

  it('DELETE_TAIL removes the last data node and relinks the new last node to NULL', () => {
    const { context, sceneManager } = makeContext();
    const { headId, nullId } = seedLinkedList(sceneManager, 'list', [10, 20, 30]);

    new LinkedListEngine().remove(context, makeGen('DELETE_TAIL', ['list'], 'list'), 'DELETE_TAIL');

    expect(readOrder(sceneManager, 'list', headId, nullId)).toEqual([10, 20]);
    expect(sceneManager.getSceneGraph().some((el: any) => el.value === 30)).toBe(false);
  });

  it('DELETE_HEAD on a single-element list empties the list (HEAD -> NULL)', () => {
    const { context, sceneManager } = makeContext();
    const { headId, nullId } = seedLinkedList(sceneManager, 'list', [10]);

    new LinkedListEngine().remove(context, makeGen('DELETE_HEAD', ['list'], 'list'), 'DELETE_HEAD');

    expect(readOrder(sceneManager, 'list', headId, nullId)).toEqual([]);
  });

  it('no-ops on an already-empty list', () => {
    const { context, sceneManager } = makeContext();
    seedLinkedList(sceneManager, 'list', []);
    const before = sceneManager.getSceneGraph().length;

    new LinkedListEngine().remove(context, makeGen('DELETE_HEAD', ['list'], 'list'), 'DELETE_HEAD');

    expect(sceneManager.getSceneGraph().length).toBe(before);
  });

  it('logs a RESULT event when deletion completes', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    seedLinkedList(sceneManager, 'list', [10, 20]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new LinkedListEngine().remove(context, makeGen('DELETE_HEAD', ['list'], 'list'), 'DELETE_HEAD');

    expect(logs.some((l) => l.keyword === 'RESULT' && l.message.includes('Deletion Complete'))).toBe(true);
  });
});

describe('LinkedListEngine.reverse', () => {
  it('reverses the order of data nodes', () => {
    const { context, sceneManager } = makeContext();
    const { headId, nullId } = seedLinkedList(sceneManager, 'list', [10, 20, 30]);

    new LinkedListEngine().reverse(context, makeGen('REVERSE', ['list'], 'list'));

    expect(readOrder(sceneManager, 'list', headId, nullId)).toEqual([30, 20, 10]);
  });

  it('no-ops on a list with fewer than 2 data nodes', () => {
    const { context, sceneManager } = makeContext();
    const { headId, nullId } = seedLinkedList(sceneManager, 'list', [10]);

    new LinkedListEngine().reverse(context, makeGen('REVERSE', ['list'], 'list'));

    expect(readOrder(sceneManager, 'list', headId, nullId)).toEqual([10]);
  });

  it('logs a RESULT event when reversal completes', () => {
    const { context, sceneManager, eventDispatcher } = makeContext();
    seedLinkedList(sceneManager, 'list', [10, 20]);

    const logs: any[] = [];
    eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));

    new LinkedListEngine().reverse(context, makeGen('REVERSE', ['list'], 'list'));

    expect(logs.some((l) => l.keyword === 'RESULT' && l.message.includes('Reversed Successfully'))).toBe(true);
  });
});
