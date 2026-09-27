/**
 * The Playground's Loops & Control examples, run end-to-end (compile ->
 * ExecutionEngine with the real AnimationController, animations completed
 * instantly).
 *
 * Every example is written out the long way (LOOP, WHILE, IF / ELSE IF /
 * ELSE, flags, helper FUNCTIONs), so besides checking each example's own
 * output, the general ones are re-run on other inputs (by swapping an array
 * literal or a starting value) against TypeScript reference implementations.
 * The language rules the examples teach (inclusive bounds, LOOP counting
 * down, block scope, short-circuit AND, text literals) are checked directly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { LoopScripts } from '../../packages/demo/src/examples/LoopLibrary';
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
  printed: string[];
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
  const printed: string[] = [];
  engine.eventDispatcher.on('RUNTIME_LOG', (e: any) => {
    if (e.keyword === 'PRINT') printed.push(e.message);
  });
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return { arrays: readArrays(engine), printed };
}

async function runError(source: string): Promise<string> {
  try {
    const engine = new ExecutionEngine({ headless: true });
    engine.loadProgram(compile(source) as any);
    await engine.execute();
  } catch (e: any) {
    return e.message;
  }
  throw new Error('expected the program to stop with an error');
}

const program = (declare: string, sequence: string) => `SCENE T\n\nDECLARE\n${declare}\n\nSEQUENCE\n${sequence}\nEND\n`;

/** The example with its first `ARRAY <name> = [...]` literal replaced. */
function withArray(source: string, name: string, values: number[]): string {
  const pattern = new RegExp(`ARRAY ${name} = \\[[^\\]]*\\]`);
  expect(source).toMatch(pattern);
  return source.replace(pattern, `ARRAY ${name} = [${values.join(', ')}]`);
}

/** The example with its first `<name> = <value>` assignment replaced. */
function withValue(source: string, name: string, value: number | string): string {
  const pattern = new RegExp(`(\\n\\s*)${name} = [^\\n]*\\n`);
  expect(source).toMatch(pattern);
  const literal = typeof value === 'string' ? `"${value}"` : String(value);
  return source.replace(pattern, `$1${name} = ${literal}\n`);
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);
const withSome = (printed: string[], text: string) => printed.filter((l) => l.includes(text));

// ── TypeScript references ────────────────────────────────────────────────────

function gradeOf(mark: number): string {
  if (mark < 0 || mark > 100) return 'invalid';
  if (mark >= 90) return 'A';
  if (mark >= 75) return 'B';
  if (mark >= 60) return 'C';
  if (mark >= 40) return 'D';
  return 'F';
}
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}
function fizzBuzz(n: number): string {
  if (n % 15 === 0) return 'FizzBuzz';
  if (n % 3 === 0) return 'Fizz';
  if (n % 5 === 0) return 'Buzz';
  return String(n);
}
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function collatzSteps(n: number): number {
  let steps = 0;
  while (n !== 1) {
    n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    steps++;
  }
  return steps;
}
function isArmstrong(n: number): boolean {
  const digits = String(n).split('').map(Number);
  return digits.reduce((sum, d) => sum + d ** digits.length, 0) === n;
}
const isPalindrome = (n: number) => String(n) === String(n).split('').reverse().join('');

// ── Each example's own run ───────────────────────────────────────────────────

