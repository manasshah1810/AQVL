/**
 * End-to-end verification of spatial AQIR compilation: realistic AQVL
 * source -> lex -> parse -> semantic validation -> type check -> optimize
 * -> generate, asserting the full, inspectable AQIR instruction stream —
 * see docs/design/spatial-syntax-spec.md (grammar/defaults) and
 * docs/design/aqir-geometry-spec.md (opcode shapes/ordering). Builds on
 * the narrower unit coverage in tests/unit/codegen-spatial.test.ts and the
 * ordering coverage in tests/integration/spatial-compilation.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  compile,
  SemanticError,
  SyntaxError as AQVLSyntaxError,
  ParseError,
  TypeMismatchError,
} from '../../packages/compiler/src';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function actionsOf(instructions: unknown[], action: string): any[] {
  return (instructions as any[]).filter((i) => i.action === action);
}

function actionNames(instructions: unknown[]): string[] {
  return (instructions as any[]).map((i) => i.action).filter(Boolean);
}

describe('Spatial AQIR — end-to-end compilation', () => {
  // -----------------------------------------------------------------
  // 1. LAYOUT STRATEGIES
  // -----------------------------------------------------------------
  describe('1. Layout strategies', () => {
    it('LINE: an array laid out with explicit spacing/axis/origin', () => {
      const source = `SCENE ArrayLayoutDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal, origin=(0, 0, 0))
  HIGHLIGHT arr[2]
  WAIT
END
`;
      const aqir = compile(source);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'arr');
      expect(layout).toBeDefined();
      expect(layout.strategy).toBe('LINE');
      expect(layout.params).toMatchObject({ spacing: 1.5, axis: 'horizontal', origin: [0, 0, 0] });
      const computeIdx = aqir.instructions.indexOf(layout);
      expect(aqir.instructions[computeIdx + 1]).toMatchObject({ action: 'COMPUTE_LAYOUT', targetId: 'arr' });
    });

    it('HIERARCHY: a BST laid out with tuned level/sibling gaps', () => {
      const source = `SCENE TreeLayoutDemo
DECLARE
  BST tree1 = [50, 30, 70]

SEQUENCE
  LAYOUT tree1 AS HIERARCHY(levelGap=2.5, siblingGap=1.5, origin=(0, 2, 0))
  WAIT
END
`;
      const aqir = compile(source);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'tree1');
      expect(layout).toBeDefined();
      expect(layout.strategy).toBe('HIERARCHY');
      expect(layout.params).toMatchObject({ levelGap: 2.5, siblingGap: 1.5, origin: [0, 2, 0] });
    });

    it('CIRCULAR: a graph frozen into a ring instead of force-simulated', () => {
      const source = `SCENE RingBufferDemo
DECLARE
  GRAPH ring = ["a", "b", "c", "d", "a-b", "b-c", "c-d", "d-a"]

SEQUENCE
  LAYOUT ring AS CIRCULAR(radius=4, startAngle=0, origin=(0, 0, 0))
  WAIT
END
`;
      const aqir = compile(source);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'ring');
      expect(layout).toBeDefined();
      expect(layout.strategy).toBe('CIRCULAR');
      expect(layout.params).toMatchObject({ radius: 4, startAngle: 0, origin: [0, 0, 0] });
    });

    it('FORCE_DIRECTED: a graph with tuned physics constants', () => {
      const source = `SCENE GraphLayoutDemo
DECLARE
  GRAPH g = ["a", "b", "c", "a-b", "b-c"]

SEQUENCE
  LAYOUT g AS FORCE_DIRECTED(repulsion=50, springLength=3, springTension=0.2, gravity=0.1, iterations=150)
  WAIT
END
`;
      const aqir = compile(source);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'g');
      expect(layout).toBeDefined();
      expect(layout.strategy).toBe('FORCE_DIRECTED');
      expect(layout.params).toMatchObject({
        repulsion: 50, springLength: 3, springTension: 0.2, gravity: 0.1, iterations: 150,
      });
    });

    it('GRID: an array visualized as a matrix', () => {
      const source = `SCENE MatrixDemo
DECLARE
  ARRAY matrix = [1, 2, 3, 4, 5, 6, 7, 8, 9]

SEQUENCE
  LAYOUT matrix AS GRID(columns=3, spacingX=1.5, spacingY=1.5, origin=(0, 0, 0))
  HIGHLIGHT matrix[4]
  WAIT
END
`;
      const aqir = compile(source);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'matrix');
      expect(layout).toBeDefined();
      expect(layout.strategy).toBe('GRID');
      expect(layout.params).toMatchObject({ columns: 3, spacingX: 1.5, spacingY: 1.5, origin: [0, 0, 0] });
    });

    it('CUSTOM: every element manually placed via POSITION, no auto-layout', () => {
      const source = `SCENE CustomLayoutDemo
DECLARE
  ARRAY pts = [1, 2, 3]

SEQUENCE
  LAYOUT pts AS CUSTOM()
  POSITION pts[0] AT (x=-3, y=0, z=0)
  POSITION pts[1] AT (x=0, y=2, z=0)
  POSITION pts[2] AT (x=3, y=0, z=0)
  WAIT
END
`;
      const aqir = compile(source);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'pts');
      expect(layout).toBeDefined();
      expect(layout.strategy).toBe('CUSTOM');
      expect(layout.params).toEqual({});

      const positions = actionsOf(aqir.instructions, 'SET_POSITION');
      expect(positions).toHaveLength(3);
      expect(positions.map((p) => [p.x, p.y, p.z])).toEqual([
        [-3, 0, 0],
        [0, 2, 0],
        [3, 0, 0],
      ]);
    });
  });

  // -----------------------------------------------------------------
  // 2. CAMERA CONTROL
  // -----------------------------------------------------------------
  describe('2. Camera control', () => {
    it('FOCUS: soft-follows a declared structure', () => {
      const source = `SCENE MultiStructureDemo
DECLARE
  ARRAY nums = [4, 2, 7]
  BST tree2 = [40, 20, 60]

SEQUENCE
  CAMERA FOCUS(tree2)
  COMPARE nums[0] nums[1]
  WAIT
END
`;
      const aqir = compile(source);
      const camera = actionsOf(aqir.instructions, 'SET_CAMERA')[0];
      const treeObject = aqir.objects.find((o: any) => o.type === 'BST');
      expect(camera).toMatchObject({ mode: 'FOCUS' });
      expect(camera.params.targetId).toBe(treeObject!.id);
    });

    it('AUTO_FIT: explicit return to global reactive follow', () => {
      const source = `SCENE FocusThenAutoFitDemo
DECLARE
  GRAPH g = ["a", "b", "a-b"]

SEQUENCE
  CAMERA FOCUS(g)
  WAIT
  CAMERA AUTO_FIT
  WAIT
END
`;
      const aqir = compile(source);
      const cameras = actionsOf(aqir.instructions, 'SET_CAMERA');
      expect(cameras).toHaveLength(2);
      expect(cameras[0].mode).toBe('FOCUS');
      expect(cameras[1]).toMatchObject({ mode: 'AUTO_FIT', params: {} });
    });

    it('ORBIT: continuous auto-rotation at a fixed speed', () => {
      const source = `SCENE OrbitPresentationDemo
DECLARE
  BST t3 = [1]

SEQUENCE
  CAMERA ORBIT(15)
  WAIT
END
`;
      const aqir = compile(source);
      const camera = actionsOf(aqir.instructions, 'SET_CAMERA')[0];
      expect(camera).toMatchObject({ mode: 'ORBIT', params: { speed: 15 } });
    });

    it('POSITION: fixed absolute camera location', () => {
      const source = `SCENE PinnedElementDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  CAMERA POSITION(0, 6, 14)
  WAIT
END
`;
      const aqir = compile(source);
      const camera = actionsOf(aqir.instructions, 'SET_CAMERA')[0];
      expect(camera).toMatchObject({ mode: 'POSITION', params: { x: 0, y: 6, z: 14 } });
    });
  });

  // -----------------------------------------------------------------
  // 3. POSITION OVERRIDES
  // -----------------------------------------------------------------
  describe('3. Position overrides', () => {
    it('LAYOUT + POSITION: the override is emitted after the layout pass (precedence)', () => {
      const source = `SCENE PinnedElementDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  POSITION arr[2] AT (x=5, y=2, z=0)
  WAIT
END
`;
      const aqir = compile(source);
      const layoutIdx = aqir.instructions.findIndex((i: any) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'arr');
      const computeIdx = aqir.instructions.findIndex((i: any) => i.action === 'COMPUTE_LAYOUT' && i.targetId === 'arr');
      const positionIdx = aqir.instructions.findIndex((i: any) => i.action === 'SET_POSITION');

      expect(layoutIdx).toBeGreaterThanOrEqual(0);
      expect(computeIdx).toBe(layoutIdx + 1);
      expect(positionIdx).toBeGreaterThan(computeIdx);
      expect(aqir.instructions[positionIdx]).toMatchObject({ x: 5, y: 2, z: 0 });
    });

    it('POSITION only (no explicit LAYOUT): default layout is backfilled ahead of the override', () => {
      const source = `SCENE ReleasePositionDemo
DECLARE
  ARRAY arr = [1, 2, 3]

SEQUENCE
  POSITION arr[1] AT (y=4)
  WAIT
END
`;
      const aqir = compile(source);
      const layoutIdx = aqir.instructions.findIndex((i: any) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'arr');
      const computeIdx = aqir.instructions.findIndex((i: any) => i.action === 'COMPUTE_LAYOUT' && i.targetId === 'arr');
      const positionIdx = aqir.instructions.findIndex((i: any) => i.action === 'SET_POSITION');

      expect(layoutIdx).toBe(0); // backfilled immediately after DECLARE, ahead of everything else
      expect(computeIdx).toBe(1);
      expect(positionIdx).toBeGreaterThan(computeIdx);
      expect(aqir.instructions[layoutIdx]).toMatchObject({ strategy: 'LINE', params: { spacing: 2.2, axis: 'horizontal' } });
      expect(aqir.instructions[positionIdx]).toMatchObject({ x: null, y: 4, z: null });
    });
  });

  // -----------------------------------------------------------------
  // 4. BACKWARD COMPATIBILITY
  // -----------------------------------------------------------------
  describe('4. Backward compatibility (pre-spatial programs)', () => {
    it('a plain BST program (no LAYOUT/CAMERA/POSITION) compiles with no errors and gets a default HIERARCHY layout', () => {
      const source = `SCENE PlainBSTDemo
DECLARE
  BST myTree = [50, 30, 70]

SEQUENCE
  INORDER myTree
  CLEAR myTree
END
`;
      expect(() => compile(source)).not.toThrow();
      const aqir = compile(source);
      // Initial elements [50, 30, 70] compile to 3 prepended BST_INSERT
      // instructions (unchanged pre-existing behavior); the user-written
      // sequence's own animation instructions follow, also unchanged.
      const genericActions = actionsOf(aqir.instructions, 'GENERIC_ACTION').map((i) => i.actionName);
      expect(genericActions).toEqual(['BST_INSERT', 'BST_INSERT', 'BST_INSERT', 'INORDER', 'CLEAR']);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'myTree');
      expect(layout).toMatchObject({ strategy: 'HIERARCHY' });
    });

    it('a linear-search array program compiles unchanged plus a default LINE layout', () => {
      const source = `SCENE LinearSearch
DECLARE
  ARRAY arr = [12, 34, 25, 64, 22, 11, 90]

SEQUENCE
  COMPARE arr[0] arr[4]
  COMPARE arr[1] arr[4]
  HIGHLIGHT arr[4] 'SUCCESS'
END
`;
      const aqir = compile(source);
      const nonGeometry = aqir.instructions.filter((i: any) => !['SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT'].includes(i.action));
      expect(actionNames(nonGeometry)).toEqual(['COMPARE_OBJECTS', 'COMPARE_OBJECTS', 'HIGHLIGHT_OBJECT']);
      expect(actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY')).toHaveLength(1);
    });

    it('a stack push/pop program compiles unchanged plus a default vertical-LINE layout', () => {
      const source = `SCENE StackDemo
DECLARE
  STACK s = [1, 2]

SEQUENCE
  PUSH s 3
  POP s
END
`;
      const aqir = compile(source);
      const nonGeometry = aqir.instructions.filter((i: any) => !['SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT'].includes(i.action));
      expect(actionNames(nonGeometry)).toEqual(['GENERIC_ACTION', 'GENERIC_ACTION']);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 's');
      expect(layout).toMatchObject({ strategy: 'LINE', params: { spacing: 1.2, axis: 'vertical', origin: [0, -2, 0] } });
    });

    it('a linked-list program compiles unchanged plus a default LINE layout', () => {
      const source = `SCENE ListDemo
DECLARE
  LINKEDLIST list1 = [1, 2, 3]

SEQUENCE
  INSERT_TAIL list1 4
END
`;
      const aqir = compile(source);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'list1');
      expect(layout).toMatchObject({ strategy: 'LINE', params: { spacing: 2.5, axis: 'horizontal', origin: [0, 0, 0] } });
      const genericActions = actionsOf(aqir.instructions, 'GENERIC_ACTION').map((i) => i.actionName);
      expect(genericActions).toEqual(['INSERT_TAIL']);
    });

    it('a hash map program compiles unchanged plus a default LINE layout for its buckets', () => {
      const source = `SCENE HashMapDemo
DECLARE
  HASH_MAP h = { a: 1, b: 2 }

SEQUENCE
  HASHMAP_INSERT h c 3
END
`;
      const aqir = compile(source);
      const layout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'h');
      expect(layout).toMatchObject({ strategy: 'LINE', params: { spacing: 2.2, axis: 'horizontal' } });
    });
  });

  // -----------------------------------------------------------------
  // 5. ERROR CASES
  // -----------------------------------------------------------------
  describe('5. Error cases', () => {
    it('LAYOUT on an undeclared structure throws a SemanticError', () => {
      const source = `SCENE Bad
SEQUENCE
  LAYOUT ghost AS LINE(spacing=1)
  WAIT
END
`;
      expect(() => compile(source)).toThrow(SemanticError);
    });

    it('an unknown (non-keyword) layout strategy throws a parse-time error', () => {
      const source = `SCENE Bad
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  LAYOUT arr AS ZIGZAG_LAYOUT(foo=1)
  WAIT
END
`;
      expect(() => compile(source)).toThrow(AQVLSyntaxError);
    });

    it('a known keyword that is not a real layout strategy throws a SemanticError', () => {
      const source = `SCENE Bad
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  LAYOUT arr AS SEARCH()
  WAIT
END
`;
      expect(() => compile(source)).toThrow(SemanticError);
    });

    it('CAMERA FOCUS on an undeclared target throws a SemanticError', () => {
      const source = `SCENE Bad
SEQUENCE
  CAMERA FOCUS(ghost)
  WAIT
END
`;
      expect(() => compile(source)).toThrow(SemanticError);
    });

    it('a malformed numeric LAYOUT parameter (spacing="abc") throws a TypeMismatchError', () => {
      const source = `SCENE Bad
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  LAYOUT arr AS LINE(spacing="abc")
  WAIT
END
`;
      expect(() => compile(source)).toThrow(TypeMismatchError);
    });
  });

  // -----------------------------------------------------------------
  // 6. MULTI-STRUCTURE
  // -----------------------------------------------------------------
  describe('6. Multi-structure programs', () => {
    it('an array, a tree, and a graph each keep their own layout, with a camera pass, and no cross-target interleaving', () => {
      const source = `SCENE MultiStructureFullDemo
DECLARE
  ARRAY nums = [4, 2, 7]
  BST tree4 = [40, 20, 60]
  GRAPH g = ["a", "b", "a-b"]

SEQUENCE
  CAMERA AUTO_FIT
  LAYOUT nums AS LINE(spacing=2, axis=horizontal)
  LAYOUT tree4 AS HIERARCHY(levelGap=2, siblingGap=1.5)
  LAYOUT g AS CIRCULAR(radius=3)
  COMPARE nums[0] nums[1]
  WAIT
END
`;
      const aqir = compile(source);

      // Exactly one explicit layout pass per structure, no default backfill duplicates.
      for (const targetId of ['nums', 'tree4', 'g']) {
        const layouts = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').filter((i) => i.targetId === targetId);
        expect(layouts).toHaveLength(1);
      }

      const numsLayout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'nums');
      const treeLayout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'tree4');
      const graphLayout = actionsOf(aqir.instructions, 'SET_LAYOUT_STRATEGY').find((i) => i.targetId === 'g');
      expect(numsLayout.strategy).toBe('LINE');
      expect(treeLayout.strategy).toBe('HIERARCHY');
      expect(graphLayout.strategy).toBe('CIRCULAR');

      // Each SET_LAYOUT_STRATEGY is immediately followed by its own
      // COMPUTE_LAYOUT for the *same* target — no interleaving between
      // structures' layout passes.
      for (const layout of [numsLayout, treeLayout, graphLayout]) {
        const idx = aqir.instructions.indexOf(layout);
        expect(aqir.instructions[idx + 1]).toMatchObject({ action: 'COMPUTE_LAYOUT', targetId: layout.targetId });
      }

      // Full geometry-relevant + animation instruction sequence matches
      // source order exactly: CAMERA first, then the three LAYOUT/COMPUTE
      // pairs in declaration order, then the COMPARE.
      const relevant = actionNames(aqir.instructions).filter((a) =>
        ['SET_CAMERA', 'SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT', 'COMPARE_OBJECTS'].includes(a)
      );
      expect(relevant).toEqual([
        'SET_CAMERA',
        'SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT', // nums
        'SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT', // tree4
        'SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT', // g
        'COMPARE_OBJECTS',
      ]);
    });
  });
});
