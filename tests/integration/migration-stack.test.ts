/**
 * Renderer migration verification — STACK. See migration-array.test.ts for
 * the rationale (StackRenderer.tsx is gone; this asserts directly against
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

describe('Migration: Stack -> GenericSceneRenderer', () => {
  // PUSH/POP are exercised at the AnimationController level, not here — see
  // renderer-migration-log.md ("Stack" section) for the observed gap: those
  // generic actions enqueue their scene mutation inside an animation
  // `complete` callback that this suite's animejs-free harness (see
  // `makeInstantEngine`, modeled on bst-array-routing.test.ts) doesn't
  // reliably resolve for this action, unlike INSERT/DELETE. That's an
  // AnimationController behavior question, independent of whether
  // GenericSceneRenderer correctly renders whatever scene state results —
  // which is what this test verifies, against a real compiled+loaded stack.
  it('a declared stack renders as one node per element, in a correctly-shaped vertical column with a highlighted element', async () => {
    const source = `SCENE StackDemo
DECLARE
  STACK s = [1, 2, 3]

SEQUENCE
  HIGHLIGHT s[0]
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const scene = engine.sceneManager.getSceneGraph() as any[];
    const stackEls = scene.filter((el) => el.logicalParent === 's' && el.originalType === 'STACK_ELEMENT');

    expect(stackEls).toHaveLength(3);
    stackEls.forEach((el) => expect(NODE_SHAPES.has(el.type)).toBe(true));
    stackEls.forEach((el) => {
      expect(Number.isFinite(el.position.x)).toBe(true);
      expect(Number.isFinite(el.position.y)).toBe(true);
      expect(Number.isFinite(el.position.z)).toBe(true);
    });

    // A vertical column: distinct Y values across elements (old StackRenderer's
    // container was drawn around exactly this Y-extent).
    const ys = new Set(stackEls.map((el) => Math.round(el.position.y * 100)));
    expect(ys.size).toBe(stackEls.length);

    const highlighted = stackEls.filter((el) => el.emissiveIntensity > 0.1);
    expect(highlighted).toHaveLength(1);
  });
});
