/**
 * Tree examples. Every algorithm is written out in full — pointer variables,
 * WHILE / IF / LOOP, recursive FUNCTIONs, NEW_NODE / FREE, a real queue or
 * stack of node pointers — so each step of the walk is visible and logged.
 * The one-line built-ins (INSERT t 35, SEARCH t 35, DELETE t 70, ...) are
 * shown at the end of the BST examples for comparison.
 */
export const TreeScripts = {
  BinaryTreeBasics: `SCENE BinaryTreeBasics

DECLARE
  BINARY_TREE t = []

SEQUENCE
  root = NEW_NODE(t, 10)
  t.root = root

  a = NEW_NODE(t, 20)
  b = NEW_NODE(t, 30)
  root.left = a
  root.right = b

  a.left = NEW_NODE(t, 40)
  a.right = NEW_NODE(t, 50)
  b.right = NEW_NODE(t, 60)
  PRINT "Tree by levels:" t

  PRINT "root.left.right.val =" root.left.right.val

  curr = t.root
  WHILE curr.left != NULL
    curr = curr.left
  END
  PRINT "Leftmost node:" curr.val

  curr = t.root
  WHILE curr.right != NULL
    curr = curr.right
  END
  PRINT "Rightmost node:" curr.val
  IF curr.left == NULL AND curr.right == NULL
    PRINT curr.val "is a leaf (both children are NULL)"
  END

  leaf = b.right
  b.right = NULL
  FREE leaf
  PRINT "After removing 60:" t
END
`,

  Traversals: `SCENE RecursiveTraversals

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
END
`,

  LevelOrder: `SCENE LevelOrderTraversal

DECLARE
  BINARY_TREE t = [8, 3, 10, 1, 6, NULL, 14, NULL, NULL, 4, 7]
  QUEUE q = []

SEQUENCE
  ENQUEUE q t.root
  level = 0
  WHILE LENGTH(q) > 0
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

DECLARE
  BST t = [50, 30, 70, 20, 40, 60, 80]
  STACK s = []

SEQUENCE
  sorted = ""
  curr = t.root
  WHILE curr != NULL OR LENGTH(s) > 0
    WHILE curr != NULL
      PUSH s curr
      curr = curr.left
    END
    curr = POP(s)
    PRINT "Visit" curr.val
    sorted = sorted + " " + curr.val
    curr = curr.right
  END
  PRINT "Keys in sorted order:" sorted
END
`,

  HeightSizeLeaves: `SCENE HeightSizeAndLeaves

DECLARE
  BINARY_TREE t = [1, 2, 3, 4, 5, NULL, 6]

  FUNCTION height(node)
    IF node == NULL
      RETURN 0
    END
    leftHeight = height(node.left)
    rightHeight = height(node.right)
    RETURN 1 + MAX(leftHeight, rightHeight)
  END

  FUNCTION countNodes(node)
    IF node == NULL
      RETURN 0
    END
    RETURN 1 + countNodes(node.left) + countNodes(node.right)
  END

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

DECLARE
  BST t = [50, 30, 70, 20, 40, 60, 80]

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

  INSERT t 35
  SEARCH t 35
END
`,

  BSTDelete: `SCENE BSTDeleteAllCases

DECLARE
  BST t = [50, 30, 70, 20, 40, 60, 80, 65]

  FUNCTION deleteKey(key)
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
  deleteKey(20)
  deleteKey(30)
  deleteKey(50)
  deleteKey(99)

  DELETE t 70
END
`,

  ValidateBST: `SCENE ValidateBST

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
