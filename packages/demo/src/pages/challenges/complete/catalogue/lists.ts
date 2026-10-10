import type { Kernel } from '../types';
import { num, nums } from './ref';

export const LIST_KERNELS: Kernel[] = [
  {
    id: 'list-reverse',
    title: 'Reverse a linked list',
    topic: 'Linked Lists',
    difficulty: 'Medium',
    goal: 'Reverse list in place by turning every next pointer around.',
    source: `SCENE ReverseLinkedList

DECLARE
  LINKEDLIST list = {{list}}

SEQUENCE
  prev = NULL
  curr = list.head
  WHILE curr != NULL
    nxt = curr.next
    curr.next = [[prev]]
    prev = curr
    curr = [[nxt]]
  END
  list.head = [[prev]]
END`,
    blanks: [
      ['nxt', 'NULL'],
      ['curr.next', 'prev'],
      ['curr', 'nxt'],
    ],
    bug: {
      find: 'prev = curr',
      replace: 'prev = nxt',
      fixes: ['prev = NULL', 'curr = prev'],
      why: 'prev must follow curr; jumping it ahead to nxt pointed every node at the wrong neighbour and broke the chain.',
    },
    core: { first: 'WHILE curr != NULL', last: 'END' },
    hints: [
      'Walk the list with three pointers: prev (already reversed), curr, and nxt (saved before you overwrite curr.next). Point curr back at prev, then move everything one step on.',
      'nxt = curr.next, curr.next = prev, prev = curr, curr = nxt.',
    ],
    visible: [{ list: [1, 2, 3, 4, 5] }, { list: [10, 20] }, { list: [7, 3, 9] }],
    hidden: [
      { category: 'edge case: empty list', input: { list: [] } },
      { category: 'edge case: one node', input: { list: [42] } },
    ],
    preview: { list: [1, 2, 3] },
    expect: (input) => [{ kind: 'list', name: 'list', value: [...nums(input, 'list')].reverse() }],
  },
  {
    id: 'list-insert-tail',
    title: 'Append at the tail',
    topic: 'Linked Lists',
    difficulty: 'Easy',
    goal: 'Add a new node holding value at the end of list (which may be empty), by walking to the last node.',
    source: `SCENE AppendAtTail

DECLARE
  LINKEDLIST list = {{list}}

SEQUENCE
  value = {{value}}
  n = NEW_NODE(list, value)
  IF [[list.head]] == NULL
    list.head = n
  ELSE
    curr = list.head
    WHILE [[curr.next != NULL]]
      curr = curr.next
    END
    [[curr.next]] = n
  END
END`,
    blanks: [
      ['n', 'list.head.next'],
      ['curr != NULL', 'curr.next == NULL'],
      ['curr', 'list.head'],
    ],
    bug: {
      find: 'WHILE curr.next != NULL',
      replace: 'WHILE curr != NULL',
      fixes: ['WHILE curr.next == NULL', 'WHILE list.head != NULL'],
      why: 'The walk went one node too far, off the end of the list, so curr was NULL when the new node was linked: a NULL pointer dereference.',
    },
    core: { first: 'curr = list.head', last: 'curr.next = n' },
    hints: ['An empty list just gets the new node as its head. Otherwise walk until the node whose next is NULL: that is the tail.', 'WHILE curr.next != NULL, curr = curr.next. Then curr.next = n.'],
    visible: [
      { list: [1, 2, 3], value: 4 },
      { list: [5], value: 9 },
      { list: [8, 6, 7, 5], value: 3 },
    ],
    hidden: [
      { category: 'edge case: empty list', input: { list: [], value: 1 } },
      { category: 'edge case: longer list', input: { list: [1, 2, 3, 4, 5, 6, 7], value: 8 } },
    ],
    preview: { list: [1, 2], value: 3 },
    expect: (input) => [{ kind: 'list', name: 'list', value: [...nums(input, 'list'), num(input, 'value')] }],
  },
  {
    id: 'list-delete-value',
    title: 'Delete a value',
    topic: 'Linked Lists',
    difficulty: 'Medium',
    goal: 'Unlink and free the first node whose value is target (if there is one).',
    source: `SCENE DeleteValue

DECLARE
  LINKEDLIST list = {{list}}

SEQUENCE
  target = {{target}}
  IF list.head != NULL
    IF list.head.val == target
      old = list.head
      list.head = old.next
      FREE old
    ELSE
      prev = list.head
      curr = prev.next
      WHILE curr != NULL AND curr.val [[!=]] target
        prev = curr
        curr = curr.next
      END
      IF curr != NULL
        prev.next = [[curr.next]]
        FREE curr
      END
    END
  END
END`,
    blanks: [
      ['==', '<'],
      ['NULL', 'prev'],
    ],
    bug: {
      find: 'prev.next = curr.next',
      replace: 'prev.next = curr.next.next',
      fixes: ['prev.next = curr', 'curr.next = prev.next'],
      why: 'The link skipped two nodes instead of one, dropping the node after the target too (and dereferencing NULL at the end of the list).',
    },
    core: { first: 'prev = list.head', last: 'END', nth: 2 },
    hints: [
      'To unlink a node you need the node before it. Walk prev and curr together until curr holds the target, then make prev skip over curr.',
      'prev.next = curr.next, then FREE curr.',
    ],
    visible: [
      { list: [1, 2, 3, 4], target: 3 },
      { list: [5, 6, 7], target: 5 },
      { list: [8, 9], target: 4 },
    ],
    hidden: [
      { category: 'edge case: empty list', input: { list: [], target: 2 } },
      { category: 'edge case: target is the last node', input: { list: [1, 2, 3], target: 3 } },
      { category: 'edge case: target appears twice', input: { list: [4, 1, 4], target: 4 } },
    ],
    preview: { list: [1, 2, 3], target: 2 },
    expect: (input) => {
      const list = [...nums(input, 'list')];
      const at = list.indexOf(num(input, 'target'));
      if (at >= 0) list.splice(at, 1);
      return [{ kind: 'list', name: 'list', value: list }];
    },
  },
  {
    id: 'list-middle',
    title: 'Find the middle node',
    topic: 'Linked Lists',
    difficulty: 'Medium',
    goal: 'Leave the value of the middle node in middle (the second middle when there are two), using a slow and a fast pointer.',
    source: `SCENE MiddleNode

DECLARE
  LINKEDLIST list = {{list}}

SEQUENCE
  slow = list.head
  fast = list.head
  WHILE fast != NULL AND fast.next != NULL
    slow = [[slow.next]]
    fast = [[fast.next.next]]
  END
  middle = slow.val
END`,
    blanks: [
      ['fast.next', 'slow'],
      ['fast.next', 'slow.next'],
    ],
    bug: {
      find: 'WHILE fast != NULL AND fast.next != NULL',
      replace: 'WHILE fast.next != NULL AND fast.next.next != NULL',
      fixes: ['WHILE fast != NULL OR fast.next != NULL', 'WHILE fast != NULL'],
      why: 'Stopping while fast still had two nodes ahead left slow on the first of the two middles, one node short.',
    },
    core: { first: 'slow = list.head', last: 'END' },
    hints: ['Move slow one node and fast two nodes at a time. When fast runs off the end, slow is in the middle.', 'WHILE fast != NULL AND fast.next != NULL: slow = slow.next, fast = fast.next.next.'],
    inputNote: 'list is never empty.',
    visible: [{ list: [1, 2, 3, 4, 5] }, { list: [1, 2, 3, 4, 5, 6] }, { list: [7, 8] }],
    hidden: [
      { category: 'edge case: one node', input: { list: [9] } },
      { category: 'a longer list', input: { list: [2, 4, 6, 8, 10, 12, 14, 16, 18] } },
    ],
    preview: { list: [1, 2, 3] },
    expect: (input) => {
      const list = nums(input, 'list');
      return [{ kind: 'var', name: 'middle', value: list[(list.length - (list.length % 2)) / 2] }];
    },
  },
  {
    id: 'dlist-insert-head',
    title: 'Insert at the head (doubly linked)',
    topic: 'Linked Lists',
    difficulty: 'Easy',
    goal: 'Put a new node holding value in front of the doubly linked list, with both its next and prev pointers right.',
    source: `SCENE DoublyInsertHead

DECLARE
  DOUBLY LINKEDLIST list = {{list}}

SEQUENCE
  value = {{value}}
  n = NEW_NODE(list, value)
  n.next = [[list.head]]
  IF list.head != NULL
    list.head.prev = [[n]]
  END
  list.head = n
END`,
    blanks: [
      ['NULL', 'n.prev'],
      ['NULL', 'list.head.next'],
    ],
    bug: {
      find: 'list.head = n',
      replace: 'list.head = n.next',
      fixes: ['n = list.head', 'list.head.next = n'],
      why: 'The head was never moved to the new node, so it was linked to the list but not part of it.',
    },
    core: { first: 'n.next = list.head', last: 'list.head = n' },
    hints: ['The new node points forward at the old head; the old head (if any) points back at the new node; then the list starts at the new node.', 'n.next = list.head; list.head.prev = n; list.head = n.'],
    visible: [
      { list: [2, 3, 4], value: 1 },
      { list: [9], value: 8 },
      { list: [5, 6], value: 4 },
    ],
    hidden: [
      { category: 'edge case: empty list', input: { list: [], value: 7 } },
      { category: 'a longer list', input: { list: [2, 3, 4, 5, 6], value: 1 } },
    ],
    preview: { list: [2, 3], value: 1 },
    expect: (input) => [{ kind: 'dlist', name: 'list', value: [num(input, 'value'), ...nums(input, 'list')] }],
  },
  {
    id: 'dlist-reverse',
    title: 'Reverse a doubly linked list',
    topic: 'Linked Lists',
    difficulty: 'Medium',
    goal: 'Reverse the doubly linked list by swapping every node’s next and prev pointers.',
    source: `SCENE DoublyReverse

DECLARE
  DOUBLY LINKEDLIST list = {{list}}

SEQUENCE
  curr = list.head
  newHead = NULL
  WHILE curr != NULL
    nxt = curr.next
    curr.next = [[curr.prev]]
    curr.prev = [[nxt]]
    newHead = curr
    curr = nxt
  END
  list.head = newHead
END`,
    blanks: [
      ['nxt', 'NULL'],
      ['NULL', 'newHead'],
    ],
    bug: {
      find: 'curr = nxt',
      replace: 'curr = curr.next',
      fixes: ['curr = newHead', 'curr = NULL'],
      why: 'After the swap, curr.next is the old prev pointer, so the walk turned back instead of moving on and stopped after one node.',
    },
    core: { first: 'WHILE curr != NULL', last: 'END' },
    hints: ['Reversing a doubly linked list is swapping next and prev on every node. Save the old next first, it is where you go after the swap.', 'nxt = curr.next, curr.next = curr.prev, curr.prev = nxt.'],
    visible: [{ list: [1, 2, 3, 4] }, { list: [10, 20] }, { list: [5, 4, 3, 2, 1] }],
    hidden: [
      { category: 'edge case: empty list', input: { list: [] } },
      { category: 'edge case: one node', input: { list: [3] } },
    ],
    preview: { list: [1, 2, 3] },
    expect: (input) => [{ kind: 'dlist', name: 'list', value: [...nums(input, 'list')].reverse() }],
  },
  {
    id: 'clist-count',
    title: 'Count a circular list',
    topic: 'Linked Lists',
    difficulty: 'Easy',
    goal: 'Leave in count the number of nodes of the circular list ring (whose last node points back to the head).',
    source: `SCENE CountCircular

DECLARE
  CIRCULAR LINKEDLIST ring = {{ring}}

SEQUENCE
  count = 0
  IF ring.head != NULL
    curr = ring.head
    count = [[1]]
    WHILE [[curr.next]] != ring.head
      count = count + 1
      curr = [[curr.next]]
    END
  END
END`,
    blanks: [
      ['0', '2'],
      ['curr', 'ring.head.next'],
      ['ring.head', 'curr'],
    ],
    bug: {
      find: 'WHILE curr.next != ring.head',
      replace: 'WHILE curr.next != NULL',
      fixes: ['WHILE curr != ring.head', 'WHILE curr.next == ring.head'],
      why: 'A circular list never reaches NULL: the walk went round and round and never stopped.',
    },
    core: { first: 'curr = ring.head', last: 'END' },
    hints: ['In a circular list the last node points back at the head instead of NULL. Count until you are about to come back round.', 'WHILE curr.next != ring.head: count = count + 1, curr = curr.next.'],
    visible: [{ ring: [1, 2, 3, 4] }, { ring: [7, 8] }, { ring: [5, 5, 5] }],
    hidden: [
      { category: 'edge case: empty list', input: { ring: [] } },
      { category: 'edge case: one node', input: { ring: [6] } },
    ],
    preview: { ring: [1, 2, 3] },
    expect: (input) => [{ kind: 'var', name: 'count', value: nums(input, 'ring').length }],
  },
];
