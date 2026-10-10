import type { Kernel } from '../types';
import { num, nums, siftDown, siftUp } from './ref';

const SIFT_DOWN = `  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(h)
    sifting = TRUE
    WHILE sifting == TRUE
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        COMPARE h[left] h[smallest]
        IF h[left] < h[smallest]
          smallest = left
        END
      END
      IF right < size
        COMPARE h[right] h[smallest]
        IF h[right] < h[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        sifting = FALSE
      ELSE
        SWAP h[parent] h[smallest]
        parent = smallest
      END
    END
  END`;

export const HEAP_KERNELS: Kernel[] = [
  {
    id: 'heap-insert',
    title: 'Min-heap insert',
    topic: 'Heaps',
    difficulty: 'Medium',
    goal: 'Add value to the min-heap h and sift it up until its parent is no larger.',
    source: `SCENE MinHeapInsert

DECLARE
  HEAP h = {{heap}}

  FUNCTION siftUp(start)
    child = start
    climbing = TRUE
    WHILE climbing == TRUE AND child > 0
      parent = (child - 1 - (child - 1) % 2) / 2
      COMPARE h[child] h[parent]
      IF h[child] [[<]] h[parent]
        SWAP h[child] h[parent]
        child = [[parent]]
      ELSE
        climbing = FALSE
      END
    END
  END

SEQUENCE
  INSERT h {{value}}
  siftUp(LENGTH(h) - 1)
END`,
    blanks: [
      ['>', '=='],
      ['child - 1', '0'],
    ],
    bug: {
      find: 'parent = (child - 1 - (child - 1) % 2) / 2',
      replace: 'parent = (child - child % 2) / 2',
      fixes: ['parent = child - 1', 'parent = 2 * child + 1'],
      why: 'The parent of index i is (i - 1) / 2 rounded down; using i / 2 compared some nodes with their sibling’s subtree instead of their parent.',
    },
    core: { first: 'WHILE climbing == TRUE AND child > 0', last: 'END' },
    hints: [
      'A new value goes in the next free cell, at the bottom of the tree. While it is smaller than its parent, swap the two: it climbs until the heap order holds again.',
      'IF h[child] < h[parent], SWAP h[child] h[parent] and child = parent.',
    ],
    inputNote: 'h is a valid min-heap (each parent is no larger than its children).',
    visible: [
      { heap: [10, 20, 15, 30, 40], value: 5 },
      { heap: [1, 3, 6, 5, 9, 8], value: 4 },
      { heap: [2, 7], value: 9 },
    ],
    hidden: [
      { category: 'edge case: empty heap', input: { heap: [], value: 3 } },
      { category: 'edge case: new smallest value', input: { heap: [4, 8, 6, 9, 12, 7, 10], value: 1 } },
    ],
    preview: { heap: [2, 5], value: 1 },
    expect: (input) => {
      const h = [...nums(input, 'heap'), num(input, 'value')];
      siftUp(h, h.length - 1);
      return [{ kind: 'array', name: 'h', value: h }];
    },
  },
  {
    id: 'heap-extract-min',
    title: 'Min-heap extract',
    topic: 'Heaps',
    difficulty: 'Hard',
    goal: 'Remove the smallest value from the min-heap h into smallest: move the last cell to the root, then sift it down.',
    source: `SCENE ExtractMin

DECLARE
  HEAP h = {{heap}}

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(h)
    sifting = TRUE
    WHILE sifting == TRUE
      smallest = parent
      left = [[2 * parent + 1]]
      right = 2 * parent + 2
      IF left < size
        COMPARE h[left] h[smallest]
        IF h[left] [[<]] h[smallest]
          smallest = left
        END
      END
      IF right < size
        COMPARE h[right] h[smallest]
        IF h[right] < h[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        sifting = FALSE
      ELSE
        SWAP h[parent] h[smallest]
        parent = [[smallest]]
      END
    END
  END

SEQUENCE
  smallest = h[0]
  last = LENGTH(h) - 1
  h[0] = h[last]
  DELETE h[last]
  siftDown(0)
END`,
    blanks: [
      ['2 * parent', 'parent + 1'],
      ['>', '=='],
      ['left', 'parent + 1'],
    ],
    bug: {
      find: 'right = 2 * parent + 2',
      replace: 'right = 2 * parent + 1',
      fixes: ['right = left', 'right = 2 * parent'],
      why: 'right pointed at the left child again, so a smaller right child was never swapped up.',
    },
    core: { first: 'IF left < size', last: 'END', nth: 2 },
    hints: [
      'After the last value is moved to the root it is probably too big. Swap it with its smaller child while that child is smaller than it.',
      'Children of index p are 2 * p + 1 and 2 * p + 2; pick the smaller of the two, and swap if it is smaller than h[p].',
    ],
    inputNote: 'h is a valid, non-empty min-heap.',
    visible: [{ heap: [5, 9, 8, 17, 12, 11, 20, 25] }, { heap: [1, 4, 2, 7, 5, 3] }, { heap: [3, 6] }],
    hidden: [
      { category: 'edge case: one value', input: { heap: [8] } },
      { category: 'edge case: duplicates', input: { heap: [2, 2, 3, 2, 4] } },
    ],
    preview: { heap: [1, 3, 2] },
    expect: (input) => {
      const h = [...nums(input, 'heap')];
      const smallest = h[0];
      const last = h.pop()!;
      if (h.length > 0) {
        h[0] = last;
        siftDown(h, 0);
      }
      return [
        { kind: 'var', name: 'smallest', value: smallest },
        { kind: 'array', name: 'h', value: h },
      ];
    },
  },
  {
    id: 'heap-check',
    title: 'Is it a min-heap?',
    topic: 'Heaps',
    difficulty: 'Easy',
    goal: 'Leave TRUE in ok when every parent in h is no larger than its children, FALSE otherwise.',
    source: `SCENE IsMinHeap

DECLARE
  HEAP h = {{heap}}

SEQUENCE
  ok = TRUE
  i = [[1]]
  WHILE i < LENGTH(h) AND ok == TRUE
    parent = (i - 1 - (i - 1) % 2) / 2
    COMPARE h[parent] h[i]
    IF h[parent] [[>]] h[i]
      ok = FALSE
      HIGHLIGHT h[i] 'DISCARDED'
    END
    i = i + 1
  END
END`,
    blanks: [
      ['2', 'LENGTH(h)'],
      ['<', '>='],
    ],
    bug: {
      find: 'i = i + 1',
      replace: 'i = i + 2',
      fixes: ['i = i', 'i = 2 * i'],
      why: 'Stepping by two only checked the left children; a right child smaller than its parent went unnoticed.',
    },
    core: { first: 'WHILE i < LENGTH(h) AND ok == TRUE', last: 'END' },
    hints: ['Check every cell except the root against its parent, (i - 1) / 2 rounded down.', 'IF h[parent] > h[i], ok = FALSE.'],
    visible: [{ heap: [1, 3, 2, 7, 4] }, { heap: [5, 9, 4] }, { heap: [2, 4, 6, 3] }],
    hidden: [
      { category: 'edge case: empty heap', input: { heap: [] } },
      { category: 'edge case: equal values', input: { heap: [3, 3, 3] } },
      { category: 'edge case: violation at a right child', input: { heap: [1, 2, 5, 4, 3, 6, 0] } },
      { category: 'edge case: violation right under the root', input: { heap: [4, 1, 6] } },
    ],
    preview: { heap: [1, 2, 3] },
    expect: (input) => {
      const h = nums(input, 'heap');
      const ok = h.every((v, i) => i === 0 || h[(i - 1 - ((i - 1) % 2)) / 2] <= v);
      return [{ kind: 'var', name: 'ok', value: ok }];
    },
  },
  {
    id: 'heap-build',
    title: 'Build a heap (bottom up)',
    topic: 'Heaps',
    difficulty: 'Hard',
    goal: 'Turn h into a min-heap in place by sifting down every parent, from the last one back to the root.',
    source: `SCENE BuildHeap

DECLARE
  HEAP h = {{heap}}

${SIFT_DOWN}

SEQUENCE
  n = LENGTH(h)
  i = [[(n - n % 2) / 2 - 1]]
  WHILE i [[>=]] 0
    siftDown(i)
    i = i - 1
  END
END`,
    blanks: [
      ['0', '1'],
      ['>', '<='],
    ],
    bug: {
      find: 'i = i - 1',
      replace: 'i = i - 2',
      fixes: ['i = 0', 'i = i'],
      why: 'Stepping back by two skipped every other parent, so some subtrees were never put in heap order.',
    },
    core: { first: 'n = LENGTH(h)', last: 'END' },
    hints: [
      'Leaves are already heaps. Starting from the last parent and moving towards the root, sift each parent down: when you reach a node, both its subtrees are heaps already.',
      'The last parent is (n / 2 rounded down) - 1. WHILE i >= 0: siftDown(i), i = i - 1.',
    ],
    visible: [{ heap: [9, 4, 7, 1, 8, 2] }, { heap: [5, 3, 8, 1] }, { heap: [10, 9, 8, 7, 6, 5, 4] }],
    hidden: [
      { category: 'edge case: empty array', input: { heap: [] } },
      { category: 'edge case: already a heap', input: { heap: [1, 2, 3, 4] } },
    ],
    preview: { heap: [3, 1, 2] },
    expect: (input) => {
      const h = [...nums(input, 'heap')];
      for (let i = (h.length - (h.length % 2)) / 2 - 1; i >= 0; i--) siftDown(h, i);
      return [{ kind: 'array', name: 'h', value: h }];
    },
  },
];
