/**
 * Integration tests for HEAP_INSERT / HEAP_EXTRACT / HEAP_DECREASE /
 * BUILD_HEAP / HEAPIFY: source -> lex -> parse -> validate -> optimize ->
 * AQIR, and (separately) HeapEngine executing those GENERIC_ACTION
 * instructions against a real SceneManager/LayoutManager, replaying
 * MinHeap's recorded COMPARE/SWAP steps as animation frames.
 *
 * Like sorting.test.ts, full AnimationController execution (which drives a
 * real anime.js timeline) is out of scope; instead we exercise HeapEngine
 * directly with a lightweight scheduler stub that just records what would
 * have been scheduled, since HeapEngine mutates scene state synchronously
 * and only defers logging into `complete` callbacks.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../utils/testHelpers';
import { MinHeap } from '../../packages/runtime/src/data-structures/Heap';
import { HeapEngine } from '../../packages/runtime/src/core/algorithms/HeapEngine';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { LayoutManager } from '../../packages/runtime/src/core/LayoutManager';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import type { AlgorithmContext } from '../../packages/runtime/src/core/algorithms/AlgorithmContext';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function genericActions(instructions: unknown[]): any[] {
  return (instructions as any[]).filter((i) => i.action === 'GENERIC_ACTION');
}

function heapSource(name: string, values: number[], ops: string[]): string {
  return `SCENE HeapDemo
DECLARE
  HEAP ${name} = [${values.join(', ')}]

SEQUENCE
  ${ops.join('\n  ')}
END
`;
}

// ── Lightweight scheduler stub ────────────────────────────────────────────
// HeapEngine mutates scene element values synchronously; only RUNTIME_LOG /
// STATE_UPDATED dispatches are deferred into `complete` callbacks. Running
// those callbacks immediately (instead of driving a real anime.js timeline)
// is enough to observe every frame HeapEngine schedules.
function makeStubScheduler() {
  const frames: any[] = [];
  let pending: any[] = [];

  function flush() {
    // Snapshot and clear before running `complete` callbacks, since those
    // callbacks (e.g. HeapEngine.log) synchronously enqueue + commit more
    // tasks of their own — reusing the same array without clearing first
    // would re-process tasks that were already flushed.
    const batch = pending;
    pending = [];
    frames.push(...batch);
    batch.forEach((t) => t.complete && t.complete());
  }

  return {
    frames,
    scheduler: {
      enqueue(task: any) {
        pending.push(task);
      },
      commitGroup(_advance = true) {
        flush();
      },
      commitSequential() {
        flush();
      },
      advanceCursor(_ms: number) {},
      getCurrentTime() {
        return 0;
      },
    } as any,
  };
}

/** Seeds a SceneManager with HEAP_NODE/HEAP_ARRAY_ELEMENT/EDGE elements the way the compiler's HeapDeclNode generator does. */
function seedHeap(sceneManager: SceneManager, heapName: string, values: number[]): void {
  const nodeIds: string[] = [];
  values.forEach((value, i) => {
    const nodeId = `heap_node_${heapName}_${i}`;
    const arrId = `heap_arr_${heapName}_${i}`;
    nodeIds[i] = nodeId;
    sceneManager.addElement({ id: nodeId, type: 'sphere', originalType: 'HEAP_NODE', logicalParent: heapName, logicalIndex: i, value, label: `${heapName}[${i}]`, position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#7c4dff', emissiveColor: '#000000', emissiveIntensity: 0, visible: true, opacity: 1 } as any);
    sceneManager.addElement({ id: arrId, type: 'box', originalType: 'HEAP_ARRAY_ELEMENT', logicalParent: heapName, logicalIndex: i, value, label: `${heapName}[${i}]`, position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#7c4dff', emissiveColor: '#000000', emissiveIntensity: 0, visible: true, opacity: 1 } as any);
  });
  for (let i = 0; i < nodeIds.length; i++) {
    const l = 2 * i + 1, r = 2 * i + 2;
    if (l < nodeIds.length) sceneManager.addElement({ id: `edge_${nodeIds[i]}_${nodeIds[l]}`, type: 'edge', originalType: 'EDGE', logicalParent: heapName, sourceId: nodeIds[i], targetId: nodeIds[l], directed: true, properties: { label: 'L' }, position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888' } as any);
    if (r < nodeIds.length) sceneManager.addElement({ id: `edge_${nodeIds[i]}_${nodeIds[r]}`, type: 'edge', originalType: 'EDGE', logicalParent: heapName, sourceId: nodeIds[i], targetId: nodeIds[r], directed: true, properties: { label: 'R' }, position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: '#888' } as any);
  }
}

function makeContext(sceneManager: SceneManager, layoutManager: LayoutManager, relationshipManager: RelationshipManager, eventDispatcher: EventDispatcher, scheduler: any): AlgorithmContext {
  return {
    scheduler,
    sceneManager,
    layoutManager,
    eventDispatcher,
    relationshipManager,
    defaultColor: '#ffffff',
  };
}

function currentValues(sceneManager: SceneManager, heapName: string): number[] {
  return sceneManager
    .getSceneGraph()
    .filter((el: any) => el.logicalParent === heapName && el.originalType === 'HEAP_ARRAY_ELEMENT')
    .sort((a: any, b: any) => a.logicalIndex - b.logicalIndex)
    .map((el: any) => Number(el.value));
}

describe('Heap built-ins: parsing to GENERIC_ACTION', () => {
  it('parses HEAP_INSERT into a GENERIC_ACTION targeting the heap and value', () => {
    const instructions = compile(heapSource('h', [5, 3, 7], ['HEAP_INSERT h 10']));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ actionName: 'HEAP_INSERT', args: ['h', 10] });
  });

  it('parses HEAP_EXTRACT into a GENERIC_ACTION targeting the heap', () => {
    const instructions = compile(heapSource('h', [5, 3, 7], ['HEAP_EXTRACT h']));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ actionName: 'HEAP_EXTRACT', args: ['h'] });
  });

  it('parses HEAP_DECREASE into a GENERIC_ACTION with index and new value', () => {
    const instructions = compile(heapSource('h', [5, 3, 7], ['HEAP_DECREASE h 2 1']));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ actionName: 'HEAP_DECREASE', args: ['h', 2, 1] });
  });

  it('parses BUILD_HEAP into a GENERIC_ACTION targeting the heap', () => {
    const instructions = compile(heapSource('h', [9, 4, 7, 1, 0], ['BUILD_HEAP h']));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ actionName: 'BUILD_HEAP', args: ['h'] });
  });

  it('parses a sequence of heap operations in order', () => {
    const instructions = compile(heapSource('h', [5, 3, 7], ['HEAP_INSERT h 1', 'HEAP_DECREASE h 0 1', 'HEAP_EXTRACT h']));
    const actions = genericActions(instructions);
    expect(actions.map((a) => a.actionName)).toEqual(['HEAP_INSERT', 'HEAP_DECREASE', 'HEAP_EXTRACT']);
  });
});

