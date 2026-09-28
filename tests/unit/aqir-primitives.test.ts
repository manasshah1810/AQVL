/**
 * AQIR primitives (docs/design/aqir-primitives-spec.md): the compiler's
 * macro expansion into STEPs of primitive ops, the runtime's legacy bridge
 * that lowers them back for AnimationController (Phase 2.1), and the VM's
 * execution of STEPs.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  compile,
  expandLegacy,
  macros,
  validateStep,
  LegacyAction,
  PrimitiveKind as CompilerKinds,
  PRIMITIVE_VERBS as COMPILER_VERBS,
} from '../../packages/compiler/src';
import {
  AQVLVirtualMachine,
  lowerStep,
  UnsupportedStepError,
  PrimitiveKind as RuntimeKinds,
  PRIMITIVE_VERBS as RUNTIME_VERBS,
} from '../../packages/runtime/src';
import { EXAMPLES } from '../../packages/demo/src/examples/registry';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

/** One instance of every former opcode's shape, including optional-key variants and malformed graph-edit arities. */
const FORMER_OPCODES: any[] = [
  { action: 'COMPARE_OBJECTS', leftId: 'arr#0', rightId: 'arr#1', lineNumber: 3 },
  { action: 'SHOW_COMPARISON_LINK', elementIdA: 'a', elementIdB: 'b', style: 'beam' },
  { action: 'SHOW_COMPARISON_LINK', elementIdA: 'a', elementIdB: 'b' },
  { action: 'HIDE_COMPARISON_LINK', elementIdA: 'a', elementIdB: 'b' },
  { action: 'SWAP_OBJECTS', leftId: 'arr#i', rightId: 'arr#{"op":"+","left":"i","right":1}', lineNumber: 4 },
  { action: 'HIGHLIGHT_OBJECT', targetId: 'arr#2', color: 'SUCCESS', lineNumber: 5 },
  { action: 'MAP_HIGHLIGHT', map: 'm', key: { text: 'apple' }, color: undefined, lineNumber: 6 },
  { action: 'SET_STATE', targetId: 'obj_001', stateName: 'active' },
  { action: 'SET_PARTITION_BOUNDARY', structureId: 'arr', startIndex: 0, endIndex: 3, label: 'pivot' },
  { action: 'SET_PARTITION_BOUNDARY', structureId: 'arr', startIndex: 0, endIndex: 3 },
  { action: 'CLEAR_PARTITION_BOUNDARY', structureId: 'arr' },
  { action: 'MARK_SORTED_REGION', structureId: 'arr', startIndex: 2, endIndex: 4 },
  { action: 'LINK_OBJECTS', sourceId: 'obj_000', targetId: 'obj_001', directed: true, relationType: 'LINK' },
  { action: 'LL_SET', target: 'curr', field: 'next', value: 'prev', sourceText: 'curr.next = prev', lineNumber: 9 },
  { action: 'GENERIC_ACTION', actionName: 'UPDATE', targetId: undefined, args: ['arr#2', 7], payload: { logicalParent: 'arr', logicalIndex: 2 }, lineNumber: 10 },
  { action: 'GENERIC_ACTION', actionName: 'UPDATE', targetId: undefined, args: ['arr#i', { op: '+', left: 'x', right: 1 }], payload: { logicalParent: 'arr', logicalIndex: undefined } },
  { action: 'MAP_PUT', map: 'm', key: { text: 'a' }, value: 1, sourceText: 'm["a"] = 1', lineNumber: 11 },
  { action: 'MAP_DELETE', map: 'm', key: { text: 'a' }, sourceText: 'DELETE m["a"]', lineNumber: 12 },
  { action: 'LL_NEW', list: 'list', value: 5, resultVar: '__new_0', assignTo: 'n', sourceText: 'n = NEW_NODE(list, 5)', lineNumber: 13 },
  { action: 'LL_NEW', list: 'list', value: 0, resultVar: '__new_1', assignTo: undefined, sourceText: 'NEW_NODE(list)', lineNumber: 13 },
  { action: 'LL_FREE', target: 'temp', sourceText: 'temp', lineNumber: 14 },
  { action: 'TRIE_EDIT', op: 'ADD_CHILD', node: 'node', ch: { text: 'a' }, nodeText: 'node', sourceText: 'ADD_CHILD node "a"', lineNumber: 15 },
  { action: 'TRIE_EDIT', op: 'REMOVE_CHILD', node: { member: 'root', object: 't' }, ch: 'c', nodeText: 't.root', sourceText: 'REMOVE_CHILD t.root c', lineNumber: 16 },
  { action: 'GRAPH_EDIT', op: 'ADD_VERTEX', graph: 'g', args: [{ text: 'C' }], sourceText: 'ADD_VERTEX g "C"', lineNumber: 17 },
  { action: 'GRAPH_EDIT', op: 'ADD_VERTEX', graph: 'g', args: [], sourceText: 'ADD_VERTEX g', lineNumber: 17 },
  { action: 'GRAPH_EDIT', op: 'ADD_VERTEX', graph: 'g', args: [{ text: 'C' }, { text: 'D' }], sourceText: 'ADD_VERTEX g "C" "D"', lineNumber: 17 },
  { action: 'GRAPH_EDIT', op: 'REMOVE_VERTEX', graph: 'g', args: [{ text: 'C' }], sourceText: 'REMOVE_VERTEX g "C"', lineNumber: 18 },
  { action: 'GRAPH_EDIT', op: 'REMOVE_VERTEX', graph: 'g', args: [], sourceText: 'REMOVE_VERTEX g', lineNumber: 18 },
  { action: 'GRAPH_EDIT', op: 'REMOVE_VERTEX', graph: 'g', args: ['v', 'w'], sourceText: 'REMOVE_VERTEX g v w', lineNumber: 18 },
  { action: 'GRAPH_EDIT', op: 'ADD_EDGE', graph: 'g', args: [{ text: 'A' }, { text: 'B' }, 4], sourceText: 'ADD_EDGE g "A" "B" 4', lineNumber: 19 },
  { action: 'GRAPH_EDIT', op: 'ADD_EDGE', graph: 'g', args: ['u', 'w'], sourceText: 'ADD_EDGE g u w', lineNumber: 19 },
  { action: 'GRAPH_EDIT', op: 'ADD_EDGE', graph: 'g', args: [{ text: 'A' }], sourceText: 'ADD_EDGE g "A"', lineNumber: 19 },
  { action: 'GRAPH_EDIT', op: 'ADD_EDGE', graph: 'g', args: ['a', 'b', 4, 5], sourceText: 'ADD_EDGE g a b 4 5', lineNumber: 19 },
  { action: 'GRAPH_EDIT', op: 'REMOVE_EDGE', graph: 'g', args: [{ text: 'A' }, { text: 'B' }], sourceText: 'REMOVE_EDGE g "A" "B"', lineNumber: 20 },
  { action: 'GRAPH_EDIT', op: 'REMOVE_EDGE', graph: 'g', args: ['a', 'b', 9], sourceText: 'REMOVE_EDGE g a b 9', lineNumber: 20 },
  { action: 'PRINT', parts: [{ text: 'x =' }, 'x', { array: 'arr' }], lineNumber: 21 },
  { action: 'WAIT' },
  { action: 'WAIT', lineNumber: 22 },
  { action: 'SET_LAYOUT_STRATEGY', targetId: 'arr', strategy: 'LINE', params: { spacing: 1.5, axis: 'horizontal' } },
  { action: 'COMPUTE_LAYOUT', targetId: 'arr', lineNumber: 23 },
  { action: 'UPDATE_LAYOUT' },
  { action: 'SET_POSITION', elementId: 'obj_000', x: 1, y: null, z: null },
  { action: 'SET_CAMERA', mode: 'FOCUS', params: { targetId: 'bt:t' } },
  { action: 'SET_ROTATION', elementId: 'obj_000', x: 0, y: 90, z: 0 },
  { action: 'SET_SCALE', elementId: 'obj_000', x: 2, y: 2, z: 2 },
  { action: 'CONTAINER_READ', op: 'POP', container: 's', resultVar: '__take_0', assignTo: 'x', sourceText: 'x = POP(s)', lineNumber: 24 },
  { action: 'CONTAINER_READ', op: 'PEEK', container: 's', resultVar: '__take_1', assignTo: undefined, sourceText: 'PEEK(s)', lineNumber: 24 },
  { action: 'GENERIC_ACTION', actionName: 'BUBBLE_SORT', targetId: undefined, args: ['arr'], payload: { logicalParent: 'arr', logicalIndex: undefined }, lineNumber: 25 },
  { action: 'GENERIC_ACTION', actionName: 'HEAP_INSERT', targetId: 'obj_004', args: ['obj_004', 9], payload: { logicalParent: undefined, logicalIndex: undefined } },
  { action: 'GENERIC_ACTION', actionName: 'INSERT', targetId: undefined, args: ['arr#1', 5], payload: { logicalParent: 'arr', logicalIndex: 1 } },
  { action: 'GENERIC_ACTION', actionName: 'UPDATE', targetId: undefined, args: ['t', 5], payload: { logicalParent: 't', logicalIndex: undefined } },
  { action: 'GENERIC_ACTION', actionName: 'HASHMAP_INIT', args: ['m'], payload: { logicalParent: 'm' } },
];

