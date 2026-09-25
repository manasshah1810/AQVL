/**
 * Renderer migration verification — HASHMAP. There was never a dedicated
 * HashMap renderer (see docs/design/existing-layout-audit.md, section 9) —
 * buckets fell through to ArrayRenderer's default grouping and entries were
 * positioned manually, with no label/container rendering at all. This
 * asserts directly against the scene graph GenericSceneRenderer's mapping
 * functions consume: buckets and their chained entries (which the old audit
 * flagged as bypassing the strategy pattern entirely) all resolve to finite
 * positions and stay visually distinct (no two elements exactly overlapping).
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

function settleLayout(engine: ExecutionEngine): void {
  const layoutMap = engine.layoutManager.updateLayout(engine.sceneManager.getSceneGraph());
  engine.layoutManager.applyLayoutInstantly(layoutMap);
}

describe('Migration: HashMap -> GenericSceneRenderer', () => {
  it('HASHMAP_INSERT leaves buckets and entries at distinct, finite positions', async () => {
    const source = `SCENE HashMapDemo
DECLARE
  HASH_MAP m = {a:1, b:2}

SEQUENCE
  HASHMAP_INSERT m c 3
END
`;
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();
    settleLayout(engine);

    const scene = engine.sceneManager.getSceneGraph() as any[];
    const buckets = scene.filter((el) => el.logicalParent === 'm' && el.originalType === 'HASHMAP_BUCKET');
    const entries = scene.filter((el) => el.logicalParent === 'm' && el.originalType === 'HASHMAP_ENTRY');

    expect(buckets.length).toBeGreaterThan(0);
    // 2 initial entries + 1 insert = 3.
    expect(entries).toHaveLength(3);
    [...buckets, ...entries].forEach((el) => expect(NODE_SHAPES.has(el.type)).toBe(true));

    [...buckets, ...entries].forEach((el) => {
      expect(Number.isFinite(el.position.x)).toBe(true);
      expect(Number.isFinite(el.position.y)).toBe(true);
      expect(Number.isFinite(el.position.z)).toBe(true);
    });

    // No two elements land on the exact same point — a real spatial layout,
    // not everything collapsed to the origin.
    const seen = new Set<string>();
    [...buckets, ...entries].forEach((el) => {
      const key = `${el.position.x.toFixed(3)},${el.position.y.toFixed(3)},${el.position.z.toFixed(3)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    });
  });
});
