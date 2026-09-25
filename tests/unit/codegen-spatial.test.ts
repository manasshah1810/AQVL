/**
 * Unit tests for geometry AQIR code generation (LAYOUT / CAMERA /
 * POSITION) — see docs/design/aqir-geometry-spec.md and
 * docs/design/spatial-syntax-spec.md.
 *
 * compile() logs a full token/AST/AQIR dump on every call; silence it so
 * `vitest run` output stays readable.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../utils/testHelpers';
import { compile as compileAQVL } from '../../packages/compiler/src';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function actionsOf(instructions: unknown[], action: string): any[] {
  return (instructions as any[]).filter((i) => i.action === action);
}

describe('Geometry AQIR code generation', () => {
  describe('LAYOUT statement', () => {
    it('LAYOUT arr AS LINE(...) emits SET_LAYOUT_STRATEGY immediately followed by COMPUTE_LAYOUT', () => {
      const source = `SCENE Test
DECLARE
  ARRAY arr = [5, 3, 8]
SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  WAIT
END
`;
      const instructions = compile(source);
      const idx = instructions.findIndex((i: any) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'arr');
      expect(idx).toBeGreaterThanOrEqual(0);

      const layoutInstr = instructions[idx] as any;
      expect(layoutInstr.strategy).toBe('LINE');
      expect(layoutInstr.params).toMatchObject({ spacing: 1.5, axis: 'horizontal' });

      expect(instructions[idx + 1]).toMatchObject({ action: 'COMPUTE_LAYOUT', targetId: 'arr' });
    });

    it.each([
      ['LINE', 'spacing=1.5, axis=horizontal', { spacing: 1.5, axis: 'horizontal' }],
      ['HIERARCHY', 'levelGap=2, siblingGap=1', { levelGap: 2, siblingGap: 1 }],
      ['CIRCULAR', 'radius=4, startAngle=0', { radius: 4, startAngle: 0 }],
      ['FORCE_DIRECTED', 'repulsion=50, iterations=100', { repulsion: 50, iterations: 100 }],
      ['GRID', 'columns=3, spacingX=1.5, spacingY=1.5', { columns: 3, spacingX: 1.5, spacingY: 1.5 }],
      ['CUSTOM', '', {}],
    ])('LAYOUT x AS %s(...) generates a correct SET_LAYOUT_STRATEGY', (strategy, argsSrc, expectedParams) => {
      const source = `SCENE Test
DECLARE
  ARRAY x = [1]
SEQUENCE
  LAYOUT x AS ${strategy}(${argsSrc})
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'x');
      expect(instr).toBeDefined();
      expect(instr.strategy).toBe(strategy);
      expect(instr.params).toMatchObject(expectedParams as Record<string, unknown>);
    });

    it('does not emit a duplicate default SET_LAYOUT_STRATEGY when an explicit LAYOUT exists', () => {
      const source = `SCENE Test
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  LAYOUT arr AS GRID(columns=3)
  WAIT
END
`;
      const instructions = compile(source);
      const layoutInstrs = actionsOf(instructions, 'SET_LAYOUT_STRATEGY').filter((i) => i.targetId === 'arr');
      expect(layoutInstrs).toHaveLength(1);
      expect(layoutInstrs[0].strategy).toBe('GRID');
    });
  });

  describe('Default layout backfill (backward compatibility)', () => {
    it('auto-emits a default SET_LAYOUT_STRATEGY + COMPUTE_LAYOUT when no explicit LAYOUT is given', () => {
      const source = `SCENE Test
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  WAIT
END
`;
      const instructions = compile(source);
      const idx = instructions.findIndex((i: any) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'arr');
      expect(idx).toBeGreaterThanOrEqual(0);

      const instr = instructions[idx] as any;
      expect(instr.strategy).toBe('LINE');
      expect(instr.params).toMatchObject({ spacing: 2.2, axis: 'horizontal' });
      expect(instructions[idx + 1]).toMatchObject({ action: 'COMPUTE_LAYOUT', targetId: 'arr' });
    });

    it('defaults a STACK to LINE(spacing=1.2, axis=vertical, origin=(0,-2,0))', () => {
      const source = `SCENE Test
DECLARE
  STACK s = [1, 2]
SEQUENCE
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 's');
      expect(instr).toBeDefined();
      expect(instr.strategy).toBe('LINE');
      expect(instr.params).toMatchObject({ spacing: 1.2, axis: 'vertical', origin: [0, -2, 0] });
    });

    it('defaults a GRAPH to FORCE_DIRECTED with the tuned physics constants', () => {
      const source = `SCENE Test
DECLARE
  GRAPH g = ["a", "b", "a-b"]
SEQUENCE
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'g');
      expect(instr).toBeDefined();
      expect(instr.strategy).toBe('FORCE_DIRECTED');
      // `attraction` (not `springTension`/`gravity`, which ForceDirectedLayout.ts
      // never reads) is the actual runtime param name — see
      // docs/design/default-tuning-log.md's FORCE_DIRECTED section.
      expect(instr.params).toMatchObject({ repulsion: 5.0, springLength: 2.0, attraction: 0.1, iterations: 100 });
    });

    it('defaults a BST to HIERARCHY(levelGap=2, siblingGap=1.5, origin=(0,2,0))', () => {
      const source = `SCENE Test
DECLARE
  BST t = [50, 30, 70]
SEQUENCE
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 't');
      expect(instr).toBeDefined();
      expect(instr.strategy).toBe('HIERARCHY');
      expect(instr.params).toMatchObject({ levelGap: 2.0, siblingGap: 1.5, origin: [0, 2, 0] });
    });
  });

  describe('CAMERA statement', () => {
    it('CAMERA FOCUS(myTree) emits SET_CAMERA with a resolved targetId', () => {
      const source = `SCENE Test
DECLARE
  BST myTree = [50]
SEQUENCE
  CAMERA FOCUS(myTree)
  WAIT
END
`;
      const aqir = compileAQVL(source);
      const instr = actionsOf(aqir.instructions, 'SET_CAMERA')[0];
      const treeObject = aqir.objects.find((o: any) => o.type === 'BST');
      expect(instr).toBeDefined();
      expect(instr.mode).toBe('FOCUS');
      expect(treeObject).toBeDefined();
      expect(instr.params.targetId).toBe(treeObject!.id);
    });

    it('CAMERA AUTO_FIT emits SET_CAMERA with mode AUTO_FIT and empty params', () => {
      const source = `SCENE Test
SEQUENCE
  CAMERA AUTO_FIT
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_CAMERA')[0];
      expect(instr).toBeDefined();
      expect(instr.mode).toBe('AUTO_FIT');
      expect(instr.params).toEqual({});
    });

    it('CAMERA ORBIT(15) emits SET_CAMERA with mode ORBIT and speed 15', () => {
      const source = `SCENE Test
SEQUENCE
  CAMERA ORBIT(15)
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_CAMERA')[0];
      expect(instr).toBeDefined();
      expect(instr.mode).toBe('ORBIT');
      expect(instr.params.speed).toBe(15);
    });

    it('CAMERA POSITION(0, 6, 14) emits SET_CAMERA with an absolute x/y/z', () => {
      const source = `SCENE Test
SEQUENCE
  CAMERA POSITION(0, 6, 14)
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_CAMERA')[0];
      expect(instr).toBeDefined();
      expect(instr.mode).toBe('POSITION');
      expect(instr.params).toMatchObject({ x: 0, y: 6, z: 14 });
    });
  });

  describe('POSITION override', () => {
    it('POSITION arr[2] AT (x=5, y=2, z=0) emits a fully-specified SET_POSITION', () => {
      const source = `SCENE Test
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]
SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  POSITION arr[2] AT (x=5, y=2, z=0)
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_POSITION')[0];
      expect(instr).toBeDefined();
      expect(instr).toMatchObject({ x: 5, y: 2, z: 0 });
    });

    it('POSITION arr[1] AT (y=4) leaves the unnamed axes as null', () => {
      const source = `SCENE Test
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  POSITION arr[1] AT (y=4)
  WAIT
END
`;
      const instructions = compile(source);
      const instr = actionsOf(instructions, 'SET_POSITION')[0];
      expect(instr).toBeDefined();
      expect(instr).toMatchObject({ x: null, y: 4, z: null });
    });

    it('POSITION arr[1] AT () (empty arg list) releases the pin — all axes null', () => {
      const source = `SCENE Test
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  POSITION arr[1] AT (y=4)
  POSITION arr[1] AT ()
  WAIT
END
`;
      const instructions = compile(source);
      const positionInstrs = actionsOf(instructions, 'SET_POSITION');
      expect(positionInstrs).toHaveLength(2);
      expect(positionInstrs[1]).toMatchObject({ x: null, y: null, z: null });
    });

    it('emits SET_POSITION after the preceding LAYOUT/COMPUTE_LAYOUT pair, preserving precedence', () => {
      const source = `SCENE Test
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]
SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  POSITION arr[2] AT (x=5, y=2, z=0)
  WAIT
END
`;
      const instructions = compile(source);
      const computeIdx = instructions.findIndex((i: any) => i.action === 'COMPUTE_LAYOUT' && i.targetId === 'arr');
      const positionIdx = instructions.findIndex((i: any) => i.action === 'SET_POSITION');
      expect(computeIdx).toBeGreaterThanOrEqual(0);
      expect(positionIdx).toBeGreaterThan(computeIdx);
    });
  });
});