const stepsOf = (source: string): any[] => compile(source).instructions.filter((i: any) => i.opcode === 'STEP');

describe('primitive vocabulary', () => {
  it('is declared identically on the compiler and runtime sides', () => {
    expect(RuntimeKinds).toEqual(CompilerKinds);
    expect(RUNTIME_VERBS).toEqual(COMPILER_VERBS);
  });
});

describe('every former opcode is a composition of primitives', () => {
  it('covers every former action except the retired LOOP', () => {
    const covered = new Set(FORMER_OPCODES.map((i) => i.action));
    const missing = Object.values(LegacyAction).filter((a) => a !== 'LOOP' && !covered.has(a));
    expect(missing).toEqual([]);
  });

  it.each(FORMER_OPCODES.map((i) => [`${i.action}${i.op ? ` ${i.op}` : i.actionName ? ` ${i.actionName}` : ''}`, i]))(
    '%s expands to a well-formed STEP that lowers back key for key',
    (_label, legacy) => {
      const step = expandLegacy(legacy);
      expect(step.opcode).toBe('STEP');
      expect(validateStep(step)).toEqual([]);
      for (const op of step.ops) expect(['MUTATE', 'TRANSFORM', 'RELATE', 'ANNOTATE', 'EMIT', 'INVOKE']).toContain(op.kind);
      expect(lowerStep(step as any)).toStrictEqual(legacy);
    }
  );

  it('tells same-looking compositions apart by content: a map delete vs a vertex removal', () => {
    const mapDelete = expandLegacy({ action: 'MAP_DELETE', map: 'm', key: 'k', sourceText: 'DELETE m[k]' });
    const vertexRemoval = expandLegacy({ action: 'GRAPH_EDIT', op: 'REMOVE_VERTEX', graph: 'g', args: ['k'], sourceText: 'REMOVE_VERTEX g k' });
    expect(mapDelete.ops).toEqual([{ kind: 'MUTATE', verb: 'destroy', target: { at: 'key', collection: 'm', key: 'k' } }]);
    expect(vertexRemoval.ops).toEqual([
      { kind: 'RELATE', verb: 'unlink', collection: 'g', source: 'k', all: true },
      { kind: 'MUTATE', verb: 'destroy', target: { at: 'key', collection: 'g', key: 'k' } },
    ]);
  });
});