describe('Loops & Control examples produce correct results', () => {
  it('For Loop Basics: one round per student, sums 1 to 10, even numbers', async () => {
    const { printed } = await run(LoopScripts.ForLoopBasics);
    expect(printed).toEqual([
      'The class has 5 students',
      'Student 1 (index 0) scored 72',
      'Student 2 (index 1) scored 85',
      'Student 3 (index 2) scored 64',
      'Student 4 (index 3) scored 90',
      'Student 5 (index 4) scored 58',
      'The loop body ran 5 times, once per student',
      '4 of 5 students scored 60 or more',
      '1 + 2 + ... + 10 = 55',
      'First five even numbers: 2 4 6 8 10 ',
    ]);
  });

  it('While Loop: digits, digit sum and reverse of 90417; a false condition runs zero times', async () => {
    const { printed, arrays } = await run(LoopScripts.WhileLoopDigits);
    expect(arrays.digits).toEqual([9, 0, 4, 1, 7]);
    expect(printed).toContain('Number of digits: 5');
    expect(printed).toContain('Sum of digits: 21');
    expect(printed).toContain('Reversed number: 71409');
    expect(printed).toContain('Starting from 0, the WHILE body ran 0 times');
  });

  it('While Loop works for other numbers', async () => {
    for (const n of [7, 1200, 5005]) {
      const { printed, arrays } = await run(withValue(LoopScripts.WhileLoopDigits, 'number', n));
      const digits = String(n).split('').map(Number);
      expect(arrays.digits, String(n)).toEqual(digits);
      expect(printed).toContain(`Sum of digits: ${digits.reduce((a, b) => a + b, 0)}`);
      expect(printed).toContain(`Reversed number: ${Number(String(n).split('').reverse().join(''))}`);
    }
  });

  it('Counting Down & Reversing: countdown, backwards visit, in-place reverse', async () => {
    const { printed, arrays } = await run(LoopScripts.CountingDownAndReversing);
    expect(printed.slice(0, 6)).toEqual(['T-minus 5', 'T-minus 4', 'T-minus 3', 'T-minus 2', 'T-minus 1', 'Lift off!']);
    expect(withSome(printed, 'Playing index').map((l) => l.split(':')[0])).toEqual(
      [5, 4, 3, 2, 1, 0].map((i) => `Playing index ${i}`)
    );
    expect(arrays.playlist).toEqual([66, 55, 44, 33, 22, 11]);
    expect(printed).toContain('Reversed with 3 swaps: [66, 55, 44, 33, 22, 11]');
  });

  it('Reversing also works for an odd length', async () => {
    const { arrays, printed } = await run(withArray(LoopScripts.CountingDownAndReversing, 'playlist', [1, 2, 3, 4, 5]));
    expect(arrays.playlist).toEqual([5, 4, 3, 2, 1]);
    expect(printed).toContain('Reversed with 2 swaps: [5, 4, 3, 2, 1]');
  });

  it('Grade Calculator: the ladder takes the first true branch', async () => {
    const { printed } = await run(LoopScripts.GradeCalculator);
    expect(printed).toEqual([
      'Student 1: 92 -> A',
      'Student 2: 67 -> C',
      'Student 3: 78 -> B',
      'Student 4: 45 -> D',
      'Student 5: 105 -> invalid (marks must be 0 to 100)',
      'Student 6: 88 -> B',
      'Student 7: 31 -> F',
      'Student 8: 73 -> C',
      'A: 1, B: 2, C: 2, D: 1, F: 1, invalid: 1',
    ]);
  });

  it('Grade Calculator matches the reference on boundary marks', async () => {
    const marks = [0, 39, 40, 59, 60, 74, 75, 89, 90, 100, -5, 101];
    const { printed } = await run(withArray(LoopScripts.GradeCalculator, 'marks', marks));
    marks.forEach((m, i) => {
      expect(printed[i].startsWith(`Student ${i + 1}: ${m} -> ${gradeOf(m)}`), printed[i]).toBe(true);
    });
  });

  it('Leap Year Checker: nested IFs and AND / OR agree', async () => {
    const { printed } = await run(LoopScripts.LeapYearChecker);
    expect(withSome(printed, 'leap year (')).toEqual([
      '1900 is not a leap year (365 days)',
      '2000 is a leap year (366 days)',
      '2023 is not a leap year (365 days)',
      '2024 is a leap year (366 days)',
      '2100 is not a leap year (365 days)',
      '2400 is a leap year (366 days)',
    ]);
    expect(printed).toContain('3 of 6 years are leap years');
    expect(printed).toContain('Both versions agreed on 6 of 6 years');
  });

  it('Leap Year Checker matches the reference on a century of years', async () => {
    const years = range(1896, 1912).concat([1600, 1700, 1800, 2000]);
    const { printed } = await run(withArray(LoopScripts.LeapYearChecker, 'years', years));
    years.forEach((y, i) => {
      expect(printed[i], String(y)).toBe(isLeap(y) ? `${y} is a leap year (366 days)` : `${y} is not a leap year (365 days)`);
    });
    expect(printed).toContain(`Both versions agreed on ${years.length} of ${years.length} years`);
  });

  it('Weekly Expenses: running total, average and over-budget days', async () => {
    const { printed } = await run(LoopScripts.WeeklyExpenses);
    expect(printed).toContain('Day 2: spent 1200, over budget by 500 (running total 1650)');
    expect(printed).toContain('Day 7: spent 700, within budget (running total 5600)');
    expect(printed.slice(-4)).toEqual([
      'Total spent this week: 5600',
      'Average per day: 800',
      'Days over the budget of 700: 3',
      'Over the weekly budget of 4900 by 700',
    ]);
  });

  it('Weekly Expenses reports savings when under budget', async () => {
    const { printed } = await run(withArray(LoopScripts.WeeklyExpenses, 'expenses', [100, 200, 300]));
    expect(printed).toContain('Total spent this week: 600');
    expect(printed).toContain('Average per day: 200');
    expect(printed).toContain('Days over the budget of 700: 0');
    expect(printed).toContain('Within the weekly budget of 2100, saved 1500');
  });

  it('Hottest & Coldest Day: records in one pass', async () => {
    const { printed } = await run(LoopScripts.HottestAndColdestDay);
    expect(printed.slice(-3)).toEqual(['Hottest: day 4 at 36 degrees', 'Coldest: day 6 at 27 degrees', 'Temperature range: 9 degrees']);
  });

  it('Hottest & Coldest Day works for negative temperatures and the first day as a record', async () => {
    const temps = [-2, -8, -5, -1, -9, -3];
    const { printed } = await run(withArray(LoopScripts.HottestAndColdestDay, 'temps', temps));
    expect(printed).toContain('Hottest: day 4 at -1 degrees');
    expect(printed).toContain('Coldest: day 5 at -9 degrees');
    const first = await run(withArray(LoopScripts.HottestAndColdestDay, 'temps', [40, 10, 20]));
    expect(first.printed).toContain('Hottest: day 1 at 40 degrees');
  });

  it('Second Largest: repeated values are not counted twice', async () => {
    const { printed } = await run(LoopScripts.SecondLargest);
    expect(printed).toContain('89 changes nothing');
    expect(printed.at(-1)).toBe('Largest is 95, second largest is 89');
    for (const [scores, expected] of [
      [[3, 10, 10, 7], 'Largest is 10, second largest is 7'],
      [[5, 5, 5], 'Largest is 5, there is no second largest'],
      [[1, 2, 3, 4], 'Largest is 4, second largest is 3'],
      [[4, 3, 2, 1], 'Largest is 4, second largest is 3'],
    ] as const) {
      const other = await run(withArray(LoopScripts.SecondLargest, 'scores', [...scores]));
      expect(other.printed.at(-1), String(scores)).toBe(expected);
    }
  });

  it('Stopping Early: the search stops at the match, a missing roll checks everything', async () => {
    const { printed } = await run(LoopScripts.StoppingEarly);
    expect(printed).toEqual([
      'Roll 135 found at index 3 after 4 checks (stopped early)',
      'Roll 999 is not in the list, all 7 entries were checked',
      'Results: 3 and -1',
    ]);
    const first = await run(withArray(LoopScripts.StoppingEarly, 'rollNumbers', [135, 1, 2]));
    expect(first.printed[0]).toBe('Roll 135 found at index 0 after 1 checks (stopped early)');
  });

  it('Skipping Items: invalid readings never reach the average', async () => {
    const { printed } = await run(LoopScripts.SkippingInvalidReadings);
    expect(withSome(printed, 'skipped').length).toBe(4);
    expect(printed.slice(-2)).toEqual(['Used 5 readings, skipped 3', 'Average temperature: 24']);
    const none = await run(withArray(LoopScripts.SkippingInvalidReadings, 'readings', [-1, 999]));
    expect(none.printed.slice(-2)).toEqual(['Used 0 readings, skipped 2', 'No valid readings, no average']);
  });

  it('Do-While: PIN accepted on the third try, then withdrawals', async () => {
    const { printed } = await run(LoopScripts.DoWhilePinAndAtm);
    expect(printed).toEqual([
      'Try 1: wrong PIN, 2 tries left',
      'Try 2: wrong PIN, 1 try left',
      'Try 3: PIN accepted',
      'Balance: 5000',
      'Withdrew 1000, balance 4000',
      'Withdrew 2500, balance 1500',
      'Declined 3000: only 1500 available',
      'Withdrew 700, balance 800',
      'Withdrew 100, balance 700',
      'Final balance: 700',
    ]);
  });

  it('Do-While: the body runs once even when the first PIN is right; three wrong PINs block the card', async () => {
    const first = await run(withArray(LoopScripts.DoWhilePinAndAtm, 'pinAttempts', [4321, 1111]));
    expect(first.printed[0]).toBe('Try 1: PIN accepted');
    const blocked = await run(withArray(LoopScripts.DoWhilePinAndAtm, 'pinAttempts', [1, 2, 3, 4321]));
    expect(blocked.printed).toEqual([
      'Try 1: wrong PIN, 2 tries left',
      'Try 2: wrong PIN, 1 try left',
      'Try 3: wrong PIN, 0 tries left',
      'Card blocked after 3 wrong tries',
    ]);
    const empty = await run(withArray(LoopScripts.DoWhilePinAndAtm, 'requests', [5000, 10]));
    expect(empty.printed.slice(-2)).toEqual(['Withdrew 5000, balance 0', 'Final balance: 0']);
  });

  it('FizzBuzz: the "both" test comes first', async () => {
    const { printed } = await run(LoopScripts.FizzBuzz);
    expect(printed.slice(0, 15)).toEqual(range(1, 15).map(fizzBuzz));
    expect(printed.at(-1)).toBe('Fizz: 4, Buzz: 2, FizzBuzz: 1, plain numbers: 8');
    const longer = await run(withArray(LoopScripts.FizzBuzz, 'nums', range(1, 45)));
    expect(longer.printed.slice(0, 45)).toEqual(range(1, 45).map(fizzBuzz));
  });

  it('Multiplication Table: the inner loop fills a whole row per outer round', async () => {
    const { printed, arrays } = await run(LoopScripts.MultiplicationTable);
    expect(withSome(printed, 'Table of')).toEqual(range(1, 5).map((t) => `Table of ${t}: [${range(1, 5).map((k) => t * k).join(', ')}]`));
    expect(printed).toContain('    5  10  15  20  25  ');
    expect(printed.slice(-2)).toEqual(['The inner loop body ran 25 times (5 x 5)', 'Sum of every number in the table: 225']);
    expect(arrays.row).toEqual([5, 10, 15, 20, 25]);
    const small = await run(withArray(LoopScripts.MultiplicationTable, 'row', [0, 0, 0]));
    expect(small.printed.slice(-2)).toEqual(['The inner loop body ran 9 times (3 x 3)', 'Sum of every number in the table: 36']);
  });

  it('Star Patterns: triangle, pyramid (zero spaces on the last row) and Floyd', async () => {
    const { printed, arrays } = await run(LoopScripts.StarPatterns);
    expect(printed).toEqual([
      'Right triangle:',
      '* ',
      '* * ',
      '* * * ',
      '* * * * ',
      'Pyramid:',
      '   *',
      '  ***',
      ' *****',
      '*******',
      'Stars in each pyramid row: [1, 3, 5, 7]',
      "Floyd's triangle:",
      '1 ',
      '2 3 ',
      '4 5 6 ',
      '7 8 9 10 ',
      'Numbers printed: 10',
    ]);
    expect(arrays.starsPerRow).toEqual([1, 3, 5, 7]);
    const six = await run(withValue(LoopScripts.StarPatterns, 'rows', 6));
    const pyramid = range(1, 6).map((r) => ' '.repeat(6 - r) + '*'.repeat(2 * r - 1));
    expect(six.printed.slice(8, 14)).toEqual(pyramid);
    expect(six.printed.at(-1)).toBe('Numbers printed: 21');
  });

  it('Gift Pairs: every pair once, j starting at i + 1', async () => {
    const { printed } = await run(LoopScripts.GiftPairsWithinBudget);
    expect(printed).toEqual([
      'Pair 1: 300 + 350 = 650 (indices 1 and 5)',
      'Pair 2: 450 + 200 = 650 (indices 2 and 3)',
      'Checked 15 pairs, 2 fit the budget of 650',
    ]);
    const prices = [325, 325, 100, 550, 650, 0];
    const expected: string[] = [];
    for (let i = 0; i < prices.length; i++) {
      for (let j = i + 1; j < prices.length; j++) {
        if (prices[i] + prices[j] === 650) expected.push(`${prices[i]} + ${prices[j]} = 650 (indices ${i} and ${j})`);
      }
    }
    const other = await run(withArray(LoopScripts.GiftPairsWithinBudget, 'prices', prices));
    expect(withSome(other.printed, 'Pair ').map((l) => l.replace(/^Pair \d+: /, ''))).toEqual(expected);
    expect(other.printed.at(-1)).toBe(`Checked 15 pairs, ${expected.length} fit the budget of 650`);
  });

  it('Counting Vowels: every vowel counts, including the letter i', async () => {
    const { printed, arrays } = await run(LoopScripts.CountingVowels);
    expect(printed.slice(1)).toEqual([
      'Vowels: 10',
      'Consonants: 15',
      'Spaces: 3',
      'Words: 4',
      'Counts [vowels, consonants, spaces]: [10, 15, 3]',
    ]);
    expect(arrays.counts).toEqual([10, 15, 3]);
    for (const sentence of ['i like pie', 'aeiou xyz', 'rhythm']) {
      const other = await run(withValue(LoopScripts.CountingVowels, 'sentence', sentence));
      const vowels = sentence.split('').filter((c) => 'aeiou'.includes(c)).length;
      const spaces = sentence.split('').filter((c) => c === ' ').length;
      const consonants = sentence.split('').filter((c) => c >= 'a' && c <= 'z' && !'aeiou'.includes(c)).length;
      expect(other.arrays.counts, sentence).toEqual([vowels, consonants, spaces]);
    }
  });

  it('Fibonacci Series: first 12 numbers, even count, first above 1000', async () => {
    const { printed, arrays } = await run(LoopScripts.FibonacciSeries);
    expect(arrays.fib).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
    expect(printed).toEqual([
      'First 12 Fibonacci numbers: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]',
      '4 of them are even',
      'The first Fibonacci number above 1000 is 1597 (index 17 in the series, counting from 0)',
    ]);
    const twenty = await run(withValue(LoopScripts.FibonacciSeries, 'howMany', 20));
    expect(twenty.arrays.fib.at(-1)).toBe(4181);
  });

  it('Prime Check: early RETURN with the factor pair', async () => {
    const { printed } = await run(LoopScripts.PrimeCheck);
    expect(printed).toEqual([
      '2 is prime',
      '  9 = 3 x 3',
      '9 is not prime',
      '17 is prime',
      '  21 = 3 x 7',
      '21 is not prime',
      '29 is prime',
      '1 is not prime',
      '  49 = 7 x 7',
      '49 is not prime',
      '97 is prime',
      '4 of 8 numbers are prime',
    ]);
    const numbers = range(0, 40);
    const other = await run(withArray(LoopScripts.PrimeCheck, 'candidates', numbers));
    expect(withSome(other.printed, ' is ').filter((l) => !l.startsWith(' '))).toEqual(
      numbers.map((n) => `${n} is ${isPrime(n) ? 'prime' : 'not prime'}`)
    );
  });

  it('Sieve of Eratosthenes: primes up to 30, and up to 60', async () => {
    const { printed, arrays } = await run(LoopScripts.SieveOfEratosthenes);
    expect(printed).toEqual([
      'Prime 2 crossed out 14 more',
      'Prime 3 crossed out 4 more',
      'Prime 5 crossed out 1 more',
      'Primes up to 30: 2 3 5 7 11 13 17 19 23 29 ',
      'There are 10 of them',
    ]);
    expect(arrays.nums).toEqual(range(2, 30).map((n) => (isPrime(n) ? n : 0)));
    const sixty = await run(withArray(LoopScripts.SieveOfEratosthenes, 'nums', range(2, 60)));
    expect(sixty.arrays.nums).toEqual(range(2, 60).map((n) => (isPrime(n) ? n : 0)));
    expect(sixty.printed.at(-1)).toBe(`There are ${range(2, 60).filter(isPrime).length} of them`);
  });

  it("Euclid's GCD & LCM: remainder steps and the subtraction version", async () => {
    const { printed, arrays } = await run(LoopScripts.EuclidGcdLcm);
    expect(printed).toEqual([
      'Find the GCD of 180 and 48',
      '  180 % 48 = 36',
      '  48 % 36 = 12',
      '  36 % 12 = 0',
      'GCD = 12 after 3 remainder steps',
      'LCM = 720',
      'Subtraction version: GCD = 12 after 6 steps',
    ]);
    expect(arrays.pair).toEqual([12, 0]);
    for (const [a, b] of [[17, 5], [21, 6], [100, 75], [7, 7]]) {
      const other = await run(withArray(LoopScripts.EuclidGcdLcm, 'pair', [a, b]));
      const g = gcd(a, b);
      expect(other.printed, `${a}, ${b}`).toContain(`LCM = ${(a * b) / g}`);
      expect(withSome(other.printed, 'GCD = ').every((l) => l.includes(`GCD = ${g} `))).toBe(true);
    }
  });

  it('Decimal to Binary: bits, round trip and count of ones', async () => {
    const { printed, arrays } = await run(LoopScripts.DecimalToBinary);
    expect(arrays.bits).toEqual([1, 0, 0, 1, 0, 1]);
    expect(printed.slice(-4)).toEqual([
      '37 in binary: [1, 0, 0, 1, 0, 1]',
      'Back to decimal: 37',
      'It has 6 bits, 3 of them are 1',
      'Round trip correct',
    ]);
    for (const n of [1, 2, 255, 1024]) {
      const other = await run(withValue(LoopScripts.DecimalToBinary, 'number', n));
      expect(other.arrays.bits, String(n)).toEqual(n.toString(2).split('').map(Number));
      expect(other.printed.at(-1)).toBe('Round trip correct');
    }
  });

  it('Palindrome & Armstrong: helper FUNCTIONs with loops inside', async () => {
    const { printed } = await run(LoopScripts.PalindromeAndArmstrong);
    expect(printed).toEqual([
      '121: palindrome (reads 121 backwards)',
      '153: Armstrong number (3 digits)',
      '1221: palindrome (reads 1221 backwards)',
      '370: Armstrong number (3 digits)',
      '9474: Armstrong number (4 digits)',
      '123: neither (reversed it is 321)',
      'Palindromes: 2, Armstrong numbers: 3',
    ]);
    const numbers = [7, 11, 407, 1634, 12321, 100, 8208, 10];
    const other = await run(withArray(LoopScripts.PalindromeAndArmstrong, 'numbers', numbers));
    numbers.forEach((n, i) => {
      const line = other.printed[i];
      if (isPalindrome(n) && isArmstrong(n)) expect(line).toBe(`${n}: palindrome and Armstrong`);
      else if (isPalindrome(n)) expect(line.startsWith(`${n}: palindrome (`), line).toBe(true);
      else if (isArmstrong(n)) expect(line.startsWith(`${n}: Armstrong number`), line).toBe(true);
      else expect(line.startsWith(`${n}: neither`), line).toBe(true);
    });
  });

  it('Collatz: the path from 6 and the longest start from 1 to 10', async () => {
    const { printed, arrays } = await run(LoopScripts.CollatzSequence);
    expect(arrays.trail).toEqual([6, 3, 10, 5, 16, 8, 4, 2, 1]);
    expect(printed.slice(0, 2)).toEqual(['Path from 6: [6, 3, 10, 5, 16, 8, 4, 2, 1]', 'Reached 1 after 8 steps']);
    expect(withSome(printed, '  start ')).toEqual(range(1, 10).map((s) => `  start ${s}: ${collatzSteps(s)} steps`));
    expect(printed.at(-1)).toBe('Longest path from 1 to 10: start 9 with 19 steps');
    const seven = await run(withValue(LoopScripts.CollatzSequence, 'start', 7));
    expect(seven.arrays.trail).toHaveLength(collatzSteps(7) + 1);
  });
});

