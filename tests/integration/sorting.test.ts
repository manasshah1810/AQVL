/**
 * Integration tests for the BUBBLE_SORT / SELECTION_SORT / INSERTION_SORT /
 * MERGE_SORT / QUICK_SORT built-ins: source -> lex -> parse -> validate ->
 * optimize -> AQIR.
 *
 * Like the existing BST GENERIC_ACTION test in vm.test.ts ("Mixed / backward
 * compatibility"), execution against a live SceneManager/AnimationController
 * is out of scope here — GENERIC_ACTION instructions are legacy, action-based
 * instructions interpreted by AnimationController, not the VM itself. These
 * tests instead verify the compiler emits the right GENERIC_ACTION shape,
 * and (for the "does it actually sort" question) exercise SortEngine
 * directly against the same literal values the compiled source declares.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../utils/testHelpers';
import { SortAlgorithm } from '../../packages/runtime/src/core/algorithms/SortEngine';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function genericActions(instructions: unknown[]): any[] {
  return (instructions as any[]).filter((i) => i.action === 'GENERIC_ACTION');
}

function arraySource(name: string, values: number[], sortKeyword: string): string {
  return `SCENE SortDemo
DECLARE
  ARRAY ${name} = [${values.join(', ')}]

SEQUENCE
  ${sortKeyword} ${name}
END
`;
}

describe('Sorting built-ins: parsing to GENERIC_ACTION', () => {
  it('parses BUBBLE_SORT into a GENERIC_ACTION targeting the array', () => {
    const instructions = compile(arraySource('arr', [5, 2, 8, 1, 9], 'BUBBLE_SORT'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'BUBBLE_SORT',
      args: ['arr'],
      payload: { logicalParent: 'arr' },
    });
  });

  it('parses SELECTION_SORT into a GENERIC_ACTION targeting the array', () => {
    const instructions = compile(arraySource('nums', [3, 1, 2], 'SELECTION_SORT'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'SELECTION_SORT',
      args: ['nums'],
      payload: { logicalParent: 'nums' },
    });
  });

  it('parses INSERTION_SORT into a GENERIC_ACTION targeting the array', () => {
    const instructions = compile(arraySource('data', [9, 8, 7], 'INSERTION_SORT'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'INSERTION_SORT',
      args: ['data'],
      payload: { logicalParent: 'data' },
    });
  });

  it.each([5, 10, 100])('compiles a BUBBLE_SORT over an array of size %i', (size) => {
    const values = Array.from({ length: size }, (_, i) => size - i);
    const instructions = compile(arraySource('arr', values, 'BUBBLE_SORT'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0].actionName).toBe('BUBBLE_SORT');
  });

  it('compiles a sort over an array of random values', () => {
    const values = Array.from({ length: 30 }, () => Math.floor(Math.random() * 1000));
    const instructions = compile(arraySource('randomArr', values, 'SELECTION_SORT'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ actionName: 'SELECTION_SORT', args: ['randomArr'] });
  });

  it('compiles multiple sort calls over different arrays in sequence', () => {
    const source = `SCENE MultiSort
DECLARE
  ARRAY a = [3, 1, 2]
  ARRAY b = [9, 4, 6]

SEQUENCE
  BUBBLE_SORT a
  INSERTION_SORT b
END
`;
    const actions = genericActions(compile(source));
    expect(actions.map((a) => a.actionName)).toEqual(['BUBBLE_SORT', 'INSERTION_SORT']);
    expect(actions.map((a) => a.payload.logicalParent)).toEqual(['a', 'b']);
  });
});

describe('MERGE_SORT / QUICK_SORT: parsing to GENERIC_ACTION', () => {
  it('parses MERGE_SORT into a GENERIC_ACTION targeting the array', () => {
    const instructions = compile(arraySource('arr', [5, 2, 8, 1, 9], 'MERGE_SORT'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'MERGE_SORT',
      args: ['arr'],
      payload: { logicalParent: 'arr' },
    });
  });

  it('parses QUICK_SORT into a GENERIC_ACTION targeting the array', () => {
    const instructions = compile(arraySource('arr', [5, 2, 8, 1, 9], 'QUICK_SORT'));
    const actions = genericActions(instructions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionName: 'QUICK_SORT',
      args: ['arr'],
      payload: { logicalParent: 'arr' },
    });
  });

  it.each([5, 10, 100, 1000])(
    'compiles MERGE_SORT and QUICK_SORT over an array of size %i to a single GENERIC_ACTION (recursion happens at runtime, not unrolled at compile time)',
    (size) => {
      const values = Array.from({ length: size }, (_, i) => size - i);

      const mergeActions = genericActions(compile(arraySource('arr', values, 'MERGE_SORT')));
      expect(mergeActions).toHaveLength(1);
      expect(mergeActions[0].actionName).toBe('MERGE_SORT');

      const quickActions = genericActions(compile(arraySource('arr', values, 'QUICK_SORT')));
      expect(quickActions).toHaveLength(1);
      expect(quickActions[0].actionName).toBe('QUICK_SORT');
    }
  );

  it('compiled MERGE_SORT/QUICK_SORT source values sort correctly and match a naive baseline sort', () => {
    const values = Array.from({ length: 200 }, () => Math.floor(Math.random() * 10000));
    const expected = [...values].sort((a, b) => a - b);

    // Confirms the source compiles cleanly (the array literal is valid AQVL)...
    expect(genericActions(compile(arraySource('arr', values, 'MERGE_SORT')))[0].actionName).toBe('MERGE_SORT');
    expect(genericActions(compile(arraySource('arr', values, 'QUICK_SORT')))[0].actionName).toBe('QUICK_SORT');

    // ...and that the engine backing those instructions actually sorts those exact values.
    expect(SortAlgorithm.mergeSort([...values]).array).toEqual(expected);
    expect(SortAlgorithm.quickSort([...values]).array).toEqual(expected);
  });

  it('emits PIVOT frames for QUICK_SORT and OVERWRITE (merge-write) frames for MERGE_SORT over the compiled array', () => {
    const values = [40, 10, 30, 20, 90, 60, 70, 80, 50];
    // Same array the compiled QUICK_SORT/MERGE_SORT instruction below targets.
    expect(genericActions(compile(arraySource('arr', values, 'QUICK_SORT')))[0].payload.logicalParent).toBe('arr');

    const quickResult = SortAlgorithm.quickSort([...values]);
    expect(quickResult.steps.some((s) => s.type === 'PIVOT')).toBe(true);

    const mergeResult = SortAlgorithm.mergeSort([...values]);
    expect(mergeResult.steps.some((s) => s.type === 'OVERWRITE')).toBe(true);
  });
});
