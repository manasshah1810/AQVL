export const SearchingScripts = {
  LinearSearch: `SCENE LinearSearch

DECLARE
  ARRAY arr = [12, 34, 25, 64, 22, 11, 90]

SEQUENCE
  // Searching for 22
  
  COMPARE arr[0] arr[4]
  COMPARE arr[1] arr[4]
  COMPARE arr[2] arr[4]
  COMPARE arr[3] arr[4]
  
  // Found 22 at index 4
  COMPARE arr[4] arr[4]
  HIGHLIGHT arr[4]
END
`,

  BinarySearch: `SCENE BinarySearch

DECLARE
  ARRAY arr = [11, 12, 22, 25, 34, 64, 90]

SEQUENCE
  // Searching for 64 (index 5)
  // Low: 0, High: 6, Mid: 3
  
  HIGHLIGHT arr[3]
  COMPARE arr[3] arr[5]
  
  // 25 < 64, so Low = Mid + 1 = 4
  // Low: 4, High: 6, Mid: 5
  HIGHLIGHT arr[5]
  COMPARE arr[5] arr[5]
  
  // Found at index 5!
  HIGHLIGHT arr[5]
END
`,

  DFS: `SCENE DFS

DECLARE
  TREE myTree = [50, 30, 70, 20, 40, 60, 80]

SEQUENCE
  // Deep traversal (Root -> Left -> Left ...)
  VISIT myTree 0
  VISIT myTree 1
  VISIT myTree 3
  
  // Backtrack to 1, then right
  VISIT myTree 4
  
  // Backtrack to root, then right
  VISIT myTree 2
  VISIT myTree 5
  VISIT myTree 6
END
`,

  BFS: `SCENE BFS

DECLARE
  GRAPH myGraph = [
    "A->B", 
    "A->C", 
    "B->D", 
    "B->E",
    "C->F"
  ]

SEQUENCE
  // Level 0
  VISIT myGraph "A"
  
  // Level 1
  TRAVERSE myGraph "A"
  VISIT myGraph "B"
  TRAVERSE myGraph "A"
  VISIT myGraph "C"
  
  // Level 2
  TRAVERSE myGraph "B"
  VISIT myGraph "D"
  TRAVERSE myGraph "B"
  VISIT myGraph "E"
  TRAVERSE myGraph "C"
  VISIT myGraph "F"
END
`
};
