export const TreeScripts = {
  BasicTree: `SCENE "Tree Operations"

DECLARE
    TREE myTree

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
    INSERT F INTO B
    DELETE D
    
    // 7. Relationships
    ANCESTORS F
    PATH A F
`
};
