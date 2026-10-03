/**
 * Unit tests for the BST's two layers:
 * - BinarySearchTree (packages/runtime/src/data-structures/BST.ts), the pure
 *   tree, with no runtime dependencies;
 * - BSTEngine (packages/runtime/src/core/algorithms/BSTEngine.ts), the
 *   BST_INSERT / BST_SEARCH / BST_DELETE / ROTATE / ... handler that
 *   rehydrates the tree from the scene and replays its recorded steps.
 *   Exercised directly against real SceneManager/LayoutManager/StateManager/
 *   EventDispatcher/RelationshipManager instances plus a synchronous fake
 *   AnimationScheduler, without going through AnimationController.
 */
import { describe, expect, it } from 'vitest';
import { BinarySearchTree, BST_STEP_PRIMITIVES } from '../../packages/runtime/src/data-structures/BST';
import { isPrimitive } from '../../packages/runtime/src/data-structures/steps';
import { BSTEngine } from '../../packages/runtime/src/core/algorithms/BSTEngine';
import type { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { StateManager } from '../../packages/runtime/src/core/StateManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';

function treeOf(values: number[]): BinarySearchTree {
  const tree = new BinarySearchTree();
  values.forEach((v) => tree.insert(v));
  return tree;
}

const types = (tree: BinarySearchTree) => tree.steps.map((s) => s.type);

describe('BinarySearchTree', () => {
  it('insert records a COMPARE per node passed, then ATTACH under the right parent', () => {
    const tree = treeOf([50, 30, 70]);
    expect(tree.insert(40)).toBe(true);
    expect(tree.steps).toEqual([
      { type: 'COMPARE', walk: 'INSERT', node: { id: '50', value: 50 }, value: 40, side: 'L' },
      { type: 'COMPARE', walk: 'INSERT', node: { id: '30', value: 30 }, value: 40, side: 'R' },
      { type: 'ATTACH', value: 40, parent: { id: '30', value: 30 }, side: 'R' },
    ]);
    expect(tree.traverse('INORDER')).toEqual([30, 40, 50, 70]);
  });

  it('insert into an empty tree attaches the root; a duplicate records DUPLICATE and changes nothing', () => {
    const tree = new BinarySearchTree();
    tree.insert(10);
    expect(tree.steps).toEqual([{ type: 'ATTACH', value: 10, parent: null, side: null }]);
    expect(tree.insert(10)).toBe(false);
    expect(tree.steps).toEqual([{ type: 'DUPLICATE', node: { id: '10', value: 10 }, value: 10 }]);
    expect(tree.size()).toBe(1);
  });

  it('search ends in FOUND or NOT_FOUND; steps are reset on every call', () => {
    const tree = treeOf([50, 30, 70]);
    expect(tree.search(70)).toEqual({ id: '70', value: 70 });
    expect(types(tree)).toEqual(['COMPARE', 'FOUND']);
    expect(tree.search(65)).toBeNull();
    expect(types(tree)).toEqual(['COMPARE', 'COMPARE', 'NOT_FOUND']);
  });

  it('delete handles a leaf, a node with one child and a node with two children', () => {
    const tree = treeOf([50, 30, 70, 20, 60, 80, 65]);

    expect(tree.delete(20)).toBe(true);
    expect(tree.steps.at(-1)).toMatchObject({ type: 'REMOVE', deleteCase: 'LEAF', parent: { value: 30 }, side: 'L' });

    expect(tree.delete(60)).toBe(true);
    expect(tree.steps.at(-1)).toMatchObject({ type: 'REMOVE', deleteCase: 'ONE_CHILD', replacement: { value: 65 } });

    expect(tree.delete(50)).toBe(true);
    expect(types(tree)).toEqual(['FOUND', 'SUCCESSOR_WALK', 'SUCCESSOR', 'REMOVE']);
    expect(tree.steps.at(-1)).toMatchObject({ deleteCase: 'TWO_CHILDREN', successor: { value: 65 } });
    expect(tree.traverse('INORDER')).toEqual([30, 65, 70, 80]);

    expect(tree.delete(99)).toBe(false);
    expect(tree.steps.at(-1)).toEqual({ type: 'NOT_FOUND', walk: 'DELETE', value: 99 });
  });

  it('rotate lifts the child, moves the inner grandchild across, and keeps the order', () => {
    const tree = treeOf([50, 30, 70, 60, 80]);
    expect(tree.rotate('50', 'L')).toEqual({ success: true });
    expect(tree.steps).toEqual([
      {
        type: 'ROTATE',
        direction: 'L',
        pivot: { id: '50', value: 50 },
        child: { id: '70', value: 70 },
        grandchild: { id: '60', value: 60 },
        parent: null,
        parentSide: null,
      },
    ]);
    expect(tree.root!.value).toBe(70);
    expect(tree.traverse('PREORDER')).toEqual([70, 50, 30, 60, 80]);
    expect(tree.rotate('30', 'R')).toEqual({ success: false, error: 'Cannot rotate right: node 30 has no left child.' });
    expect(tree.steps).toEqual([]);
  });

  it('traversals, level order, min / max, height and size record their walks', () => {
    const tree = treeOf([50, 30, 70, 20]);
    expect(tree.traverse('POSTORDER')).toEqual([20, 30, 70, 50]);
    expect(tree.steps.filter((s) => s.type === 'BACKTRACK')).toHaveLength(3);
    expect(tree.levelOrder()).toEqual([50, 30, 70, 20]);
    expect(types(tree).slice(0, 3)).toEqual(['ENQUEUE', 'DEQUEUE', 'PROCESS']);
    expect(tree.min()).toEqual({ id: '20', value: 20 });
    expect(types(tree)).toEqual(['DESCEND', 'DESCEND', 'DESCEND', 'EXTREME']);
    expect(tree.max()).toEqual({ id: '70', value: 70 });
    expect(tree.height()).toBe(3);
    expect(tree.steps.at(-1)).toEqual({ type: 'HEIGHT', node: { id: '50', value: 50 }, height: 3 });
    expect(tree.size()).toBe(4);
    expect(tree.steps.at(-1)).toMatchObject({ type: 'COUNT', count: 4 });
  });

  it('fromLinks rebuilds a tree from a root and a child lookup', () => {
    const links: Record<string, { L?: string; R?: string }> = { a: { L: 'b', R: 'c' } };
    const values: Record<string, number> = { a: 5, b: 2, c: 9 };
    const tree = BinarySearchTree.fromLinks({ id: 'a', value: 5 }, (id, side) => {
      const child = links[id]?.[side];
      return child ? { id: child, value: values[child] } : null;
    });
    expect(tree.traverse('INORDER')).toEqual([2, 5, 9]);
    expect(tree.find(9)!.parent!.id).toBe('a');
  });

  it('every step type is an AQIR primitive', () => {
    for (const p of Object.values(BST_STEP_PRIMITIVES)) expect(isPrimitive(p)).toBe(true);
    expect(BST_STEP_PRIMITIVES.ATTACH).toEqual({ kind: 'MUTATE', verb: 'create' });
    expect(BST_STEP_PRIMITIVES.REMOVE).toEqual({ kind: 'MUTATE', verb: 'destroy' });
    expect(BST_STEP_PRIMITIVES.ROTATE).toEqual({ kind: 'RELATE', verb: 'link' });
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
  const context: AlgorithmContext = {
    scheduler: makeFakeScheduler(),
    sceneManager,
    layoutManager,
    eventDispatcher,
    stateManager: new StateManager(),
    relationshipManager,
    activeTreeName: 't',
    defaultColor: '#ffffff',
  };
  const logs: any[] = [];
  eventDispatcher.on('RUNTIME_LOG', (msg: any) => logs.push(msg));
  return { context, sceneManager, logs };
}

const gen = (actionName: string, args: any[] = []): any => ({ action: 'GENERIC_ACTION', actionName, args });
const inorder = (sceneManager: SceneManager) => BSTEngine.rehydrate(sceneManager, 't').traverse('INORDER');

describe('BSTEngine', () => {
  it('BST_INSERT builds the tree in the scene: a node per key, an L / R edge per child', () => {
    const { context, sceneManager, logs } = makeContext();
    const engine = new BSTEngine();
    [50, 30, 70, 40].forEach((v) => engine.execute(context, gen('BST_INSERT', [v])));

    expect(BSTEngine.getNodes(sceneManager, 't')).toHaveLength(4);
    expect(BSTEngine.getEdges(sceneManager, 't').map((e: any) => e.properties.label)).toEqual(['L', 'R', 'R']);
    expect(inorder(sceneManager)).toEqual([30, 40, 50, 70]);
    expect(logs.at(-1).message).toBe('Inserted 40 successfully as Right child of 30.');
  });

  it('a duplicate insert only reports the error', () => {
    const { context, sceneManager, logs } = makeContext();
    const engine = new BSTEngine();
    engine.execute(context, gen('BST_INSERT', [5]));
    engine.execute(context, gen('BST_INSERT', [5]));
    expect(BSTEngine.getNodes(sceneManager, 't')).toHaveLength(1);
    expect(logs.at(-1)).toMatchObject({ keyword: 'INSERT_ERROR', message: 'Value 5 already exists.' });
  });

  it('BST_DELETE of a node with two children copies its successor up and removes the successor', () => {
    const { context, sceneManager, logs } = makeContext();
    const engine = new BSTEngine();
    [50, 30, 70, 60, 80].forEach((v) => engine.execute(context, gen('BST_INSERT', [v])));
    engine.execute(context, gen('BST_DELETE', [50]));
    expect(inorder(sceneManager)).toEqual([30, 60, 70, 80]);
    expect(logs.some((l) => l.message.startsWith('Inorder Successor = 60'))).toBe(true);
    expect(logs.at(-1).message).toBe('Deleted 50 successfully. BST property maintained.');
  });

  it('ROTATE rewires the scene edges', () => {
    const { context, sceneManager } = makeContext();
    const engine = new BSTEngine();
    [50, 30, 70, 60, 80].forEach((v) => engine.execute(context, gen('BST_INSERT', [v])));
    engine.execute(context, gen('ROTATE', [50, 'LEFT']));
    const tree = BSTEngine.rehydrate(sceneManager, 't');
    expect(tree.root!.value).toBe(70);
    expect(tree.traverse('PREORDER')).toEqual([70, 50, 30, 60, 80]);
  });

  it('BST_SEARCH logs a comparison per node and the outcome', () => {
    const { context, logs } = makeContext();
    const engine = new BSTEngine();
    [50, 30].forEach((v) => engine.execute(context, gen('BST_INSERT', [v])));
    logs.length = 0;
    engine.execute(context, gen('BST_SEARCH', [30]));
    expect(logs.map((l) => l.message)).toEqual(['Searching for 30...', '30 < 50 → Go Left', '30 = 30 → Found!', 'Value 30 found!']);
  });

  it('BST_CLEAR removes every node and edge', () => {
    const { context, sceneManager } = makeContext();
    const engine = new BSTEngine();
    [2, 1, 3].forEach((v) => engine.execute(context, gen('BST_INSERT', [v])));
    engine.execute(context, gen('BST_CLEAR'));
    expect(BSTEngine.getNodes(sceneManager, 't')).toHaveLength(0);
    expect(BSTEngine.getEdges(sceneManager, 't')).toHaveLength(0);
  });

  it('isBSTTarget routes by the named structure, falling back to the scene flag', () => {
    const { sceneManager } = makeContext();
    sceneManager.addElement({ id: 'a', type: 'BST', logicalParent: 'bst' } as any);
    sceneManager.addElement({ id: 'b', type: 'ARRAY', logicalParent: 'arr' } as any);
    expect(BSTEngine.isBSTTarget(sceneManager, 'bst', false)).toBe(true);
    expect(BSTEngine.isBSTTarget(sceneManager, 'arr', true)).toBe(false);
    expect(BSTEngine.isBSTTarget(sceneManager, undefined, true)).toBe(true);
    expect(BSTEngine.detectActiveTree(sceneManager)).toEqual({ name: 'bst', isBST: true });
  });
});
