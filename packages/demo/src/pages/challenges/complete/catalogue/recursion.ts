import type { Kernel } from '../types';
import { num, nums } from './ref';

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const fib = (n: number): number => (n < 2 ? n : fib(n - 1) + fib(n - 2));
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export const RECURSION_KERNELS: Kernel[] = [
  {
    id: 'rec-factorial',
    title: 'Factorial',
    topic: 'Recursion',
    difficulty: 'Easy',
    goal: 'Leave n! (1 × 2 × … × n, and 0! = 1) in result, computed recursively.',
    source: `SCENE Factorial

DECLARE
  STACK calls = []

  FUNCTION factorial(n)
    PUSH calls "factorial(" + n + ")"
    answer = 0
    IF n [[<=]] 1
      answer = [[1]]
    ELSE
      answer = n * factorial([[n - 1]])
    END
    done = POP(calls)
    RETURN answer
  END

SEQUENCE
  n = {{n}}
  result = factorial(n)
END`,
    blanks: [
      ['==', '>='],
      ['0', 'n'],
      ['n', 'n + 1'],
    ],
    bug: {
      find: 'answer = n * factorial(n - 1)',
      replace: 'answer = n * factorial(n - 2)',
      fixes: ['answer = n + factorial(n - 1)', 'answer = factorial(n - 1)'],
      why: 'Each call skipped a number on the way down, so only every other factor was multiplied in.',
    },
    core: { first: 'IF n <= 1', last: 'END' },
    hints: ['A recursive function needs a base case that stops it (0! and 1! are 1), and a step that shrinks the problem: n! = n × (n - 1)!. The calls stack shows every call still waiting for its answer.', 'answer = n * factorial(n - 1).'],
    visible: [{ n: 5 }, { n: 3 }, { n: 1 }],
    hidden: [
      { category: 'edge case: zero', input: { n: 0 } },
      { category: 'a larger input', input: { n: 10 } },
    ],
    preview: { n: 3 },
    expect: (input) => [{ kind: 'var', name: 'result', value: factorial(num(input, 'n')) }],
  },
  {
    id: 'rec-fibonacci',
    title: 'Fibonacci',
    topic: 'Recursion',
    difficulty: 'Easy',
    goal: 'Leave the n-th Fibonacci number (0, 1, 1, 2, 3, 5, …) in result.',
    source: `SCENE Fibonacci

DECLARE
  STACK calls = []

  FUNCTION fib(n)
    PUSH calls "fib(" + n + ")"
    answer = 0
    IF n [[<]] 2
      answer = [[n]]
    ELSE
      answer = fib(n - 1) [[+]] fib(n - 2)
    END
    done = POP(calls)
    RETURN answer
  END

SEQUENCE
  n = {{n}}
  result = fib(n)
END`,
    blanks: [
      ['<=', '=='],
      ['1', '0'],
      ['-', '*'],
    ],
    bug: {
      find: 'answer = fib(n - 1) + fib(n - 2)',
      replace: 'answer = fib(n - 1) + fib(n - 1)',
      fixes: ['answer = fib(n - 2) + fib(n - 2)', 'answer = fib(n) + fib(n - 1)'],
      why: 'Both calls asked for fib(n - 1), so each number doubled the one before instead of adding the two before it.',
    },
    core: { first: 'IF n < 2', last: 'END' },
    hints: ['fib(0) is 0 and fib(1) is 1; every later number is the sum of the two before it. Watch the calls stack: each call waits for both of its smaller calls.', 'answer = fib(n - 1) + fib(n - 2).'],
    visible: [{ n: 6 }, { n: 1 }, { n: 8 }],
    hidden: [
      { category: 'edge case: zero', input: { n: 0 } },
      { category: 'edge case: two', input: { n: 2 } },
    ],
    preview: { n: 3 },
    expect: (input) => [{ kind: 'var', name: 'result', value: fib(num(input, 'n')) }],
  },
  {
    id: 'rec-gcd',
    title: 'Greatest common divisor',
    topic: 'Recursion',
    difficulty: 'Easy',
    goal: "Leave the greatest common divisor of a and b in result, using Euclid's rule gcd(a, b) = gcd(b, a % b).",
    source: `SCENE EuclidGCD

DECLARE
  STACK calls = []

  FUNCTION gcd(a, b)
    PUSH calls "gcd(" + a + ", " + b + ")"
    answer = 0
    IF b == [[0]]
      answer = a
    ELSE
      answer = gcd([[b]], a % b)
    END
    done = POP(calls)
    RETURN answer
  END

SEQUENCE
  a = {{a}}
  b = {{b}}
  result = gcd(a, b)
END`,
    blanks: [
      ['1', 'a'],
      ['a', 'a % b'],
    ],
    bug: {
      find: 'answer = gcd(b, a % b)',
      replace: 'answer = gcd(b, a - b)',
      fixes: ['answer = gcd(a, a % b)', 'answer = gcd(a % b, b)'],
      why: 'Subtracting once is not the remainder: the numbers can go negative and the recursion never reaches its base case.',
    },
    core: { first: 'IF b == 0', last: 'END' },
    hints: ["When b is 0, the answer is a. Otherwise the answer does not change if you replace (a, b) by (b, the remainder of a divided by b).", 'answer = gcd(b, a % b).'],
    visible: [
      { a: 48, b: 18 },
      { a: 17, b: 5 },
      { a: 100, b: 75 },
    ],
    hidden: [
      { category: 'edge case: b is zero', input: { a: 7, b: 0 } },
      { category: 'edge case: a is zero', input: { a: 0, b: 9 } },
    ],
    preview: { a: 12, b: 8 },
    expect: (input) => [{ kind: 'var', name: 'result', value: gcd(num(input, 'a'), num(input, 'b')) }],
  },
  {
    id: 'rec-power',
    title: 'Fast power',
    topic: 'Recursion',
    difficulty: 'Medium',
    goal: 'Leave base to the power exp in result, halving exp at every call.',
    source: `SCENE FastPower

DECLARE
  STACK calls = []

  FUNCTION power(base, exp)
    PUSH calls "power(" + base + ", " + exp + ")"
    answer = 0
    IF exp == 0
      answer = 1
    ELSE
      half = power(base, (exp - exp % 2) / 2)
      IF exp % 2 == 0
        answer = half [[*]] half
      ELSE
        answer = half * half * [[base]]
      END
    END
    done = POP(calls)
    RETURN answer
  END

SEQUENCE
  base = {{base}}
  exp = {{exp}}
  result = power(base, exp)
END`,
    blanks: [
      ['+', '-'],
      ['exp', '2'],
    ],
    bug: {
      find: 'IF exp == 0',
      replace: 'IF exp == 1',
      fixes: ['IF exp < 0', 'IF exp == 2'],
      why: 'The base case was moved to exp = 1 and returned 1 there, so every result lost its last factor (and exp = 0 never stopped).',
    },
    core: { first: 'IF exp == 0', last: 'END' },
    hints: ['b^e = (b^(e/2))² when e is even, and (b^(e/2))² × b when e is odd. Anything to the power 0 is 1.', 'For an odd exp: answer = half * half * base.'],
    visible: [
      { base: 2, exp: 10 },
      { base: 3, exp: 5 },
      { base: 5, exp: 0 },
    ],
    hidden: [
      { category: 'edge case: exponent one', input: { base: 7, exp: 1 } },
      { category: 'a larger exponent', input: { base: 2, exp: 15 } },
    ],
    preview: { base: 2, exp: 3 },
    expect: (input) => [{ kind: 'var', name: 'result', value: Math.pow(num(input, 'base'), num(input, 'exp')) }],
  },
  {
    id: 'rec-array-sum',
    title: 'Sum an array recursively',
    topic: 'Recursion',
    difficulty: 'Easy',
    goal: 'Leave the sum of arr in total, adding one cell per call.',
    source: `SCENE RecursiveSum

DECLARE
  ARRAY arr = {{arr}}

  FUNCTION sumFrom(i)
    IF i [[>=]] LENGTH(arr)
      RETURN 0
    END
    HIGHLIGHT arr[i]
    RETURN arr[i] + sumFrom([[i + 1]])
  END

SEQUENCE
  total = sumFrom(0)
END`,
    blanks: [
      ['>', '<'],
      ['i', 'i + 2'],
    ],
    bug: {
      find: 'RETURN 0',
      replace: 'RETURN arr[0]',
      fixes: ['RETURN 1', 'RETURN i'],
      why: 'Past the end of the array the sum must add nothing; returning arr[0] counted the first value twice (and fails on an empty array).',
    },
    core: { first: 'IF i >= LENGTH(arr)', last: 'RETURN arr[i] + sumFrom(i + 1)' },
    hints: ['The sum from index i is arr[i] plus the sum from i + 1. Past the end, the sum is 0.', 'RETURN arr[i] + sumFrom(i + 1).'],
    visible: [{ arr: [3, 1, 4, 1, 5] }, { arr: [10, 20] }, { arr: [-2, 8, -1] }],
    hidden: [
      { category: 'edge case: empty array', input: { arr: [] } },
      { category: 'edge case: one element', input: { arr: [6] } },
    ],
    preview: { arr: [1, 2, 3] },
    expect: (input) => [{ kind: 'var', name: 'total', value: nums(input, 'arr').reduce((s, v) => s + v, 0) }],
  },
];
