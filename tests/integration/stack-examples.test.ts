/**
 * The Playground's Stack examples, run end-to-end (compile ->
 * ExecutionEngine with the real AnimationController, animations completed
 * instantly).
 *
 * Every example must do its work with real stack code — loops and IFs over
 * `x = POP(s)`, `PEEK(s)`, `IS_EMPTY(s)`, `LENGTH(s)`, not a scripted
 * sequence of pushes and pops — so these tests assert each one's answer,
 * the stacks it leaves behind, and that the source really loops. The rest
 * covers the stack behaviour those examples rely on.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { StackScripts } from '../../packages/demo/src/examples/StackLibrary';
import { EXAMPLES } from '../../packages/demo/src/examples/registry';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

interface RunResult {
  engine: ExecutionEngine;
  logs: string[];
  /** Every stack's values, bottom → top. */
  stacks: Record<string, unknown[]>;
  arrays: Record<string, unknown[]>;
}

function readScene(engine: ExecutionEngine) {
  const scene = engine.sceneManager.getSceneGraph() as any[];
  const stacks: Record<string, unknown[]> = {};
  for (const anchor of scene.filter((e) => e.originalType === 'CONTAINER')) {
    stacks[anchor.logicalParent] = scene
      .filter((e) => e.originalType === 'CONTAINER_ITEM' && e.logicalParent === anchor.logicalParent)
      .sort((a, b) => a.order - b.order)
      .map((e) => e.value);
  }
  const arrays: Record<string, unknown[]> = {};
  for (const el of scene.filter((e) => e.originalType === 'ARRAY_ELEMENT').sort((a, b) => a.logicalIndex - b.logicalIndex)) {
    (arrays[el.logicalParent] ??= []).push(el.value);
  }
  return { stacks, arrays };
}

async function run(source: string): Promise<RunResult> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => logs.push(e.message));
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return { engine, logs, ...readScene(engine) };
}

/** What the program PRINTed (no step-by-step operation lines). */
const printed = (logs: string[]) =>
  logs.filter((l) => !l.includes('⟹') && !/^(Highlighted|Marked|Updated value|Cleared mark)/.test(l));

