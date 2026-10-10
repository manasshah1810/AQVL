import type { Kernel } from '../types';
import { bstFrom, bstInsert, height, inorder, leaves, levelsOf, num, nums, treeFromLevels, type TreeNode } from './ref';

const treeOf = (input: Record<string, unknown>) => treeFromLevels((input.tree as (number | null)[]) ?? []);

function levelOrder(root: TreeNode | null): number[] {
  const out: number[] = [];
  const q = root ? [root] : [];
  while (q.length > 0) {
    const n = q.shift()!;
    out.push(n.val);
    if (n.left) q.push(n.left);
    if (n.right) q.push(n.right);
  }
  return out;
}

function bstHas(root: TreeNode | null, key: number): boolean {
  let curr = root;
  while (curr && curr.val !== key) curr = key < curr.val ? curr.left : curr.right;
  return curr !== null;
}

export const TREE_KERNELS: Kernel[] = [
  {
    id: 'bst-insert',
    title: 'BST insert',
    topic: 'Trees',
    difficulty: 'Medium',
    goal: 'Insert key into the binary search tree t by walking down from the root and linking a new node where the walk falls off.',
    source: `SCENE BSTInsert

DECLARE
  BST t = {{keys}}

  FUNCTION insert(key)
    parent = NULL
    curr = t.root
    WHILE curr != NULL
      parent = curr
      IF key [[<]] curr.val
        curr = curr.left
      ELSE
        curr = curr.right
      END
    END
    n = NEW_NODE(t, key)
    IF parent == NULL
      t.root = n
    ELSE IF key < parent.val
      parent.[[left]] = n
    ELSE
      parent.right = n
    END
  END

SEQUENCE
  insert({{key}})
END`,
    blanks: [
      ['>', '=='],
      ['right', 'val'],
    ],
    bug: {
      find: 'curr = curr.left',
      replace: 'curr = curr.right',
      fixes: ['curr = t.root', 'curr = NULL'],
      why: 'The walk went right even when the key was smaller, so the new node was hung in the wrong subtree.',
    },
    core: { first: 'WHILE curr != NULL', last: 'END' },
    hints: [
      'Smaller keys live in the left subtree, others in the right. Walk down remembering the last node you stood on (the parent): the new node becomes its left or right child.',
      'IF key < curr.val, curr = curr.left; ELSE curr = curr.right. Set parent = curr before each move.',
    ],
    inputNote: 't is built by inserting keys in order.',
    visible: [
      { keys: [50, 30, 70, 20, 40], key: 35 },
      { keys: [8, 3, 10], key: 9 },
      { keys: [5], key: 7 },
    ],
    hidden: [
      { category: 'edge case: empty tree', input: { keys: [], key: 4 } },
      { category: 'edge case: smaller than everything', input: { keys: [20, 10, 30, 5], key: 1 } },
    ],
    preview: { keys: [5, 2], key: 8 },
    expect: (input) => [{ kind: 'tree', name: 't', value: levelsOf(bstInsert(bstFrom(nums(input, 'keys')), num(input, 'key'))) }],
  },
  {
    id: 'bst-search',
    title: 'BST search',
    topic: 'Trees',
    difficulty: 'Easy',
    goal: 'Leave TRUE in found when key is in the binary search tree t, FALSE otherwise, following a single path down.',
    source: `SCENE BSTSearch

DECLARE
  BST t = {{keys}}

  FUNCTION search(key)
    curr = t.root
    WHILE curr != NULL AND curr.val != key
      IF key [[<]] curr.val
        curr = [[curr.left]]
      ELSE
        curr = curr.right
      END
    END
    IF curr == NULL
      RETURN FALSE
    END
    RETURN TRUE
  END

SEQUENCE
  found = search({{key}})
END`,
    blanks: [
      ['>', '=='],
      ['curr.right', 't.root'],
    ],
    bug: {
      find: 'WHILE curr != NULL AND curr.val != key',
      replace: 'WHILE curr.val != key',
      fixes: ['WHILE curr != NULL OR curr.val != key', 'WHILE curr == NULL AND curr.val != key'],
      why: 'Without the NULL check the walk fell off the tree when the key was missing, and read .val of NULL.',
    },
    core: { first: 'WHILE curr != NULL AND curr.val != key', last: 'END' },
    hints: ['At each node, the key is either here, in the left subtree (smaller) or in the right one (larger). Stop when you find it or run out of tree.', 'IF key < curr.val, curr = curr.left; ELSE curr = curr.right.'],
    visible: [
      { keys: [50, 30, 70, 20, 40, 60, 80], key: 60 },
      { keys: [50, 30, 70, 20, 40], key: 45 },
      { keys: [8, 3, 10, 1, 6], key: 1 },
    ],
    hidden: [
      { category: 'edge case: empty tree', input: { keys: [], key: 3 } },
      { category: 'edge case: key at the root', input: { keys: [7, 2, 9], key: 7 } },
    ],
    preview: { keys: [5, 2, 8], key: 8 },
    expect: (input) => [{ kind: 'var', name: 'found', value: bstHas(bstFrom(nums(input, 'keys')), num(input, 'key')) }],
  },
  {
    id: 'tree-inorder',
    title: 'Inorder traversal',
    topic: 'Trees',
    difficulty: 'Easy',
    goal: 'Collect the values of t in order, in inorder (left subtree, node, right subtree).',
    source: `SCENE InorderTraversal

DECLARE
  BINARY_TREE t = {{tree}}
  ARRAY order = []

  FUNCTION inorder(node)
    IF node [[==]] NULL
      RETURN
    END
    inorder(node.[[left]])
    INSERT order[LENGTH(order)] node.val
    inorder(node.right)
  END

SEQUENCE
  inorder(t.root)
END`,
    blanks: [
      ['!=', '== t.root'],
      ['right', 'left.left'],
    ],
    bug: {
      find: 'inorder(node.right)',
      replace: 'inorder(node.left)',
      fixes: ['inorder(node)', 'inorder(t.root)'],
      why: 'The left subtree was visited twice and the right one never.',
    },
    core: { first: 'IF node == NULL', last: 'inorder(node.right)' },
    hints: ['Inorder: everything in the left subtree first, then the node itself, then the right subtree. An empty subtree (NULL) adds nothing.', 'inorder(node.left), then record node.val, then inorder(node.right).'],
    inputNote: 'tree is in level order; NULL is a missing child.',
    visible: [{ tree: [4, 2, 6, 1, 3, 5, 7] }, { tree: [1, null, 2, 3] }, { tree: [8, 3, 10, 1, 6, null, 14] }],
    hidden: [
      { category: 'edge case: empty tree', input: { tree: [] } },
      { category: 'edge case: one node', input: { tree: [5] } },
    ],
    preview: { tree: [2, 1, 3] },
    expect: (input) => [{ kind: 'array', name: 'order', value: inorder(treeOf(input)) }],
  },
  {
    id: 'tree-height',
    title: 'Height of a tree',
    topic: 'Trees',
    difficulty: 'Easy',
    goal: 'Leave in h the number of nodes on the longest path from the root down to a leaf (0 for an empty tree).',
    source: `SCENE TreeHeight

DECLARE
  BINARY_TREE t = {{tree}}

  FUNCTION height(node)
    IF node == NULL
      RETURN [[0]]
    END
    RETURN 1 + [[MAX]](height(node.left), height(node.[[right]]))
  END

SEQUENCE
  h = height(t.root)
END`,
    blanks: [
      ['1', '-1'],
      ['MIN', 'ABS'],
      ['left', 'left.right'],
    ],
    bug: {
      find: 'RETURN 1 + MAX(height(node.left), height(node.right))',
      replace: 'RETURN MAX(height(node.left), height(node.right))',
      fixes: ['RETURN 1 + MIN(height(node.left), height(node.right))', 'RETURN 2 + MAX(height(node.left), height(node.right))'],
      why: 'The node itself was never counted, so every height came out as 0.',
    },
    core: { first: 'IF node == NULL', last: 'RETURN 1 + MAX(height(node.left), height(node.right))' },
    hints: ['An empty tree has height 0. Any other tree is one node taller than its taller subtree.', 'RETURN 1 + MAX(height(node.left), height(node.right)).'],
    inputNote: 'tree is in level order; NULL is a missing child.',
    visible: [{ tree: [3, 9, 20, null, null, 15, 7] }, { tree: [1, 2, null, 3, null, 4] }, { tree: [1, 2, 3] }],
    hidden: [
      { category: 'edge case: empty tree', input: { tree: [] } },
      { category: 'edge case: one node', input: { tree: [5] } },
    ],
    preview: { tree: [1, 2] },
    expect: (input) => [{ kind: 'var', name: 'h', value: height(treeOf(input)) }],
  },
  {
    id: 'tree-level-order',
    title: 'Level-order traversal',
    topic: 'Trees',
    difficulty: 'Medium',
    goal: 'Collect the values of t in order, level by level from the top, left to right, using the queue q.',
    source: `SCENE LevelOrder

DECLARE
  BINARY_TREE t = {{tree}}
  QUEUE q = []
  ARRAY order = []

SEQUENCE
  IF t.root != NULL
    ENQUEUE q t.root
  END
  WHILE LENGTH(q) > 0
    node = [[DEQUEUE(q)]]
    INSERT order[LENGTH(order)] node.val
    IF node.left [[!=]] NULL
      ENQUEUE q node.[[left]]
    END
    IF node.right != NULL
      ENQUEUE q node.right
    END
  END
END`,
    blanks: [
      ['FRONT(q)', 'REAR(q)'],
      ['==', '!= node.right'],
      ['right', 'left.left'],
    ],
    bug: {
      find: 'ENQUEUE q node.right',
      replace: 'ENQUEUE q node.left',
      fixes: ['ENQUEUE q node', 'ENQUEUE q t.root'],
      why: 'Every right child was replaced by a second copy of the left child, so right subtrees were never reached.',
    },
    core: { first: 'WHILE LENGTH(q) > 0', last: 'END' },
    hints: ['A queue serves nodes in the order they were found. Take a node from the front, record it, and add its children at the rear.', 'node = DEQUEUE(q); record node.val; ENQUEUE its left child, then its right child.'],
    inputNote: 'tree is in level order; NULL is a missing child.',
    visible: [{ tree: [8, 3, 10, 1, 6, null, 14, null, null, 4, 7] }, { tree: [1, 2, 3, 4, 5] }, { tree: [1, null, 2, null, 3] }],
    hidden: [
      { category: 'edge case: empty tree', input: { tree: [] } },
      { category: 'edge case: one node', input: { tree: [9] } },
    ],
    preview: { tree: [1, 2, 3] },
    expect: (input) => [{ kind: 'array', name: 'order', value: levelOrder(treeOf(input)) }],
  },
  {
    id: 'tree-count-leaves',
    title: 'Count the leaves',
    topic: 'Trees',
    difficulty: 'Easy',
    goal: 'Leave in count the number of leaves of t (nodes with no children).',
    source: `SCENE CountLeaves

DECLARE
  BINARY_TREE t = {{tree}}

  FUNCTION leaves(node)
    IF node == NULL
      RETURN 0
    END
    IF node.left == NULL [[AND]] node.right == NULL
      RETURN 1
    END
    RETURN leaves(node.left) [[+]] leaves(node.right)
  END

SEQUENCE
  count = leaves(t.root)
END`,
    blanks: [
      ['OR', '=='],
      ['*', '-'],
    ],
    bug: {
      find: 'RETURN 0',
      replace: 'RETURN 1',
      fixes: ['RETURN -1', 'RETURN node'],
      why: 'Every missing child was counted as a leaf.',
    },
    core: { first: 'IF node == NULL', last: 'RETURN leaves(node.left) + leaves(node.right)' },
    hints: ['A leaf has no left child and no right child. Any other node has as many leaves as its two subtrees together.', 'IF node.left == NULL AND node.right == NULL, RETURN 1.'],
    inputNote: 'tree is in level order; NULL is a missing child.',
    visible: [{ tree: [1, 2, 3, 4, 5, null, 6] }, { tree: [1, 2, null, 3] }, { tree: [7, 3, 9, 1, 5, 8, 10] }],
    hidden: [
      { category: 'edge case: empty tree', input: { tree: [] } },
      { category: 'edge case: one node', input: { tree: [4] } },
      { category: 'edge case: a node with only one child', input: { tree: [1, 2, null, 3, 4] } },
    ],
    preview: { tree: [1, 2, 3] },
    expect: (input) => [{ kind: 'var', name: 'count', value: leaves(treeOf(input)) }],
  },
  {
    id: 'bst-min',
    title: 'Smallest key in a BST',
    topic: 'Trees',
    difficulty: 'Easy',
    goal: 'Leave the smallest key of the binary search tree t in smallest (-1 when the tree is empty).',
    source: `SCENE BSTMinimum

DECLARE
  BST t = {{keys}}

SEQUENCE
  smallest = -1
  curr = t.root
  IF curr != NULL
    WHILE curr.[[left]] != NULL
      curr = [[curr.left]]
    END
    smallest = curr.val
  END
END`,
    blanks: [
      ['right', 'val'],
      ['curr.right', 't.root'],
    ],
    bug: {
      find: 'smallest = curr.val',
      replace: 'smallest = t.root.val',
      fixes: ['smallest = curr.left', 'smallest = curr'],
      why: 'The walk reached the leftmost node, but the root’s key was reported instead of the one found.',
    },
    core: { first: 'WHILE curr.left != NULL', last: 'END' },
    hints: ['In a binary search tree smaller keys are always to the left. Keep going left until you cannot.', 'WHILE curr.left != NULL, curr = curr.left.'],
    inputNote: 't is built by inserting keys in order.',
    visible: [{ keys: [50, 30, 70, 20, 40] }, { keys: [8, 10, 14] }, { keys: [5, 3, 4, 1, 2] }],
    hidden: [
      { category: 'edge case: empty tree', input: { keys: [] } },
      { category: 'edge case: one node', input: { keys: [6] } },
    ],
    preview: { keys: [5, 2, 8] },
    expect: (input) => {
      const keys = nums(input, 'keys');
      return [{ kind: 'var', name: 'smallest', value: keys.length === 0 ? -1 : Math.min(...keys) }];
    },
  },
];
