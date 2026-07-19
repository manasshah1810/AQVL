export const SortingScripts = {
  ArrayTest: `SCENE ArrayFoundationTest

DECLARE
  ARRAY arr = [10, 20, 30, 40]

SEQUENCE
  // 1. Highlight
  HIGHLIGHT arr[0]

  // 2. Compare
  COMPARE arr[0] arr[1]

  // 3. Swap / Move
  SWAP arr[0] arr[1]

  // 4. Update Value
  UPDATE arr[1] 99

  // 5. Insert (Dynamic Resize, Relayout, No Overlap)
  INSERT arr[2] 25

  // 6. Delete
  DELETE arr[3]

  // 7. Push
  PUSH arr 50

  // 8. Pop
  POP arr

  // 9. Peek
  PEEK arr

  // 10. Search
  SEARCH arr 25
END
`,

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
`
};
