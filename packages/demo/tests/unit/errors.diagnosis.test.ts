import { describe, expect, it } from 'vitest';
import { teachError } from '@aqvl/runtime';
import { compileIssue, program, run } from './errors.helpers';

describe('runtime errors are found at the exact line, from the live run', () => {
  const INDEX = program('LOOP i FROM 0 TO LENGTH(arr) - 1\n  HIGHLIGHT arr[i + 1]\nEND');

  it('describes an index error with the real index, range, expression and the values in it', async () => {
    const trace = await run(INDEX);
    const info = trace.error?.info;
    expect(info?.type).toBe('INDEX_ERROR');
    expect(info?.line).toBe(8);
    expect(info?.lineText?.trim()).toBe('HIGHLIGHT arr[i + 1]');
    expect(info?.expression).toBe('arr[i + 1]');
    expect(info?.actualIndex).toBe(3);
    expect(info?.validRange).toEqual([0, 2]);
    expect(info?.indexExpression).toEqual({ text: 'i + 1', value: 3, parts: { i: 2 } });
    expect(info?.loop?.variable).toBe('i');
    expect(info?.loop?.toValue).toBe(2);
    // The column points at the access itself.
    expect(info?.lineText?.slice((info.column ?? 1) - 1, (info.column ?? 1) - 1 + (info.length ?? 0))).toBe('arr[i + 1]');
  });

  it('puts the error on its own frame, on the failing line, as the last step of the trace', async () => {
    const trace = await run(INDEX);
    const last = trace.frames[trace.frames.length - 1];
    expect(trace.error?.frameIndex).toBe(trace.frames.length - 1);
    expect(last.event.kind).toBe('error');
    expect(last.line).toBe(8);
    // The variables are the ones at the moment of failure (i has reached 2), not the last visible step's.
    expect(last.vars.i).toBe(2);
    expect(last.error?.info).toBe(trace.error?.info);
  });

  it('shows the failed access as an error cell just past the last element, in the structure’s own spacing', async () => {
    const trace = await run(INDEX);
    const last = trace.frames[trace.frames.length - 1];
    const ghost = last.nodes.find((n) => n.id === 'error:ghost');
    expect(ghost?.state).toBe('ERROR');
    expect(ghost?.text).toBe('3');
    const cells = last.nodes.filter((n) => n.structure === 'arr').sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const stride = cells[2].pos.x - cells[1].pos.x;
    expect(ghost!.pos.x).toBeCloseTo(cells[2].pos.x + stride, 5);
    expect(last.event.actors).toContain('error:ghost');
    // The structure itself still has three cells: nothing was invented in the data.
    expect(last.structures.find((s) => s.name === 'arr')?.nodeIds).toHaveLength(3);
  });

  it('explains what, why and how from the values, not from the error’s name', async () => {
    const info = (await run(INDEX)).error!.info!;
    const lesson = teachError(info);
    expect(lesson.what).toContain('arr[i + 1]');
    expect(lesson.what).toContain('index 3');
    expect(lesson.what).toContain('indices 0, 1, and 2');
    expect(lesson.why).toContain('i is 2');
    expect(lesson.why).toContain('i + 1 works out to 3');
    expect(lesson.fix).toMatch(/stop the loop 1 step sooner/);
    expect(lesson.correct?.lines[0]).toBe('LOOP i FROM 0 TO LENGTH(arr) - 2');
    expect(lesson.strip?.cells.map((c) => [c.index, c.kind])).toEqual([
      [0, 'valid'],
      [1, 'valid'],
      [2, 'valid'],
      [3, 'attempted'],
    ]);
  });

  it('gives a different explanation for the same kind of error when the code and numbers differ', async () => {
    const other = program('LOOP k FROM 0 TO LENGTH(data) - 1\n  HIGHLIGHT data[k + 2]\nEND', 'ARRAY data = [9, 8, 7, 6, 5]');
    const a = teachError((await run(INDEX)).error!.info!);
    const b = teachError((await run(other)).error!.info!);
    expect(b.what).toContain('data[k + 2]');
    expect(b.what).toContain('index 5');
    expect(b.what).toContain('indices 0, 1, 2, 3, and 4');
    expect(b.why).toContain('k is 3');
    expect(b.fix).toMatch(/2 steps sooner/);
    expect(b.correct?.lines[0]).toBe('LOOP k FROM 0 TO LENGTH(data) - 3');
    expect(a.what).not.toBe(b.what);
  });

  it('explains a negative index', async () => {
    const trace = await run(program('i = 0 - 1\nUPDATE arr[i] 9'));
    const info = trace.error!.info!;
    expect(info.type).toBe('INDEX_ERROR');
    expect(info.actualIndex).toBe(-1);
    const lesson = teachError(info);
    expect(lesson.why).toContain('before the first element');
    expect(lesson.facts.direction).toBe('before-start');
    const ghost = trace.frames[trace.frames.length - 1].nodes.find((n) => n.id === 'error:ghost')!;
    const first = trace.frames[0].nodes.filter((n) => n.structure === 'arr').sort((a, b) => a.index! - b.index!)[0];
    expect(ghost.pos.x).toBeLessThan(first.pos.x);
  });

  it('explains taking from an empty stack with what was put in', async () => {
    const trace = await run(program('PUSH s 1\nPOP s\nPOP s', 'STACK s'));
    const info = trace.error!.info!;
    expect(info.type).toBe('EMPTY_STRUCTURE');
    expect(info.line).toBe(9);
    expect(info.added).toBe(1);
    expect(info.removed).toBe(1);
    const lesson = teachError(info);
    expect(lesson.why).toContain('received 1 item');
    expect(lesson.fix).toContain('Check that s has something in it');
  });

  it('explains dividing by zero with the divisor and its value', async () => {
    const info = (await run(program('d = 0\nx = 10 / d\nPRINT x'))).error!.info!;
    expect(info.type).toBe('DIVISION_BY_ZERO');
    expect(info.line).toBe(8);
    expect(info.subject).toBe('d');
    expect(teachError(info).what).toContain('d is 0');
  });

  it('explains a null pointer with the line that last set the pointer', async () => {
    const info = (await run(program('p = list.head\np = p.next\np = p.next\nPRINT p.value', 'LINKEDLIST list = [1, 2]'))).error!.info!;
    expect(info.type).toBe('NULL_ACCESS');
    expect(info.subject).toBe('p');
    expect(info.assignedAtLine).toBe(9);
    expect(info.line).toBe(10);
    expect(teachError(info).why).toContain('line 9');
  });

  it('stops an endless loop and names the variable that never changes', async () => {
    const trace = await run(program('i = 0\nWHILE i < 3\n  HIGHLIGHT arr[0]\nEND'));
    const info = trace.error!.info!;
    expect(info.type).toBe('INFINITE_LOOP');
    expect(info.line).toBe(8);
    expect(info.frozen).toEqual(['i']);
    expect(trace.truncated).toBe(false);
    expect(trace.frames.length).toBeLessThan(400);
    expect(teachError(info).why).toContain('i never changes');
  });

  it('explains unbounded recursion from the call stack', async () => {
    const info = (await run(program('x = f(1)', 'ARRAY arr = [1]\nFUNCTION f(n)\n  RETURN f(n + 1)\nEND'))).error!.info!;
    expect(info.type).toBe('RECURSION_LIMIT');
    expect(info.subject).toBe('f');
    expect(teachError(info).why).toContain('f(n=');
  });
});

