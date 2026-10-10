import type { Kernel } from '../types';
import { nums } from './ref';

const sorted = (input: Record<string, unknown>) => [...((input.arr as number[]) ?? [])].sort((a, b) => a - b);

const SORT_HIDDEN = [
  { category: 'edge case: empty array', input: { arr: [] } },
  { category: 'edge case: duplicates', input: { arr: [3, 1, 3, 1, 2] } },
  { category: 'edge case: one element', input: { arr: [7] } },
];

export const SORTING_KERNELS: Kernel[] = [
  {
    id: 'sort-bubble',
    title: 'Bubble sort',
    topic: 'Sorting',
    difficulty: 'Easy',
    goal: 'Make this sort the array from smallest to largest.',
    source: `SCENE BubbleSort

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  n = LENGTH(arr)
  pass = 0
  WHILE pass < n - 1
    j = 0
    WHILE j < n - 1 - [[pass]]
      COMPARE arr[j] arr[j + 1]
      IF arr[j] [[>]] arr[j + 1]
        SWAP arr[j] arr[j + 1]
      END
      j = j + 1
    END
    HIGHLIGHT arr[n - 1 - pass] 'SUCCESS'
    pass = pass + 1
  END
END`,
    blanks: [
      ['pass + 1', 'n'],
      ['<', '==', '<='],
    ],
    bug: {
      find: 'WHILE j < n - 1 - pass',
      replace: 'WHILE j < n - 2 - pass',
      fixes: ['WHILE j < n - pass', 'WHILE j <= n - 1 - pass'],
      why: 'Each pass stopped one pair early, so the last pair of the unsorted part was never compared and a large value could be left behind.',
    },
    core: { first: 'WHILE pass < n - 1', last: 'END' },
    hints: [
      'Walk along the array comparing neighbours, and swap a pair that is the wrong way round. After each pass the largest remaining value has bubbled to the end, so the next pass can stop one cell earlier.',
      'IF arr[j] > arr[j + 1], SWAP arr[j] arr[j + 1].',
    ],
    visible: [{ arr: [5, 2, 9, 1] }, { arr: [64, 34, 25, 12, 22, 11, 90] }, { arr: [1, 2, 4, 3] }],
    hidden: SORT_HIDDEN,
    preview: { arr: [3, 1, 2] },
    expect: (input) => [{ kind: 'array', name: 'arr', value: sorted(input) }],
  },
  {
    id: 'sort-selection',
    title: 'Selection sort',
    topic: 'Sorting',
    difficulty: 'Easy',
    goal: 'Sort arr from smallest to largest by repeatedly selecting the smallest remaining value.',
    source: `SCENE SelectionSort

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  n = LENGTH(arr)
  i = 0
  WHILE i < n - 1
    minAt = i
    j = [[i + 1]]
    WHILE j < n
      COMPARE arr[j] arr[minAt]
      IF arr[j] [[<]] arr[minAt]
        minAt = j
      END
      j = j + 1
    END
    IF minAt != i
      SWAP arr[i] arr[minAt]
    END
    HIGHLIGHT arr[i] 'SUCCESS'
    i = i + 1
  END
END`,
    blanks: [
      ['0', 'n'],
      ['>', '=='],
    ],
    bug: {
      find: 'WHILE j < n',
      replace: 'WHILE j < n - 1',
      fixes: ['WHILE j <= n', 'WHILE j < i'],
      why: 'The scan for the minimum never looked at the last cell, so a small value at the end stayed there.',
    },
    core: { first: 'WHILE i < n - 1', last: 'END' },
    hints: [
      'For each position i, scan the rest of the array for the smallest value, then swap it into position i.',
      'IF arr[j] < arr[minAt], then minAt = j. After the scan, SWAP arr[i] arr[minAt].',
    ],
    visible: [{ arr: [29, 10, 14, 37, 13] }, { arr: [4, 3, 2, 1] }, { arr: [8, 5, 9, 2] }],
    hidden: SORT_HIDDEN,
    preview: { arr: [3, 1, 2] },
    expect: (input) => [{ kind: 'array', name: 'arr', value: sorted(input) }],
  },
  {
    id: 'sort-insertion',
    title: 'Insertion sort',
    topic: 'Sorting',
    difficulty: 'Medium',
    goal: 'Sort arr by sliding each value left until it meets a smaller one.',
    source: `SCENE InsertionSort

DECLARE
  ARRAY arr = {{arr}}

SEQUENCE
  n = LENGTH(arr)
  i = 1
  WHILE i < n
    j = i
    WHILE j > 0 AND arr[j - 1] [[>]] arr[j]
      COMPARE arr[j - 1] arr[j]
      SWAP arr[j - 1] arr[j]
      j = [[j - 1]]
    END
    i = i + 1
  END
END`,
    blanks: [
      ['<', '=='],
      ['j + 1', 'j'],
    ],
    bug: {
      find: 'j = i',
      replace: 'j = i - 1',
      fixes: ['j = 0', 'j = i + 1'],
      why: 'Each round started one cell too far left, so the newest value was never slid into place.',
    },
    core: { first: 'WHILE i < n', last: 'END' },
    hints: [
      'Everything left of i is already sorted. Take arr[i] and swap it leftwards while the value before it is bigger.',
      'WHILE j > 0 AND arr[j - 1] > arr[j], SWAP arr[j - 1] arr[j] and j = j - 1.',
    ],
    visible: [{ arr: [12, 11, 13, 5, 6] }, { arr: [3, 7, 4, 9, 5, 2, 6, 1] }, { arr: [2, 1] }],
    hidden: SORT_HIDDEN,
    preview: { arr: [3, 1, 2] },
    expect: (input) => [{ kind: 'array', name: 'arr', value: sorted(input) }],
  },
  {
    id: 'sort-quick',
    title: 'Quick sort',
    topic: 'Sorting',
    difficulty: 'Hard',
    goal: 'Sort arr with quick sort: partition around the last value, then sort each side recursively.',
    source: `SCENE QuickSort

DECLARE
  ARRAY arr = {{arr}}

  FUNCTION partition(low, high)
    pivot = arr[high]
    HIGHLIGHT arr[high] 'MARKED'
    i = low
    j = low
    WHILE j < high
      COMPARE arr[j] arr[high]
      IF arr[j] [[<]] pivot
        SWAP arr[i] arr[j]
        i = i + 1
      END
      j = j + 1
    END
    SWAP arr[i] arr[high]
    RETURN i
  END

  FUNCTION quickSort(low, high)
    IF low [[<]] high
      p = partition(low, high)
      quickSort(low, [[p - 1]])
      quickSort(p + 1, high)
    END
  END

SEQUENCE
  quickSort(0, LENGTH(arr) - 1)
END`,
    blanks: [
      ['>', '=='],
      ['>', '=='],
      ['p', 'p - 2'],
    ],
    bug: {
      find: 'j = low',
      replace: 'j = low + 1',
      fixes: ['j = high', 'j = i + 1'],
      why: 'The partition skipped the first cell of its range, so a value there was never placed on the correct side of the pivot.',
    },
    core: { first: 'pivot = arr[high]', last: 'RETURN i' },
    hints: [
      'Partition: walk j across the range and keep every value smaller than the pivot at the front (i marks where the next one goes). Finally swap the pivot into position i: everything left of it is smaller.',
      'IF arr[j] < pivot, SWAP arr[i] arr[j] and i = i + 1.',
    ],
    visible: [{ arr: [10, 80, 30, 90, 40, 50, 70] }, { arr: [5, 2, 9, 1, 6] }, { arr: [3, 3, 1] }],
    hidden: [...SORT_HIDDEN, { category: 'edge case: already sorted', input: { arr: [1, 2, 3, 4, 5] } }],
    preview: { arr: [3, 1, 2] },
    expect: (input) => [{ kind: 'array', name: 'arr', value: [...nums(input, 'arr')].sort((a, b) => a - b) }],
  },
];
