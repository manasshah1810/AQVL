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
`
};