describe('compile errors are blamed on the line that needs the change', () => {
  it('points an unclosed bracket at the line that opened it, not the line the parser gave up on', async () => {
    const info = compileIssue(program('PRINT arr', 'ARRAY arr = [5, 3, 2'));
    expect(info.type).toBe('MISSING_DELIMITER');
    expect(info.line).toBe(4);
    expect(info.noticedAtLine).toBeGreaterThan(4);
    const lesson = teachError(info);
    expect(lesson.what).toContain('"[" that is never closed');
    expect(lesson.correct?.lines).toEqual(['ARRAY arr = [5, 3, 2]']);
  });

  it('points a half-written statement at the line that stopped', () => {
    const info = compileIssue(program('LOOP i FROM 0 TO\n  PRINT i\nEND'));
    expect(info.type).toBe('INCOMPLETE_STATEMENT');
    expect(info.line).toBe(7);
  });

  it('spots a misspelt keyword and suggests the real one', () => {
    const info = compileIssue(program('HIGHLIGT arr[0]'));
    expect(info.type).toBe('UNKNOWN_KEYWORD');
    expect(info.suggestion).toBe('HIGHLIGHT');
    expect(teachError(info).correct?.lines).toEqual(['HIGHLIGHT arr[0]']);
  });

  it('names an undeclared variable and the closest name that exists', () => {
    const info = compileIssue(program('x = 1\nPRINT y + x'));
    expect(info.type).toBe('UNDEFINED_NAME');
    expect(info.subject).toBe('y');
    expect(info.line).toBe(8);
  });
});

