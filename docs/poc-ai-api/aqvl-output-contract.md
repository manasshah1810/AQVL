# AQVL Output Contract for AI Generation (PoC)

## 1. PURPOSE
This document defines the strictly fixed subset of AQVL (AlgoQuest Visualization Language) that the temporary AI generation API is permitted to emit. Generated code MUST conform to this contract to ensure it compiles correctly against the existing compiler pipeline and visualizes properly in the existing Playground.

## 2. SOURCE / AUTHORITY
The authoritative specification for the current implementation of AQVL is `docs/LANGUAGE_SPEC.md`. 
The file `docs/grammar.md` is explicitly marked as stale and describes syntax (e.g., semantic indentation, `IMPORT` statements) that is **not** supported by the current implementation. AI generation must rely solely on `LANGUAGE_SPEC.md` and the verified real-world examples found in the `packages/demo/src/examples/` libraries.

## 3. REQUIRED PROGRAM SKELETON
All generated AQVL programs must adhere to the following structure:

```aqvl
SCENE <Name>
DECLARE
  // Data structures and functions go here (Optional)
SEQUENCE
  // Algorithmic execution and visualization statements go here
END
```

- `SCENE <Name>`: Required. Must begin the file.
- `DECLARE`: Optional. Used for declaring structures (e.g., `ARRAY`, `GRAPH`) and `FUNCTION` definitions.
- `SEQUENCE`: Optional (but necessary for execution). Contains the main body of execution.
- `END`: Required to close the `SCENE` block (as well as inner blocks like `LOOP`, `WHILE`, `IF`, `FUNCTION`).

## 4. ALLOWED KEYWORDS / STATEMENTS
The PoC is allowed to generate the following statements:
- Block Controls: `SCENE`, `DECLARE`, `SEQUENCE`, `END`
- Variables: Implicit scalar assignment (`x = 5`)
- Actions: `COMPARE`, `SWAP`, `WAIT`, `HIGHLIGHT`, `LINK`, `SET ... STATE`
- Standard I/O: `PRINT`
- Tree/Node manipulation: `ROOT`, `CHILD`, `NEW_NODE`, `FREE`

## 5. ALLOWED DATA STRUCTURES
The PoC contract permits declaring the following structures in the `DECLARE` block:
- `ARRAY name = [...]`
- `STACK name = [...]`
- `QUEUE name = [...]`
- `SINGLY LINKEDLIST name = [...]`
- `DOUBLY LINKEDLIST name = [...]`
- `CIRCULAR LINKEDLIST name = [...]`
- `BINARY_TREE name = [...]`
- `BST name = [...]`
- `GRAPH name = ["A-B", "A->B:5", ...]`

**Note:** Unsupported structures like `AVL_TREE` and `RED_BLACK` must not be emitted.

## 6. CONTROL FLOW
All blocks must be closed with the `END` keyword (or `{}` for functions, though `END` is preferred for consistency).
- `LOOP identifier FROM expr TO expr ... END`
- `WHILE expr ... END`
- `IF expr ... END`
- `IF expr ... ELSE IF expr ... ELSE ... END`
- `FUNCTION name(args) ... END`
- `RETURN expr`

## 7. EXPRESSIONS / OPERATORS
- **Binary:** `<=`, `>=`, `==`, `!=`, `+`, `-`, `*`, `/`, `>`, `<`
- **Logical:** `AND`, `OR`
- **Built-in Functions:** `LENGTH(arr)`, `MAX(a, b)`, `MIN(a, b)`, `ABS(x)`
- **Member Access:** `node.val`, `node.left`, `list.head`, etc.
- **Queue/Stack reads:** `DEQUEUE(q)`, `POP(s)`, `PEEK(s)`, `IS_EMPTY(x)`

## 8. VISUALIZATION / ACTION STATEMENTS
- `COMPARE a b`
- `SWAP a b`
- `WAIT`
- `HIGHLIGHT target ['COLOR_OR_LABEL']`
- `LINK a TO b`
- `SET target STATE name`

## 9. RESTRICTIONS
- **Indentation is NOT semantic:** Do not rely on indentation for blocks; you MUST use `END`.
- **Imports are NOT supported:** Never generate an `IMPORT` statement.
- **No Early Escapes:** `BREAK` and `CONTINUE` are NOT supported. Use a `WHILE` condition flag to break early.
- **Unsupported Actions:** Documented but unimplemented operations (e.g., `PARENT`, `LCA`, `DEPTH` on non-BST trees) must NOT be emitted.

## 10. FORMATTING RULES
- Keep indentation consistent for readability (2 spaces recommended), even though the compiler ignores it.
- Use ALL CAPS for keywords (`SCENE`, `DECLARE`, `SEQUENCE`, `END`, `IF`, `WHILE`, etc.).
- Ensure a space follows every keyword.

## 11. THREE REAL REFERENCE PROGRAMS