describe('compiled programs', () => {
  const programs = EXAMPLES.map((ex) => [ex.id, ex.source] as const);

  it.each(programs)('%s compiles to kernel opcodes and well-formed STEPs matching the reference expansion', (_id, source) => {
    const { instructions } = compile(source);
    for (const instr of instructions as any[]) {
      expect(instr.action).toBeUndefined();
      if (instr.opcode !== 'STEP') continue;
      expect(validateStep(instr)).toEqual([]);
      // The generator's macros agree with the reference table in expandLegacy.
      expect(expandLegacy(lowerStep(instr) as any)).toStrictEqual(instr);
    }
  });
});

describe('statement macros', () => {
  const scene = (declare: string, sequence: string) => `SCENE T\nDECLARE\n${declare}\nSEQUENCE\n${sequence}\nEND\n`;

  it('SWAP, COMPARE, HIGHLIGHT and `arr[i] = v` on an array', () => {
    const steps = stepsOf(scene('  ARRAY arr = [3, 1, 2]', '  SWAP arr[0] arr[1]\n  COMPARE arr[1] arr[2]\n  HIGHLIGHT arr[2] "SUCCESS"\n  arr[0] = 9'));
    const ops = steps.slice(2).map((s) => s.ops); // after the default arrange + reflow
    expect(ops).toEqual([
      [{ kind: 'MUTATE', verb: 'exchange', target: 'arr#0', with: 'arr#1' }],
      [{ kind: 'ANNOTATE', verb: 'contrast', targets: ['arr#1', 'arr#2'] }],
      [{ kind: 'ANNOTATE', verb: 'focus', targets: ['arr#2'], color: 'SUCCESS' }],
      [{ kind: 'MUTATE', verb: 'set', target: { at: 'slot', collection: 'arr', ref: 'arr#0', index: 0 }, value: 9 }],
    ]);
    expect(steps.slice(2).map((s) => s.lineNumber)).toEqual([5, 6, 7, 8]);
  });

  it('a default layout is an arrange then a reflow of the structure', () => {
    const [arrange, reflow] = stepsOf(scene('  ARRAY arr = [3, 1, 2]', '  WAIT'));
    expect(arrange.ops).toEqual([{ kind: 'TRANSFORM', verb: 'arrange', target: 'arr', strategy: 'LINE', params: expect.any(Object) }]);
    expect(reflow.ops).toEqual([{ kind: 'TRANSFORM', verb: 'reflow', target: 'arr' }]);
  });

  it('WAIT is an empty step, PRINT an EMIT', () => {
    const steps = stepsOf(scene('  ARRAY arr = [1]', '  WAIT\n  PRINT "sum" arr'));
    expect(steps[2].ops).toEqual([]);
    expect(steps[3].ops).toEqual([{ kind: 'EMIT', verb: 'log', parts: [{ text: 'sum' }, { array: 'arr' }] }]);
  });

  it('LINK and SET ... STATE', () => {
    const steps = stepsOf(scene('  NODE a\n  NODE b', '  LINK a TO b\n  SET a STATE active'));
    expect(steps.map((s) => s.ops)).toEqual([
      [{ kind: 'RELATE', verb: 'link', source: 'obj_000', target: 'obj_001', directed: true, label: 'LINK' }],
      [{ kind: 'ANNOTATE', verb: 'state', targets: ['obj_000'], state: 'active' }],
    ]);
  });

  it('hash map writes, deletes and highlights address a member by key', () => {
    const steps = stepsOf(scene('  HASH_MAP m = {"a": 1}', '  m["b"] = 2\n  DELETE m["a"]\n  HIGHLIGHT m["b"] "FOCUS"'));
    // Built by library procedures before the sequence runs (no subject, no index: nothing is scoped below the map).
    expect(steps.filter((s) => s.ops[0]?.kind === 'INVOKE').map((s) => s.ops)).toEqual([
      [{ kind: 'INVOKE', procedure: 'HASHMAP_INIT', args: ['m'], scope: { collection: 'm' } }],
      [{ kind: 'INVOKE', procedure: 'HASHMAP_INSERT', args: ['m', 'a', 1], scope: { collection: 'm' } }],
    ]);
    const key = (k: string) => ({ at: 'key', collection: 'm', key: { text: k } });
    expect(steps.slice(-3).map((s) => s.ops)).toEqual([
      [{ kind: 'MUTATE', verb: 'set', target: key('b'), value: 2 }],
      [{ kind: 'MUTATE', verb: 'destroy', target: key('a') }],
      [{ kind: 'ANNOTATE', verb: 'focus', targets: [key('b')], color: 'FOCUS' }],
    ]);
    expect(steps.slice(-3).map((s) => s.sourceText)).toEqual(['m["b"] = 2', 'DELETE m["a"]', undefined]);
  });

  it('linked-list allocation, field writes and FREE', () => {
    const steps = stepsOf(scene('  LINKEDLIST list = [1, 2]', '  n = NEW_NODE(list, 5)\n  n.next = list.head\n  FREE n'));
    const ops = steps.slice(-3).map((s) => s.ops);
    expect(ops[0]).toEqual([{ kind: 'MUTATE', verb: 'create', collection: 'list', value: 5, bind: expect.stringMatching(/^__new_/), assignTo: 'n' }]);
    expect(ops[1]).toEqual([{ kind: 'MUTATE', verb: 'set', target: 'n', field: 'next', value: { member: 'head', object: 'list' } }]);
    expect(ops[2]).toEqual([{ kind: 'MUTATE', verb: 'destroy', target: 'n' }]);
  });

  it('trie edits: ADD_CHILD creates then links, REMOVE_CHILD destroys what the label reaches', () => {
    const steps = stepsOf(scene('  TRIE t = []', '  node = t.root\n  ADD_CHILD node "a"\n  REMOVE_CHILD node "a"'));
    expect(steps.slice(-2).map((s) => s.ops)).toEqual([
      [
        { kind: 'MUTATE', verb: 'create' },
        { kind: 'RELATE', verb: 'link', source: 'node', target: { at: 'created', op: 0 }, label: { text: 'a' }, texts: { source: 'node' } },
      ],
      [{ kind: 'MUTATE', verb: 'destroy', target: { at: 'via', from: 'node', label: { text: 'a' } }, texts: { from: 'node' } }],
    ]);
  });

  it('graph edits', () => {
    const steps = stepsOf(scene('  GRAPH g = ["A-B"]', '  ADD_VERTEX g "C"\n  ADD_EDGE g "A" "C" 4\n  REMOVE_EDGE g "A" "B"\n  REMOVE_VERTEX g "C"'));
    const t = (text: string) => ({ text });
    expect(steps.slice(-4).map((s) => s.ops)).toEqual([
      [{ kind: 'MUTATE', verb: 'create', collection: 'g', key: t('C') }],
      [{ kind: 'RELATE', verb: 'link', collection: 'g', source: t('A'), target: t('C'), weight: 4 }],
      [{ kind: 'RELATE', verb: 'unlink', collection: 'g', source: t('A'), target: t('B') }],
      [
        { kind: 'RELATE', verb: 'unlink', collection: 'g', source: t('C'), all: true },
        { kind: 'MUTATE', verb: 'destroy', target: { at: 'key', collection: 'g', key: t('C') } },
      ],
    ]);
  });

  it('library procedures are INVOKEs; a container read binds its result', () => {
    const steps = stepsOf(scene('  STACK s = [1]\n  ARRAY arr = [2, 1]', '  PUSH s 5\n  x = POP(s)\n  BUBBLE_SORT arr'));
    const ops = steps.slice(-3).map((s) => s.ops[0]);
    expect(ops[0]).toMatchObject({ kind: 'INVOKE', procedure: 'PUSH', args: ['s', 5], scope: { collection: 's' } });
    expect(ops[1]).toEqual({ kind: 'INVOKE', procedure: 'POP', args: ['s'], bind: expect.stringMatching(/^__take_/), assignTo: 'x' });
    expect(ops[2]).toMatchObject({ kind: 'INVOKE', procedure: 'BUBBLE_SORT', args: ['arr'], scope: { collection: 'arr' } });
  });

  it('LAYOUT, POSITION and CAMERA are TRANSFORMs', () => {
    const steps = stepsOf(scene('  ARRAY arr = [1, 2]', '  LAYOUT arr AS GRID(columns=2)\n  POSITION arr[0] AT (x=1)\n  CAMERA ORBIT(10)'));
    expect(steps.slice(-4).map((s) => s.ops[0])).toEqual([
      { kind: 'TRANSFORM', verb: 'arrange', target: 'arr', strategy: 'GRID', params: { columns: 2 } },
      { kind: 'TRANSFORM', verb: 'reflow', target: 'arr' },
      { kind: 'TRANSFORM', verb: 'place', target: 'obj_000', x: 1, y: null, z: null },
      { kind: 'TRANSFORM', verb: 'view', mode: 'ORBIT', params: { speed: 10 } },
    ]);
  });
});