describe('logic problems are reported only when they cannot be right', () => {
  it('flags a cell compared with itself, on the step that does it', async () => {
    const trace = await run(program('LOOP i FROM 0 TO LENGTH(arr) - 1\n  IF arr[i] > arr[i]\n    SWAP arr[i] arr[i]\n  END\nEND'));
    expect(trace.error).toBeNull();
    const [d] = trace.diagnostics;
    expect(d.type).toBe('SELF_COMPARISON');
    expect(d.severity).toBe('warning');
    expect(d.line).toBe(8);
    expect(trace.frames[d.frameIndex!].line).toBe(8);
    expect(teachError(d).canContinue).toBe(true);
  });

  it('does not flag two different expressions that happen to meet (low and mid in a one-cell window)', async () => {
    const trace = await run(program('low = 1\nmid = 1\nIF arr[low] <= arr[mid]\n  PRINT "same cell, on purpose"\nEND'));
    expect(trace.diagnostics).toEqual([]);
  });

  it('flags a sort that ends out of order in both directions', async () => {
    const trace = await run(program('LOOP i FROM 0 TO LENGTH(arr) - 2\n  IF arr[i] > arr[i + 1]\n    SWAP arr[i] arr[i + 1]\n  END\nEND', 'ARRAY arr = [5, 1, 4, 2, 3]', 'BubbleSort'));
    const d = trace.diagnostics.find((x) => x.type === 'UNSORTED_RESULT');
    expect(d?.evidence?.end).toBe('[1, 4, 2, 3, 5]');
    expect(teachError(d!).what).toContain('is meant to sort arr');
  });

  it('does not call a descending sort wrong', async () => {
    const trace = await run(
      program(
        'LOOP p FROM 0 TO LENGTH(arr) - 1\n  LOOP i FROM 0 TO LENGTH(arr) - 2\n    IF arr[i] < arr[i + 1]\n      SWAP arr[i] arr[i + 1]\n    END\n  END\nEND',
        'ARRAY arr = [5, 1, 4, 2, 3]',
        'BubbleSort',
      ),
    );
    expect(trace.diagnostics).toEqual([]);
    expect(trace.error).toBeNull();
  });

  it('does not touch a program that is not a sort', async () => {
    const trace = await run(program('SWAP arr[0] arr[2]', 'ARRAY arr = [5, 1, 4, 2, 3]', 'ReverseEnds'));
    expect(trace.diagnostics).toEqual([]);
  });
});

describe('valid programs run exactly as before', () => {
  it('records the same frames with and without the diagnosis on, and reports nothing', async () => {
    const source = program('LOOP i FROM 0 TO LENGTH(arr) - 2\n  IF arr[i] > arr[i + 1]\n    SWAP arr[i] arr[i + 1]\n  END\nEND\nPRINT arr');
    const { recordTrace } = await import('@aqvl/runtime');
    const { compile } = await import('./errors.helpers');
    const withSource = await recordTrace(compile(source), { source });
    const without = await recordTrace(compile(source));
    expect(withSource.error).toBeNull();
    expect(withSource.diagnostics).toEqual([]);
    expect(withSource.frames.map((f) => [f.line, f.event.kind, f.caption])).toEqual(without.frames.map((f) => [f.line, f.event.kind, f.caption]));
    expect(withSource.frames.some((f) => f.event.kind === 'error')).toBe(false);
  });
});
