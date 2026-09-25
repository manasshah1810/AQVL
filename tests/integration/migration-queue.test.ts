/**
 * Renderer migration verification — QUEUE. See migration-array.test.ts for
 * the rationale (QueueRenderer.tsx is gone; this asserts directly against
 * the scene graph GenericSceneRenderer's mapping functions consume).
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

describe('Migration: Queue -> GenericSceneRenderer', () => {
  it('a declared queue renders as one node per element, in a correctly-shaped horizontal line with a highlighted element', async () => {
    const source = `SCENE QueueDemo
DECLARE
  QUEUE q = [1, 2, 3]

SEQUENCE
  HIGHLIGHT q[0]
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const scene = engine.sceneManager.getSceneGraph() as any[];
    const queueEls = scene.filter((el) => el.logicalParent === 'q' && el.originalType === 'CONTAINER_ITEM');

    expect(queueEls).toHaveLength(3);
    queueEls.forEach((el) => expect(NODE_SHAPES.has(el.type)).toBe(true));
    queueEls.forEach((el) => {
      expect(Number.isFinite(el.position.x)).toBe(true);
      expect(Number.isFinite(el.position.y)).toBe(true);
      expect(Number.isFinite(el.position.z)).toBe(true);
    });

    // A horizontal line: distinct X values, shared Y (old QueueRenderer's
    // tube/Front/Rear labels were drawn around exactly this X-extent).
    const xs = new Set(queueEls.map((el) => Math.round(el.position.x * 100)));
    expect(xs.size).toBe(queueEls.length);
    const ys = new Set(queueEls.map((el) => Math.round(el.position.y * 100)));
    expect(ys.size).toBe(1);

    const highlighted = queueEls.filter((el) => el.isHighlighted);
    expect(highlighted).toHaveLength(1);
  });
});
