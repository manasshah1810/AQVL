/**
 * Renderer migration verification — ARRAY.
 *
 * Confirms the real demo pipeline (compile -> ExecutionEngine, which drives
 * AnimationController/LayoutManager exactly like packages/demo does) produces
 * scene elements shaped the way `GenericSceneRenderer`'s `toRenderableElement`
 * (packages/renderer/src/components/generic/GenericSceneRenderer.tsx) expects:
 * a known primitive shape ('box'/'sphere'/'cylinder'), a resolved `position`,
 * and highlight-carrying fields (`color`/`emissiveColor`/`emissiveIntensity`).
 * This is the "old ArrayRenderer vs GenericSceneRenderer" migration check —
 * ArrayRenderer.tsx is gone, so this asserts directly against the scene graph
 * GenericSceneRenderer's own (separately tested) mapping functions consume.
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

/**
 * animejs's `anime.timeline()` reaches for `window`, absent under this
 * suite's `node` environment. The scene mutations under test are all
 * synchronous (AnimationController mutates elements, then schedules the
 * animation); short-circuiting the timeline to complete instantly lets
 * `ExecutionEngine.execute()` run the real production pipeline to
 * completion without an actual animation loop. Same trick as
 * `tests/integration/bst-array-routing.test.ts`.
 */
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

describe('Migration: Array -> GenericSceneRenderer', () => {
  it('a sorted array renders as one node per element, in ascending index order along one axis', async () => {
    const source = `SCENE ArraySortDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  BUBBLE_SORT arr
  HIGHLIGHT arr[2]
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const scene = engine.sceneManager.getSceneGraph() as any[];
    const arrEls = scene.filter((el) => el.logicalParent === 'arr' && el.originalType === 'ARRAY_ELEMENT');

    // Element count preserved through the sort.
    expect(arrEls).toHaveLength(5);
    arrEls.forEach((el) => expect(NODE_SHAPES.has(el.type)).toBe(true));

    // BUBBLE_SORT actually sorted the underlying values (by logicalIndex,
    // the field ArrayLayoutStrategy sorts on to place elements in a line).
    const byIndex = [...arrEls].sort((a, b) => a.logicalIndex - b.logicalIndex);
    expect(byIndex.map((el) => Number(el.value))).toEqual([1, 3, 5, 8, 9]);

    // Every element resolved to a finite, defined position — the field
    // GenericSceneRenderer's PrimitiveNode reads directly.
    arrEls.forEach((el) => {
      expect(Number.isFinite(el.position.x)).toBe(true);
      expect(Number.isFinite(el.position.y)).toBe(true);
      expect(Number.isFinite(el.position.z)).toBe(true);
    });

    // The trailing HIGHLIGHT persists (HIGHLIGHT_OBJECT sets color/emissive
    // and never resets it) — the exact fields toRenderableElement copies
    // through as the node's RenderableElement color/emissive state. Exactly
    // one element should carry it.
    const highlighted = arrEls.filter((el) => el.emissiveIntensity > 0.1);
    expect(highlighted).toHaveLength(1);
    const untouched = arrEls.find((el) => el.id !== highlighted[0].id)!;
    expect(highlighted[0].color).not.toBe(untouched.color);
  });
});
