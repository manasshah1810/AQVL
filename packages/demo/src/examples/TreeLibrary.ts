export const TreeScripts = {
  BasicTree: `SCENE TreeOperations

SEQUENCE
    // 1. Create a tree and root node
    ROOT A
    
    // 2. Add children
    CHILD A B
    CHILD A C
    CHILD B D
    CHILD B E
    
    // 3. Tree Traversals
    PREORDER
    LEVELORDER
    
    // 4. Searches
    SEARCH E
    
    // 5. Tree Queries
    HEIGHT
    SIZE
    LEAVES
    
    // 6. Modifications
    CHILD B F
    DELETE D
    
    // 7. Relationships
    ANCESTORS F
    PATH A F
`,

  BinaryTree: `SCENE BinaryTreeTraversals

SEQUENCE
    ROOT 50
    CHILD 50 30
    CHILD 50 70
    CHILD 30 20
    CHILD 30 40
    CHILD 70 60
    CHILD 70 80

    // Traversals demonstrating active node highlighting
    INORDER
    PREORDER
    POSTORDER
    SEARCH 60
`,

  BinarySearchTreeInsertion: `SCENE BSTInsertion

SEQUENCE
    // Build the BST by inserting nodes
    ROOT 50
    WAIT

    // Insert 30 (Left of 50)
    CHILD 50 30
    WAIT

    // Insert 70 (Right of 50)
    CHILD 50 70
    WAIT

    // Insert 20 (Left of 30)
    CHILD 30 20
    WAIT

    // Insert 40 (Right of 30)
    CHILD 30 40
    WAIT
`,

  LowestCommonAncestor: `SCENE LowestCommonAncestorBST

SEQUENCE
    // Initialize tree
    ROOT 50
    CHILD 50 30
    CHILD 50 70
    CHILD 30 20
    CHILD 30 40
    CHILD 70 60
    CHILD 70 80

    // Find LCA of 20 and 40 (Expected: 30)
    // Traversing down from root
    SEARCH 50
    WAIT

    SEARCH 30
    WAIT

    // 30 is the split point (LCA)
    SEARCH 30
    WAIT
`,

  MirrorBinaryTree: `SCENE MirrorBinaryTree

SEQUENCE
    ROOT 1
    CHILD 1 2
    CHILD 1 3
    CHILD 2 4
    CHILD 2 5

    // Traverse before mirroring
    PREORDER
    WAIT

    // Recursively swap every node's left and right children
    MIRROR
    WAIT

    // Traversal order is now flipped
    PREORDER
`,

  TreeViews: `SCENE TreeViews

SEQUENCE
    ROOT 1
    CHILD 1 2
    CHILD 1 3
    CHILD 2 4
    CHILD 2 5
    CHILD 3 6

    // Leftmost node visible at each depth
    LEFT_VIEW
    WAIT

    // Rightmost node visible at each depth
    RIGHT_VIEW
`,

  BoundaryAndVerticalTraversal: `SCENE BoundaryAndVerticalTraversal

SEQUENCE
    ROOT 1
    CHILD 1 2
    CHILD 1 3
    CHILD 2 4
    CHILD 2 5
    CHILD 3 6
    CHILD 3 7

    // Traverse the outer boundary: left edge, leaves, right edge
    BOUNDARY
    WAIT

    // Group nodes by horizontal distance from the root
    VERTICAL_ORDER
`,

  BSTDeletionCases: `SCENE BSTDeletionCases

DECLARE
  BST bstTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  INSERT 20
  INSERT 40
  INSERT 60
  INSERT 80
  WAIT

  // Case 1: delete a leaf node (20 has no children)
  DELETE 20
  WAIT

  // Case 2: delete a node with a single child
  INSERT 45
  DELETE 40
  WAIT

  // Case 3: delete a node with two children (replaced by its inorder successor)
  DELETE 70
END
`
};