describe('Stack examples produce correct results', () => {
  it('Stack Foundation: LIFO order, sizes, and a guarded pop on the empty stack', async () => {
    const { logs, stacks } = await run(StackScripts.StackFoundation);
    expect(stacks.plates).toEqual([]);
    expect(printed(logs)).toEqual([
      'Pushed 10 - size is now 1',
      'Pushed 20 - size is now 2',
      'Pushed 30 - size is now 3',
      'Pushed 40 - size is now 4',
      'Top of the stack: 40 - size is still 4',
      'Popped 40 - size is now 3',
      'Popped 30 - size is now 2',
      'Popped 20 - size is now 1',
      'Popped 10 - size is now 0',
      "The stack is empty: popping now would be a STACK UNDERFLOW, so we stop.",
    ]);
  });

  it('Stack Using an Array: overflow on the sixth push, underflow after the last pop', async () => {
    const { logs, arrays } = await run(StackScripts.StackUsingArray);
    const out = printed(logs);
    expect(out).toContain('STACK OVERFLOW: cannot push 6 - all 5 slots are full');
    expect(out).toContain('peek -> top element is 8 at index 4');
    expect(out.filter((l) => l.startsWith('pop ->'))).toEqual([
      'pop -> 8 - top is now 3',
      'pop -> 4 - top is now 2',
      'pop -> 9 - top is now 1',
      'pop -> 3 - top is now 0',
      'pop -> 7 - top is now -1',
    ]);
    expect(out[out.length - 1]).toBe('STACK UNDERFLOW: nothing left to pop (top = -1)');
    expect(arrays.slots).toEqual([0, 0, 0, 0, 0]);
  });

  it('Reverse an Array: the array itself is reversed', async () => {
    const { logs, arrays, stacks } = await run(StackScripts.ReverseArrayWithStack);
    expect(arrays.arr).toEqual([50, 40, 30, 20, 10]);
    expect(stacks.helper).toEqual([]);
    expect(logs).toContain('After:  [50, 40, 30, 20, 10]');
  });

  it('Reverse a String', async () => {
    const { logs } = await run(StackScripts.ReverseStringWithStack);
    expect(logs).toContain('Reversed word: OLLEH');
  });

  it('Palindrome Check: RADAR is one, and a non-palindrome stops at the first mismatch', async () => {
    expect((await run(StackScripts.PalindromeCheck)).logs).toContain('Result: the word IS a palindrome');
    const other = await run(StackScripts.PalindromeCheck.replace('["R", "A", "D", "A", "R"]', '["S", "T", "A", "C", "K"]'));
    expect(other.logs).toContain('Result: the word is NOT a palindrome');
    expect(printed(other.logs).filter((l) => l.startsWith('Index'))).toHaveLength(1);
  });

  it('Balanced Parentheses: balanced, mismatched, stray closer and unclosed inputs', async () => {
    const source = StackScripts.BalancedParentheses;
    const input = '["{", "(", "[", "]", ")", "(", ")", "}"]';
    expect((await run(source)).logs).toContain('Result: BALANCED');
    expect((await run(source.replace(input, '["(", "]"]'))).logs).toEqual(
      expect.arrayContaining(['Mismatch: ( cannot be closed by ]', 'Result: NOT balanced'])
    );
    expect((await run(source.replace(input, '[")"]'))).logs).toEqual(
      expect.arrayContaining(['Closing ) at index 0 has no opening bracket', 'Result: NOT balanced'])
    );
    expect((await run(source.replace(input, '["(", "(", ")"]'))).logs).toContain(
      'Result: NOT balanced - these brackets were never closed: ["("]'
    );
  });

  it('Evaluate Postfix: 5 1 2 + 4 * + 3 - = 14, and an invalid expression is rejected', async () => {
    const { logs, stacks } = await run(StackScripts.EvaluatePostfixExpression);
    expect(printed(logs)).toEqual(['1 + 2 = 3', '3 * 4 = 12', '5 + 12 = 17', '17 - 3 = 14', 'Answer: 14']);
    expect(stacks.operands).toEqual([]);
    const invalid = await run(StackScripts.EvaluatePostfixExpression.replace('[5, 1, 2, "+", 4, "*", "+", 3, "-"]', '[5, "+"]'));
    expect(invalid.logs).toContain('Invalid expression: operator + needs two numbers');
  });

  it('Infix to Postfix: A * ( B + C ) - D / E', async () => {
    const { logs, stacks } = await run(StackScripts.InfixToPostfix);
    expect(logs).toContain('Postfix: A B C + * D E / - ');
    expect(stacks.operators).toEqual([]);
  });

  it('Next Greater Element', async () => {
    const { arrays, logs } = await run(StackScripts.NextGreaterElement);
    expect(arrays.answer).toEqual([5, 25, 25, -1, 8, -1]);
    expect(logs).toContain('Next greater of 2 is 25');
  });

  it('Stock Span', async () => {
    const { arrays } = await run(StackScripts.StockSpan);
    expect(arrays.spans).toEqual([1, 1, 1, 2, 1, 4, 6]);
  });

  it('Min Stack: the minimum after every push and pop', async () => {
    const { logs, stacks } = await run(StackScripts.MinStack);
    expect(printed(logs)).toEqual([
      'push 5 -> minimum is 5',
      'push 3 -> minimum is 3',
      'push 7 -> minimum is 3',
      'push 3 -> minimum is 3',
      'push 8 -> minimum is 3',
      'push 1 -> minimum is 1',
      'pop 1 -> minimum is 3',
      'pop 8 -> minimum is 3',
      'pop 3 -> minimum is 3',
      'pop 7 -> minimum is 3',
      'pop 3 -> minimum is 5',
      'pop 5 -> the stack is now empty',
    ]);
    expect(stacks).toEqual({ values: [], minimums: [] });
  });

  it('Sort a Stack', async () => {
    const { stacks } = await run(StackScripts.SortStack);
    expect(stacks.sorted).toEqual([3, 23, 31, 34, 92, 98]);
    expect(stacks.input).toEqual([]);
  });

  it('Decimal to Binary: 13 -> 1101, and other numbers / bases', async () => {
    expect((await run(StackScripts.DecimalToBinary)).logs).toContain('13 in base 2 is 1101');
    const octal = StackScripts.DecimalToBinary.replace('number = 13', 'number = 100').replace('base = 2', 'base = 8');
    expect((await run(octal)).logs).toContain('100 in base 8 is 144');
  });

  it('Undo / Redo: a new edit clears the redo history', async () => {
    const { logs, stacks } = await run(StackScripts.UndoRedo);
    expect(printed(logs).filter((l) => l.startsWith('Document:')).pop()).toBe('Document: ["Hello", "big", "again"]');
    expect(logs).toContain('REDO: nothing to redo (typing a new word clears the redo history)');
    expect(stacks).toEqual({ undoStack: ['Hello', 'big', 'again'], redoStack: [] });
  });

  it('Recursion as a Stack: 5! = 120', async () => {
    const { logs } = await run(StackScripts.FactorialWithStack);
    expect(logs).toContain('Answer: factorial of 5 = 120');
  });

  it('every example is real stack code (loops, IFs, value-returning reads) and is in the Playground', () => {
    const registered = new Set(EXAMPLES.filter((e) => e.category === 'Stacks').map((e) => e.source));
    for (const [name, source] of Object.entries(StackScripts)) {
      expect(registered.has(source), `${name} is registered`).toBe(true);
      expect(/\b(LOOP|WHILE)\b/.test(source), `${name} loops`).toBe(true);
      expect(/\bIF\b/.test(source) || /=\s*(POP|PEEK)\(/.test(source), `${name} decides or reads values`).toBe(true);
      expect(/^\s*WAIT\s*$/m.test(source), `${name} has no scripted WAITs`).toBe(false);
    }
  });
});

describe('Stack behaviour the examples rely on', () => {
  it('PUSH / POP / PEEK really change the stack, with a console line each', async () => {
    const { stacks, logs } = await run(`SCENE S
DECLARE
  STACK s = [1, 2, 3]
SEQUENCE
  PUSH s 4
  PEEK s
  POP s
  POP s
END`);
    expect(stacks.s).toEqual([1, 2]);
    expect(logs).toEqual([
      'PUSH s 4   ⟹   4 goes on top of s   s (bottom → top): [1, 2, 3, 4]',
      'PEEK(s)   ⟹   read 4 from the top of s',
      'POP(s)   ⟹   removed 4 from the top of s; s is now [1, 2, 3]',
      'POP(s)   ⟹   removed 3 from the top of s; s is now [1, 2]',
    ]);
  });

  it('PUSH names its operand as written (arr[i], text)', async () => {
    const { logs } = await run(`SCENE S
DECLARE
  ARRAY arr = [7]
  STACK s = []
SEQUENCE
  i = 0
  PUSH s arr[i]
  PUSH s "("
END`);
    expect(logs[0]).toMatch(/^PUSH s arr\[i\]   ⟹   7 goes on top/);
    expect(logs[1]).toMatch(/^PUSH s "\("   ⟹   "\(" goes on top of s   s \(bottom → top\): \[7, "\("\]$/);
  });

  it('popping or peeking an empty stack is a stack-underflow error', async () => {
    await expect(run(`SCENE S
DECLARE
  STACK s = []
SEQUENCE
  x = POP(s)
END`)).rejects.toThrow(/stack underflow/);
  });

  it('AND / OR short-circuit before reading the stack', async () => {
    const { logs } = await run(`SCENE S
DECLARE
  STACK s = [3]
SEQUENCE
  popped = 0
  WHILE LENGTH(s) > 0 AND PEEK(s) > 1
    x = POP(s)
    popped = popped + 1
  END
  IF IS_EMPTY(s) OR PEEK(s) == 9
    PRINT "OR skipped the peek"
  END
  PRINT "popped" popped
END`);
    expect(printed(logs)).toEqual(['OR skipped the peek', 'popped 1']);
  });

  it('PRINT shows quoted text as written, even when a variable has that name', async () => {
    const { logs } = await run(`SCENE S
DECLARE
  STACK s = [5]
SEQUENCE
  top = PEEK(s)
  PRINT "top" top
END`);
    expect(logs).toContain('top 5');
  });

  it('SIZE / IS_EMPTY / CLEAR statements work on a stack', async () => {
    const { logs, stacks } = await run(`SCENE S
DECLARE
  STACK s = [1, 2]
SEQUENCE
  SIZE s
  IS_EMPTY s
  CLEAR s
  IS_EMPTY s
END`);
    expect(stacks.s).toEqual([]);
    expect(logs).toEqual([
      'SIZE s   ⟹   2 elements   s (bottom → top): [1, 2]',
      'IS_EMPTY s   ⟹   FALSE (it holds 2)',
      'CLEAR s   ⟹   removed 2 elements; s is now []',
      'IS_EMPTY s   ⟹   TRUE (it holds nothing)',
    ]);
  });

  it('a stack can be declared with text values', async () => {
    const { stacks } = await run(`SCENE S
DECLARE
  STACK s = ["a", 1]
SEQUENCE
  PUSH s "b"
END`);
    expect(stacks.s).toEqual(['a', 1, 'b']);
  });

  it('without a tree, a stack is a vertical column (bottom → top) with the top tagged TOP, beside other structures', async () => {
    const { engine } = await run(`SCENE S
DECLARE
  ARRAY arr = [1, 2, 3]
  STACK s = [10, 20, 30]
SEQUENCE
  PUSH s 40
END`);
    const scene = engine.sceneManager.getSceneGraph() as any[];
    const items = scene.filter((e) => e.originalType === 'CONTAINER_ITEM').sort((a, b) => a.order - b.order);
    const targets = items.map((e) => e.worldTarget);
    expect(new Set(targets.map((t: any) => t.x)).size).toBe(1);
    for (let i = 1; i < targets.length; i++) expect(targets[i].y).toBeGreaterThan(targets[i - 1].y);
    expect(items.map((e) => e.tags)).toEqual([[], [], [], ['TOP']]);
    const arrayMaxX = Math.max(...scene.filter((e) => e.originalType === 'ARRAY_ELEMENT').map((e) => e.worldTarget?.x ?? e.position.x));
    expect(targets[0].x).toBeGreaterThan(arrayMaxX);
  });
});
