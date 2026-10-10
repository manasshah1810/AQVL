import type { Kernel } from '../types';
import { nums, strs } from './ref';

function balanced(chars: string[]): boolean {
  const open: string[] = [];
  for (const ch of chars) {
    if (ch === '(' || ch === '[') open.push(ch);
    else {
      const top = open.pop();
      if (top === undefined) return false;
      if (ch === ')' && top !== '(') return false;
      if (ch === ']' && top !== '[') return false;
    }
  }
  return open.length === 0;
}

export const STACK_KERNELS: Kernel[] = [
  {
    id: 'stack-balanced',
    title: 'Balanced brackets',
    topic: 'Stacks',
    difficulty: 'Medium',
    goal: 'Leave TRUE in ok when every bracket in text is closed by the matching kind in the right order, FALSE otherwise.',
    source: `SCENE BalancedBrackets

DECLARE
  ARRAY text = {{text}}
  STACK open = []

SEQUENCE
  ok = TRUE
  i = 0
  WHILE i < LENGTH(text) AND ok == TRUE
    ch = text[i]
    HIGHLIGHT text[i]
    IF ch == "(" OR ch == "["
      PUSH open ch
    ELSE IF [[IS_EMPTY(open)]]
      ok = FALSE
    ELSE
      closes = [[POP(open)]]
      IF ch == ")" AND closes != "("
        ok = FALSE
      END
      IF ch == "]" AND closes != "["
        ok = FALSE
      END
    END
    i = i + 1
  END
  IF [[LENGTH(open) > 0]]
    ok = FALSE
  END
END`,
    blanks: [
      ['LENGTH(open) > 0', 'ok == FALSE'],
      ['PEEK(open)', 'ch'],
      ['LENGTH(open) == 0', 'ok == TRUE'],
    ],
    bug: {
      find: 'IF ch == ")" AND closes != "("',
      replace: 'IF ch == ")" AND closes != "["',
      fixes: ['IF ch == "(" AND closes != "("', 'IF ch == ")" AND closes == "("'],
      why: 'A ) was checked against [ instead of (, so correct pairs were rejected and mismatched ones accepted.',
    },
    core: { first: 'IF ch == "(" OR ch == "["', last: 'END' },
    hints: [
      'Push every opening bracket. A closing bracket must match the most recent unclosed one: pop it and compare. At the end, nothing may be left open.',
      'ELSE IF IS_EMPTY(open), ok = FALSE: a closing bracket with nothing open.',
    ],
    inputNote: 'text is a list of single bracket characters.',
    visible: [{ text: ['(', '[', ']', ')'] }, { text: ['(', ']'] }, { text: ['(', '(', ')'] }],
    hidden: [
      { category: 'edge case: empty text', input: { text: [] } },
      { category: 'edge case: closing before opening', input: { text: [')', '('] } },
      { category: 'edge case: interleaved pairs', input: { text: ['(', '[', ')', ']'] } },
      { category: 'edge case: a round bracket closing a square one', input: { text: ['[', ')'] } },
    ],
    preview: { text: ['(', ')'] },
    expect: (input) => [{ kind: 'var', name: 'ok', value: balanced(strs(input, 'text')) }],
  },
  {
    id: 'stack-reverse',
    title: 'Reverse with a stack',
    topic: 'Stacks',
    difficulty: 'Easy',
    goal: 'Reverse arr by pushing every value onto the stack helper and popping them back. The stack must end empty.',
    source: `SCENE ReverseWithStack

DECLARE
  ARRAY arr = {{arr}}
  STACK helper = []

SEQUENCE
  i = 0
  WHILE i < LENGTH(arr)
    HIGHLIGHT arr[i]
    PUSH helper arr[i]
    i = i + 1
  END
  k = 0
  WHILE [[LENGTH(helper) > 0]]
    value = [[POP(helper)]]
    UPDATE arr[k] value
    k = k + 1
  END
END`,
    blanks: [
      ['LENGTH(helper) > 1', 'IS_EMPTY(helper)'],
      ['PEEK(helper)', 'arr[k]'],
    ],
    bug: {
      find: 'PUSH helper arr[i]',
      replace: 'PUSH helper arr[0]',
      fixes: ['PUSH helper i', 'PUSH helper arr[LENGTH(arr) - 1]'],
      why: 'Every push copied the first cell, so the array came back filled with one value.',
    },
    core: { first: 'k = 0', last: 'END' },
    hints: ['A stack gives values back in the opposite order: the last one pushed is the first one popped.', 'WHILE LENGTH(helper) > 0, value = POP(helper), then UPDATE arr[k] value.'],
    visible: [{ arr: [10, 20, 30, 40, 50] }, { arr: ['H', 'E', 'Y'] }, { arr: [1, 2] }],
    hidden: [
      { category: 'edge case: empty array', input: { arr: [] } },
      { category: 'edge case: one element', input: { arr: [5] } },
    ],
    preview: { arr: [1, 2, 3] },
    expect: (input) => [
      { kind: 'array', name: 'arr', value: [...(input.arr as (number | string)[])].reverse() },
      { kind: 'stack', name: 'helper', value: [] },
    ],
  },
  {
    id: 'stack-next-greater',
    title: 'Next greater element',
    topic: 'Stacks',
    difficulty: 'Hard',
    goal: 'For every cell, store in answer the first larger value to its right, or -1 when there is none.',
    source: `SCENE NextGreater

DECLARE
  ARRAY arr = {{arr}}
  ARRAY answer = []
  STACK waiting = []

SEQUENCE
  i = 0
  WHILE i < LENGTH(arr)
    INSERT answer[i] -1
    i = i + 1
  END
  i = 0
  WHILE i < LENGTH(arr)
    WHILE LENGTH(waiting) > 0 AND arr[PEEK(waiting)] [[<]] arr[i]
      j = POP(waiting)
      UPDATE answer[j] arr[i]
    END
    PUSH waiting [[i]]
    i = i + 1
  END
END`,
    blanks: [
      ['>', '<='],
      ['arr[i]', 'i + 1'],
    ],
    bug: {
      find: 'UPDATE answer[j] arr[i]',
      replace: 'UPDATE answer[j] arr[j]',
      fixes: ['UPDATE answer[i] arr[i]', 'UPDATE answer[j] i'],
      why: 'Each waiting cell was given its own value instead of the larger value that just arrived.',
    },
    core: { first: 'WHILE LENGTH(waiting) > 0 AND arr[PEEK(waiting)] < arr[i]', last: 'END' },
    hints: [
      'The stack holds the indexes still waiting for a larger value, their values decreasing from bottom to top. A new value answers every waiting index whose value is smaller, starting from the top.',
      'WHILE LENGTH(waiting) > 0 AND arr[PEEK(waiting)] < arr[i]: j = POP(waiting), UPDATE answer[j] arr[i].',
    ],
    visible: [{ arr: [4, 5, 2, 25] }, { arr: [13, 7, 6, 12] }, { arr: [1, 3, 2, 4] }],
    hidden: [
      { category: 'edge case: decreasing values', input: { arr: [5, 4, 3] } },
      { category: 'edge case: equal neighbours', input: { arr: [2, 2, 3] } },
      { category: 'edge case: empty array', input: { arr: [] } },
    ],
    preview: { arr: [2, 1, 3] },
    expect: (input) => {
      const arr = nums(input, 'arr');
      return [
        {
          kind: 'array',
          name: 'answer',
          value: arr.map((v, i) => arr.slice(i + 1).find((w) => w > v) ?? -1),
        },
      ];
    },
  },
];
