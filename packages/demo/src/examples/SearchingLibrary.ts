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
  HIGHLIGHT arr[4] 'SUCCESS'
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
  HIGHLIGHT arr[5] 'SUCCESS'
END
`,

  DFS: `SCENE DFSTraversal

SEQUENCE
  ROOT 50
  CHILD 50 30
  CHILD 50 70
  CHILD 30 20
  CHILD 30 40
  CHILD 70 60
  CHILD 70 80

  // Deep traversal (Pre-order DFS style)
  HIGHLIGHT 50
  WAIT
  
  HIGHLIGHT 30
  WAIT
  
  HIGHLIGHT 20
  WAIT
  
  HIGHLIGHT 40
  WAIT
  
  HIGHLIGHT 70
  WAIT
  
  HIGHLIGHT 60
  WAIT
  
  HIGHLIGHT 80
  WAIT
END
`,

  BFS: `SCENE BFSTraversal

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
  HIGHLIGHT myGraph["A"]
  WAIT
  
  // Level 1
  HIGHLIGHT myGraph["B"]
  HIGHLIGHT myGraph["C"]
  WAIT
  
  // Level 2
  HIGHLIGHT myGraph["D"]
  HIGHLIGHT myGraph["E"]
  HIGHLIGHT myGraph["F"]
  WAIT
END
`
};
