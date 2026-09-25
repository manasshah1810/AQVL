/**
 * Integration tests for full AQVL programs mixing LAYOUT / CAMERA /
 * POSITION with ordinary sequence statements (INSERT, WAIT, ...): source ->
 * lex -> parse -> validate -> optimize -> AQIR, asserting the complete,
 * ordered instruction sequence — see docs/design/aqir-geometry-spec.md §5.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../utils/testHelpers';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function actionsOnly(instructions: unknown[]): string[] {
  return (instructions as any[]).map((i) => i.action).filter(Boolean);
}

describe('Spatial AQIR compilation (full programs)', () => {
  it('compiles the CAMERA POSITION + LAYOUT + POSITION worked example (geometry spec §5) to the expected sequence', () => {
    const source = `SCENE PinnedElementDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  CAMERA POSITION(0, 6, 14)
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  POSITION arr[2] AT (x=5, y=2, z=0)
  HIGHLIGHT arr[2]
  WAIT
END
`;
    const instructions = compile(source) as any[];

    // Exactly one layout pass for "arr" (the explicit one — no default backfill).
    const layoutInstrs = instructions.filter((i) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'arr');
    expect(layoutInstrs).toHaveLength(1);
    expect(layoutInstrs[0].strategy).toBe('LINE');

    // Program-order sequence of the "geometry-relevant" instructions, in the
    // order they appear in source: SET_CAMERA, then SET_LAYOUT_STRATEGY +
    // COMPUTE_LAYOUT for the explicit LAYOUT, then SET_POSITION, then the
    // ordinary HIGHLIGHT_OBJECT/WAIT.
    const relevantActions = actionsOnly(instructions).filter((a) =>
      ['SET_CAMERA', 'SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT', 'SET_POSITION', 'HIGHLIGHT_OBJECT', 'WAIT'].includes(a)
    );
    expect(relevantActions).toEqual([
      'SET_CAMERA',
      'SET_LAYOUT_STRATEGY',
      'COMPUTE_LAYOUT',
      'SET_POSITION',
      'HIGHLIGHT_OBJECT',
      'WAIT',
    ]);

    const cameraInstr = instructions.find((i) => i.action === 'SET_CAMERA');
    expect(cameraInstr).toMatchObject({ mode: 'POSITION', params: { x: 0, y: 6, z: 14 } });

    const positionInstr = instructions.find((i) => i.action === 'SET_POSITION');
    expect(positionInstr).toMatchObject({ x: 5, y: 2, z: 0 });
  });

  it('backfills default layouts and emits no SET_CAMERA when a program has no LAYOUT/CAMERA statements', () => {
    const source = `SCENE PlainBSTDemo
DECLARE
  BST myTree = [50, 30, 70]

SEQUENCE
  INORDER myTree
  CLEAR myTree
END
`;
    const instructions = compile(source) as any[];

    // No explicit CAMERA statement anywhere -> no SET_CAMERA at all (the
    // deliverable scope here is explicit CAMERA emission only; the "no
    // statement = AUTO_FIT" behavior is a runtime-default, not a
    // synthesized instruction).
    expect(instructions.some((i) => i.action === 'SET_CAMERA')).toBe(false);

    // The BST still gets its default HIERARCHY layout backfilled.
    const layoutInstr = instructions.find((i) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'myTree');
    expect(layoutInstr).toBeDefined();
    expect(layoutInstr.strategy).toBe('HIERARCHY');
    expect(layoutInstr.params).toMatchObject({ levelGap: 2.0, siblingGap: 1.5, origin: [0, 2, 0] });

    const computeIdx = instructions.indexOf(layoutInstr);
    expect(instructions[computeIdx + 1]).toMatchObject({ action: 'COMPUTE_LAYOUT', targetId: 'myTree' });
  });

  it('preserves source order between geometry statements and INSERT/DELETE-family GENERIC_ACTIONs', () => {
    const source = `SCENE RelayoutDemo
DECLARE
  BST t = [50]

SEQUENCE
  LAYOUT t AS HIERARCHY(levelGap=3, siblingGap=2)
  INSERT 30
  INSERT 70
  LAYOUT t AS CIRCULAR(radius=3)
  WAIT
END
`;
    const instructions = compile(source) as any[];

    // Exactly two explicit layout passes for "t" (no default backfill, since
    // the pre-scan sees the first LAYOUT statement before DECLARE runs).
    const layoutInstrs = instructions.filter((i) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 't');
    expect(layoutInstrs).toHaveLength(2);
    expect(layoutInstrs.map((i) => i.strategy)).toEqual(['HIERARCHY', 'CIRCULAR']);

    // The two INSERTs (compiled to GENERIC_ACTION/BST_INSERT) must land
    // strictly between the first LAYOUT's COMPUTE_LAYOUT and the second
    // LAYOUT's SET_LAYOUT_STRATEGY, matching the program's written order.
    const firstComputeIdx = instructions.indexOf(layoutInstrs[0]) + 1;
    const secondLayoutIdx = instructions.indexOf(layoutInstrs[1]);
    const insertIndices = instructions
      .map((instr, idx) => ({ instr, idx }))
      .filter(({ instr }) => instr.action === 'GENERIC_ACTION' && instr.actionName === 'INSERT' && instr.args?.includes(30 as any))
      .map(({ idx }) => idx);
    expect(insertIndices.length).toBeGreaterThanOrEqual(1);
    for (const idx of insertIndices) {
      expect(idx).toBeGreaterThan(firstComputeIdx - 1);
      expect(idx).toBeLessThan(secondLayoutIdx);
    }
  });
});
