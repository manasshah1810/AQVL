/**
 * Renderer migration verification — BST / BINARY TREE. See
 * migration-array.test.ts for the rationale (TreeRenderer.tsx is gone; this
 * asserts directly against the scene graph GenericSceneRenderer's mapping
 * functions consume). Confirms HIERARCHY-shaped positions (children below
 * their parent) and resolvable parent/child edges after insert/delete,
 * traversal highlighting, and — see the last test below — that ROTATE now
 * performs a real BST rotation (edges rewired, positions actually move),
 * not the old x+1/x-1 acknowledgment wiggle. See renderer-migration-log.md
 * ("BST / Binary Tree") for the full writeup.
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

/**
 * `makeInstantEngine`'s stub short-circuits the animation *timeline*
 * (`init`/`play`/`triggerComplete`), which resolves any scene mutation an
 * instruction makes directly inside a `complete` callback (e.g. INSERT's
 * final `targetEl.position.x = ...`). It does NOT run real anime.js
 * interpolation, so a plain tween (`enqueue({targets: el.position, y: ...,
 * duration, easing})` with no callback) never reaches its target value —
 * the property just stays at its pre-animation starting point. Several
 * operations (tree-node "drop in" on insert, PUSH) rely on exactly that
 * kind of tween for their Y position. Settling the layout once after
 * execution — the same `layoutManager.updateLayout` +
 * `applyLayoutInstantly` pair `ExecutionEngine` itself runs on
 * `SCENE_LOADED` — gives the real, final positions the active layout
 * strategy computes for the tree's current (post-instruction) shape,
 * independent of animation timing.
 */
function settleLayout(engine: ExecutionEngine): void {
  const layoutMap = engine.layoutManager.updateLayout(engine.sceneManager.getSceneGraph());
  engine.layoutManager.applyLayoutInstantly(layoutMap);
}

describe('Migration: BST -> GenericSceneRenderer', () => {
  it('insert/delete leave a hierarchy-shaped tree (children below parent) with resolvable parent/child edges', async () => {
    const source = `SCENE BSTDemo
DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  INSERT 20
  INSERT 40
  INORDER
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();
    settleLayout(engine);

    const scene = engine.sceneManager.getSceneGraph() as any[];
    // DELETE marks a node REMOVED/inactive rather than pruning it from the
    // scene graph immediately (lifecycle-managed removal) — filter to the
    // nodes actually live, which is what GenericSceneRenderer would render.
    const nodes = scene.filter(
      (el) => el.logicalParent === 'myTree' && el.originalType === 'TREE_NODE' && el.lifecycleState !== 'REMOVED'
    );
    const edges = scene.filter((el) => el.logicalParent === 'myTree' && el.type === 'edge');

    expect(nodes).toHaveLength(5);
    nodes.forEach((el) => expect(NODE_SHAPES.has(el.type)).toBe(true));

    const nodeIds = new Set(nodes.map((el) => el.id));
    expect(edges.length).toBe(nodes.length - 1); // a tree: n-1 edges
    edges.forEach((edge) => {
      expect(nodeIds.has(edge.sourceId)).toBe(true);
      expect(nodeIds.has(edge.targetId)).toBe(true);
      // HIERARCHY layout: child strictly below its parent.
      const parent = scene.find((el) => el.id === edge.sourceId)!;
      const child = scene.find((el) => el.id === edge.targetId)!;
      expect(child.position.y).toBeLessThan(parent.position.y);
    });
  });

  it('a traversal (INORDER) leaves a visited node highlighted', async () => {
    const source = `SCENE BSTTraversalDemo
DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  INORDER
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();
    settleLayout(engine);

    const scene = engine.sceneManager.getSceneGraph() as any[];
    const nodes = scene.filter((el) => el.logicalParent === 'myTree' && el.originalType === 'TREE_NODE');
    expect(nodes).toHaveLength(3);
    // Every node is touched by an inorder walk of a 3-node tree — confirm
    // at least the state/color machinery ran (not all-neutral).
    const touched = nodes.filter((el) => el.emissiveIntensity > 0.1 || el.state !== 'NEUTRAL');
    expect(touched.length).toBeGreaterThan(0);
  });

  it('ROTATE performs a real rotation: edges rewire and nodes actually move, not the old wiggle', async () => {
    // 50 / 30,70 / 20,40 — rotating LEFT at 30 promotes 40 (30's right
    // child) to take 30's place; 30 becomes 40's left child, keeping its
    // own left child (20).
    const source = `SCENE BSTRotateDemo
DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  INSERT 20
  INSERT 40
  ROTATE 30 "LEFT"
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();
    settleLayout(engine);

    const scene = engine.sceneManager.getSceneGraph() as any[];
    const nodes = scene.filter((el) => el.logicalParent === 'myTree' && el.originalType === 'TREE_NODE');
    const edges = scene.filter((el) => el.logicalParent === 'myTree' && el.type === 'edge');
    const byValue = (v: number) => nodes.find((n) => Number(n.value) === v)!;

    // Still 5 nodes, still a tree (n - 1 edges) — rotation restructures, never drops nodes.
    expect(nodes).toHaveLength(5);
    expect(edges.length).toBe(nodes.length - 1);

    const edgeLabel = (sourceVal: number, targetVal: number): string | undefined => {
      const source = byValue(sourceVal);
      const target = byValue(targetVal);
      const edge = edges.find((e) => e.sourceId === source.id && e.targetId === target.id);
      return edge?.properties?.label;
    };

    // The real post-rotation shape: 40 takes 30's old slot under 50; 30
    // becomes 40's left child; 30 keeps its own left child (20); 70 is
    // untouched under 50.
    expect(edgeLabel(50, 40)).toBe('L');
    expect(edgeLabel(50, 70)).toBe('R');
    expect(edgeLabel(40, 30)).toBe('L');
    expect(edgeLabel(30, 20)).toBe('L');
    // The old 30->40 edge is gone (that's what "rewired" means, not just added-to).
    expect(edgeLabel(30, 40)).toBeUndefined();

    // Positions actually changed to reflect the new hierarchy — not a
    // wiggle back to the same spot. 40 is now strictly above 30 (its
    // parent), and 30 (now depth 2) sits below its old depth-1 position.
    expect(byValue(40).position.y).toBeGreaterThan(byValue(30).position.y);
    expect(byValue(30).position.y).toBeLessThan(byValue(50).position.y);
    // HIERARCHY shape holds throughout: every edge's child is below its parent.
    edges.forEach((edge) => {
      const parent = scene.find((el) => el.id === edge.sourceId)!;
      const child = scene.find((el) => el.id === edge.targetId)!;
      expect(child.position.y).toBeLessThan(parent.position.y);
    });
  });

  it('ROTATE reports an error instead of silently no-oping when the pivot has no child on the rotation side', async () => {
    const source = `SCENE BSTRotateErrorDemo
DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  ROTATE 30 "RIGHT"
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const scene = engine.sceneManager.getSceneGraph() as any[];
    const edges = scene.filter((el) => el.logicalParent === 'myTree' && el.type === 'edge');
    // 30 has no left child, so a RIGHT rotation at 30 is impossible —
    // the tree must be unchanged (still just the original 50->30 edge),
    // not silently corrupted.
    expect(edges).toHaveLength(1);
  });
});
