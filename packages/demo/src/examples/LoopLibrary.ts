export const LoopScripts = {
  ForLoopTest: `SCENE ForLoopTest

DECLARE
  ARRAY arr = [1, 2, 3, 4, 5]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
  END
END
`,
  NestedLoopTest: `SCENE NestedLoopTest

DECLARE
  ARRAY arr = [1, 2, 3]

SEQUENCE
  LOOP i FROM 0 TO 2
    LOOP j FROM 0 TO 2
      HIGHLIGHT arr[i]
      HIGHLIGHT arr[j]
    END
  END
END
`,

  SumOfArrayElements: `SCENE SumOfArrayElements

DECLARE
  ARRAY arr = [4, 8, 15, 16, 23, 42]

SEQUENCE
  // Accumulate a running total in a plain scalar variable
  total = 0
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    total = total + arr[i]
    WAIT
  END
END
`,

  FindMaximumInArray: `SCENE FindMaximumInArray

DECLARE
  ARRAY arr = [3, 41, 7, 19, 28, 5]

SEQUENCE
  // Track the largest value seen so far as the loop scans forward
  maxVal = arr[0]
  HIGHLIGHT arr[0]

  LOOP i FROM 1 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    COMPARE arr[i] maxVal
    IF arr[i] > maxVal
      maxVal = arr[i]
      HIGHLIGHT arr[i] 'SUCCESS'
    END
    WAIT
  END
END
`,

  CountdownLoop: `SCENE CountdownLoop

DECLARE
  ARRAY arr = [10, 20, 30, 40, 50]

SEQUENCE
  // LOOP always counts upward, so index from the end to
  // visit elements in reverse: last element first.
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[LENGTH(arr) - 1 - i]
    WAIT
  END
END
`,

  ConditionalLoopFiltering: `SCENE ConditionalLoopFiltering

DECLARE
  ARRAY arr = [1, 2, 3, 4, 5, 6, 7, 8]

SEQUENCE
  // Combine LOOP with IF to act only on elements that pass a condition
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    IF arr[i] > 4
      HIGHLIGHT arr[i] 'SUCCESS'
    END
    WAIT
  END
END
`
};