describe('validateStep', () => {
  it('reports unknown kinds and verbs, missing fields and misplaced INVOKE / TRANSFORM', () => {
    expect(validateStep({ opcode: 'STEP', ops: [{ kind: 'EXPLODE' } as any] })[0]).toMatch(/unknown kind "EXPLODE"/);
    expect(validateStep({ opcode: 'STEP', ops: [{ kind: 'MUTATE', verb: 'melt' } as any] })[0]).toMatch(/unknown verb "melt"/);
    expect(validateStep({ opcode: 'STEP', ops: [{ kind: 'MUTATE', verb: 'set', target: 'a' } as any] })).toEqual(['op 0: MUTATE is missing "value".']);
    expect(validateStep({ opcode: 'STEP', ops: [...macros.invoke('PUSH', ['s', 1]), ...macros.print([])] })[0]).toMatch(/INVOKE must be the only op/);
    expect(validateStep({ opcode: 'STEP', ops: [...macros.reflow('arr'), ...macros.print([])] })[0]).toMatch(/TRANSFORM must be the only op/);
  });

  it('requires a created-address to name an earlier MUTATE create in the same step', () => {
    const dangling = { kind: 'RELATE', verb: 'link', source: 'n', target: { at: 'created', op: 0 } } as any;
    expect(validateStep({ opcode: 'STEP', ops: [dangling] })[0]).toMatch(/refers to created op 0/);
    expect(validateStep({ opcode: 'STEP', ops: [{ kind: 'MUTATE', verb: 'create' }, dangling] })).toEqual([]);
  });
});

