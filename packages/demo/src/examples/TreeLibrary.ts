/**
 * Tree examples. Every algorithm is written out in full — pointer variables,
 * WHILE / IF / LOOP, recursive FUNCTIONs, NEW_NODE / FREE, a real queue or
 * stack of node pointers — so each step of the walk is visible and logged.
 * The one-line built-ins (INSERT t 35, SEARCH t 35, DELETE t 70, ...) are
 * shown at the end of the BST examples for comparison.
 */
export const TreeScripts = {
  BinaryTreeBasics: `SCENE BinaryTreeBasics
// A binary tree is built from nodes. Each node holds a value (val) and two
// pointers: left and right. NULL means "no child here".
// t.root points to the top node.

DECLARE
  BINARY_TREE t = []

SEQUENCE
  // 1. Create the root. NEW_NODE allocates it in heap memory (unlinked).
  root = NEW_NODE(t, 10)
  t.root = root

  // 2. Create two children and link them under the root.
  a = NEW_NODE(t, 20)
  b = NEW_NODE(t, 30)
  root.left = a
  root.right = b

  // 3. The next level: 40 and 50 under 20, and 60 under 30.
  a.left = NEW_NODE(t, 40)
  a.right = NEW_NODE(t, 50)
  b.right = NEW_NODE(t, 60)
  PRINT "Tree by levels:" t

  // 4. Read values through a chain of pointers.
  PRINT "root.left.right.val =" root.left.right.val

  // 5. Leftmost path: keep following .left until it is NULL.
  curr = t.root
  WHILE curr.left != NULL
    curr = curr.left
  END
  PRINT "Leftmost node:" curr.val

  // 6. Rightmost path: keep following .right.
  curr = t.root
  WHILE curr.right != NULL
    curr = curr.right
  END
  PRINT "Rightmost node:" curr.val
  IF curr.left == NULL AND curr.right == NULL
    PRINT curr.val "is a leaf (both children are NULL)"
  END

  // 7. Remove the leaf 60: unlink it (it moves to heap memory),
  //    then FREE releases its memory.
  leaf = b.right
  b.right = NULL
  FREE leaf
  PRINT "After removing 60:" t
END
`,

  Traversals: `SCENE RecursiveTraversals
// The three depth-first orders differ only in WHEN the node itself is
// visited: before its subtrees (preorder), between them (inorder) or after
// them (postorder). Watch the call stack grow and shrink on the left.

DECLARE
  BINARY_TREE t = [1, 2, 3, 4, 5]

  FUNCTION preorder(node)
    IF node == NULL
      RETURN
    END
    PRINT "Preorder visits" node.val
    preorder(node.left)
    preorder(node.right)
  END

  FUNCTION inorder(node)
    IF node == NULL
      RETURN
    END
    inorder(node.left)
    PRINT "Inorder visits" node.val
    inorder(node.right)
  END

  FUNCTION postorder(node)
    IF node == NULL
      RETURN
    END
    postorder(node.left)
    postorder(node.right)
    PRINT "Postorder visits" node.val
  END

SEQUENCE
  preorder(t.root)
  inorder(t.root)
  postorder(t.root)
  // Expected: preorder 1 2 4 5 3, inorder 4 2 5 1 3, postorder 4 5 2 3 1
END
`,

  LevelOrder: `SCENE LevelOrderTraversal
// Breadth-first search: visit the tree level by level. A queue holds the
// nodes waiting to be visited — children join at the rear, and we always
// take the next node from the front.

DECLARE
  BINARY_TREE t = [8, 3, 10, 1, 6, NULL, 14, NULL, NULL, 4, 7]
  QUEUE q = []

SEQUENCE
  ENQUEUE q t.root
  level = 0
  WHILE LENGTH(q) > 0
    // Everything in the queue right now is on the same level.
    count = LENGTH(q)
    line = ""
    sum = 0
    LOOP i FROM 1 TO count
      node = DEQUEUE(q)
      line = line + " " + node.val
      sum = sum + node.val
      IF node.left != NULL
        ENQUEUE q node.left
      END
      IF node.right != NULL
        ENQUEUE q node.right
      END
    END
    PRINT "Level" level ":" line "  (sum =" sum ")"
    level = level + 1
  END
  PRINT "The tree has" level "levels"
END
`,

  IterativeInorder: `SCENE IterativeInorder
// Inorder traversal without recursion: a stack remembers the path back up.
// Go left as far as possible (pushing every node), then pop one, visit it,
// and continue with its right subtree. For a BST this visits the keys in
// sorted order.

DECLARE
  BST t = [50, 30, 70, 20, 40, 60, 80]
  STACK s = []

SEQUENCE
  sorted = ""
  curr = t.root
  WHILE curr != NULL OR LENGTH(s) > 0
    // Walk down the left spine, saving each node on the stack.
    WHILE curr != NULL
      PUSH s curr
      curr = curr.left
    END
    // The top of the stack is the next node in inorder.
    curr = POP(s)
    PRINT "Visit" curr.val
    sorted = sorted + " " + curr.val
    // Then handle its right subtree.
    curr = curr.right
  END
  PRINT "Keys in sorted order:" sorted
END
`,

  HeightSizeLeaves: `SCENE HeightSizeAndLeaves
// Recursive functions that RETURN a value: each call asks its two subtrees
// for their answers and combines them. The console shows every call and
// what it returns.

DECLARE
  BINARY_TREE t = [1, 2, 3, 4, 5, NULL, 6]

  // Height = number of levels on the longest root-to-leaf path.
  FUNCTION height(node)
    IF node == NULL
      RETURN 0
    END
    leftHeight = height(node.left)
    rightHeight = height(node.right)
    RETURN 1 + MAX(leftHeight, rightHeight)
  END

  // Size = this node + everything in both subtrees.
  FUNCTION countNodes(node)
    IF node == NULL
      RETURN 0
    END
    RETURN 1 + countNodes(node.left) + countNodes(node.right)
  END

  // A leaf has no children.
  FUNCTION countLeaves(node)
    IF node == NULL
      RETURN 0
    END
    IF node.left == NULL AND node.right == NULL
      RETURN 1
    END
    RETURN countLeaves(node.left) + countLeaves(node.right)
  END

SEQUENCE
  h = height(t.root)
  PRINT "Height:" h
  n = countNodes(t.root)
  PRINT "Number of nodes:" n
  leaves = countLeaves(t.root)
  PRINT "Number of leaves:" leaves
END
`,

  BSTSearchInsert: `SCENE BSTSearchAndInsert
// In a binary search tree every key in a node's left subtree is smaller and
// every key in its right subtree is larger. So a search only follows ONE
// path from the root: compare, then go left or right.

DECLARE
  BST t = [50, 30, 70, 20, 40, 60, 80]

  // Returns the node holding key, or NULL.
  FUNCTION search(key)
    curr = t.root
    WHILE curr != NULL AND curr.val != key
      IF key < curr.val
        curr = curr.left
      ELSE
        curr = curr.right
      END
    END
    RETURN curr
  END

  // Walk down remembering the parent; the new node hangs where we fall off.
  FUNCTION insert(key)
    parent = NULL
    curr = t.root
    WHILE curr != NULL
      IF key == curr.val
        PRINT key "is already in the tree"
        RETURN
      END
      parent = curr
      IF key < curr.val
        curr = curr.left
      ELSE
        curr = curr.right
      END
    END
    n = NEW_NODE(t, key)
    IF parent == NULL
      t.root = n
    ELSE IF key < parent.val
      parent.left = n
    ELSE
      parent.right = n
    END
    PRINT "Inserted" key
  END

SEQUENCE
  found = search(60)
  IF found != NULL
    PRINT "Found" found.val
  END
  found = search(45)
  IF found == NULL
    PRINT "45 is not in the tree"
  END

  insert(45)
  insert(65)
  insert(10)
  PRINT "Tree by levels:" t

  // The same operations as one-line built-ins (they animate the same walk):
  INSERT t 35
  SEARCH t 35
END
`,

  BSTDelete: `SCENE BSTDeleteAllCases
// Deleting from a BST has three cases:
//   1. a leaf           -> just unlink it
//   2. one child        -> the parent adopts that child
//   3. two children     -> copy the inorder successor's key into the node,
//                          then delete the successor (which has no left child)
// An unlinked node waits in heap memory until FREE releases it.

DECLARE
  BST t = [50, 30, 70, 20, 40, 60, 80, 65]

  FUNCTION deleteKey(key)
    // Find the node and its parent.
    parent = NULL
    curr = t.root
    WHILE curr != NULL AND curr.val != key
      parent = curr
      IF key < curr.val
        curr = curr.left
      ELSE
        curr = curr.right
      END
    END
    IF curr == NULL
      PRINT key "is not in the tree"
      RETURN
    END

    // Case 3: two children -> reduce it to deleting the successor.
    IF curr.left != NULL AND curr.right != NULL
      succParent = curr
      succ = curr.right
      WHILE succ.left != NULL
        succParent = succ
        succ = succ.left
      END
      PRINT "Two children: copy successor" succ.val "into" curr.val
      curr.val = succ.val
      parent = succParent
      curr = succ
    END

    // Now curr has at most one child: link its parent to that child.
    child = curr.left
    IF child == NULL
      child = curr.right
    END
    IF parent == NULL
      t.root = child
    ELSE IF parent.left == curr
      parent.left = child
    ELSE
      parent.right = child
    END
    FREE curr
    PRINT "Deleted" key ":" t
  END

SEQUENCE
  deleteKey(20)   // case 1: leaf
  deleteKey(30)   // case 2: one child (40)
  deleteKey(50)   // case 3: two children (successor 60)
  deleteKey(99)   // not in the tree

  // The one-line built-in walks the same three cases:
  DELETE t 70
END
`,

  ValidateBST: `SCENE ValidateBST
// Checking only "left child < node < right child" is not enough: EVERY key
// in the left subtree must be smaller than the node. So each call carries
// the range (low, high) its node must lie in, and narrows it for its children.

DECLARE
  BINARY_TREE good = [50, 30, 70, 20, 40, 60, 80]
  BINARY_TREE bad = [50, 30, 70, 20, 60, 55, 80]

  FUNCTION isBST(node, low, high)
    IF node == NULL
      RETURN 1
    END
    IF node.val <= low OR node.val >= high
      PRINT node.val "breaks the rule: it must be between" low "and" high
      HIGHLIGHT node 'DISCARDED'
      RETURN 0
    END
    IF isBST(node.left, low, node.val) == 0
      RETURN 0
    END
    RETURN isBST(node.right, node.val, high)
  END

SEQUENCE
  IF isBST(good.root, -1000, 1000) == 1
    PRINT "good is a valid BST"
  END
  IF isBST(bad.root, -1000, 1000) == 0
    PRINT "bad is NOT a BST (60 sits in the left subtree of 50)"
  END
END
`,

  LowestCommonAncestor: `SCENE LowestCommonAncestor
// In a BST, the lowest common ancestor of a and b is the first node on the
// way down where a and b split: one goes left and the other goes right
// (or one of them IS the node). While both are smaller, go left; while
// both are larger, go right.

DECLARE
  BST t = [50, 30, 70, 20, 40, 60, 80, 35, 45]

  FUNCTION lca(a, b)
    curr = t.root
    WHILE curr != NULL
      IF a < curr.val AND b < curr.val
        PRINT "both" a "and" b "<" curr.val "-> go left"
        curr = curr.left
      ELSE IF a > curr.val AND b > curr.val
        PRINT "both" a "and" b ">" curr.val "-> go right"
        curr = curr.right
      ELSE
        PRINT a "and" b "split at" curr.val
        RETURN curr
      END
    END
    RETURN NULL
  END

SEQUENCE
  x = lca(35, 45)
  PRINT "LCA(35, 45) =" x.val
  x = lca(20, 45)
  PRINT "LCA(20, 45) =" x.val
  x = lca(35, 80)
  PRINT "LCA(35, 80) =" x.val
  HIGHLIGHT x 'SUCCESS'
END
`,

  MirrorTree: `SCENE MirrorBinaryTree
// Mirror (invert) a tree: swap the left and right pointers of every node.
// temp holds one subtree while the pointers are exchanged — watch that
// subtree wait in place, then the whole level flip around.

DECLARE
  BINARY_TREE t = [4, 2, 7, 1, 3, 6, 9]

  FUNCTION mirror(node)
    IF node == NULL
      RETURN
    END
    mirror(node.left)
    mirror(node.right)
    temp = node.left
    node.left = node.right
    node.right = temp
  END

SEQUENCE
  PRINT "Before:" t
  mirror(t.root)
  PRINT "After: " t
END
`,

  TreeViews: `SCENE LeftAndRightViews
// Looking at the tree from the left you see the FIRST node of every level;
// from the right, the LAST one. A level-order walk that processes one whole
// level at a time finds both.

DECLARE
  BINARY_TREE t = [1, 2, 3, NULL, 5, NULL, 4, NULL, NULL, 6]
  QUEUE q = []

SEQUENCE
  leftView = ""
  rightView = ""
  ENQUEUE q t.root
  WHILE LENGTH(q) > 0
    count = LENGTH(q)
    LOOP i FROM 1 TO count
      node = DEQUEUE(q)
      IF i == 1
        leftView = leftView + " " + node.val
        HIGHLIGHT node 'SUCCESS'
      END
      IF i == count
        rightView = rightView + " " + node.val
      END
      IF node.left != NULL
        ENQUEUE q node.left
      END
      IF node.right != NULL
        ENQUEUE q node.right
      END
    END
  END
  PRINT "Left view: " leftView
  PRINT "Right view:" rightView
END
`,

  PathSum: `SCENE RootToLeafPathSum
// Is there a path from the root down to a LEAF whose values add up to the
// target? Each call subtracts its node's value from what is still needed;
// a leaf that brings it to exactly 0 completes the path.

DECLARE
  BINARY_TREE t = [5, 4, 8, 11, NULL, 13, 4, 7, 2, NULL, NULL, NULL, 1]

  FUNCTION hasPathSum(node, remaining)
    IF node == NULL
      RETURN 0
    END
    remaining = remaining - node.val
    IF node.left == NULL AND node.right == NULL
      IF remaining == 0
        PRINT "Leaf" node.val "completes the path"
        HIGHLIGHT node 'SUCCESS'
        RETURN 1
      END
      PRINT "Leaf" node.val ": dead end (still need" remaining ")"
      RETURN 0
    END
    IF hasPathSum(node.left, remaining) == 1
      HIGHLIGHT node 'SUCCESS'
      RETURN 1
    END
    IF hasPathSum(node.right, remaining) == 1
      HIGHLIGHT node 'SUCCESS'
      RETURN 1
    END
    RETURN 0
  END

SEQUENCE
  target = 22
  IF hasPathSum(t.root, target) == 1
    PRINT "Yes: a root-to-leaf path sums to" target "(5 + 4 + 11 + 2)"
  ELSE
    PRINT "No root-to-leaf path sums to" target
  END
END
`,
};
