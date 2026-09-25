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
  SEARCH 50
  WAIT

  SEARCH 30
  WAIT

  SEARCH 20
  WAIT

  SEARCH 40
  WAIT

  SEARCH 70
  WAIT

  SEARCH 60
  WAIT

  SEARCH 80
  WAIT
END
`,

  BFS: `SCENE BFSTraversal

DECLARE
  GRAPH myGraph = ["A->B", "A->C", "B->D", "B->E", "C->F"]

SEQUENCE
  // Explore all neighbors at the current depth before going deeper
  BFS myGraph FROM A
END
`,

  JumpSearch: `SCENE JumpSearch

DECLARE
  ARRAY arr = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]

SEQUENCE
  // Searching for 13. Jump ahead in blocks of size sqrt(n) ~ 3,
  // then do a linear scan backward inside the block that overshot.

  HIGHLIGHT arr[2]
  COMPARE arr[2] arr[6]
  WAIT

  HIGHLIGHT arr[5]
  COMPARE arr[5] arr[6]
  WAIT

  HIGHLIGHT arr[8]
  COMPARE arr[8] arr[6]
  // Overshot the target's block -> scan backward from here
  WAIT

  HIGHLIGHT arr[7]
  COMPARE arr[7] arr[6]
  WAIT

  HIGHLIGHT arr[6]
  COMPARE arr[6] arr[6]
  HIGHLIGHT arr[6] 'SUCCESS'
END
`,

  ExponentialSearch: `SCENE ExponentialSearch

DECLARE
  ARRAY arr = [1, 2, 4, 8, 16, 32, 64, 128, 256]

SEQUENCE
  // Searching for 64. Double the bound each step (1, 2, 4, 8...)
  // until it exceeds the target, then binary-search that range.

  HIGHLIGHT arr[0]
  COMPARE arr[0] arr[6]
  WAIT

  HIGHLIGHT arr[1]
  COMPARE arr[1] arr[6]
  WAIT

  HIGHLIGHT arr[2]
  COMPARE arr[2] arr[6]
  WAIT

  HIGHLIGHT arr[4]
  COMPARE arr[4] arr[6]
  WAIT

  HIGHLIGHT arr[8]
  COMPARE arr[8] arr[6]
  // Range [4, 8] now brackets the target -> binary search within it
  WAIT

  HIGHLIGHT arr[6]
  COMPARE arr[6] arr[6]
  HIGHLIGHT arr[6] 'SUCCESS'
END
`,

  TernarySearch: `SCENE TernarySearch

DECLARE
  ARRAY arr = [2, 5, 8, 12, 16, 23, 38, 45, 56, 72]

SEQUENCE
  // Searching for 45. Split the range into thirds using two
  // midpoints instead of one, discarding two-thirds each step.

  HIGHLIGHT arr[3]
  HIGHLIGHT arr[6]
  COMPARE arr[3] arr[7]
  COMPARE arr[6] arr[7]
  // Target lies beyond both midpoints -> search the right third
  WAIT

  HIGHLIGHT arr[7]
  HIGHLIGHT arr[8]
  COMPARE arr[7] arr[7]
  HIGHLIGHT arr[7] 'SUCCESS'
END
`,

  InterpolationSearch: `SCENE InterpolationSearch

DECLARE
  ARRAY arr = [10, 20, 30, 40, 50, 60, 70, 80, 90]

SEQUENCE
  // For uniformly-distributed sorted data, estimate the probe
  // position proportionally instead of always halving the range.

  HIGHLIGHT arr[6]
  COMPARE arr[6] arr[6]
  // Estimated position based on value proportion lands exactly on target
  HIGHLIGHT arr[6] 'SUCCESS'
END
`
};
