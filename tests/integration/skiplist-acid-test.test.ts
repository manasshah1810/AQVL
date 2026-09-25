/**
 * Acceptance test for `examples/data-structures/skiplist.aqvl`: can a Skip
 * List — a structure whose shape (multiple parallel per-level chains, plus
 * per-key "towers" spanning levels) doesn't match any single built-in
 * layout strategy — be expressed entirely out of existing AQVL language
 * primitives (NODE, LINK, LAYOUT/POSITION/CAMERA, HIGHLIGHT, SET ... STATE,
 * FUNCTION/RETURN recursion) with zero new renderer code?
 *
 * See docs/design/acid-test-report.md for the full verdict, including the
 * language gaps this test's design had to work around (documented there,
 * not silently papered over here).
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

const SOURCE_PATH = join(__dirname, '..', '..', 'examples', 'data-structures', 'skiplist.aqvl');
const source = readFileSync(SOURCE_PATH, 'utf-8');

function actionsOf(instructions: unknown[], action: string): any[] {
  return (instructions as any[]).filter((i: any) => i.action === action);
}

/** Resolves the compiled scene-element id for a standalone NODE by its declared identifier (its `label`). */
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

describe('Skip List acid test: compiles', () => {
  it('compiles skiplist.aqvl with no errors', () => {
    expect(() => compile(source)).not.toThrow();
  });
});

describe('Skip List acid test: AQIR contains geometry instructions from LAYOUT/POSITION only', () => {
  const aqir = compile(source);

  it('emits exactly one SET_LAYOUT_STRATEGY, strategy CUSTOM, targeting the "sl" structure', () => {
    const layouts = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY');
    expect(layouts).toHaveLength(1);
    expect(layouts[0]).toMatchObject({ targetId: 'sl', strategy: 'CUSTOM', params: {} });
  });

  it('emits a matching COMPUTE_LAYOUT immediately after SET_LAYOUT_STRATEGY', () => {
    const layoutIdx = aqir.instructions.findIndex((i: any) => i.action === 'SET_LAYOUT_STRATEGY');
    expect(aqir.instructions[layoutIdx + 1]).toMatchObject({ action: 'COMPUTE_LAYOUT', targetId: 'sl' });
  });

  it('emits one SET_POSITION per declared skip-list NODE (22 rungs)', () => {
    const positions = actionsOf(aqir.instructions, 'SET_POSITION');
    expect(positions).toHaveLength(22);
    // Every axis was given a literal, not left to strategy inference (CUSTOM requires this).
    for (const p of positions) {
      expect(p.x).not.toBeNull();
      expect(p.y).not.toBeNull();
      expect(p.z).not.toBeNull();
    }
  });

  it('SET_CAMERA is present (absolute POSITION, framing the whole multi-level grid)', () => {
    const cameras = actionsOf(aqir.instructions, 'SET_CAMERA');
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({ mode: 'POSITION', params: { x: 0, y: 4, z: 26 } });
  });

  it('emits exactly 29 LINK_OBJECTS instructions (11 tower + 18 forward pointers)', () => {
    const links = actionsOf(aqir.instructions, 'LINK_OBJECTS');
    expect(links).toHaveLength(29);
    expect(links.every((l: any) => l.relationType === 'LINK' && l.directed === true)).toBe(true);
  });
});

describe('Skip List acid test: runtime computes positions for every level correctly', () => {
  it('resolves each rung to the exact (key-rank, level) grid coordinate its LAYOUT/POSITION statements declared', async () => {
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    // One rung per level, spanning the full height of the tallest tower (key 21, level 3).
    const expected: Array<[string, number, number, number]> = [
      ['head0', -12, 0, 0],
      ['head1', -12, 2.4, 0],
      ['head2', -12, 4.8, 0],
      ['head3', -12, 7.2, 0],
      ['k3_0', -9.6, 0, 0],
      ['k9_0', -2.4, 0, 0],
      ['k9_1', -2.4, 2.4, 0],
      ['k9_2', -2.4, 4.8, 0],
      ['k21_0', 7.2, 0, 0],
      ['k21_1', 7.2, 2.4, 0],
      ['k21_2', 7.2, 4.8, 0],
      ['k21_3', 7.2, 7.2, 0],
      ['k26_0', 12, 0, 0],
      ['k26_1', 12, 2.4, 0],
    ];

    for (const [name, x, y, z] of expected) {
      const id = idForNode(aqir.objects, name);
      const positions = positionsAfter(result.executionSteps, id);
      expect(positions[id].x).toBe(x);
      expect(positions[id].y).toBe(y);
      expect(positions[id].z).toBe(z);
    }
  });

  it('every rung of the same key shares one x column, confirming towers line up vertically', async () => {
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    for (const [a, b] of [['k9_0', 'k9_1'], ['k9_1', 'k9_2'], ['k21_0', 'k21_3'], ['k26_0', 'k26_1']] as const) {
      const idA = idForNode(aqir.objects, a);
      const idB = idForNode(aqir.objects, b);
      const posA = positionsAfter(result.executionSteps, idA);
      const posB = positionsAfter(result.executionSteps, idB);
      expect(posA[idA].x).toBe(posB[idB].x);
    }
  });
});

