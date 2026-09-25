/**
 * End-to-end verification of the runtime Layout Engine (Phase 3.1): compiles
 * real AQVL source containing `LAYOUT ... AS LINE/GRID(...)`, runs the
 * resulting AQIR through the real AQVLVirtualMachine (with the compiler's
 * `objects` wired in so the VM can resolve structure membership), and
 * asserts the actual resolved x/y/z math recorded in the execution
 * timeline — not just that the right instructions were emitted (that's
 * covered by tests/integration/spatial-e2e.test.ts).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { createVM } from '../../packages/runtime/src';
import type { ResolvedPosition } from '../../packages/runtime/src';
import { SceneManager } from '../../packages/runtime/src/core/SceneManager';
import { RelationshipManager } from '../../packages/runtime/src/core/RelationshipManager';
import { EventDispatcher } from '../../packages/runtime/src/core/EventDispatcher';
import { BSTEngine } from '../../packages/runtime/src/core/algorithms/BSTEngine';
import { LayoutEngine, type LayoutElementInput } from '../../packages/runtime/src/layout/LayoutEngine';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

/** Resolves the compiled scene-element id for `logicalParent[logicalIndex]`. */
function idFor(objects: any[], logicalParent: string, logicalIndex: number): string {
  const obj = objects.find((o) => o.logicalParent === logicalParent && o.logicalIndex === logicalIndex);
  if (!obj) throw new Error(`No compiled object for ${logicalParent}[${logicalIndex}]`);
  return obj.id;
}

/** Finds the last recorded positions snapshot that has an entry for `elementId` (i.e. after its COMPUTE_LAYOUT ran). */
function positionsAfter(steps: { state: { positions?: Record<string, ResolvedPosition> } }[], elementId: string): Record<string, ResolvedPosition> {
  for (let i = steps.length - 1; i >= 0; i--) {
    const positions = steps[i].state.positions;
    if (positions && positions[elementId]) return positions;
  }
  throw new Error(`Element ${elementId} never appears in any recorded positions snapshot`);
}

describe('Runtime layout engine — end-to-end (compile -> VM -> resolved positions)', () => {
  it('LINE: array elements resolve to evenly spaced x coordinates after COMPUTE_LAYOUT', async () => {
    const source = `SCENE ArrayLayoutDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal, origin=(0, 0, 0))
  WAIT
END
`;
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const el2 = idFor(aqir.objects, 'arr', 2);
    const positions = positionsAfter(result.executionSteps, el2);

    for (let i = 0; i < 5; i++) {
      const id = idFor(aqir.objects, 'arr', i);
      expect(positions[id]).toBeDefined();
      expect(positions[id].y).toBe(0);
      expect(positions[id].z).toBe(0);
    }
    // Centered on origin, spacing 1.5: index 2 (middle of 5) sits at x=0.
    expect(positions[el2].x).toBe(0);
    expect(positions[idFor(aqir.objects, 'arr', 0)].x).toBe(-3);
    expect(positions[idFor(aqir.objects, 'arr', 4)].x).toBe(3);
  });

  it('LINE: a vertical-axis stack resolves to evenly spaced y coordinates', async () => {
    const source = `SCENE StackDemo
DECLARE
  STACK s = [1, 2, 3]

SEQUENCE
  LAYOUT s AS LINE(spacing=1.2, axis=vertical, origin=(0, -2, 0))
  WAIT
END
`;
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const el1 = idFor(aqir.objects, 's', 1);
    const positions = positionsAfter(result.executionSteps, el1);
    expect(positions[el1].x).toBe(0);
    expect(positions[el1].y).toBe(-2); // middle element sits at origin.y
    const el0 = idFor(aqir.objects, 's', 0);
    const el2 = idFor(aqir.objects, 's', 2);
    expect(positions[el0].y).toBeCloseTo(-3.2, 10);
    expect(positions[el2].y).toBeCloseTo(-0.8, 10);
  });

  it('GRID: a matrix resolves to row/column coordinates in the X-Z plane', async () => {
    const source = `SCENE MatrixDemo
DECLARE
  ARRAY matrix = [1, 2, 3, 4, 5, 6, 7, 8, 9]

SEQUENCE
  LAYOUT matrix AS GRID(columns=3, spacingX=1.5, spacingY=1.5, cellSpacing=1.5, origin=(0, 0, 0))
  WAIT
END
`;
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const el4 = idFor(aqir.objects, 'matrix', 4);
    const positions = positionsAfter(result.executionSteps, el4);

    // Element 4 is the grid's center (row 1, col 1 of a 3x3 grid) -> at origin.
    expect(positions[el4]).toEqual({ x: 0, y: 0, z: 0 });

    const el0 = idFor(aqir.objects, 'matrix', 0);
    const el8 = idFor(aqir.objects, 'matrix', 8);
    expect(positions[el0].x).toBeLessThan(positions[el4].x + 0.001);
    expect(positions[el0].z).toBeLessThan(positions[el4].z + 0.001);
    expect(positions[el8].x).toBeGreaterThan(positions[el4].x);
    expect(positions[el8].z).toBeGreaterThan(positions[el4].z);
  });

  it('SET_POSITION overrides a pinned axis while leaving the layout-computed axes alone', async () => {
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
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const el2 = idFor(aqir.objects, 'arr', 2);
    const positions = positionsAfter(result.executionSteps, el2);
    expect(positions[el2]).toEqual({ x: 5, y: 2, z: 0 });

    // Unpinned neighbors keep the LINE-computed slots.
    const el0 = idFor(aqir.objects, 'arr', 0);
    expect(positions[el0]).toEqual({ x: -3, y: 0, z: 0 });
  });

  it('SET_CAMERA: the resolved camera state is recorded in the execution timeline', async () => {
    const source = `SCENE PinnedElementDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  CAMERA POSITION(0, 6, 14)
  WAIT
END
`;
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    expect(result.finalState.camera).toEqual({
      mode: 'POSITION',
      position: { x: 0, y: 6, z: 14 },
    });
  });
});

