// Every example below is written to work for ANY array: loop bounds come from
// LENGTH(...), decisions come from IF / WHILE on the live element values, so
// editing the numbers in DECLARE (or the array size) still gives a correct run.
//
// Colour legend used across the examples:
//   HIGHLIGHT arr[i]              amber, only for the current step ("looking at this")
//   HIGHLIGHT arr[i] 'SUCCESS'    green, stays until changed ("done / answer")
//   HIGHLIGHT arr[i] 'WINDOW'     purple, stays until changed (a range or marked cell)
//   HIGHLIGHT arr[i] 'MARKED'     purple, same colour as 'WINDOW'
//   HIGHLIGHT arr[i] 'DISCARDED'  grey, stays ("ruled out / already used")
//   HIGHLIGHT arr[i] 'NEUTRAL'    back to the normal blue

export const ArrayScripts = {
  ArrayFoundation: `SCENE ArrayFoundation

DECLARE
  ARRAY arr = [10, 20, 30, 40, 50]

SEQUENCE
  // 1. Traversal: visit every index from 0 to LENGTH(arr) - 1
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
  END

  // 2. Insertion: 25 goes in at index 2, everything after it shifts right
  INSERT arr[2] 25
  PRINT "After INSERT:" arr

  // 3. Deletion: remove index 4, everything after it shifts left
  DELETE arr[4]
  PRINT "After DELETE:" arr

  // 4. Update: overwrite the value at index 0
  UPDATE arr[0] 15
  PRINT "After UPDATE:" arr

  // 5. Swap: exchange the values at index 1 and index 3
  SWAP arr[1] arr[3]
  PRINT "After SWAP:" arr

  // 6. Linear search: scan left to right until the target is found
  target = 30
  foundAt = -1
  i = 0
  WHILE i < LENGTH(arr) AND foundAt == -1
    HIGHLIGHT arr[i]
    IF arr[i] == target
      HIGHLIGHT arr[i] 'SUCCESS'
      foundAt = i
    END
    i = i + 1
  END

  IF foundAt == -1
    PRINT target + " is not in the array"
  ELSE
    PRINT "Found " + target + " at index " + foundAt
  END
END
`,

  ArrayReverse: `SCENE ArrayReverse

DECLARE
  ARRAY arr = [1, 2, 3, 4, 5, 6]

SEQUENCE
  // Two pointers start at opposite ends and walk towards each other,
  // swapping as they go. Green cells are already in their final place.
  left = 0
  right = LENGTH(arr) - 1

  WHILE left < right
    SWAP arr[left] arr[right]
    HIGHLIGHT arr[left] 'SUCCESS'
    HIGHLIGHT arr[right] 'SUCCESS'
    left = left + 1
    right = right - 1
  END

  // With an odd length the middle element never moves
  IF left == right
    HIGHLIGHT arr[left] 'SUCCESS'
  END

  PRINT "Reversed:" arr
END
`,

  SlidingWindow: `SCENE SlidingWindow

DECLARE
  ARRAY arr = [2, 1, 5, 1, 3, 2]

SEQUENCE
  // Goal: the largest sum of k consecutive elements.
  // Instead of re-adding k numbers for every position, slide the window
  // one step right: add the element that enters, subtract the one that leaves.
  k = 3

  // Build the first window arr[0 .. k-1]
  windowSum = 0
  LOOP i FROM 0 TO k - 1
    HIGHLIGHT arr[i] 'WINDOW'
    windowSum = windowSum + arr[i]
  END
  best = windowSum
  bestStart = 0
  PRINT "Window [0.." + (k - 1) + "] sum = " + windowSum

  // Slide the window until its right edge reaches the last element
  LOOP i FROM k TO LENGTH(arr) - 1
    HIGHLIGHT arr[i - k] 'NEUTRAL'
    HIGHLIGHT arr[i] 'WINDOW'
    windowSum = windowSum + arr[i] - arr[i - k]
    PRINT "Window [" + (i - k + 1) + ".." + i + "] sum = " + windowSum
    IF windowSum > best
      best = windowSum
      bestStart = i - k + 1
    END
  END

  // Show the best window in green
  LOOP i FROM 0 TO LENGTH(arr) - 1
    IF i >= bestStart AND i < bestStart + k
      HIGHLIGHT arr[i] 'SUCCESS'
    ELSE
      HIGHLIGHT arr[i] 'NEUTRAL'
    END
  END
  PRINT "Maximum sum of " + k + " consecutive elements = " + best
END
`,

  TwoPointerPairSum: `SCENE TwoPointerPairSum

DECLARE
  ARRAY arr = [1, 3, 4, 6, 8, 10]

SEQUENCE
  // The array is sorted. Find two elements that add up to target.
  // If the sum is too small, only moving left forward can increase it;
  // if it is too large, only moving right back can decrease it.
  target = 12
  left = 0
  right = LENGTH(arr) - 1
  found = 0

  HIGHLIGHT arr[left] 'MARKED'
  HIGHLIGHT arr[right] 'MARKED'

  WHILE left < right AND found == 0
    pairSum = arr[left] + arr[right]
    IF pairSum == target
      HIGHLIGHT arr[left] 'SUCCESS'
      HIGHLIGHT arr[right] 'SUCCESS'
      PRINT arr[left] + " + " + arr[right] + " = " + target + "  -> pair found at indices " + left + " and " + right
      found = 1
    ELSE IF pairSum < target
      PRINT arr[left] + " + " + arr[right] + " = " + pairSum + " < " + target + "  -> move left pointer right"
      HIGHLIGHT arr[left] 'DISCARDED'
      left = left + 1
      HIGHLIGHT arr[left] 'MARKED'
    ELSE
      PRINT arr[left] + " + " + arr[right] + " = " + pairSum + " > " + target + "  -> move right pointer left"
      HIGHLIGHT arr[right] 'DISCARDED'
      right = right - 1
      HIGHLIGHT arr[right] 'MARKED'
    END
  END

  IF found == 0
    PRINT "No pair adds up to " + target
  END
END
`,

  FindMaxMin: `SCENE FindMaxMin

DECLARE
  ARRAY arr = [7, 2, 9, 4, 1, 6]

SEQUENCE
  // Scan once, remembering the largest and smallest values seen so far.
  // Green = current maximum, purple = current minimum.
  largest = arr[0]
  smallest = arr[0]
  maxIndex = 0
  minIndex = 0
  HIGHLIGHT arr[0] 'SUCCESS'

  LOOP i FROM 1 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    IF arr[i] > largest
      // The old maximum loses its colour (unless it is still the minimum)
      IF maxIndex == minIndex
        HIGHLIGHT arr[maxIndex] 'MARKED'
      ELSE
        HIGHLIGHT arr[maxIndex] 'NEUTRAL'
      END
      largest = arr[i]
      maxIndex = i
      HIGHLIGHT arr[i] 'SUCCESS'
      PRINT "New maximum " + largest + " at index " + i
    ELSE IF arr[i] < smallest
      IF minIndex != maxIndex
        HIGHLIGHT arr[minIndex] 'NEUTRAL'
      END
      smallest = arr[i]
      minIndex = i
      HIGHLIGHT arr[i] 'MARKED'
      PRINT "New minimum " + smallest + " at index " + i
    END
  END

  PRINT "Maximum = " + largest + " (index " + maxIndex + ")"
  PRINT "Minimum = " + smallest + " (index " + minIndex + ")"
END
`,

  RotateArrayRight: `SCENE RotateArrayRight

DECLARE
  ARRAY arr = [1, 2, 3, 4, 5]

SEQUENCE
  // Rotate right by k places. One rotation = remember the last element,
  // shift every other element one place right, put the saved one at index 0.
  k = 2
  n = LENGTH(arr)
  k = k % n          // rotating by n (or a multiple of n) changes nothing

  r = 0
  WHILE r < k
    last = arr[n - 1]
    HIGHLIGHT arr[n - 1] 'MARKED'
    LOOP j FROM n - 1 TO 1
      UPDATE arr[j] arr[j - 1]
    END
    UPDATE arr[0] last
    HIGHLIGHT arr[0] 'SUCCESS'
    r = r + 1
    PRINT "After rotation " + r + ":" arr
    HIGHLIGHT arr[0] 'NEUTRAL'
  END

  PRINT "Rotated right by " + k + ":" arr
END
`,

  FindDuplicateInArray: `SCENE FindDuplicateInArray

DECLARE
  ARRAY arr = [4, 2, 7, 5, 2, 9]

SEQUENCE
  // Fix one element (purple) and compare it with every element after it.
  // Stop at the first pair of equal values.
  found = 0
  i = 0
  WHILE i < LENGTH(arr) - 1 AND found == 0
    HIGHLIGHT arr[i] 'MARKED'
    j = i + 1
    WHILE j < LENGTH(arr) AND found == 0
      HIGHLIGHT arr[j]
      IF arr[i] == arr[j]
        HIGHLIGHT arr[i] 'SUCCESS'
        HIGHLIGHT arr[j] 'SUCCESS'
        PRINT "Duplicate value " + arr[i] + " at indices " + i + " and " + j
        found = 1
      END
      j = j + 1
    END
    IF found == 0
      HIGHLIGHT arr[i] 'NEUTRAL'
    END
    i = i + 1
  END

  IF found == 0
    PRINT "No duplicates: every value is unique"
  END
END
`,

  MergeTwoSortedArrays: `SCENE MergeTwoSortedArrays

DECLARE
  ARRAY first = [1, 4, 7, 9]
  ARRAY second = [2, 3, 8]
  ARRAY merged = []

SEQUENCE
  // Both inputs are sorted. Compare the front elements, append the smaller
  // one to merged, and move past it (it turns grey once used).
  i = 0
  j = 0
  k = 0

  WHILE i < LENGTH(first) AND j < LENGTH(second)
    COMPARE first[i] second[j]
    IF first[i] <= second[j]
      INSERT merged[k] first[i]
      HIGHLIGHT first[i] 'DISCARDED'
      i = i + 1
    ELSE
      INSERT merged[k] second[j]
      HIGHLIGHT second[j] 'DISCARDED'
      j = j + 1
    END
    k = k + 1
  END

  // One array is used up; copy whatever is left in the other
  WHILE i < LENGTH(first)
    INSERT merged[k] first[i]
    HIGHLIGHT first[i] 'DISCARDED'
    i = i + 1
    k = k + 1
  END
  WHILE j < LENGTH(second)
    INSERT merged[k] second[j]
    HIGHLIGHT second[j] 'DISCARDED'
    j = j + 1
    k = k + 1
  END

  PRINT "Merged:" merged
END
`,

  PrefixSumArray: `SCENE PrefixSumArray

DECLARE
  ARRAY arr = [3, 1, 4, 1, 5]
  ARRAY prefix = []

SEQUENCE
  // prefix[i] = arr[0] + arr[1] + ... + arr[i]
  //           = prefix[i - 1] + arr[i]
  // prefix starts empty and grows by one element per step.
  INSERT prefix[0] arr[0]
  LOOP i FROM 1 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    INSERT prefix[i] prefix[i - 1] + arr[i]
    PRINT "prefix[" + i + "] = prefix[" + (i - 1) + "] + arr[" + i + "] = " + prefix[i]
  END
  PRINT "Prefix sums:" prefix

  // Any range sum arr[lo..hi] is now one subtraction
  lo = 1
  hi = 3
  rangeTotal = 0
  IF lo == 0
    rangeTotal = prefix[hi]
  ELSE
    rangeTotal = prefix[hi] - prefix[lo - 1]
    HIGHLIGHT prefix[lo - 1] 'MARKED'
  END
  HIGHLIGHT prefix[hi] 'SUCCESS'
  LOOP i FROM lo TO hi
    HIGHLIGHT arr[i] 'WINDOW'
  END
  PRINT "Sum of arr[" + lo + ".." + hi + "] = " + rangeTotal
END
`,

  MoveZeroesToEnd: `SCENE MoveZeroesToEnd

DECLARE
  ARRAY arr = [0, 1, 0, 3, 12]

SEQUENCE
  // 'write' is where the next non-zero value belongs. Scan with 'read';
  // each non-zero value is swapped forward to 'write', keeping its order.
  write = 0
  LOOP read FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[read]
    IF arr[read] != 0
      IF read != write
        SWAP arr[write] arr[read]
      END
      HIGHLIGHT arr[write] 'SUCCESS'
      write = write + 1
    END
  END

  // Everything from 'write' to the end is now zero
  WHILE write < LENGTH(arr)
    HIGHLIGHT arr[write] 'DISCARDED'
    write = write + 1
  END

  PRINT "Result:" arr
END
`,

  DutchNationalFlagSort: `SCENE DutchNationalFlagSort

DECLARE
  ARRAY arr = [2, 0, 2, 1, 1, 0]

SEQUENCE
  // Sort an array of 0s, 1s and 2s in one pass with three pointers:
  //   arr[0 .. low-1]    are 0s   (purple)
  //   arr[low .. mid-1]  are 1s
  //   arr[high+1 .. end] are 2s   (green)
  //   arr[mid .. high]   not looked at yet
  low = 0
  mid = 0
  high = LENGTH(arr) - 1

  WHILE mid <= high
    HIGHLIGHT arr[mid]
    IF arr[mid] == 0
      IF low != mid
        SWAP arr[low] arr[mid]
      END
      HIGHLIGHT arr[low] 'MARKED'
      low = low + 1
      mid = mid + 1
    ELSE IF arr[mid] == 1
      mid = mid + 1
    ELSE
      IF mid != high
        SWAP arr[mid] arr[high]
      END
      HIGHLIGHT arr[high] 'SUCCESS'
      high = high - 1
    END
  END

  PRINT "Sorted:" arr
END
`
};