// ── The language rules the examples teach ────────────────────────────────────

describe('Loop and control-flow rules', () => {
  const arr = '  ARRAY arr = [4, 5, 6]';

  it('LOOP bounds are inclusive, and LOOP counts down when TO < FROM', async () => {
    const { printed } = await run(program(arr, '  s = ""\n  LOOP i FROM 0 TO 2\n    s = s + i\n  END\n  LOOP i FROM 2 TO 0\n    s = s + i\n  END\n  PRINT s'));
    expect(printed).toEqual(['012210']);
    const twice = await run(program(arr, '  n = 0\n  LOOP s FROM 1 TO 0\n    n = n + 1\n  END\n  PRINT n'));
    expect(twice.printed).toEqual(['2']);
  });

  it('a WHILE whose condition is false at the start runs zero times', async () => {
    const { printed } = await run(program(arr, '  n = 0\n  WHILE n < 0\n    n = n + 1\n  END\n  PRINT n'));
    expect(printed).toEqual(['0']);
  });

  it('ELSE IF runs only the first true branch, and the chain has one END', async () => {
    const src = program(arr, '  x = 95\n  IF x > 50\n    PRINT "first"\n  ELSE IF x > 90\n    PRINT "second"\n  ELSE\n    PRINT "third"\n  END');
    expect((await run(src)).printed).toEqual(['first']);
  });

  it('AND short-circuits, so an index guard protects the read on its right', async () => {
    const { printed } = await run(program(arr, '  i = 0\n  WHILE i < LENGTH(arr) AND arr[i] != 99\n    i = i + 1\n  END\n  PRINT i'));
    expect(printed).toEqual(['3']);
  });

  it('a text literal stays text, even when a variable has the same name', async () => {
    const { printed } = await run(program(arr, '  x = 5\n  PRINT "x"\n  LOOP i FROM 0 TO 1\n    PRINT "i" + i\n    IF CHAR_AT("hi", 1) == "i"\n      PRINT "match"\n    END\n  END'));
    expect(printed).toEqual(['x', 'i0', 'match', 'i1', 'match']);
  });

  it('assigning inside a FUNCTION creates a local, the caller keeps its variable', async () => {
    const src = `SCENE T\n\nDECLARE\n  ARRAY arr = [1]\n  FUNCTION bump(x)\n    counter = counter + x\n    RETURN counter\n  END\n\nSEQUENCE\n  counter = 10\n  r = bump(5)\n  PRINT r + " " + counter\nEND\n`;
    expect((await run(src)).printed).toEqual(['15 10']);
  });

  it('a variable first assigned inside a block does not exist after it', async () => {
    const message = await runError(program(arr, '  IF 1 == 1\n    inner = 7\n  END\n  PRINT inner'));
    expect(message).toContain("Undeclared identifier 'inner'");
  });

  it('going one index past the end is a clear error', async () => {
    const message = await runError(program(arr, '  LOOP i FROM 0 TO LENGTH(arr)\n    PRINT arr[i]\n  END'));
    expect(message).toContain("Index 3 is out of bounds for array 'arr' (valid indices are 0 to 2)");
  });

  it('a WHILE loop that never ends is stopped with a clear error', async () => {
    const message = await runError(program(arr, '  k = 0\n  WHILE k < 5\n    k = k\n  END'));
    expect(message).toContain('non-terminating loop');
  });
});