/**
 * Builds a real BST using the exact same production `BSTEngine` the
 * compiled `BST_INSERT` GENERIC_ACTION drives at runtime (see
 * packages/runtime/src/core/algorithms/BSTEngine.ts), but invoked directly
 * and synchronously — `BST_INSERT` is dynamic (nodes/edges are created via
 * `SceneManager.addElement` during animation execution, not emitted as
 * static compiler `objects`; see docs/design/existing-layout-audit.md §5),
 * so there is no static element list the VM's own geometry tracking can see
 * ahead of time. This still exercises the real insertion algorithm and real
 * scene-element/edge shapes, just without going through the (real-time,
 * anime.js-driven) AnimationController.
 */
function buildRealBST(treeName: string, values: number[]): { elements: LayoutElementInput[]; idForValue: (v: number) => string } {
  const dispatcher = new EventDispatcher();
  const sceneManager = new SceneManager(dispatcher);
  const relationshipManager = new RelationshipManager(dispatcher);

  values.forEach((value) => {
    const path = BSTEngine.computeInsertPath(sceneManager, treeName, value);
    if (!path.success) throw new Error(`BST insert failed for ${value}: ${path.error}`);
    BSTEngine.insertNode(sceneManager, relationshipManager, treeName, value, path.parentNode ?? null, path.edgeLabel ?? null);
  });

  const nodes = BSTEngine.getNodes(sceneManager, treeName);
  const edges = BSTEngine.getEdges(sceneManager, treeName);

  const elements: LayoutElementInput[] = nodes.map((node: any) => {
    const parentEdge = edges.find((e: any) => e.targetId === node.id);
    // L child sorts before R child under the same parent; root has no siblings so its index is arbitrary.
    const logicalIndex = parentEdge?.properties?.label === 'R' ? 1 : 0;
    return { id: node.id, logicalIndex, parentId: parentEdge ? parentEdge.sourceId : null };
  });

  const idForValue = (v: number): string => {
    const node = nodes.find((n: any) => Number(n.value) === v);
    if (!node) throw new Error(`No BST node for value ${v}`);
    return node.id;
  };

  return { elements, idForValue };
}

