/**
 * Renderer migration verification — HEAP. There was never a dedicated
 * HeapRenderer.tsx (see docs/design/existing-layout-audit.md, "Scope note on
 * structures") — heap nodes rendered through TreeRenderer and the backing
 * array through ArrayRenderer, both gone now. This asserts directly against
 * the scene graph GenericSceneRenderer's mapping functions consume: the
 * heap-as-tree view (HEAP_NODE, hierarchy-shaped) and the heap-as-array view
 * (HEAP_ARRAY_ELEMENT, line-shaped) after a bubble-up-triggering insert.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

const NODE_SHAPES = new Set(['box', 'sphere', 'cylinder']);

function makeInstantEngine(): ExecutionEngine {
  const engine = new ExecutionEngine();
  let onComplete: (() => void) | null = null;
  const timelineEngine = engine.timelineEngine as any;
  timelineEngine.init = (cb?: () => void) => {
    onComplete = cb ?? null;
  };
  timelineEngine.play = () => {
    const cb = onComplete;
    onComplete = null;
    cb?.();
  };
  timelineEngine.triggerComplete = () => {
    const cb = onComplete;
    onComplete = null;
    cb?.();
  };
  return engine;
}

/** See migration-bst.test.ts for why this is needed: plain tweens (no
 * `complete` callback) never reach their target value under the stubbed
 * timeline above, so settle positions via the same updateLayout/
 * applyLayoutInstantly pair ExecutionEngine itself runs on SCENE_LOADED. */
function settleLayout(engine: ExecutionEngine): void {
  const layoutMap = engine.layoutManager.updateLayout(engine.sceneManager.getSceneGraph());
  engine.layoutManager.applyLayoutInstantly(layoutMap);
}

describe('Migration: Heap -> GenericSceneRenderer', () => {
  it('HEAP_INSERT (bubble-up) leaves a correctly-sized tree view and array view, both real-position-shaped', async () => {
    const source = `SCENE HeapDemo
DECLARE
  HEAP h = [5, 3, 7]

SEQUENCE
  HEAP_INSERT h 1
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();
    settleLayout(engine);

    const scene = engine.sceneManager.getSceneGraph() as any[];
    const treeNodes = scene.filter((el) => el.logicalParent === 'h' && el.originalType === 'HEAP_NODE');
    const arrayEls = scene.filter((el) => el.logicalParent === 'h' && el.originalType === 'HEAP_ARRAY_ELEMENT');
    const edges = scene.filter((el) => el.logicalParent === 'h' && el.type === 'edge');

    // 3 initial + 1 insert = 4, in both views.
    expect(treeNodes).toHaveLength(4);
    expect(arrayEls).toHaveLength(4);
    [...treeNodes, ...arrayEls].forEach((el) => expect(NODE_SHAPES.has(el.type)).toBe(true));

    // Min-heap property actually holds after the bubble-up.
    const values = arrayEls.sort((a, b) => a.logicalIndex - b.logicalIndex).map((el) => Number(el.value));
    expect(values[0]).toBe(Math.min(...values));
    expect(values).toContain(1);

    // Tree view: hierarchy-shaped, children below parent (same shape as BST).
    const nodeIds = new Set(treeNodes.map((el) => el.id));
    expect(edges.length).toBe(treeNodes.length - 1);
    edges.forEach((edge) => {
      expect(nodeIds.has(edge.sourceId)).toBe(true);
      expect(nodeIds.has(edge.targetId)).toBe(true);
      const parent = scene.find((el) => el.id === edge.sourceId)!;
      const child = scene.find((el) => el.id === edge.targetId)!;
      expect(child.position.y).toBeLessThan(parent.position.y);
    });

    // Array view: a line — distinct X per element, shared Y.
    const xs = new Set(arrayEls.map((el) => Math.round(el.position.x * 100)));
    expect(xs.size).toBe(arrayEls.length);
  });
});
