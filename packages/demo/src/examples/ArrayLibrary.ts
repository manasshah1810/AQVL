export const ArrayScripts = {
  ArrayFoundation: `SCENE ArrayOperations

DECLARE
    ARRAY arr = [10, 20, 30, 40, 50]

SEQUENCE
    // 1. Array Traversal
    LOOP i FROM 0 TO 4
        HIGHLIGHT arr[i]
        WAIT
    END

    // 2. Insertion
    INSERT arr[2] 25
    
    // 3. Deletion
    DELETE arr[4]

    // 4. Update
    UPDATE arr[0] 15
    
    // 5. Swap
    SWAP arr[1] arr[3]
`,
  ArrayReverse: `SCENE ArrayReversal

DECLARE
    ARRAY arr = [1, 2, 3, 4, 5, 6]

SEQUENCE
    // Reversing array in-place using indices
    LOOP i FROM 0 TO 2
        HIGHLIGHT arr[i]
        HIGHLIGHT arr[5-i]
        WAIT
        
        SWAP arr[i] arr[5-i]
        WAIT
    END
`,
  SlidingWindow: `SCENE SlidingWindowMaximum

DECLARE
    ARRAY arr = [2, 1, 5, 1, 3, 2]

SEQUENCE
    // Slide a window of size 3 across the array
    LOOP i FROM 0 TO 3
        HIGHLIGHT arr[i]
        HIGHLIGHT arr[i+2]
        WAIT
    END
`
};
