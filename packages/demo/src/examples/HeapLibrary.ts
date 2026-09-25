export const HeapScripts = {
  HeapInsertion: `SCENE HeapInsertion

DECLARE
  HEAP h = [5, 3, 7]

SEQUENCE
  // Insert a value at the end, then sift it up until the
  // min-heap property (parent <= children) is restored
  HEAP_INSERT h 10
  WAIT

  HEAP_INSERT h 1
  WAIT

  HEAP_INSERT h 8
END
`,

  HeapExtractMin: `SCENE HeapExtractMin

DECLARE
  HEAP h = [1, 3, 2, 7, 5, 4]

SEQUENCE
  // The root of a min-heap is always the smallest element.
  // Removing it moves the last element to the root and sifts it down.
  HEAP_EXTRACT h
  WAIT

  HEAP_EXTRACT h
  WAIT

  HEAP_EXTRACT h
END
`,

  HeapDecreaseKey: `SCENE HeapDecreaseKey

DECLARE
  HEAP h = [10, 15, 20, 30, 25]

SEQUENCE
  // Lowering a value can break the min-heap property upward,
  // so it must be sifted up again (used heavily by Dijkstra's algorithm)
  HEAP_DECREASE h 4 2
  WAIT

  HEAP_DECREASE h 3 5
END
`,

  BuildHeapFromArray: `SCENE BuildHeapFromArray

DECLARE
  HEAP h = [9, 4, 7, 1, 8, 2, 6]

SEQUENCE
  // Turn an arbitrary array into a valid heap in-place in O(n)
  // by heapifying every non-leaf node, bottom-up
  BUILD_HEAP h
END
`,

  HeapifySingleNode: `SCENE HeapifySingleNode

DECLARE
  HEAP h = [1, 3, 2, 7, 5, 4, 9]

SEQUENCE
  // Restore the heap property downward from a given node,
  // the core primitive used by both BUILD_HEAP and HEAP_EXTRACT
  HEAPIFY h
END
`
};
