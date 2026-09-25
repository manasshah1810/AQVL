export const SortingScripts = {
  BubbleSort: `SCENE BubbleSort

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    LOOP j FROM 0 TO LENGTH(arr) - i - 2
      COMPARE arr[j] arr[j+1]
      IF arr[j] > arr[j+1]
        SWAP arr[j] arr[j+1]
      END
    END
    HIGHLIGHT arr[LENGTH(arr) - i - 1]
  END
  HIGHLIGHT arr[0]
END
`,

  SelectionSort: `SCENE SelectionSort

DECLARE
  ARRAY arr = [64, 25, 12, 22, 11]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    HIGHLIGHT arr[i]
    LOOP j FROM i + 1 TO LENGTH(arr) - 1
      COMPARE arr[i] arr[j]
      IF arr[i] > arr[j]
        SWAP arr[i] arr[j]
      END
    END
  END
END
`,

  InsertionSort: `SCENE InsertionSort

DECLARE
  ARRAY arr = [4, 3, 2, 10, 12, 1, 5, 6]

SEQUENCE
  HIGHLIGHT arr[0]
  LOOP i FROM 1 TO LENGTH(arr) - 1
    LOOP j FROM i TO 1
      COMPARE arr[j] arr[j-1]
      IF arr[j] < arr[j-1]
        SWAP arr[j] arr[j-1]
      END
    END
  END
END
`,

  QuickSort: `SCENE QuickSort

DECLARE
  ARRAY arr = [10, 80, 30, 90, 40, 50, 70]

SEQUENCE
  // 1. Choose Pivot (70)
  HIGHLIGHT arr[6]
  
  // 2. Partitioning
  COMPARE arr[0] arr[6]
  // 10 < 70, keep it
  
  COMPARE arr[1] arr[6]
  // 80 > 70, mark it
  HIGHLIGHT arr[1]
  
  COMPARE arr[2] arr[6]
  // 30 < 70, swap with marked 80
  SWAP arr[1] arr[2]
  
  COMPARE arr[3] arr[6]
  // 90 > 70, mark it
  HIGHLIGHT arr[3]
  
  COMPARE arr[4] arr[6]
  // 40 < 70, swap with marked 90
  SWAP arr[3] arr[4]
  
  // (Process continues)
END
`,

  MergeSort: `SCENE MergeSort

DECLARE
  ARRAY arr = [38, 27, 43, 3, 9, 82, 10]

SEQUENCE
  // 1. Compare and divide left sub-array
  COMPARE arr[0] arr[1]
  IF arr[0] > arr[1]
    SWAP arr[0] arr[1]
  END
  COMPARE arr[1] arr[2]
  IF arr[1] > arr[2]
    SWAP arr[1] arr[2]
  END
  COMPARE arr[0] arr[1]
  IF arr[0] > arr[1]
    SWAP arr[0] arr[1]
  END

  // 2. Compare right sub-array
  COMPARE arr[3] arr[4]
  COMPARE arr[5] arr[6]
  IF arr[5] > arr[6]
    SWAP arr[5] arr[6]
  END

  // 3. Final merge comparison across halves
  COMPARE arr[0] arr[3]
  COMPARE arr[1] arr[3]
  COMPARE arr[2] arr[3]

  // 4. Sorted confirmation
  HIGHLIGHT arr[0]
  HIGHLIGHT arr[1]
  HIGHLIGHT arr[2]
  HIGHLIGHT arr[3]
  HIGHLIGHT arr[4]
  HIGHLIGHT arr[5]
  HIGHLIGHT arr[6]
END
`,

  BubbleSortBuiltin: `SCENE BubbleSortBuiltin

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  // The one-shot builtin keyword runs the full algorithm and
  // animates every comparison and swap automatically.
  BUBBLE_SORT arr
END
`,

  SelectionSortBuiltin: `SCENE SelectionSortBuiltin

DECLARE
  ARRAY arr = [29, 10, 14, 37, 13]

SEQUENCE
  SELECTION_SORT arr
END
`,

  InsertionSortBuiltin: `SCENE InsertionSortBuiltin

DECLARE
  ARRAY arr = [9, 5, 1, 4, 3]

SEQUENCE
  INSERTION_SORT arr
END
`,

  MergeSortBuiltin: `SCENE MergeSortBuiltin

DECLARE
  ARRAY arr = [12, 11, 13, 5, 6, 7]

SEQUENCE
  // True recursive divide-and-conquer merge sort
  MERGE_SORT arr
END
`,

  QuickSortBuiltin: `SCENE QuickSortBuiltin

DECLARE
  ARRAY arr = [10, 7, 8, 9, 1, 5]

SEQUENCE
  // True recursive partition-based quicksort
  QUICK_SORT arr
END
`,

  ShellSort: `SCENE ShellSort

DECLARE
  ARRAY arr = [23, 12, 1, 8, 34, 54, 2, 3]

SEQUENCE
  // Compare and swap elements a large "gap" apart first,
  // then shrink the gap toward 1 (a generalized insertion sort).
  gap = 4

  // Gap = 4
  COMPARE arr[0] arr[4]
  IF arr[0] > arr[4]
    SWAP arr[0] arr[4]
  END
  COMPARE arr[1] arr[5]
  IF arr[1] > arr[5]
    SWAP arr[1] arr[5]
  END
  COMPARE arr[2] arr[6]
  IF arr[2] > arr[6]
    SWAP arr[2] arr[6]
  END
  COMPARE arr[3] arr[7]
  IF arr[3] > arr[7]
    SWAP arr[3] arr[7]
  END
  WAIT

  // Gap = 2
  LOOP i FROM 0 TO 5
    COMPARE arr[i] arr[i+2]
    IF arr[i] > arr[i+2]
      SWAP arr[i] arr[i+2]
    END
  END
  WAIT

  // Gap = 1 (plain insertion sort pass)
  LOOP i FROM 0 TO LENGTH(arr) - 2
    COMPARE arr[i] arr[i+1]
    IF arr[i] > arr[i+1]
      SWAP arr[i] arr[i+1]
    END
  END
END
`,

  CountingSort: `SCENE CountingSort

DECLARE
  ARRAY arr = [4, 2, 2, 8, 3, 3, 1]
  ARRAY counts = [0, 0, 0, 0, 0, 0, 0, 0, 0]

SEQUENCE
  // Tally how many times each value occurs
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    WAIT
  END

  UPDATE counts[1] 1
  UPDATE counts[2] 2
  UPDATE counts[3] 2
  UPDATE counts[4] 1
  UPDATE counts[8] 1
  WAIT

  // Reading the counts array in order reconstructs the sorted array:
  // 1, 2, 2, 3, 3, 4, 8
  LOOP i FROM 0 TO LENGTH(counts) - 1
    HIGHLIGHT counts[i]
  END
END
`,

  CycleSort: `SCENE CycleSort

DECLARE
  ARRAY arr = [4, 3, 2, 1]

SEQUENCE
  // Cycle sort minimizes writes: each element is moved directly
  // to its final sorted position in one cycle of swaps.

  HIGHLIGHT arr[0]
  // 4 belongs at index 3
  SWAP arr[0] arr[3]
  WAIT

  HIGHLIGHT arr[0]
  // 1 (now at index 0) belongs at index 0 already... continue the cycle
  SWAP arr[0] arr[2]
  WAIT

  HIGHLIGHT arr[0]
  SWAP arr[0] arr[1]
  WAIT
  // arr is now fully sorted: [1, 2, 3, 4]
END
`
};

