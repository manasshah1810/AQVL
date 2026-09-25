/**
 * Regression coverage for AnimationController routing bare INSERT/DELETE/
 * SEARCH GENERIC_ACTION instructions by a scene-global `activeTreeIsBST`
 * flag instead of by the instruction's actual target structure.
 *
 * Before the fix, any scene containing a BST caused `activeTreeIsBST` to be
 * set true (and it is never cleared), so *every* bare INSERT/DELETE/SEARCH
 * in that scene — including ones explicitly targeting an ARRAY via
 * `INSERT arr[i] value` — was dispatched to BSTAlgorithms instead of the
 * array-mutation code path. Because BSTAlgorithms reads the raw numeric
 * value from `instruction.args[0]` (which, for an array target, is the
 * resolved element id string, not a number), the misrouted call fails
 * `Number(...)` and silently no-ops: the array is never actually mutated.
 *
 * This drives a real compiled program with both a BST and an ARRAY in the
 * same scene, interleaves operations on each, and confirms the array
 * actually grew (proving its INSERT instructions were *not* misrouted to
 * BST logic) while the BST gained the expected nodes.
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

/**
 * animejs's `anime.timeline()` (used internally by TimelineEngine.init())
 * reaches for `window`, which doesn't exist under this suite's `node` test
 * environment. The routing bug under test lives entirely in
 * AnimationController's synchronous instruction handling (which structure
 * an INSERT/DELETE/SEARCH gets dispatched to) — none of the actual scene
 * mutations this test asserts on depend on an animation actually visually
 * playing out. So the timeline is short-circuited to complete instantly:
 * `init` records the completion callback instead of building a real anime
 * timeline, and `play`/`triggerComplete` invoke it immediately.
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

describe('AnimationController routes GENERIC_ACTION by actual target structure, not a global BST flag', () => {
  it('interleaved BST and ARRAY INSERTs each hit their own handler', async () => {
    const source = `SCENE MixedBSTArrayRouting
DECLARE
  BST myTree
  ARRAY arr = [10, 20, 30]

SEQUENCE
  INSERT 50
  INSERT arr[1] 99
  INSERT 30
  INSERT arr[0] 88
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const scene = engine.sceneManager.getSceneGraph() as any[];

    // The array must have actually grown by the two INSERTs targeting it —
    // if they had been misrouted to BSTAlgorithms, `arr` would still have
    // only its 3 original elements.
    const arrEls = scene.filter((el) => el.logicalParent === 'arr' && el.originalType === 'ARRAY_ELEMENT');
    expect(arrEls).toHaveLength(5);
    const arrValues = arrEls.map((el) => el.value).sort((a, b) => a - b);
    expect(arrValues).toEqual([10, 20, 30, 88, 99]);

    // The BST must have gained exactly the two nodes inserted into it (50, 30) —
    // not nodes for the array-targeted inserts too.
    const treeNodes = scene.filter((el) => el.logicalParent === 'myTree' && el.originalType === 'TREE_NODE');
    expect(treeNodes).toHaveLength(2);
    const treeValues = treeNodes.map((el) => el.value).sort((a, b) => a - b);
    expect(treeValues).toEqual([30, 50]);
  });
});