describe('VM execution of STEPs', () => {
  const objects = [
    { id: 'obj_000', type: 'ARRAY_ELEMENT', logicalParent: 'arr', logicalIndex: 0, value: 3 },
    { id: 'obj_001', type: 'ARRAY_ELEMENT', logicalParent: 'arr', logicalIndex: 1, value: 1 },
  ];

  it('resolves geometry itself and hands every other step to the host in its lowered form', async () => {
    const handled: any[] = [];
    const program = [
      macros.step(macros.arrange('arr', 'LINE', { spacing: 2 })),
      macros.step(macros.reflow('arr')),
      macros.step(macros.swap('arr#0', 'arr#1'), { lineNumber: 3 }),
      macros.step([]),
      macros.step(macros.print([{ text: 'done' }]), { lineNumber: 5 }),
    ];
    const vm = new AQVLVirtualMachine(program as any, {}, {}, (instr) => { handled.push(instr); }, objects as any);
    const result = await vm.run();

    expect(handled).toStrictEqual([
      { action: 'SWAP_OBJECTS', leftId: 'arr#0', rightId: 'arr#1', lineNumber: 3 },
      { action: 'WAIT' },
      { action: 'PRINT', parts: [{ text: 'done' }], lineNumber: 5 },
    ]);
    expect(Object.keys(result.finalState.positions ?? {}).sort()).toEqual(['obj_000', 'obj_001']);
    // Frames report the lowered form (what ExecutionEngine reads) and keep the STEP alongside.
    expect(result.executionSteps.map((f: any) => f.instruction.action)).toEqual(['SET_LAYOUT_STRATEGY', 'COMPUTE_LAYOUT', 'SWAP_OBJECTS', 'WAIT', 'PRINT']);
    result.executionSteps.forEach((f: any, i: number) => expect(f.programInstruction).toBe(program[i]));
  });

  it('geometry from a STEP and from a hand-written legacy instruction resolve identically', async () => {
    const legacy = [
      { action: 'SET_LAYOUT_STRATEGY', targetId: 'arr', strategy: 'GRID', params: { columns: 1 } },
      { action: 'COMPUTE_LAYOUT', targetId: 'arr' },
      { action: 'SET_POSITION', elementId: 'obj_001', x: 4, y: null, z: 1 },
      { action: 'SET_CAMERA', mode: 'POSITION', params: { x: 1, y: 2, z: 3 } },
    ];
    const run = (instructions: any[]) => new AQVLVirtualMachine(instructions, {}, {}, undefined, objects as any).run();
    const fromLegacy = await run(legacy);
    const fromSteps = await run(legacy.map((i) => expandLegacy(i)));
    expect(fromSteps.finalState.positions).toEqual(fromLegacy.finalState.positions);
    expect(fromSteps.finalState.camera).toEqual(fromLegacy.finalState.camera);
    expect(fromSteps.finalState.camera).toEqual({ mode: 'POSITION', position: { x: 1, y: 2, z: 3 } });
  });

  it('rejects a composition the Phase 2.1 bridge cannot lower', async () => {
    const vm = new AQVLVirtualMachine([macros.step(macros.markRegion('arr', 0, 1, 'visited'))] as any, {}, {}, () => {});
    await expect(vm.step()).rejects.toBeInstanceOf(UnsupportedStepError);
  });
});