// ── Registry and docs ────────────────────────────────────────────────────────

describe('Loops & Control library, registry and docs', () => {
  const loopExamples = EXAMPLES.filter((e) => e.category === 'Loops & Control');

  it('lists all 23 examples, each written out the long way', () => {
    expect(loopExamples).toHaveLength(23);
    expect(new Set(loopExamples.map((e) => e.source))).toEqual(new Set(Object.values(LoopScripts)));
    expect(new Set(loopExamples.map((e) => e.id)).size).toBe(23);
    for (const example of loopExamples) {
      expect(example.source, example.id).toMatch(/\b(WHILE|LOOP)\b/);
      expect(example.source, example.id).not.toMatch(/\b(MAX|MIN|ABS)\(/);
    }
    // Between them the examples use every control construct
    const all = loopExamples.map((e) => e.source).join('\n');
    for (const construct of [/\bLOOP \w+ FROM/, /\bWHILE\b/, /\bELSE IF\b/, /\n\s*ELSE\n/, /\bAND\b/, /\bOR\b/, /\bFUNCTION\b/, /\bRETURN\b/, / % /]) {
      expect(all).toMatch(construct);
    }
  });

  it('every example runs without an error', async () => {
    for (const example of loopExamples) {
      await expect(run(example.source), example.id).resolves.toBeDefined();
    }
  });

  it("the Docs page's loop programs run and print what the page says", async () => {
    const docs = readFileSync(resolve(__dirname, '../../packages/demo/src/pages/Docs.tsx'), 'utf8').replace(/\r\n/g, '\n');
    const docProgram = (sceneName: string) => {
      const match = docs.match(new RegExp('code=\\{`(SCENE ' + sceneName + '\\n[\\s\\S]*?)`\\}'));
      expect(match, sceneName).not.toBeNull();
      return match![1];
    };
    expect((await run(docProgram('LoopsAtAGlance'))).printed).toEqual(['4 of 5 students passed']);
    expect((await run(docProgram('GradeLadder'))).printed).toEqual(['92 -> A', '67 -> C', '78 -> B', '31 -> F']);
    expect((await run(docProgram('DigitSum'))).printed).toEqual(['Digits: [9, 0, 4, 1, 7]', 'Sum of digits: 21']);
    const pyramid = await run(docProgram('Pyramid'));
    expect(pyramid.printed).toEqual(['   *', '  ***', ' *****', '*******']);
    expect(pyramid.arrays.starsPerRow).toEqual([1, 3, 5, 7]);
    await expect(run(docProgram('PrimeCheck'))).resolves.toBeDefined();
  });
});