### Reference 1: Bubble Sort
- **Registry ID:** `bubble-sort`
- **Title:** `Bubble Sort`
- **Category:** `Sorting`

```aqvl
SCENE BubbleSort

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  n = LENGTH(arr)
  pass = 0
  swapped = 1

  WHILE swapped == 1 AND pass < n - 1
    swapped = 0
    LOOP j FROM 0 TO n - pass - 2
      COMPARE arr[j] arr[j + 1]
      IF arr[j] > arr[j + 1]
        SWAP arr[j] arr[j + 1]
        swapped = 1
      END
    END
    HIGHLIGHT arr[n - pass - 1] 'SUCCESS'
    pass = pass + 1
    PRINT "After pass " + pass + ":" arr
  END

  IF swapped == 0
    PRINT "Pass " + pass + " made no swaps, so the array is already sorted"
  END

  k = 0
  WHILE k < n - pass
    HIGHLIGHT arr[k] 'SUCCESS'
    k = k + 1
  END
  PRINT "Sorted:" arr
END
```

### Reference 2: Linear Search
- **Registry ID:** `linear-search`
- **Title:** `Linear Search`
- **Category:** `Searching`

```aqvl
SCENE LinearSearch

DECLARE
  ARRAY rollNo = [104, 117, 109, 123, 131, 112, 140]

  FUNCTION linearSearch(target)
    n = LENGTH(rollNo)
    foundAt = -1
    comparisons = 0
    i = 0

    WHILE i < n AND foundAt == -1
      HIGHLIGHT rollNo[i]
      comparisons = comparisons + 1
      IF rollNo[i] == target
        foundAt = i
        HIGHLIGHT rollNo[i] 'SUCCESS'
      ELSE
        HIGHLIGHT rollNo[i] 'DISCARDED'
      END
      i = i + 1
    END

    IF foundAt != -1
      PRINT "Roll no " + target + " found at index " + foundAt + " after " + comparisons + " comparisons"
    ELSE
      PRINT "Roll no " + target + " is absent: all " + comparisons + " cells were checked"
    END
    RETURN foundAt
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(rollNo) - 1
      HIGHLIGHT rollNo[k] 'NEUTRAL'
    END
  END

SEQUENCE
  present = linearSearch(123)
  resetColours()
  absent = linearSearch(150)

  IF present != -1 AND absent == -1
    PRINT "Best case: 1 comparison, worst case: " + LENGTH(rollNo) + " comparisons (O(n))"
  END
END
```

### Reference 3: For Loop Basics
- **Registry ID:** `for-loop-basics`
- **Title:** `For Loop Basics`
- **Category:** `Loops & Control`

```aqvl
SCENE ForLoopBasics

DECLARE
  ARRAY marks = [72, 85, 64, 90, 58]

SEQUENCE
  n = LENGTH(marks)
  PRINT "The class has " + n + " students"

  iterations = 0
  passed = 0
  LOOP i FROM 0 TO n - 1
    HIGHLIGHT marks[i]
    PRINT "Student " + (i + 1) + " (index " + i + ") scored " + marks[i]
    IF marks[i] >= 60
      passed = passed + 1
      HIGHLIGHT marks[i] 'SUCCESS'
    END
    iterations = iterations + 1
  END
  PRINT "The loop body ran " + iterations + " times, once per student"
  PRINT passed + " of " + n + " students scored 60 or more"

  sum = 0
  LOOP k FROM 1 TO 10
    sum = sum + k
  END
  PRINT "1 + 2 + ... + 10 = " + sum

  evens = ""
  LOOP k FROM 1 TO 5
    evens = evens + (2 * k) + " "
  END
  PRINT "First five even numbers: " + evens
END
```

## 12. VERIFICATION NOTES
- **Bubble Sort:** Extracted directly from `SortingLibrary.ts` (`SortingScripts.BubbleSort`). The algorithm accurately maps to registry `bubble-sort`.
- **Linear Search:** Extracted directly from `SearchingLibrary.ts` (`SearchingScripts.LinearSearch`). The algorithm accurately maps to registry `linear-search`.
- **For Loop Basics:** Extracted directly from `LoopLibrary.ts` (`LoopScripts.ForLoopBasics`). The algorithm accurately maps to registry `for-loop-basics`.
- **Compilation Check:** 
  - Bubble Sort — verified successfully via `compile()`
  - Linear Search — verified successfully via `compile()`
  - For Loop Basics — verified successfully via `compile()`
  
## 13. Playground Verification

The three reference programs were manually verified in the existing AQVL Playground:

- Bubble Sort — PASS
- Linear Search — PASS
- For Loop Basics — PASS

Each program compiled and executed successfully in the Playground, with the expected visualization behavior and no runtime errors.

The examples were also independently verified through the existing compiler pipeline using `compile()`.

No compiler, runtime, renderer, shared, or demo source files were modified.
