import type { Kernel } from '../types';
import { num, nums } from './ref';

function josephus(people: number[], k: number): number {
  const q = [...people];
  while (q.length > 1) {
    for (let pass = 1; pass < k; pass++) q.push(q.shift()!);
    q.shift();
  }
  return q[0];
}

export const QUEUE_KERNELS: Kernel[] = [
  {
    id: 'queue-rotate',
    title: 'Rotate a queue',
    topic: 'Queues',
    difficulty: 'Easy',
    goal: 'Move the front value of q to the rear, k times.',
    source: `SCENE RotateQueue

DECLARE
  QUEUE q = {{q}}

SEQUENCE
  k = {{k}}
  turn = 0
  WHILE turn < k AND LENGTH(q) > 0
    moving = [[DEQUEUE(q)]]
    ENQUEUE q [[moving]]
    turn = turn + 1
  END
END`,
    blanks: [
      ['FRONT(q)', 'REAR(q)'],
      ['k', 'turn'],
    ],
    bug: {
      find: 'WHILE turn < k AND LENGTH(q) > 0',
      replace: 'WHILE turn <= k AND LENGTH(q) > 0',
      fixes: ['WHILE turn < k - 1 AND LENGTH(q) > 0', 'WHILE turn > k AND LENGTH(q) > 0'],
      why: 'With <= the loop ran k + 1 times, so the queue was rotated one step too far.',
    },
    core: { first: 'turn = 0', last: 'END' },
    hints: ['A rotation takes the value at the front out of the queue and puts it straight back in at the rear.', 'moving = DEQUEUE(q), then ENQUEUE q moving.'],
    visible: [
      { q: [1, 2, 3, 4, 5], k: 2 },
      { q: [10, 20, 30], k: 1 },
      { q: [7, 8, 9, 6], k: 3 },
    ],
    hidden: [
      { category: 'edge case: no rotation', input: { q: [1, 2, 3], k: 0 } },
      { category: 'edge case: more rotations than values', input: { q: [1, 2, 3], k: 7 } },
      { category: 'edge case: empty queue', input: { q: [], k: 2 } },
    ],
    preview: { q: [1, 2, 3], k: 1 },
    expect: (input) => {
      const q = [...nums(input, 'q')];
      for (let t = 0; t < num(input, 'k') && q.length > 0; t++) q.push(q.shift()!);
      return [{ kind: 'queue', name: 'q', value: q }];
    },
  },
  {
    id: 'queue-josephus',
    title: 'Hot potato (Josephus)',
    topic: 'Queues',
    difficulty: 'Medium',
    goal: 'People stand in a circle. Pass the potato k - 1 times, then the one holding it is out. Leave the last one standing in survivor.',
    source: `SCENE HotPotato

DECLARE
  QUEUE circle = {{people}}

SEQUENCE
  k = {{k}}
  WHILE LENGTH(circle) > [[1]]
    pass = 1
    WHILE pass < [[k]]
      person = DEQUEUE(circle)
      ENQUEUE circle person
      pass = pass + 1
    END
    gone = DEQUEUE(circle)
  END
  survivor = FRONT(circle)
END`,
    blanks: [
      ['0', '2'],
      ['k - 1', 'k + 1'],
    ],
    bug: {
      find: 'gone = DEQUEUE(circle)',
      replace: 'gone = FRONT(circle)',
      fixes: ['gone = REAR(circle)', 'gone = LENGTH(circle)'],
      why: 'FRONT only looks at the front; nobody ever left the circle, so the game never ended.',
    },
    core: { first: 'WHILE LENGTH(circle) > 1', last: 'END' },
    hints: [
      'Passing the potato is moving the front person to the rear. After k - 1 passes the person at the front is out: dequeue them for good.',
      'Inside: WHILE pass < k, move the front to the rear. Then gone = DEQUEUE(circle).',
    ],
    inputNote: 'people is never empty.',
    visible: [
      { people: [1, 2, 3, 4, 5, 6, 7], k: 3 },
      { people: [1, 2, 3, 4, 5], k: 2 },
      { people: [10, 20, 30], k: 1 },
    ],
    hidden: [
      { category: 'edge case: one person', input: { people: [9], k: 4 } },
      { category: 'edge case: k larger than the circle', input: { people: [1, 2, 3], k: 5 } },
    ],
    preview: { people: [1, 2, 3], k: 2 },
    expect: (input) => {
      const s = josephus(nums(input, 'people'), num(input, 'k'));
      return [
        { kind: 'var', name: 'survivor', value: s },
        { kind: 'queue', name: 'circle', value: [s] },
      ];
    },
  },
  {
    id: 'queue-reverse',
    title: 'Reverse a queue',
    topic: 'Queues',
    difficulty: 'Easy',
    goal: 'Reverse the queue q using the stack s. The stack must end empty.',
    source: `SCENE ReverseQueue

DECLARE
  QUEUE q = {{q}}
  STACK s = []

SEQUENCE
  WHILE LENGTH(q) > 0
    x = DEQUEUE(q)
    PUSH s x
  END
  WHILE [[LENGTH(s) > 0]]
    y = [[POP(s)]]
    ENQUEUE q y
  END
END`,
    blanks: [
      ['LENGTH(s) > 1', 'LENGTH(q) > 0'],
      ['PEEK(s)', 'FRONT(q)'],
    ],
    bug: {
      find: 'x = DEQUEUE(q)',
      replace: 'x = FRONT(q)',
      fixes: ['x = REAR(q)', 'x = POP(s)'],
      why: 'FRONT reads the front without removing it, so the queue never emptied and the first loop never ended.',
    },
    core: { first: 'WHILE LENGTH(q) > 0', last: 'END', nth: 2 },
    hints: ['Empty the queue onto a stack, front first; then empty the stack back into the queue. The stack turns the order around.', 'WHILE LENGTH(s) > 0, y = POP(s), ENQUEUE q y.'],
    visible: [{ q: [1, 2, 3, 4] }, { q: [5, 9] }, { q: [8, 6, 7, 5, 3] }],
    hidden: [
      { category: 'edge case: empty queue', input: { q: [] } },
      { category: 'edge case: one value', input: { q: [4] } },
    ],
    preview: { q: [1, 2, 3] },
    expect: (input) => [
      { kind: 'queue', name: 'q', value: [...nums(input, 'q')].reverse() },
      { kind: 'stack', name: 's', value: [] },
    ],
  },
];