describe('Runtime layout engine — end-to-end (HIERARCHY + CIRCULAR)', () => {
  it('HIERARCHY: LAYOUT tree1 AS HIERARCHY(...) compiled params + a real BST produce a correct, non-overlapping tree shape', () => {
    const source = `SCENE BSTLayoutDemo
DECLARE
  BST tree1 = [50, 30, 70, 20, 40, 60, 80]

SEQUENCE
  LAYOUT tree1 AS HIERARCHY(levelGap=2, siblingGap=1)
  WAIT
END
`;
    const aqir = compile(source);
    const layoutInstr = aqir.instructions.find((i: any) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'tree1') as any;
    expect(layoutInstr).toBeDefined();
    expect(layoutInstr.strategy).toBe('HIERARCHY');
    expect(layoutInstr.params).toMatchObject({ levelGap: 2, siblingGap: 1 });

    const { elements, idForValue } = buildRealBST('tree1', [50, 30, 70, 20, 40, 60, 80]);
    const engine = new LayoutEngine();
    const positions = engine.computeLayout('tree1', layoutInstr.strategy, layoutInstr.params, elements);

    expect(positions.size).toBe(7);

    // Perfectly balanced insert order -> 3 clean levels.
    const yOf = (v: number) => positions.get(idForValue(v))!.y;
    expect(yOf(50)).toBe(0);
    expect(yOf(30)).toBe(-2);
    expect(yOf(70)).toBe(-2);
    expect(yOf(20)).toBe(-4);
    expect(yOf(40)).toBe(-4);
    expect(yOf(60)).toBe(-4);
    expect(yOf(80)).toBe(-4);

    // Symmetric tree -> root centered, left/right subtrees mirror around it.
    expect(positions.get(idForValue(50))!.x).toBeCloseTo(0, 10);
    expect(positions.get(idForValue(30))!.x).toBeCloseTo(-positions.get(idForValue(70))!.x, 10);

    // No overlap at the bottom level (the 4 leaves).
    const leafXs = [20, 40, 60, 80].map((v) => positions.get(idForValue(v))!.x).sort((a, b) => a - b);
    for (let i = 1; i < leafXs.length; i++) {
      expect(leafXs[i] - leafXs[i - 1]).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });

  it('HIERARCHY: an unbalanced (ascending-insert) real BST lays out as a non-overlapping right-leaning chain', () => {
    const source = `SCENE ChainBSTDemo
DECLARE
  BST chain = [1]

SEQUENCE
  LAYOUT chain AS HIERARCHY(levelGap=1.5, siblingGap=1)
  WAIT
END
`;
    const aqir = compile(source);
    const layoutInstr = aqir.instructions.find((i: any) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'chain') as any;

    const { elements, idForValue } = buildRealBST('chain', [1, 2, 3, 4, 5]);
    const engine = new LayoutEngine();
    const positions = engine.computeLayout('chain', layoutInstr.strategy, layoutInstr.params, elements);

    expect(positions.size).toBe(5);
    // Every node has exactly one (right) child -> a straight vertical chain, all sharing x.
    const xs = [1, 2, 3, 4, 5].map((v) => positions.get(idForValue(v))!.x);
    xs.forEach((x) => expect(x).toBeCloseTo(xs[0], 10));

    const ys = [1, 2, 3, 4, 5].map((v) => positions.get(idForValue(v))!.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeLessThan(ys[i - 1]); // strictly deeper each step, no overlap possible on a single column
    }
  });

  it('CIRCULAR: a real GRAPH ring compiles + runs through the VM to an equidistant, correctly-spaced circle', async () => {
    const source = `SCENE RingBufferDemo
DECLARE
  GRAPH ring = ["a", "b", "c", "d", "a-b", "b-c", "c-d", "d-a"]

SEQUENCE
  LAYOUT ring AS CIRCULAR(radius=5, startAngle=0)
  WAIT
END
`;
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const vertexIds = aqir.objects.filter((o: any) => o.type === 'VERTEX' && o.logicalParent === 'ring').map((o: any) => o.id);
    expect(vertexIds).toHaveLength(4);

    const positions = positionsAfter(result.executionSteps, vertexIds[0]);
    const center = { x: 0, y: 0, z: 0 };
    vertexIds.forEach((id) => {
      const p = positions[id];
      expect(p).toBeDefined();
      const dist = Math.sqrt((p.x - center.x) ** 2 + (p.y - center.y) ** 2 + (p.z - center.z) ** 2);
      expect(dist).toBeCloseTo(5, 10);
    });

    // startAngle=0 -> the first vertex sits exactly on the +X axis.
    expect(positions[vertexIds[0]].x).toBeCloseTo(5, 10);
    expect(positions[vertexIds[0]].z).toBeCloseTo(0, 10);
  });

  it('CIRCULAR: startAngle shifts the compiled ring\'s rotation', async () => {
    const baseSource = `SCENE RotatedRing
DECLARE
  GRAPH ring = ["a", "b", "c", "a-b", "b-c", "c-a"]

SEQUENCE
  LAYOUT ring AS CIRCULAR(radius=4, startAngle=0)
  WAIT
END
`;
    const rotatedSource = baseSource.replace('startAngle=0', 'startAngle=120');

    const [baseAqir, rotatedAqir] = [compile(baseSource), compile(rotatedSource)];
    const [baseVm, rotatedVm] = [
      createVM(baseAqir.instructions, baseAqir.functionTable, {}, undefined, baseAqir.objects),
      createVM(rotatedAqir.instructions, rotatedAqir.functionTable, {}, undefined, rotatedAqir.objects),
    ];
    const [baseResult, rotatedResult] = await Promise.all([baseVm.run(), rotatedVm.run()]);

    const vertexId = baseAqir.objects.find((o: any) => o.type === 'VERTEX' && o.logicalParent === 'ring')!.id;
    const basePositions = positionsAfter(baseResult.executionSteps, vertexId);
    const rotatedPositions = positionsAfter(rotatedResult.executionSteps, vertexId);

    // Same radius, rotated ring -> same distance from center, different point.
    const dist = (p: ResolvedPosition) => Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
    expect(dist(basePositions[vertexId])).toBeCloseTo(4, 10);
    expect(dist(rotatedPositions[vertexId])).toBeCloseTo(4, 10);
    expect(rotatedPositions[vertexId].x).not.toBeCloseTo(basePositions[vertexId].x, 5);
  });
});

describe('Runtime layout engine — end-to-end (FORCE_DIRECTED + CUSTOM)', () => {
  it('FORCE_DIRECTED: a real GRAPH compiles + runs through the VM, connected vertices end up closer than disconnected ones', async () => {
    const source = `SCENE GraphLayoutDemo
DECLARE
  GRAPH g = ["a", "b", "c", "d", "a-b", "c-d"]

SEQUENCE
  LAYOUT g AS FORCE_DIRECTED(repulsion=5, attraction=0.2, springLength=2, iterations=200)
  WAIT
END
`;
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const vertexObjs = aqir.objects.filter((o: any) => o.type === 'VERTEX' && o.logicalParent === 'g');
    expect(vertexObjs).toHaveLength(4);
    const idOf = (name: string) => vertexObjs.find((o: any) => o.value === name)!.id;
    const positions = positionsAfter(result.executionSteps, idOf('a'));

    const dist = (x: string, y: string) => {
      const p1 = positions[idOf(x)];
      const p2 = positions[idOf(y)];
      return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
    };

    const connectedAvg = (dist('a', 'b') + dist('c', 'd')) / 2;
    const disconnectedAvg = (dist('a', 'c') + dist('a', 'd') + dist('b', 'c') + dist('b', 'd')) / 4;
    expect(connectedAvg).toBeLessThan(disconnectedAvg);
  });

  it('CUSTOM: exact per-element positions set via POSITION pass through the VM unchanged', async () => {
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
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const el0 = idFor(aqir.objects, 'pts', 0);
    const el1 = idFor(aqir.objects, 'pts', 1);
    const el2 = idFor(aqir.objects, 'pts', 2);
    const positions = positionsAfter(result.executionSteps, el1);

    expect(positions[el0]).toEqual({ x: -3, y: 0, z: 0 });
    expect(positions[el1]).toEqual({ x: 0, y: 2, z: 0 });
    expect(positions[el2]).toEqual({ x: 3, y: 0, z: 0 });
  });

  it('CUSTOM: an element with no POSITION override falls back to the origin instead of crashing', async () => {
    const source = `SCENE CustomLayoutPartialDemo
DECLARE
  ARRAY pts = [1, 2]

SEQUENCE
  LAYOUT pts AS CUSTOM()
  POSITION pts[0] AT (x=5, y=5, z=5)
  WAIT
END
`;
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const el0 = idFor(aqir.objects, 'pts', 0);
    const el1 = idFor(aqir.objects, 'pts', 1);
    const positions = positionsAfter(result.executionSteps, el0);

    expect(positions[el0]).toEqual({ x: 5, y: 5, z: 5 });
    expect(positions[el1]).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('COMPREHENSIVE: all 6 layout strategies compute correctly within one program, no interference', async () => {
    const source = `SCENE AllStrategiesDemo
DECLARE
  ARRAY lineArr = [1, 2, 3]
  ARRAY gridArr = [1, 2, 3, 4]
  BST bstTree = [50, 30, 70]
  GRAPH ring = ["a", "b", "c", "a-b", "b-c", "c-a"]
  GRAPH mesh = ["p", "q", "r", "p-q", "q-r"]
  ARRAY freeform = [9]

SEQUENCE
  LAYOUT lineArr AS LINE(spacing=1, axis=horizontal)
  LAYOUT gridArr AS GRID(columns=2, cellSpacing=1)
  LAYOUT bstTree AS HIERARCHY(levelGap=2, siblingGap=1)
  LAYOUT ring AS CIRCULAR(radius=3)
  LAYOUT mesh AS FORCE_DIRECTED(iterations=60)
  LAYOUT freeform AS CUSTOM()
  POSITION freeform[0] AT (x=7, y=7, z=7)
  WAIT
END
`;
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects);
    const result = await vm.run();

    const positions = positionsAfter(result.executionSteps, idFor(aqir.objects, 'freeform', 0));

    // LINE: 3 elements, spacing 1 -> middle sits at origin, first is left of it.
    expect(positions[idFor(aqir.objects, 'lineArr', 1)]).toEqual({ x: 0, y: 0, z: 0 });
    expect(positions[idFor(aqir.objects, 'lineArr', 0)].x).toBeLessThan(0);

    // GRID: 4 elements, 2 columns -> 2 distinct x-columns.
    const gridPos = [0, 1, 2, 3].map((i) => positions[idFor(aqir.objects, 'gridArr', i)]);
    gridPos.forEach((p) => expect(p).toBeDefined());
    expect(new Set(gridPos.map((p) => p.x)).size).toBe(2);

    // CIRCULAR: 3 ring vertices equidistant from the center.
    const ringVertexIds = aqir.objects
      .filter((o: any) => o.type === 'VERTEX' && o.logicalParent === 'ring')
      .map((o: any) => o.id);
    expect(ringVertexIds).toHaveLength(3);
    ringVertexIds.forEach((id: string) => {
      const p = positions[id];
      expect(Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2)).toBeCloseTo(3, 10);
    });

    // FORCE_DIRECTED: 3 mesh vertices resolve to distinct positions (no collapse).
    const meshVertexIds = aqir.objects
      .filter((o: any) => o.type === 'VERTEX' && o.logicalParent === 'mesh')
      .map((o: any) => o.id);
    expect(meshVertexIds).toHaveLength(3);
    const meshPts = meshVertexIds.map((id: string) => positions[id]);
    for (let i = 0; i < meshPts.length; i++) {
      for (let j = i + 1; j < meshPts.length; j++) {
        const d = Math.sqrt((meshPts[i].x - meshPts[j].x) ** 2 + (meshPts[i].z - meshPts[j].z) ** 2);
        expect(d).toBeGreaterThan(0.01);
      }
    }

    // CUSTOM: pinned element passes through unchanged.
    expect(positions[idFor(aqir.objects, 'freeform', 0)]).toEqual({ x: 7, y: 7, z: 7 });

    // HIERARCHY: BST nodes are created dynamically at animation time, not as
    // static compiled objects (see buildRealBST above), so verify the exact
    // compiled SET_LAYOUT_STRATEGY params against a real BST built the same
    // way the HIERARCHY-only tests above do.
    const layoutInstr = aqir.instructions.find((i: any) => i.action === 'SET_LAYOUT_STRATEGY' && i.targetId === 'bstTree') as any;
    expect(layoutInstr.strategy).toBe('HIERARCHY');
    const { elements, idForValue } = buildRealBST('bstTree', [50, 30, 70]);
    const engine = new LayoutEngine();
    const hierarchyPositions = engine.computeLayout('bstTree', layoutInstr.strategy, layoutInstr.params, elements);
    expect(hierarchyPositions.get(idForValue(50))!.y).toBe(0);
    expect(hierarchyPositions.get(idForValue(30))!.y).toBe(-2);
    expect(hierarchyPositions.get(idForValue(70))!.y).toBe(-2);
  });
});
