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
    HIGHLIGHT 50
    WAIT
    CHILD 50 30
    WAIT
    
    // Insert 70 (Right of 50)
    HIGHLIGHT 50
    WAIT
    CHILD 50 70
    WAIT
    
    // Insert 20 (Left of 30)
    HIGHLIGHT 50
    HIGHLIGHT 30
    WAIT
    CHILD 30 20
    WAIT
    
    // Insert 40 (Right of 30)
    HIGHLIGHT 50
    HIGHLIGHT 30
    WAIT
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
    HIGHLIGHT 50
    WAIT
    
    HIGHLIGHT 30
    WAIT
    
    // 30 is the split point (LCA)
    HIGHLIGHT 30
    WAIT
`
};