describe('Skip List acid test: algorithmic correctness of the level assignment (real AQVL recursion)', () => {
  it('levelFor()/isEven() — real CALL/RET recursion executed by the VM — reproduces the deterministic level scheme baked into the DECLARE section', async () => {
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable);
    const result = await vm.run();

    const g = result.finalState.globals;
    expect(g.lvl3).toBe(0);
    expect(g.lvl6).toBe(1);
    expect(g.lvl7).toBe(0);
    expect(g.lvl9).toBe(2);
    expect(g.lvl12).toBe(0);
    expect(g.lvl17).toBe(1);
    expect(g.lvl19).toBe(0);
    expect(g.lvl21).toBe(3);
    expect(g.lvl25).toBe(0);
    expect(g.lvl26).toBe(1);

    // Real recursion, not unrolled: more execution frames than source AQIR instructions.
    expect(result.executionSteps.length).toBeGreaterThan(aqir.instructions.length);
  });
});

describe('Skip List acid test: structural (graph) correctness — insert/search/delete', () => {
  function edgeSet(instructions: any[]): Set<string> {
    return new Set(
      actionsOf(instructions, 'LINK_OBJECTS').map((l: any) => `${l.sourceId}->${l.targetId}`)
    );
  }

  it('level-0 forward chain visits every key in sorted order (the built structure is a valid, fully-linked skip list base level)', () => {
    const aqir = compile(source);
    const edges = edgeSet(aqir.instructions);
    const order = ['head0', 'k3_0', 'k6_0', 'k7_0', 'k9_0', 'k12_0', 'k17_0', 'k19_0', 'k21_0', 'k25_0', 'k26_0'];
    for (let i = 0; i < order.length - 1; i++) {
      const from = idForNode(aqir.objects, order[i]);
      const to = idForNode(aqir.objects, order[i + 1]);
      expect(edges.has(`${from}->${to}`)).toBe(true);
    }
  });

  it('higher levels only contain keys whose tower reaches that level (level 3 has exactly key 21)', () => {
    const aqir = compile(source);
    const edges = edgeSet(aqir.instructions);
    const head3 = idForNode(aqir.objects, 'head3');
    const k21_3 = idForNode(aqir.objects, 'k21_3');
    expect(edges.has(`${head3}->${k21_3}`)).toBe(true);
    // No other level-3 rung exists at all to link to/from.
    expect(aqir.objects.filter((o: any) => o.label?.endsWith('_3'))).toHaveLength(1);
  });

  it('search HIGHLIGHT order matches the real skip-list search path for key 19 (top level down, right while safe)', () => {
    const aqir = compile(source);
    const highlights = actionsOf(aqir.instructions, 'HIGHLIGHT_OBJECT').map((h: any) => h.targetId);
    const expectedOrder = [
      'head3', 'k21_3', 'head2', 'k9_2', 'k21_2', 'head1', 'k6_1', 'k9_1', 'k17_1', 'k21_1',
      'head0', 'k3_0', 'k6_0', 'k7_0', 'k9_0', 'k12_0', 'k17_0', 'k19_0',
    ].map((n) => idForNode(aqir.objects, n));
    expect(highlights).toEqual(expectedOrder);
  });

  it('DELETE marks the found node removed via SET ... STATE (documented gap: no generic UNLINK exists to splice it out of the pointer chain)', () => {
    const aqir = compile(source);
    const setState = actionsOf(aqir.instructions, 'SET_STATE');
    const k19 = idForNode(aqir.objects, 'k19_0');
    expect(setState.some((s: any) => s.targetId === k19 && s.stateName === 'removed')).toBe(true);
  });
});

describe('Skip List acid test: renderer files are byte-identical to before this feature', () => {
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

  it('every file under packages/renderer/src hashes identically to the pre-Skip-List snapshot, and no files were added or removed', () => {
    const snapshot: Record<string, string> = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));

    const currentFiles = walk(RENDERER_SRC).map((f) =>
      f.split(sep).join('/').split(RENDERER_SRC.split(sep).join('/') + '/')[1]
    );
    expect(new Set(currentFiles)).toEqual(new Set(Object.keys(snapshot)));

    for (const relPath of Object.keys(snapshot)) {
      const full = join(RENDERER_SRC, ...relPath.split('/'));
      const hash = createHash('sha256').update(readFileSync(full)).digest('hex');
      expect(hash, `${relPath} differs from the pre-Skip-List snapshot`).toBe(snapshot[relPath]);
    }
  });
});
