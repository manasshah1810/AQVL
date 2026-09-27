/**
 * The Playground's Recursion & Functions examples, run end-to-end (compile ->
 * ExecutionEngine with the real AnimationController, animations completed
 * instantly).
 *
 * Besides each example's own output, the recursive functions are re-run on
 * many other inputs (by replacing the SEQUENCE and keeping the FUNCTIONs) and
 * compared with the answer worked out in TypeScript: factorials, gcd, digits,
 * number bases, palindromes, Hanoi for 1 to 4 disks, N-Queens for 4 to 6
 * queens, subsets for other budgets, stairs and coin change.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { RecursionScripts } from '../../packages/demo/src/examples/RecursionLibrary';
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
  arrays: Record<string, unknown[]>;
  logs: string[];
}

function readArrays(engine: ExecutionEngine): Record<string, unknown[]> {
  const byName: Record<string, any[]> = {};
  for (const el of engine.sceneManager.getSceneGraph() as any[]) {
    if (el.originalType !== 'ARRAY_ELEMENT' || el.animationLayer) continue;
    (byName[el.logicalParent] ??= []).push(el);
  }
  const out: Record<string, unknown[]> = {};
  for (const [name, els] of Object.entries(byName)) {
    out[name] = els.sort((a, b) => a.logicalIndex - b.logicalIndex).map((el) => el.value);
  }
  return out;
}

async function run(source: string): Promise<RunResult> {
  const engine = new ExecutionEngine({ headless: true });
  const logs: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => logs.push(e.message));
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return { arrays: readArrays(engine), logs };
}

/** The example with its SEQUENCE block replaced, keeping DECLARE (arrays and FUNCTIONs). */
function withSequence(source: string, body: string): string {
  const at = source.indexOf('\nSEQUENCE\n');
  expect(at).toBeGreaterThan(0);
  return `${source.slice(0, at)}\nSEQUENCE\n${body}\nEND\n`;
}

/** The example with its first `ARRAY|STACK <name> = [...]` literal replaced. */
function withArray(source: string, name: string, values: (number | string)[]): string {
  const pattern = new RegExp(`(ARRAY|STACK) ${name} = \\[[^\\]]*\\]`);
  expect(source).toMatch(pattern);
  const literal = values.map((v) => (typeof v === 'string' ? `"${v}"` : String(v))).join(', ');
  return source.replace(pattern, (_m, kind) => `${kind} ${name} = [${literal}]`);
}

/** Runs `PRINT "@" + <expr>` for every expression and returns the printed answers in order. */
async function answers(source: string, exprs: string[]): Promise<string[]> {
  const body = exprs.map((e) => `  PRINT "@" + ${e}`).join('\n');
  const { logs } = await run(withSequence(source, body));
  return logs.filter((l) => l.startsWith('@')).map((l) => l.slice(1));
}

const printed = (logs: string[], keyword: string) => logs.filter((l) => l.includes(keyword));

