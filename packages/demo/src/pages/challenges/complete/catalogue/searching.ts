import type { Kernel } from '../types';
import { num, nums } from './ref';

/** The iterative binary search the challenge asks for, step for step (which index it lands on matters with duplicates). */
function binarySearch(arr: number[], target: number): number {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const size = high - low;
    const mid = low + (size - (size % 2)) / 2;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

export const SEARCHING_KERNELS: Kernel[] = [
  {
    id: 'search-binary',
    title: 'Binary search',
    topic: 'Searching',
    difficulty: 'Medium',
    goal: 'Find target in the sorted array arr by halving the window: leave its index in foundAt, or -1.',
    source: `SCENE BinarySearch

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  target = {{target}}
  low = 0
  high = LENGTH(arr) - 1
  foundAt = -1
  WHILE low [[<=]] high AND foundAt == -1
    size = high - low
    mid = low + (size - size % 2) / 2
    HIGHLIGHT arr[mid]
    IF arr[mid] == target
      foundAt = mid
      HIGHLIGHT arr[mid] 'SUCCESS'
    ELSE IF arr[mid] [[<]] target
      low = [[mid + 1]]
    ELSE
      high = mid - 1
    END
  END
END`,
    blanks: [
      ['<', '>='],
      ['>', '=='],
      ['mid', 'mid - 1'],
    ],
    bug: {
      find: 'high = LENGTH(arr) - 1',
      replace: 'high = LENGTH(arr) - 2',
      fixes: ['high = LENGTH(arr) - 3', 'high = 0'],
      why: 'The window started one cell short, so the last value of the array could never be found.',
    },
    core: { first: 'WHILE low <= high AND foundAt == -1', last: 'END' },
    hints: [
      'Look at the middle of the window. If it is too small, the target can only be to its right; if too big, only to its left. Keep the window inclusive at both ends.',
      'ELSE IF arr[mid] < target, then low = mid + 1.',
    ],
    inputNote: 'arr is sorted.',
    visible: [
      { arr: [11, 12, 22, 25, 34, 64, 90], target: 90 },
      { arr: [2, 4, 6, 8], target: 4 },
      { arr: [1, 3, 5, 7, 9], target: 6 },
    ],
    hidden: [
      { category: 'edge case: empty array', input: { arr: [], target: 5 } },
      { category: 'edge case: one element', input: { arr: [8], target: 8 } },
      { category: 'edge case: target smaller than everything', input: { arr: [10, 20, 30], target: 1 } },
    ],
    preview: { arr: [1, 4, 7], target: 7 },
    expect: (input) => [{ kind: 'var', name: 'foundAt', value: binarySearch(nums(input, 'arr'), num(input, 'target')) }],
  },
  {
    id: 'search-insert-position',
    title: 'Search insert position',
    topic: 'Searching',
    difficulty: 'Medium',
    goal: 'Leave in pos the first index whose value is at least target (where target would be inserted to keep arr sorted).',
    source: `SCENE SearchInsertPosition

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  target = {{target}}
  low = 0
  high = LENGTH(arr)
  WHILE low < high
    size = high - low
    mid = low + (size - size % 2) / 2
    HIGHLIGHT arr[mid]
    IF arr[mid] [[<]] target
      low = mid + 1
    ELSE
      high = [[mid]]
    END
  END
  pos = low
END`,
    blanks: [
      ['<=', '>'],
      ['mid - 1', 'mid + 1'],
    ],
    bug: {
      find: 'WHILE low < high',
      replace: 'WHILE low <= high',
      fixes: ['WHILE low > high', 'WHILE low < high - 1'],
      why: 'With <= the loop runs once more when the window is already empty, reading past it (or never stopping).',
    },
    core: { first: 'low = 0', last: 'END' },
    hints: [
      'Keep a half-open window [low, high): everything before low is smaller than target, everything from high on is at least target. Shrink until the window is empty.',
      'IF arr[mid] < target, low = mid + 1; ELSE high = mid.',
    ],
    inputNote: 'arr is sorted.',
    visible: [
      { arr: [1, 3, 5, 6], target: 5 },
      { arr: [1, 3, 5, 6], target: 2 },
      { arr: [1, 3, 5, 6], target: 7 },
    ],
    hidden: [
      { category: 'edge case: empty array', input: { arr: [], target: 4 } },
      { category: 'edge case: duplicates of the target', input: { arr: [2, 4, 4, 4, 9], target: 4 } },
    ],
    preview: { arr: [2, 6], target: 4 },
    expect: (input) => {
      const arr = nums(input, 'arr');
      const t = num(input, 'target');
      const at = arr.findIndex((v) => v >= t);
      return [{ kind: 'var', name: 'pos', value: at < 0 ? arr.length : at }];
    },
  },
];
