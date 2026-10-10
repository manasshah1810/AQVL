import type { Kernel } from '../types';
import { num, nums, strs } from './ref';

function twoSum(arr: number[], target: number): [number, number] {
  const seen = new Map<number, number>();
  for (let i = 0; i < arr.length; i++) {
    const need = target - arr[i];
    if (seen.has(need)) return [seen.get(need)!, i];
    seen.set(arr[i], i);
  }
  return [-1, -1];
}

export const HASHMAP_KERNELS: Kernel[] = [
  {
    id: 'map-word-count',
    title: 'Count words',
    topic: 'Hash Maps',
    difficulty: 'Easy',
    goal: 'Store in freq how many times each word of words appears.',
    source: `SCENE WordCount

DECLARE
  HASH_MAP freq
  ARRAY words = {{words}}

SEQUENCE
  i = 0
  WHILE i < LENGTH(words)
    w = words[i]
    HIGHLIGHT words[i]
    IF [[CONTAINS(freq, w)]]
      freq[w] = [[freq[w] + 1]]
    ELSE
      freq[w] = [[1]]
    END
    i = i + 1
  END
END`,
    blanks: [
      ['CONTAINS(freq, i)', 'LENGTH(freq) > 0'],
      ['freq[w]', 'i + 1'],
      ['0', 'i'],
    ],
    bug: {
      find: 'w = words[i]',
      replace: 'w = words[0]',
      fixes: ['w = words[i + 1]', 'w = i'],
      why: 'Every round looked at the first word, so it was counted once per word and nothing else was counted.',
    },
    core: { first: 'WHILE i < LENGTH(words)', last: 'END' },
    hints: ['A word seen before gets its count raised by one; a new word starts at one.', 'IF CONTAINS(freq, w), freq[w] = freq[w] + 1; ELSE freq[w] = 1.'],
    visible: [{ words: ['the', 'cat', 'the', 'hat'] }, { words: ['a', 'b', 'a', 'b', 'a'] }, { words: ['one', 'two', 'three'] }],
    hidden: [
      { category: 'edge case: no words', input: { words: [] } },
      { category: 'edge case: one word repeated', input: { words: ['go', 'go', 'go'] } },
    ],
    preview: { words: ['x', 'y', 'x'] },
    expect: (input) => {
      const value: Record<string, number> = {};
      for (const w of strs(input, 'words')) value[w] = (value[w] ?? 0) + 1;
      return [{ kind: 'map', name: 'freq', value }];
    },
  },
  {
    id: 'map-two-sum',
    title: 'Two sum',
    topic: 'Hash Maps',
    difficulty: 'Medium',
    goal: 'Find two different cells of nums adding up to target in one pass: leave their indexes in first and second (-1 and -1 when there are none).',
    source: `SCENE TwoSum

DECLARE
  HASH_MAP seen
  ARRAY nums = {{nums}}

SEQUENCE
  target = {{target}}
  first = -1
  second = -1
  i = 0
  WHILE i < LENGTH(nums) AND first == -1
    HIGHLIGHT nums[i]
    need = target [[-]] nums[i]
    IF CONTAINS(seen, need)
      first = seen[need]
      second = i
    ELSE
      seen[nums[i]] = [[i]]
    END
    i = i + 1
  END
END`,
    blanks: [
      ['+', '*'],
      ['nums[i]', 'need'],
    ],
    bug: {
      find: 'seen[nums[i]] = i',
      replace: 'seen[need] = i',
      fixes: ['seen[i] = nums[i]', 'seen[target] = i'],
      why: 'The map remembered the value still needed instead of the value seen, so a pair was matched against the wrong cells.',
    },
    core: { first: 'WHILE i < LENGTH(nums) AND first == -1', last: 'END' },
    hints: [
      'For each value, the partner it needs is target minus the value. Keep a map from every value seen so far to its index, and check it for the partner before storing the current value.',
      'need = target - nums[i]; IF CONTAINS(seen, need) you have the pair; ELSE seen[nums[i]] = i.',
    ],
    visible: [
      { nums: [2, 7, 11, 15], target: 9 },
      { nums: [3, 2, 4], target: 6 },
      { nums: [1, 5, 8, 3], target: 11 },
    ],
    hidden: [
      { category: 'edge case: no pair', input: { nums: [1, 2, 3], target: 100 } },
      { category: 'edge case: the pair is a repeated value', input: { nums: [3, 3], target: 6 } },
      { category: 'edge case: empty array', input: { nums: [], target: 4 } },
    ],
    preview: { nums: [1, 4, 6], target: 7 },
    expect: (input) => {
      const [first, second] = twoSum(nums(input, 'nums'), num(input, 'target'));
      return [
        { kind: 'var', name: 'first', value: first },
        { kind: 'var', name: 'second', value: second },
      ];
    },
  },
  {
    id: 'map-dedupe',
    title: 'Remove duplicates',
    topic: 'Hash Maps',
    difficulty: 'Easy',
    goal: 'Copy each distinct value of items into unique once, in the order it first appears, using the map seen.',
    source: `SCENE RemoveDuplicates

DECLARE
  HASH_MAP seen
  ARRAY items = {{items}}
  ARRAY unique = []

SEQUENCE
  i = 0
  WHILE i < LENGTH(items)
    x = items[i]
    IF CONTAINS(seen, x) == [[FALSE]]
      seen[x] = 1
      INSERT unique[LENGTH(unique)] [[x]]
    END
    i = i + 1
  END
END`,
    blanks: [
      ['TRUE', 'x'],
      ['i', 'items[0]'],
    ],
    bug: {
      find: 'seen[x] = 1',
      replace: 'seen[i] = 1',
      fixes: ['seen[1] = x', 'unique[x] = 1'],
      why: 'The map stored indexes instead of values, so a repeated value was never recognised as seen.',
    },
    core: { first: 'WHILE i < LENGTH(items)', last: 'END' },
    hints: ['Keep a map of values already copied. Copy a value only when the map does not contain it yet, and add it to the map at the same time.', 'IF CONTAINS(seen, x) == FALSE: seen[x] = 1 and append x to unique.'],
    visible: [{ items: [3, 1, 3, 2, 1] }, { items: ['b', 'a', 'b', 'c'] }, { items: [5, 5, 5, 6] }],
    hidden: [
      { category: 'edge case: empty array', input: { items: [] } },
      { category: 'edge case: already unique', input: { items: [9, 8, 7] } },
    ],
    preview: { items: [1, 2, 1] },
    expect: (input) => {
      const unique = [...new Set(input.items as (number | string)[])];
      const seen: Record<string, number> = {};
      for (const v of unique) seen[String(v)] = 1;
      return [
        { kind: 'array', name: 'unique', value: unique },
        { kind: 'map', name: 'seen', value: seen },
      ];
    },
  },
  {
    id: 'map-remove-low',
    title: 'Remove low stock',
    topic: 'Hash Maps',
    difficulty: 'Medium',
    goal: 'Delete from stock every item whose amount is below limit. Collect the keys first, then delete them.',
    source: `SCENE RemoveLowStock

DECLARE
  HASH_MAP stock = {{stock}}
  ARRAY gone = []

SEQUENCE
  limit = {{limit}}
  i = 0
  WHILE i < LENGTH(stock)
    item = KEY_AT(stock, i)
    IF stock[item] [[<]] limit
      INSERT gone[LENGTH(gone)] item
    END
    i = i + 1
  END
  j = 0
  WHILE j < LENGTH(gone)
    DELETE stock[gone[j]]
    j = [[j + 1]]
  END
END`,
    blanks: [
      ['>', '<='],
      ['j', 'j + 2'],
    ],
    bug: {
      find: 'WHILE i < LENGTH(stock)',
      replace: 'WHILE i < LENGTH(stock) - 1',
      fixes: ['WHILE i <= LENGTH(stock)', 'WHILE i < LENGTH(gone)'],
      why: 'The scan stopped one key early, so the last key in the map was never checked.',
    },
    core: { first: 'WHILE i < LENGTH(stock)', last: 'END' },
    hints: [
      'Deleting from a map while walking it by position would shift the positions under you. So first walk it and remember which keys to remove; then remove them.',
      'IF stock[item] < limit, INSERT gone[LENGTH(gone)] item.',
    ],
    visible: [
      { stock: { apple: 5, pear: 1, fig: 3, kiwi: 0 }, limit: 3 },
      { stock: { a: 10, b: 20 }, limit: 15 },
      { stock: { x: 1, y: 2, z: 3 }, limit: 10 },
    ],
    hidden: [
      { category: 'edge case: nothing below the limit', input: { stock: { a: 4, b: 9 }, limit: 2 } },
      { category: 'edge case: an amount equal to the limit', input: { stock: { a: 3, b: 2, c: 5 }, limit: 3 } },
      { category: 'edge case: empty map', input: { stock: {}, limit: 1 } },
    ],
    preview: { stock: { a: 1, b: 5 }, limit: 3 },
    expect: (input) => {
      const value: Record<string, number> = {};
      for (const [k, v] of Object.entries(input.stock as Record<string, number>)) if (v >= num(input, 'limit')) value[k] = v;
      return [{ kind: 'map', name: 'stock', value }];
    },
  },
];

