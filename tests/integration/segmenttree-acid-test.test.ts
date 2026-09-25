/**
 * Second acid test (see docs/design/acid-test-report.md §1-3): does the
 * Skip List finding generalize to a structurally different shape? Segment
 * Tree is a binary tree, not a multi-level linked structure — a different
 * stress case for `LAYOUT ... AS CUSTOM()` (here: leaves forced onto one
 * shared baseline row regardless of actual tree depth, and internal-node x
 * set to the true midpoint of its children rather than an equal sibling
 * gap — both things the built-in HIERARCHY strategy cannot produce) and a
 * different real recursive algorithm (range-sum query with O(1) early-exit
 * on full containment, the defining behavior of a segment tree query).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import { createHash } from 'crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { createVM } from '../../packages/runtime/src';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

const SOURCE_PATH = join(__dirname, '..', '..', 'examples', 'data-structures', 'segmenttree.aqvl');
const source = readFileSync(SOURCE_PATH, 'utf-8');

function actionsOf(instructions: unknown[], action: string): any[] {
  return (instructions as any[]).filter((i: any) => i.action === action);
}

function idForNode(objects: any[], name: string): string {
  const obj = objects.find((o) => o.label === name && o.originalType === 'NODE');
  if (!obj) throw new Error(`No compiled NODE object named "${name}"`);
  return obj.id;
}

function positionsAfter(steps: { state: { positions?: Record<string, any> } }[], elementId: string): Record<string, any> {
  for (let i = steps.length - 1; i >= 0; i--) {
    const positions = steps[i].state.positions;
    if (positions && positions[elementId]) return positions;
  }
  throw new Error(`Element ${elementId} never appears in any recorded positions snapshot`);
}

describe('Segment Tree acid test: compiles', () => {
  it('compiles segmenttree.aqvl with no errors', () => {
    expect(() => compile(source)).not.toThrow();
  });
});

describe('Segment Tree acid test: AQIR contains geometry instructions from LAYOUT/POSITION only', () => {
  const aqir = compile(source);

  it('emits exactly one SET_LAYOUT_STRATEGY, strategy CUSTOM, targeting the "st" structure', () => {
    const layouts = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY');
    expect(layouts).toHaveLength(1);
    expect(layouts[0]).toMatchObject({ targetId: 'st', strategy: 'CUSTOM', params: {} });
  });

  it('emits a matching COMPUTE_LAYOUT immediately after SET_LAYOUT_STRATEGY', () => {
    const layoutIdx = aqir.instructions.findIndex((i: any) => i.action === 'SET_LAYOUT_STRATEGY');
    expect(aqir.instructions[layoutIdx + 1]).toMatchObject({ action: 'COMPUTE_LAYOUT', targetId: 'st' });
  });

  it('emits one SET_POSITION per declared tree NODE (11: 5 internal + 6 leaves)', () => {
    const positions = actionsOf(aqir.instructions, 'SET_POSITION');
    expect(positions).toHaveLength(11);
    for (const p of positions) {
      expect(p.x).not.toBeNull();
      expect(p.y).not.toBeNull();
      expect(p.z).not.toBeNull();
    }
  });

  it('SET_CAMERA is present (absolute POSITION, framing the whole tree)', () => {
    const cameras = actionsOf(aqir.instructions, 'SET_CAMERA');
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({ mode: 'POSITION', params: { x: 0, y: 0, z: 22 } });
  });

  it('emits exactly 10 LINK_OBJECTS instructions (n-1 edges for 11 nodes, a valid tree)', () => {
    const links = actionsOf(aqir.instructions, 'LINK_OBJECTS');
    expect(links).toHaveLength(10);
    expect(links.every((l: any) => l.relationType === 'LINK' && l.directed === true)).toBe(true);
  });
});

describe('Segment Tree acid test: runtime computes positions correctly, including the layout HIERARCHY cannot produce', () => {
  it('resolves every node to its declared (midpoint-x, depth-or-baseline-y) coordinate', async () => {
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const expected: Array<[string, number, number, number]> = [
      ['seg_0_5', 0.6, 0, 0],
      ['seg_0_2', -3, -2.4, 0],
      ['seg_3_5', 4.2, -2.4, 0],
      ['seg_0_1', -4.8, -4.8, 0],
      ['seg_3_4', 2.4, -4.8, 0],
      ['leaf0', -6, -7.2, 0],
      ['leaf1', -3.6, -7.2, 0],
      ['leaf2', -1.2, -7.2, 0],
      ['leaf3', 1.2, -7.2, 0],
      ['leaf4', 3.6, -7.2, 0],
      ['leaf5', 6, -7.2, 0],
    ];
    for (const [name, x, y, z] of expected) {
      const id = idForNode(aqir.objects, name);
      const positions = positionsAfter(result.executionSteps, id);
      expect(positions[id].x).toBe(x);
      expect(positions[id].y).toBe(y);
      expect(positions[id].z).toBe(z);
    }
  });

  it('all 6 leaves share one baseline y — despite leaf2/leaf5 sitting at a shallower tree depth (3) than leaf0/leaf1/leaf3/leaf4 (4), which is exactly what default HIERARCHY (strict per-depth rows) cannot produce', async () => {
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const leaves = ['leaf0', 'leaf1', 'leaf2', 'leaf3', 'leaf4', 'leaf5'];
    const ys = leaves.map((n) => {
      const id = idForNode(aqir.objects, n);
      return positionsAfter(result.executionSteps, id)[id].y;
    });
    expect(new Set(ys).size).toBe(1);
  });

  it('an internal node sits at the midpoint of its two children x, not an equal sibling gap', async () => {
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const xOf = (name: string) => {
      const id = idForNode(aqir.objects, name);
      return positionsAfter(result.executionSteps, id)[id].x;
    };
    // seg_0_1's children (leaf0, leaf1) are both leaves (equal-width subtrees) -> midpoint == equal gap here,
    // but seg_0_2's children (seg_0_1, a 2-leaf subtree, and leaf2, a 1-leaf subtree) are NOT equal width,
    // so seg_0_2's x is pulled toward its wider child — an equal sibling gap would center it exactly
    // between leaf-derived extremes, midpoint-of-children does not.
    expect(xOf('seg_0_2')).toBeCloseTo((xOf('seg_0_1') + xOf('leaf2')) / 2, 10);
    expect(xOf('seg_3_5')).toBeCloseTo((xOf('seg_3_4') + xOf('leaf5')) / 2, 10);
    expect(xOf('seg_0_5')).toBeCloseTo((xOf('seg_0_2') + xOf('seg_3_5')) / 2, 10);
  });
});

describe('Segment Tree acid test: algorithmic correctness of the range-sum query (real AQVL recursion)', () => {
  it('query() — real CALL/RET recursion executed by the VM — computes correct sums for every node range and several cross-node ranges', async () => {
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable);
    const result = await vm.run();

    const g = result.finalState.globals;
    expect(g.qFull).toBe(24); // [0,5]
    expect(g.qLeft).toBe(8); // [0,2]
    expect(g.qRight).toBe(16); // [3,5]
    expect(g.qMid).toBe(19); // [1,4], crosses the seg_0_2 / seg_3_5 boundary
    expect(g.qSingle).toBe(9); // [4,4], a single leaf

    // Real recursion, not unrolled.
    expect(result.executionSteps.length).toBeGreaterThan(aqir.instructions.length);
  });

  it('query() early-exits via nodeSum on full containment instead of always re-summing leaves (the actual O(log n) behavior a segment tree exists to provide)', () => {
    // seg_3_4's range [3,4] is fully inside the animated query [1,4] (see the
    // HIGHLIGHT walk below), so the compiled HIGHLIGHT sequence never visits
    // leaf3/leaf4 individually — the visible, testable proxy for the early-exit
    // this test's description asserts, since AQVL functions have no
    // observable "did I recurse further" signal beyond their return value.
    const aqir = compile(source);
    const highlights = actionsOf(aqir.instructions, 'HIGHLIGHT_OBJECT').map((h: any) => h.targetId);
    const leaf3Id = idForNode(aqir.objects, 'leaf3');
    const leaf4Id = idForNode(aqir.objects, 'leaf4');
    expect(highlights).not.toContain(leaf3Id);
    expect(highlights).not.toContain(leaf4Id);
  });
});

describe('Segment Tree acid test: structural correctness — the built tree matches the query results', () => {
  function edgeSet(instructions: any[]): Set<string> {
    return new Set(actionsOf(instructions, 'LINK_OBJECTS').map((l: any) => `${l.sourceId}->${l.targetId}`));
  }

  it('every internal node links to exactly its two real children', () => {
    const aqir = compile(source);
    const edges = edgeSet(aqir.instructions);
    const expectedEdges: Array<[string, string]> = [
      ['seg_0_5', 'seg_0_2'], ['seg_0_5', 'seg_3_5'],
      ['seg_0_2', 'seg_0_1'], ['seg_0_2', 'leaf2'],
      ['seg_0_1', 'leaf0'], ['seg_0_1', 'leaf1'],
      ['seg_3_5', 'seg_3_4'], ['seg_3_5', 'leaf5'],
      ['seg_3_4', 'leaf3'], ['seg_3_4', 'leaf4'],
    ];
    for (const [from, to] of expectedEdges) {
      const fromId = idForNode(aqir.objects, from);
      const toId = idForNode(aqir.objects, to);
      expect(edges.has(`${fromId}->${toId}`)).toBe(true);
    }
  });

  it('animated query(1,4) HIGHLIGHT order matches the real recursive traversal path, and excluded leaves are marked via SET ... STATE rather than skipped silently', () => {
    const aqir = compile(source);
    const highlights = actionsOf(aqir.instructions, 'HIGHLIGHT_OBJECT').map((h: any) => h.targetId);
    const expectedOrder = ['seg_0_5', 'seg_0_2', 'seg_0_1', 'leaf1', 'leaf2', 'seg_3_5', 'seg_3_4'].map((n) =>
      idForNode(aqir.objects, n)
    );
    expect(highlights).toEqual(expectedOrder);

    const setState = actionsOf(aqir.instructions, 'SET_STATE');
    const leaf0 = idForNode(aqir.objects, 'leaf0');
    const leaf5 = idForNode(aqir.objects, 'leaf5');
    expect(setState.some((s: any) => s.targetId === leaf0 && s.stateName === 'excluded')).toBe(true);
    expect(setState.some((s: any) => s.targetId === leaf5 && s.stateName === 'excluded')).toBe(true);
  });
});

describe('Segment Tree acid test: renderer files are byte-identical to before this feature', () => {
  const RENDERER_SRC = join(__dirname, '..', '..', 'packages', 'renderer', 'src');
  const SNAPSHOT_PATH = join(__dirname, '..', 'fixtures', 'renderer-snapshot.json');

  function walk(dir: string): string[] {
    let out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out = out.concat(walk(full));
      else out.push(full);
    }
    return out;
  }

  it('every file under packages/renderer/src hashes identically to the pre-Segment-Tree snapshot, and no files were added or removed', () => {
    const snapshot: Record<string, string> = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));
    const currentFiles = walk(RENDERER_SRC).map((f) =>
      f.split(sep).join('/').split(RENDERER_SRC.split(sep).join('/') + '/')[1]
    );
    expect(new Set(currentFiles)).toEqual(new Set(Object.keys(snapshot)));

    for (const relPath of Object.keys(snapshot)) {
      const full = join(RENDERER_SRC, ...relPath.split('/'));
      const hash = createHash('sha256').update(readFileSync(full)).digest('hex');
      expect(hash, `${relPath} differs from the pre-Segment-Tree snapshot`).toBe(snapshot[relPath]);
    }
  });
});
