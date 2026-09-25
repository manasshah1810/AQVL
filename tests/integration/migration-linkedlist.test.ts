/**
 * Renderer migration verification — LINKED LIST. See migration-array.test.ts
 * for the rationale (LinkedListRenderer.tsx is gone; this asserts directly
 * against the scene graph GenericSceneRenderer's mapping functions consume),
 * plus edge (next-pointer) correctness, which is the structure-specific bit:
 * `toRenderableConnection` resolves an EDGE element's source/target ids to
 * live node positions.
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

describe('Migration: Linked List -> GenericSceneRenderer', () => {
  it('insert/delete leave a correctly-linked node chain with resolvable pointer edges', async () => {
    const source = `SCENE LinkedListDemo
DECLARE
  LINKEDLIST list = [10, 20, 30]

SEQUENCE
  INSERT_HEAD list 5
  INSERT_TAIL list 40
  DELETE_HEAD list
  HIGHLIGHT list[0]
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const scene = engine.sceneManager.getSceneGraph() as any[];
    // The list's anchor (`ll:list`, holding the head pointer) is data, not a drawn node.
    const nodes = scene.filter((el) => el.logicalParent === 'list' && el.type !== 'edge' && el.originalType !== 'LINKEDLIST');
    const edges = scene.filter((el) => el.logicalParent === 'list' && el.type === 'edge');

    nodes.forEach((el) => expect(NODE_SHAPES.has(el.type)).toBe(true));
    nodes.forEach((el) => {
      expect(Number.isFinite(el.position.x)).toBe(true);
      expect(Number.isFinite(el.position.y)).toBe(true);
    });

    // Every edge's endpoints resolve to a real node in the current scene —
    // exactly the lookup toRenderableConnection performs (source/target id
    // -> live element -> live position); a dangling pointer would silently
    // drop the connection there.
    const nodeIds = new Set(nodes.map((el) => el.id));
    expect(edges.length).toBeGreaterThan(0);
    edges.forEach((edge) => {
      expect(nodeIds.has(edge.sourceId)).toBe(true);
      expect(nodeIds.has(edge.targetId)).toBe(true);
    });

    const highlighted = nodes.filter((el) => el.emissiveIntensity > 0.1);
    expect(highlighted.length).toBeGreaterThan(0);
  });
});