describe('Functions examples produce correct results', () => {
  it('Canteen Bill: line totals, discount, GST and a smaller bill', async () => {
    const { logs } = await run(RecursionScripts.FunctionBasics);
    expect(printed(logs, 'Item ')).toEqual([
      'Item 0: 2 x 40 = 80',
      'Item 1: 4 x 25 = 100',
      'Item 2: 2 x 60 = 120',
      'Item 3: 4 x 50 = 200',
    ]);
    expect(logs).toEqual(expect.arrayContaining([
      'Subtotal: 500', 'Discount: 50', 'GST: 22.5', 'Amount to pay: 472.5',
      'A bill of 120 pays 126 (no discount below 300)',
    ]));
  });

  it('Grade Calculator: ELSE IF ladder, TRUE / FALSE guard, skipped marks', async () => {
    const { arrays, logs } = await run(RecursionScripts.GradeCalculator);
    expect(logs).toEqual(expect.arrayContaining([
      'Student 0: 91 -> grade A+ (distinction)',
      'Student 3: 58 -> grade C (pass)',
      'Student 4: 34 -> grade F (needs a re-test)',
      'Student 2: 105 is not a valid mark, skipped',
      'Student 6: -3 is not a valid mark, skipped',
      '6 valid marks, 1 student(s) need a re-test',
    ]));
    expect(arrays.marks).toEqual([91, 76, 105, 58, 34, 67, -3, 82]);
  });

  it('Grade Calculator: every band boundary', async () => {
    const got = await answers(RecursionScripts.GradeCalculator,
      ['gradeOf(100)', 'gradeOf(90)', 'gradeOf(89)', 'gradeOf(75)', 'gradeOf(74)', 'gradeOf(60)', 'gradeOf(59)',
       'gradeOf(40)', 'gradeOf(39)', 'gradeOf(0)', 'isValid(0)', 'isValid(100)', 'isValid(101)', 'isValid(-1)']);
    expect(got).toEqual(['A+', 'A+', 'A', 'A', 'B', 'B', 'C', 'C', 'F', 'F', 'TRUE', 'TRUE', 'FALSE', 'FALSE']);
  });

  it('Parameters Are Copies: scalars are copied, array cells are shared', async () => {
    const { arrays, logs } = await run(RecursionScripts.ParametersAreCopies);
    expect(logs).toEqual(expect.arrayContaining([
      '  inside trySwap: a=2 b=1',
      'after trySwap: x=1 y=2 (unchanged: the function got copies)',
      'addBonus(marksNow) alone: marksNow is still 70',
      'marksNow = addBonus(marksNow): marksNow is now 75',
    ]));
    expect(arrays.score).toEqual([20, 10]);
  });

  it('Local & Global Scope: assigning inside a function does not change the outer variable', async () => {
    const { arrays, logs } = await run(RecursionScripts.LocalAndGlobalScope);
    expect(logs).toEqual(expect.arrayContaining([
      'Sharma Stores welcomes Asha',
      'after 2 wrong calls: visits = 0',
      'after 2 nextCount calls: visits = 2',
      'after 3 countVisitInBox calls: visitsBox[0] = 3',
    ]));
    expect(printed(logs, 'local visits = ')).toEqual([
      '  inside countVisitWrong: local visits = 1',
      '  inside countVisitWrong: local visits = 1',
    ]);
    expect(arrays.visitsBox).toEqual([3]);
  });

  it('Prime Toolkit: primes, factor pairs, next prime, prime count', async () => {
    const { logs } = await run(RecursionScripts.PrimeToolkit);
    expect(logs).toEqual(expect.arrayContaining([
      '2 is prime', '13 is prime', '29 is prime', '41 is prime',
      '9 = 3 x 3, next prime is 11', '21 = 3 x 7, next prime is 23',
      '35 = 5 x 7, next prime is 37', '49 = 7 x 7, next prime is 53',
      'There are 15 primes up to 50',
    ]));
  });

  it('Prime Toolkit: isPrime agrees with trial division from 0 to 60', async () => {
    const ns = Array.from({ length: 61 }, (_, i) => i);
    const isPrime = (n: number) => n >= 2 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0);
    const got = await answers(RecursionScripts.PrimeToolkit, ns.map((n) => `isPrime(${n})`));
    expect(got).toEqual(ns.map((n) => (isPrime(n) ? 'TRUE' : 'FALSE')));
  });

  it('Class Report: total, average, topper, lowest, counts', async () => {
    const { arrays, logs } = await run(RecursionScripts.ClassReportFunctions);
    expect(logs).toEqual(expect.arrayContaining([
      'Total: 476', 'Average: 68',
      'Topper: student 1 with 91', 'Lowest: student 5 with 39',
      '5 students scored at least the average',
      '6 of 7 students passed (40 or more)',
    ]));
    expect(arrays.marks).toEqual([68, 91, 45, 77, 83, 39, 73]);
  });

  it('ATM Withdrawal: guard clauses reject bad requests, balance and notes are right', async () => {
    const { arrays, logs } = await run(RecursionScripts.AtmWithdrawal);
    expect(logs).toEqual(expect.arrayContaining([
      'Rs 1800: dispensed, new balance 3200',
      'Rs -50: rejected, amount must be positive',
      'Rs 750: rejected, the ATM only has notes of 100 and above',
      'Rs 2500: rejected, daily limit 4000 (already withdrawn 1800)',
      'Rs 2000: dispensed, new balance 1200',
      'Rs 4000: rejected, balance is only 1200',
      '2 of 6 requests succeeded, final balance 1200',
    ]));
    const at = logs.indexOf('Rs 1800: dispensed, new balance 3200');
    expect(logs.slice(at + 1).filter((l) => / x \d+$/.test(l)).slice(0, 3)).toEqual(['    3 x 500', '    1 x 200', '    1 x 100']);
    expect(arrays.account).toEqual([1200, 3800]);
  });
});

