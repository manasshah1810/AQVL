import type { Kernel } from '../types';
import { num, nums } from './ref';

export const ARRAY_KERNELS: Kernel[] = [
  {
    id: 'array-max',
    title: 'Find the maximum',
    topic: 'Arrays',
    difficulty: 'Easy',
    goal: 'Leave the largest value in best, and the index where it first appears in bestAt.',
    source: `SCENE FindMaximum

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  bestAt = 0
  i = 1
  WHILE i < LENGTH(arr)
    COMPARE arr[i] arr[bestAt]
    IF arr[i] [[>]] arr[bestAt]
      bestAt = [[i]]
    END
    i = i + 1
  END
  best = arr[bestAt]
  HIGHLIGHT arr[bestAt] 'SUCCESS'
END`,
    blanks: [
      ['<', '>=', '=='],
      ['i + 1', 'bestAt + 1', '0'],
    ],
    bug: {
      find: 'WHILE i < LENGTH(arr)',
      replace: 'WHILE i < LENGTH(arr) - 1',
      fixes: ['WHILE i <= LENGTH(arr)', 'WHILE i < LENGTH(arr) - 2'],
      why: 'The loop stopped one cell early, so the last cell was never compared: a maximum sitting at the end was missed.',
    },
    core: { first: 'WHILE i < LENGTH(arr)', last: 'END' },
    hints: [
      'Keep the index of the largest value seen so far. Compare every later cell with it, and move the index only when you find something strictly larger.',
      'Inside the loop: IF arr[i] > arr[bestAt], then bestAt = i.',
    ],
    inputNote: 'arr is never empty.',
    visible: [{ arr: [4, 9, 2, 15] }, { arr: [7, 3, 5] }, { arr: [-2, 6, 6, 1] }],
    hidden: [
      { category: 'edge case: one element', input: { arr: [42] } },
      { category: 'edge case: duplicates of the maximum', input: { arr: [3, 9, 2, 9, 1] } },
      { category: 'edge case: all negative', input: { arr: [-8, -3, -5] } },
    ],
    preview: { arr: [3, 8, 5] },
    expect: (input) => {
      const arr = nums(input, 'arr');
      const bestAt = arr.indexOf(Math.max(...arr));
      return [
        { kind: 'var', name: 'best', value: arr[bestAt] },
        { kind: 'var', name: 'bestAt', value: bestAt },
      ];
    },
  },
  {
    id: 'array-reverse',
    title: 'Reverse in place',
    topic: 'Arrays',
    difficulty: 'Easy',
    goal: 'Reverse arr in place with two pointers that walk toward each other.',
    source: `SCENE ReverseInPlace

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  left = 0
  right = LENGTH(arr) - 1
  WHILE left [[<]] right
    SWAP arr[left] arr[right]
    left = left [[+ 1]]
    right = right - 1
  END
END`,
    blanks: [
      ['>', '!=', '>='],
      ['- 1', '+ 2'],
    ],
    bug: {
      find: 'right = LENGTH(arr) - 1',
      replace: 'right = LENGTH(arr) - 2',
      fixes: ['right = LENGTH(arr)', 'right = LENGTH(arr) - 3'],
      why: 'The right pointer started one cell short of the end, so the last value never moved.',
    },
    core: { first: 'left = 0', last: 'END' },
    hints: ['Swap the two ends, then move both pointers one step inward. Stop when they meet or cross.', 'WHILE left < right, SWAP arr[left] arr[right].'],
    visible: [{ arr: [1, 2, 3, 4, 5] }, { arr: [10, 20, 30, 40] }, { arr: ['A', 'B', 'C'] }],
    hidden: [
      { category: 'edge case: empty array', input: { arr: [] } },
      { category: 'edge case: one element', input: { arr: [42] } },
    ],
    preview: { arr: [1, 2, 3] },
    expect: (input) => [{ kind: 'array', name: 'arr', value: [...(input.arr as (number | string)[])].reverse() }],
  },
  {
    id: 'array-linear-search',
    title: 'Linear search',
    topic: 'Arrays',
    difficulty: 'Easy',
    goal: 'Leave in foundAt the index of the first cell equal to target, or -1 when there is none.',
    source: `SCENE LinearSearch

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  target = {{target}}
  foundAt = -1
  i = 0
  WHILE i < LENGTH(arr) AND foundAt == -1
    HIGHLIGHT arr[i]
    IF arr[i] [[==]] target
      foundAt = [[i]]
      HIGHLIGHT arr[i] 'SUCCESS'
    END
    i = i + 1
  END
END`,
    blanks: [
      ['!=', '>', '<'],
      ['i + 1', 'target', '-1'],
    ],
    bug: {
      find: 'WHILE i < LENGTH(arr) AND foundAt == -1',
      replace: 'WHILE i < LENGTH(arr) - 1 AND foundAt == -1',
      fixes: ['WHILE i <= LENGTH(arr) AND foundAt == -1', 'WHILE i < LENGTH(arr) OR foundAt == -1'],
      why: 'The search stopped before the last cell, so a target at the end was reported as missing.',
    },
    core: { first: 'WHILE i < LENGTH(arr) AND foundAt == -1', last: 'END' },
    hints: ['Look at the cells one by one from the left. Stop at the first one that equals the target.', 'IF arr[i] == target, then foundAt = i.'],
    visible: [
      { arr: [4, 8, 15, 16, 23], target: 23 },
      { arr: [7, 3, 7], target: 7 },
      { arr: [5, 1, 9], target: 4 },
    ],
    hidden: [
      { category: 'edge case: empty array', input: { arr: [], target: 3 } },
      { category: 'edge case: target appears several times', input: { arr: [2, 5, 5, 5], target: 5 } },
    ],
    preview: { arr: [3, 1, 4], target: 4 },
    expect: (input) => [{ kind: 'var', name: 'foundAt', value: nums(input, 'arr').indexOf(num(input, 'target')) }],
  },
  {
    id: 'array-insert-sorted',
    title: 'Insert into a sorted array',
    topic: 'Arrays',
    difficulty: 'Easy',
    goal: 'Insert value into the sorted array arr so that it stays sorted.',
    source: `SCENE InsertIntoSorted

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  value = {{value}}
  pos = [[0]]
  WHILE pos < LENGTH(arr) AND arr[pos] [[<]] value
    HIGHLIGHT arr[pos]
    pos = pos + 1
  END
  INSERT arr[pos] value
  HIGHLIGHT arr[pos] 'SUCCESS'
END`,
    blanks: [
      ['1', 'LENGTH(arr)'],
      ['>', '==', '!='],
    ],
    bug: {
      find: 'INSERT arr[pos] value',
      replace: 'INSERT arr[pos + 1] value',
      fixes: ['INSERT arr[pos - 1] value', 'INSERT arr[0] value'],
      why: 'The scan found the right place, but the value was inserted one cell after it (and past the end of an empty array).',
    },
    core: { first: 'pos = 0', last: 'INSERT arr[pos] value' },
    hints: ['Walk from the left past every value smaller than the new one. The first cell that is not smaller is where it goes.', 'WHILE pos < LENGTH(arr) AND arr[pos] < value, pos = pos + 1. Then INSERT arr[pos] value.'],
    visible: [
      { arr: [10, 20, 40, 50], value: 30 },
      { arr: [5, 15, 25], value: 1 },
      { arr: [2, 4], value: 9 },
    ],
    hidden: [
      { category: 'edge case: empty array', input: { arr: [], value: 7 } },
      { category: 'edge case: value already present', input: { arr: [1, 3, 3, 8], value: 3 } },
      { category: 'edge case: insertion near the end', input: { arr: [1, 2, 3, 4, 6], value: 5 } },
    ],
    preview: { arr: [1, 5], value: 3 },
    expect: (input) => {
      const arr = [...nums(input, 'arr')];
      const value = num(input, 'value');
      let pos = 0;
      while (pos < arr.length && arr[pos] < value) pos++;
      arr.splice(pos, 0, value);
      return [{ kind: 'array', name: 'arr', value: arr }];
    },
  },
  {
    id: 'array-remove-all',
    title: 'Remove every occurrence',
    topic: 'Arrays',
    difficulty: 'Medium',
    goal: 'Delete every cell equal to target from arr, keeping the other values in order.',
    source: `SCENE RemoveAll

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  target = {{target}}
  i = 0
  WHILE i < LENGTH(arr)
    IF arr[i] [[==]] target
      HIGHLIGHT arr[i] 'DISCARDED'
      DELETE arr[i]
    ELSE
      i = [[i + 1]]
    END
  END
END`,
    blanks: [
      ['!=', '<', '>'],
      ['i', 'i + 2', 'i - 1'],
    ],
    bug: {
      find: 'WHILE i < LENGTH(arr)',
      replace: 'WHILE i < LENGTH(arr) - 1',
      fixes: ['WHILE i <= LENGTH(arr)', 'WHILE i > LENGTH(arr)'],
      why: 'The loop stopped before the last cell, so a target at the very end was never deleted.',
    },
    core: { first: 'WHILE i < LENGTH(arr)', last: 'END' },
    hints: [
      'Deleting a cell shifts everything after it one place left. So after a delete, the next value to check is already at index i: only step forward when you keep the cell.',
      'IF arr[i] == target, DELETE arr[i]; ELSE i = i + 1.',
    ],
    visible: [
      { arr: [3, 1, 3, 4, 3], target: 3 },
      { arr: [5, 5, 2, 5, 5], target: 5 },
      { arr: [1, 2, 3], target: 9 },
    ],
    hidden: [
      { category: 'edge case: every value is the target', input: { arr: [6, 6, 6], target: 6 } },
      { category: 'edge case: empty array', input: { arr: [], target: 1 } },
    ],
    preview: { arr: [2, 1, 2], target: 2 },
    expect: (input) => [{ kind: 'array', name: 'arr', value: nums(input, 'arr').filter((v) => v !== num(input, 'target')) }],
  },
  {
    id: 'array-prefix-sums',
    title: 'Running totals',
    topic: 'Arrays',
    difficulty: 'Easy',
    goal: 'Turn arr into its running totals: each cell becomes the sum of itself and every cell before it.',
    source: `SCENE PrefixSums

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  i = [[1]]
  WHILE i < LENGTH(arr)
    UPDATE arr[i] arr[i] [[+]] arr[i - 1]
    HIGHLIGHT arr[i]
    i = i + 1
  END
END`,
    blanks: [
      ['0', '2'],
      ['-', '*'],
    ],
    bug: {
      find: 'UPDATE arr[i] arr[i] + arr[i - 1]',
      replace: 'UPDATE arr[i - 1] arr[i] + arr[i - 1]',
      fixes: ['UPDATE arr[i] arr[i] + arr[i + 1]', 'UPDATE arr[i] arr[i - 1]'],
      why: 'Each sum was written into the cell before instead of the current one, so the totals never carried forward.',
    },
    core: { first: 'i = 1', last: 'END' },
    hints: ['The cell before already holds the total so far. Add it to the current cell, then move on.', 'UPDATE arr[i] arr[i] + arr[i - 1], for i from 1 to the end.'],
    visible: [{ arr: [1, 2, 3, 4] }, { arr: [5, 0, 5] }, { arr: [10, -4, 2, 7] }],
    hidden: [
      { category: 'edge case: empty array', input: { arr: [] } },
      { category: 'edge case: one element', input: { arr: [9] } },
    ],
    preview: { arr: [1, 1, 1] },
    expect: (input) => {
      const out: number[] = [];
      for (const v of nums(input, 'arr')) out.push((out[out.length - 1] ?? 0) + v);
      return [{ kind: 'array', name: 'arr', value: out }];
    },
  },
];