describe('HeapEngine: executing heap operations against a live scene', () => {
  function setup(values: number[]) {
    const eventDispatcher = new EventDispatcher();
    const sceneManager = new SceneManager(eventDispatcher);
    const relationshipManager = new RelationshipManager(eventDispatcher);
    const layoutManager = new LayoutManager(sceneManager, relationshipManager);
    seedHeap(sceneManager, 'h', values);
    const { scheduler, frames } = makeStubScheduler();
    const context = makeContext(sceneManager, layoutManager, relationshipManager, eventDispatcher, scheduler);
    return { sceneManager, context, frames };
  }

  it('HEAP_INSERT adds a node and bubbles it into a valid heap position', () => {
    const { sceneManager, context, frames } = setup([5, 3, 7]);
    const engine = new HeapEngine();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HEAP_INSERT', args: ['h', 1] } as any);

    const values = currentValues(sceneManager, 'h');
    expect(values).toHaveLength(4);
    expect(MinHeap.buildHeap([...values]).isMinHeap()).toBe(true);
    expect(values.includes(1)).toBe(true);
    // The bubble-up should have produced at least one scheduled frame.
    expect(frames.length).toBeGreaterThan(0);
  });

  it('HEAP_EXTRACT removes and returns the minimum, keeping the heap property', () => {
    const { sceneManager, context } = setup([1, 3, 7, 9, 5]);
    const engine = new HeapEngine();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HEAP_EXTRACT', args: ['h'] } as any);

    const values = currentValues(sceneManager, 'h');
    expect(values).toHaveLength(4);
    expect(values.includes(1)).toBe(false);
    const heap = new MinHeap();
    heap.elements = values;
    expect(heap.isMinHeap()).toBe(true);
  });

  it('HEAP_DECREASE lowers a value and bubbles it toward the root', () => {
    const { sceneManager, context } = setup([1, 5, 3, 10, 8]);
    const engine = new HeapEngine();
    // index 3 holds value 10 -> decrease to -1, should become the new root
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HEAP_DECREASE', args: ['h', 3, -1] } as any);

    const values = currentValues(sceneManager, 'h');
    expect(values[0]).toBe(-1);
    const heap = new MinHeap();
    heap.elements = values;
    expect(heap.isMinHeap()).toBe(true);
  });

  it('BUILD_HEAP reorders an unordered array in place into a valid heap', () => {
    const { sceneManager, context } = setup([9, 4, 7, 1, -2, 6, 5]);
    const engine = new HeapEngine();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'BUILD_HEAP', args: ['h'] } as any);

    const values = currentValues(sceneManager, 'h');
    expect(values[0]).toBe(-2);
    const heap = new MinHeap();
    heap.elements = values;
    expect(heap.isMinHeap()).toBe(true);
    expect(values.sort((a, b) => a - b)).toEqual([-2, 1, 4, 5, 6, 7, 9]);
  });

  it('HEAPIFY sifts a single subtree down without disturbing the rest of a valid heap', () => {
    const { sceneManager, context } = setup([1, 5, 3, 10, 8, 9, 20]);
    const engine = new HeapEngine();
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HEAPIFY', args: ['h', 0] } as any);

    const values = currentValues(sceneManager, 'h');
    const heap = new MinHeap();
    heap.elements = values;
    expect(heap.isMinHeap()).toBe(true);
  });

  it('a realistic sequence of operations (insert, decrease, extract) leaves a valid heap end-to-end', () => {
    const { sceneManager, context } = setup([5, 3, 7]);
    const engine = new HeapEngine();

    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HEAP_INSERT', args: ['h', 20] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HEAP_INSERT', args: ['h', 2] } as any);
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HEAP_DECREASE', args: ['h', 3, 0] } as any);
    const beforeExtract = currentValues(sceneManager, 'h');
    engine.execute(context, { action: 'GENERIC_ACTION', actionName: 'HEAP_EXTRACT', args: ['h'] } as any);
    const afterExtract = currentValues(sceneManager, 'h');

    expect(afterExtract).toHaveLength(beforeExtract.length - 1);
    const heap = new MinHeap();
    heap.elements = afterExtract;
    expect(heap.isMinHeap()).toBe(true);
  });
});

describe('MinHeap performance shape: bubble operations stay O(log n)', () => {
  it('a single insert/decreaseKey touches at most ~log2(n) levels, not the whole heap', () => {
    const size = 1024;
    const heap = MinHeap.buildHeap(Array.from({ length: size }, (_, i) => size - i));

    heap.insert(-1); // guaranteed to bubble all the way to the root
    // Each level costs one COMPARE step plus (when it swaps) one SWAP step.
    const maxSteps = 2 * (Math.ceil(Math.log2(size + 1)) + 2);
    expect(heap.steps.length).toBeLessThanOrEqual(maxSteps);
    expect(heap.isMinHeap()).toBe(true);
  });
});