describe('Recursion examples produce correct results', () => {
  it('Factorial: winds down to the base case, unwinds with the products, empties the call stack', async () => {
    const { logs } = await run(RecursionScripts.FactorialRecursion);
    const trace = logs.filter((l) => l.includes('factorial(') && !l.includes('⟹'));
    expect(trace.slice(0, 11)).toEqual([
      'factorial(5) called',
      '  factorial(4) called',
      '    factorial(3) called',
      '      factorial(2) called',
      '        factorial(1) called',
      '        base case: factorial(1) = 1',
      '      factorial(2) = 2 * 1 = 2',
      '    factorial(3) = 3 * 2 = 6',
      '  factorial(4) = 4 * 6 = 24',
      'factorial(5) = 5 * 24 = 120',
      'factorial(5) = 120, the loop version gives 120',
    ]);
    expect(logs).toContain('factorial(0) = 1');
    const pops = logs.filter((l) => l.includes('from the top of calls'));
    expect(pops).toHaveLength(6);
    expect(pops[pops.length - 1]).toMatch(/calls is now \[\]$/);
  });

  it('Factorial: recursion and loop agree for 0 to 10', async () => {
    const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
    const ns = Array.from({ length: 11 }, (_, i) => i);
    const got = await answers(RecursionScripts.FactorialRecursion, ns.map((n) => `factorialLoop(${n}) + "," + factorial(${n}, 0)`));
    expect(got).toEqual(ns.map((n) => `${fact(n)},${fact(n)}`));
  });

  it('Before vs After the Call: count down, count up, paint backwards', async () => {
    const { logs } = await run(RecursionScripts.HeadVsTailRecursion);
    expect(logs.filter((l) => /^count(Down|Up)|Lift off/.test(l))).toEqual([
      'countDown: 3', 'countDown: 2', 'countDown: 1', 'Lift off!',
      'countUp: 1', 'countUp: 2', 'countUp: 3',
    ]);
    expect(printed(logs, 'painted index')).toEqual([4, 3, 2, 1, 0].map((i) => `painted index ${i}`));
  });

  it('Digits by Recursion: counts, sums, reverses and digital roots', async () => {
    const { logs } = await run(RecursionScripts.DigitRecursion);
    expect(logs).toEqual(expect.arrayContaining([
      '4072: 4 digits, digit sum 13, reversed 2704, digital root 4',
      '9: 1 digits, digit sum 9, reversed 9, digital root 9',
      '123456: 6 digits, digit sum 21, reversed 654321, digital root 3',
      '99999: 5 digits, digit sum 45, reversed 99999, digital root 9',
    ]));
    const ns = [0, 7, 10, 100, 305, 1234, 90817];
    const got = await answers(RecursionScripts.DigitRecursion,
      ns.map((n) => `countDigits(${n}) + "," + sumDigits(${n}) + "," + reverseDigits(${n}, 0) + "," + digitalRoot(${n})`));
    const sum = (n: number) => String(n).split('').reduce((a, c) => a + Number(c), 0);
    const root = (n: number): number => (n < 10 ? n : root(sum(n)));
    expect(got).toEqual(ns.map((n) => `${String(n).length},${sum(n)},${Number(String(n).split('').reverse().join(''))},${root(n)}`));
  });

  it('Slow vs Fast Power: same answers, far fewer calls', async () => {
    const { logs } = await run(RecursionScripts.PowerRecursion);
    expect(logs).toEqual(expect.arrayContaining([
      '2^10 = 1024 with 11 calls',
      '2^10 = 1024 with 5 calls',
      '3^13 = 1594323 (slow: 14 calls) = 1594323 (fast: 5 calls)',
      'Any number to the power 0 is 1',
    ]));
    const pairs: [number, number][] = [[2, 0], [2, 1], [5, 3], [3, 7], [2, 16], [10, 5], [7, 9]];
    const got = await answers(RecursionScripts.PowerRecursion, pairs.map(([b, e]) => `slowPower(${b}, ${e}) + "," + fastPower(${b}, ${e})`));
    expect(got).toEqual(pairs.map(([b, e]) => `${b ** e},${b ** e}`));
  });

  it('GCD & LCM: Euclid trace, tiles, fraction, buses', async () => {
    const { logs } = await run(RecursionScripts.GcdAndLcm);
    expect(logs.slice(0, 20).filter((l) => l.trim().startsWith('gcd(')).slice(0, 4)).toEqual([
      'gcd(48, 18)', '  gcd(18, 12)', '    gcd(12, 6)', '      gcd(6, 0)',
    ]);
    expect(logs).toEqual(expect.arrayContaining([
      'Biggest square tile: 6 x 6 feet, 24 tiles',
      '84/126 = 2/3',
      'The buses meet again after 36 minutes',
      'gcd(17, 5) = 1, so 17 and 5 share no factor',
    ]));
  });

  it('GCD & LCM: gcd and lcm agree with brute force', async () => {
    const pairs: [number, number][] = [[1, 1], [7, 0], [0, 9], [12, 8], [8, 12], [35, 64], [100, 75], [81, 27], [13, 13]];
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const got = await answers(RecursionScripts.GcdAndLcm, pairs.map(([a, b]) => `gcd(${a}, ${b}, 0)`));
    expect(got).toEqual(pairs.map(([a, b]) => String(gcd(a, b))));
    const lcms = await answers(RecursionScripts.GcdAndLcm, ['lcm(4, 6)', 'lcm(5, 7)', 'lcm(21, 6)']);
    expect(lcms).toEqual(['12', '35', '42']);
  });

  it('Fibonacci Three Ways: call counts, memo table, loop', async () => {
    const { arrays, logs } = await run(RecursionScripts.FibonacciThreeWays);
    expect(logs).toEqual(expect.arrayContaining([
      'naive fib(5) = 5 needed 15 calls',
      'naive fib(10) = 55 needed 177 calls',
      'naive fib(15) = 610 needed 1973 calls',
      'memo fib(16) = 987 needed 31 calls',
      'asking for fib(16) again: 987 in 1 call (a table lookup)',
      'loop fib(16) = 987',
    ]));
    expect(arrays.memo).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]);
  });

  it('Fibonacci Three Ways: all three agree for 0 to 12', async () => {
    const fib = (n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
    const ns = Array.from({ length: 13 }, (_, i) => i);
    const got = await answers(RecursionScripts.FibonacciThreeWays, ns.map((n) => `fibNaive(${n}) + "," + fibMemo(${n}) + "," + fibLoop(${n})`));
    expect(got).toEqual(ns.map((n) => `${fib(n)},${fib(n)},${fib(n)}`));
  });

  it('Recursion on an Array: sum, hottest day, count, sorted check', async () => {
    const { logs } = await run(RecursionScripts.ArrayRecursion);
    expect(logs).toEqual(expect.arrayContaining([
      'Total of 7 days: 224, average 32',
      'Hottest day: index 5 at 36 degrees',
      '3 days were above 32 degrees',
      'Sorted? FALSE',
    ]));
    for (const temps of [[5], [1, 2, 2, 3], [9, 1], [4, 8, 8, 2]]) {
      const src = withArray(RecursionScripts.ArrayRecursion, 'temps', temps);
      const [sum, maxIdx, sorted] = await answers(src, ['sumFrom(0)', 'maxIndexFrom(0)', 'isSortedFrom(0)']);
      expect(Number(sum)).toBe(temps.reduce((a, b) => a + b, 0));
      expect(Number(maxIdx)).toBe(temps.indexOf(Math.max(...temps)));
      expect(sorted).toBe(temps.every((v, i) => i === 0 || temps[i - 1] <= v) ? 'TRUE' : 'FALSE');
    }
  });

  it('Reverse an Array: odd and even lengths', async () => {
    const { arrays, logs } = await run(RecursionScripts.ReverseArrayRecursive);
    expect(arrays.playlist).toEqual([107, 106, 105, 104, 103, 102, 101]);
    expect(logs).toContain('3 swaps for 7 songs');
    for (const values of [[1], [1, 2], [1, 2, 3, 4, 5, 6]]) {
      const { arrays: a } = await run(withArray(RecursionScripts.ReverseArrayRecursive, 'playlist', values));
      expect(a.playlist).toEqual([...values].reverse());
    }
  });

  it('Palindrome Words: finds the palindromes and explains the others', async () => {
    const { logs } = await run(RecursionScripts.PalindromeRecursion);
    expect(logs).toEqual(expect.arrayContaining([
      'racecar is a palindrome', 'abba is a palindrome', 'x is a palindrome',
      "  hello: 'h' at 0 differs from 'o' at 4",
      'hello is not a palindrome (reversed: olleh)',
      "  ranker: 'a' at 1 differs from 'e' at 4",
      '7 of 9 words are palindromes',
    ]));
    const words = ['noon', 'no', 'aa', 'abca', 'refer', 'stats', 'tenet', 'banana'];
    const got = await answers(RecursionScripts.PalindromeRecursion,
      words.map((w) => `isPalindrome("${w}", 0, ${w.length - 1}) + "," + reversed("${w}", ${w.length - 1})`));
    expect(got).toEqual(words.map((w) => {
      const r = w.split('').reverse().join('');
      return `${r === w ? 'TRUE' : 'FALSE'},${r}`;
    }));
  });

  it('Binary, Octal & Hex: matches toString for 0 to 300', async () => {
    const { logs } = await run(RecursionScripts.NumberBases);
    expect(logs).toEqual(expect.arrayContaining([
      '13 -> binary 1101, octal 15, hex D, 3 one-bit(s)',
      '255 -> binary 11111111, octal 377, hex FF, 8 one-bit(s)',
      '0 -> binary 0, octal 0, hex 0, 0 one-bit(s)',
    ]));
    const ns = [1, 2, 7, 8, 15, 16, 31, 64, 99, 128, 200, 300];
    const got = await answers(RecursionScripts.NumberBases,
      ns.map((n) => `toBinary(${n}) + "," + toBase(${n}, 8) + "," + toBase(${n}, 16) + "," + toBase(${n}, 3) + "," + onesIn(${n})`));
    expect(got).toEqual(ns.map((n) => [
      n.toString(2), n.toString(8), n.toString(16).toUpperCase(), n.toString(3),
      n.toString(2).split('').filter((c) => c === '1').length,
    ].join(',')));
  });

  it('Mutual Recursion: even / odd and Collatz steps', async () => {
    const { logs } = await run(RecursionScripts.MutualRecursion);
    expect(logs).toEqual(expect.arrayContaining([
      '0 is even', '7 is odd', '10 is even', '15 is odd', '22 is even',
      'Collatz: 6 reaches 1 in 8 steps, 7 in 16 steps',
    ]));
  });

  it('Tower of Hanoi: 7 legal moves for 3 disks, all disks end on C', async () => {
    const { logs } = await run(RecursionScripts.TowerOfHanoi);
    expect(printed(logs, 'Move ')).toEqual([
      'Move 1: disk 1 from A to C', 'Move 2: disk 2 from A to B', 'Move 3: disk 1 from C to B',
      'Move 4: disk 3 from A to C', 'Move 5: disk 1 from B to A', 'Move 6: disk 2 from B to C',
      'Move 7: disk 1 from A to C',
    ]);
    expect(logs).toContain('Peg C (bottom to top): [3, 2, 1]');
    expect(logs).toContain('3 disks moved in 7 moves (2^n - 1)');
  });

  it('Tower of Hanoi: 1 to 4 disks, never a big disk on a small one', async () => {
    for (let n = 1; n <= 4; n++) {
      const disks = Array.from({ length: n }, (_, i) => n - i);
      const { logs } = await run(withArray(RecursionScripts.TowerOfHanoi, 'pegA', disks));
      const moves = printed(logs, 'Move ');
      expect(moves).toHaveLength(2 ** n - 1);
      const pegs: Record<string, number[]> = { A: [...disks], B: [], C: [] };
      for (const m of moves) {
        const [, disk, from, to] = m.match(/disk (\d+) from (\w) to (\w)/)!;
        expect(pegs[from].pop()).toBe(Number(disk));
        const top = pegs[to][pegs[to].length - 1];
        if (top !== undefined) expect(top).toBeGreaterThan(Number(disk));
        pegs[to].push(Number(disk));
      }
      expect(pegs.C).toEqual(disks);
      expect(logs).toContain(`Peg C (bottom to top): [${disks.join(', ')}]`);
    }
  });

  it('Subsets Within a Budget: 13 combinations, choices undone', async () => {
    const { arrays, logs } = await run(RecursionScripts.SubsetsWithinBudget);
    const combos = logs.filter((l) => /^  .*\(\d+\)$/.test(l));
    expect(combos).toHaveLength(13);
    expect(combos).toEqual(expect.arrayContaining(['  plain pizza (0)', '  30 50 20 (100)', '  40 30 20 (90)']));
    expect(combos).not.toContain('  40 50 20 (110)');
    expect(logs).toContain('13 combinations fit the budget (out of 2^4 = 16)');
    expect(arrays.chosen).toEqual([0, 0, 0, 0]);
  });

  it('Subsets Within a Budget: other budgets match brute force', async () => {
    const cost = [40, 30, 50, 20];
    for (const budget of [0, 20, 55, 140]) {
      let expected = 0;
      for (let mask = 0; mask < 16; mask++) {
        const total = cost.reduce((a, c, i) => a + (mask & (1 << i) ? c : 0), 0);
        if (total <= budget) expected++;
      }
      const { logs } = await run(withSequence(RecursionScripts.SubsetsWithinBudget, `  explore(0, 0, ${budget})\n  PRINT "@" + counts[0]`));
      expect(logs.find((l) => l.startsWith('@'))).toBe(`@${expected}`);
    }
  });

  it('Seating Permutations: 6 different orders, seats restored', async () => {
    const { arrays, logs } = await run(RecursionScripts.SeatingPermutations);
    const orders = logs.filter((l) => /^\d+: /.test(l)).map((l) => l.replace(/^\d+: /, '').trim());
    expect(orders).toHaveLength(6);
    expect(new Set(orders).size).toBe(6);
    expect(logs).toContain('6 arrangements = 3! = 6');
    expect(arrays.seat).toEqual(['Asha', 'Ben', 'Chen']);

    const { logs: four } = await run(withArray(RecursionScripts.SeatingPermutations, 'seat', ['A', 'B', 'C', 'D']));
    const fourOrders = four.filter((l) => /^\d+: /.test(l)).map((l) => l.replace(/^\d+: /, '').trim());
    expect(new Set(fourOrders).size).toBe(24);
    expect(four).toContain('24 arrangements = 4! = 24');
  });

  it('N-Queens: both 4 x 4 boards, and the counts for 5 and 6 queens', async () => {
    const { arrays, logs } = await run(RecursionScripts.NQueens);
    expect(logs.filter((l) => l.startsWith('  ')).slice(0, 4)).toEqual(['  . Q . . ', '  . . . Q ', '  Q . . . ', '  . . Q . ']);
    expect(logs).toContain('4 queens can be placed in 2 ways');
    expect(arrays.col).toEqual([-1, -1, -1, -1]);
    for (const [n, ways] of [[5, 10], [6, 4]]) {
      const { logs: l } = await run(withArray(RecursionScripts.NQueens, 'col', Array(n).fill(-1)));
      expect(l).toContain(`${n} queens can be placed in ${ways} ways`);
    }
  });

  it('Climbing Stairs: lists the 5 ways for 4 steps, 89 for 10', async () => {
    const { arrays, logs } = await run(RecursionScripts.ClimbingStairs);
    expect(logs.filter((l) => /^  [12+]+$/.test(l))).toEqual(['  1+1+1+1', '  1+1+2', '  1+2+1', '  2+1+1', '  2+2']);
    expect(logs).toContain('5 ways for 4 steps, countWays(4) = 5');
    expect(logs).toContain('A staircase of 10 steps: 89 ways');
    expect(arrays.ways).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
  });

  it('Coin Change: ways and fewest coins match brute force', async () => {
    const { logs } = await run(RecursionScripts.CoinChangeWays);
    expect(logs).toEqual(expect.arrayContaining([
      'Ways to pay 5: 4 (65 calls)',
      'Ways to pay 12: 15 (353 calls)',
      'Fewest coins for 18: 4 -> 10 5 2 1 ',
    ]));
    const coins = [1, 2, 5, 10];
    const ways = (a: number, i: number): number => (a === 0 ? 1 : a < 0 || i === coins.length ? 0 : ways(a - coins[i], i) + ways(a, i + 1));
    const amounts = [0, 1, 3, 7, 10, 15];
    const got = await answers(RecursionScripts.CoinChangeWays, amounts.map((a) => `ways(${a}, 0) + "," + fewestCoins(${a})`));
    const fewest = (a: number): number => (a === 0 ? 0 : Math.min(...coins.filter((c) => c <= a).map((c) => 1 + fewest(a - c))));
    expect(got).toEqual(amounts.map((a) => `${ways(a, 0)},${fewest(a)}`));
  });
});

