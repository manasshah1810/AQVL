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
  WhileLoopTest: `SCENE WhileLoopTest

DECLARE
  ARRAY arr = [10, 20, 30]
  VARIABLE i = 0

SEQUENCE
  WHILE i < LENGTH(arr)
    HIGHLIGHT arr[i]
    UPDATE i (i + 1)
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
`
};
