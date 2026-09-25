export const BSTExamples: Record<string, string> = {
  bst_operations: `SCENE BSTOperations
DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  INSERT 20
  INSERT 40
  INSERT 60
  INSERT 80
  
  // Search for an existing value
  SEARCH 60
  
  // Search for a non-existing value
  SEARCH 90
  
  // Delete a leaf node
  DELETE 20
  
  // Delete a node with one child
  // Let's insert a single child first
  INSERT 85
  DELETE 80
  
  // Delete a node with two children
  DELETE 50
  
  // Clear the tree
  CLEAR
END
`,

  bst_traversals_and_queries: `SCENE BSTTraversalsAndQueries
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

  // ── Layer 2: Traversals ──
  INORDER
  PREORDER
  POSTORDER
  LEVELORDER

  // ── Layer 3: Information Queries ──
  MIN
  MAX
  HEIGHT
  SIZE
  ROOT
  IS_EMPTY

  CLEAR
  // Verify empty tree handling
  IS_EMPTY
END
`,
};