describe('Language behaviour the examples teach', () => {
  it('joining TRUE / FALSE to text prints them the way PRINT does', async () => {
    const { logs } = await run('SCENE T\n\nDECLARE\n  ARRAY a = [1]\n\nSEQUENCE\n  PRINT "x " + TRUE + " " + FALSE\n  PRINT TRUE\nEND\n');
    expect(logs).toContain('x TRUE FALSE');
    expect(logs).toContain('TRUE');
  });

  it('UPDATE a[i] -1 stores -1 (a spaced negative number is its own argument)', async () => {
    const { arrays } = await run('SCENE T\n\nDECLARE\n  ARRAY a = [5, 6, 7]\n\nSEQUENCE\n  r = 1\n  UPDATE a[0] -1\n  UPDATE a[r] a[r] - 1\n  UPDATE a[r + 1] a[r + 1]-1\nEND\n');
    expect(arrays.a).toEqual([-1, 5, 6]);
  });

  it('a recursion with no reachable base case stops with a clear error', async () => {
    const source = 'SCENE T\n\nDECLARE\n  FUNCTION forever(n)\n    RETURN forever(n + 1)\n  END\n\nSEQUENCE\n  x = forever(0)\nEND\n';
    await expect(run(source)).rejects.toThrow(/Call stack exceeded 1000 frames/);
  });
});

describe('Registry', () => {
  it('every Recursion & Functions example is listed and written as real functions', () => {
    const entries = EXAMPLES.filter((e: any) => e.category === 'Recursion & Functions');
    expect(entries).toHaveLength(Object.keys(RecursionScripts).length);
    const sources = entries.map((e: any) => e.source);
    for (const script of Object.values(RecursionScripts)) expect(sources).toContain(script);
    for (const source of sources) expect(source).toMatch(/^\s*FUNCTION \w+\(/m);
    expect(new Set(entries.map((e: any) => e.id)).size).toBe(entries.length);
  });
});

describe('Docs', () => {
  it('the Functions & Recursion docs page shows the same code as the Playground examples', async () => {
    const { readFileSync } = await import('node:fs');
    const docs = readFileSync(new URL('../../packages/demo/src/pages/Docs.tsx', import.meta.url), 'utf-8')
      .replace(/\r\n/g, '\n');
    for (const name of ['FunctionBasics', 'ParametersAreCopies', 'FactorialRecursion', 'FibonacciThreeWays', 'TowerOfHanoi', 'SubsetsWithinBudget'] as const) {
      expect(docs).toContain(RecursionScripts[name].replace(/\r\n/g, '\n').trimEnd());
    }
  });
});
