// Every sorting example below is the real algorithm written out with LOOP,
// WHILE, IF / ELSE and (for the divide-and-conquer sorts) recursive FUNCTIONs.
// Nothing is hard-coded: loop bounds come from LENGTH(...) and every decision
// is made on the live element values, so you can change the numbers in
// DECLARE (or the size of the array) and the run is still correct.
//
// Colour legend used across the examples:
//   COMPARE arr[a] arr[b]         the two cells being compared right now
//   HIGHLIGHT arr[i]              amber, only for the current step ("looking at this")
//   HIGHLIGHT arr[i] 'SUCCESS'    green, stays ("this cell is in its final sorted place")
//   HIGHLIGHT arr[i] 'MARKED'     purple, stays (the pivot, the key, the current minimum ...)
//   HIGHLIGHT arr[i] 'WINDOW'     purple, the part of the array being worked on
//   HIGHLIGHT arr[i] 'DISCARDED'  grey, stays ("already used / ruled out")
//   HIGHLIGHT arr[i] 'NEUTRAL'    back to the normal blue
//
// Two language facts the examples rely on:
//   * "/" is real division (7 / 2 = 3.5). The middle of a range is written as
//     (total - total % 2) / 2, which always gives a whole number.
//   * LOOP i FROM a TO b counts DOWN when b < a. Wherever a range may be empty,
//     the examples use WHILE instead, so an empty range runs zero times.

export const SortingScripts = {
  BubbleSort: `SCENE BubbleSort

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
`,

  SelectionSort: `SCENE SelectionSort

DECLARE
  ARRAY arr = [64, 25, 12, 22, 11]

SEQUENCE
  n = LENGTH(arr)
  swaps = 0

  LOOP i FROM 0 TO n - 2
    minIndex = i
    HIGHLIGHT arr[i] 'MARKED'

    LOOP j FROM i + 1 TO n - 1
      COMPARE arr[minIndex] arr[j]
      IF arr[j] < arr[minIndex]
        IF minIndex != i
          HIGHLIGHT arr[minIndex] 'NEUTRAL'
        END
        minIndex = j
        HIGHLIGHT arr[minIndex] 'MARKED'
      END
    END

    IF minIndex != i
      PRINT "Smallest of the rest is " + arr[minIndex] + " at index " + minIndex + ", swap it into index " + i
      SWAP arr[i] arr[minIndex]
      HIGHLIGHT arr[minIndex] 'NEUTRAL'
      swaps = swaps + 1
    ELSE
      PRINT arr[i] + " is already the smallest of the rest, no swap needed"
    END
    HIGHLIGHT arr[i] 'SUCCESS'
  END

  HIGHLIGHT arr[n - 1] 'SUCCESS'
  PRINT "Sorted with " + swaps + " swaps:" arr
END
`,

  InsertionSort: `SCENE InsertionSort

DECLARE
  ARRAY arr = [12, 11, 13, 5, 6]

SEQUENCE
  n = LENGTH(arr)
  shifts = 0

  LOOP i FROM 1 TO n - 1
    key = arr[i]
    HIGHLIGHT arr[i] 'MARKED'
    PRINT "Insert key " + key
    j = i - 1

    keepShifting = 1
    WHILE keepShifting == 1
      IF j < 0
        keepShifting = 0
      ELSE
        HIGHLIGHT arr[j]
        IF arr[j] > key
          UPDATE arr[j + 1] arr[j]
          shifts = shifts + 1
          j = j - 1
        ELSE
          keepShifting = 0
        END
      END
    END

    UPDATE arr[j + 1] key
    HIGHLIGHT arr[i] 'NEUTRAL'
    HIGHLIGHT arr[j + 1]
    PRINT "  placed at index " + (j + 1) + ":" arr
  END

  LOOP k FROM 0 TO n - 1
    HIGHLIGHT arr[k] 'SUCCESS'
  END
  PRINT "Sorted with " + shifts + " shifts:" arr
END
`,

  QuickSort: `SCENE QuickSort

DECLARE
  ARRAY arr = [10, 80, 30, 90, 40, 50, 70]

  FUNCTION partition(low, high)
    pivot = arr[high]
    HIGHLIGHT arr[high] 'MARKED'
    PRINT "Partition [" + low + ".." + high + "] around pivot " + pivot
    wall = low - 1

    LOOP j FROM low TO high - 1
      COMPARE arr[j] arr[high]
      IF arr[j] < pivot
        wall = wall + 1
        IF wall != j
          SWAP arr[wall] arr[j]
        END
      END
    END

    pivotIndex = wall + 1
    IF pivotIndex != high
      SWAP arr[pivotIndex] arr[high]
      HIGHLIGHT arr[high] 'NEUTRAL'
    END
    HIGHLIGHT arr[pivotIndex] 'SUCCESS'
    PRINT "  pivot " + pivot + " is now fixed at index " + pivotIndex + ":" arr
    RETURN pivotIndex
  END

  FUNCTION quickSort(low, high)
    IF low < high
      p = partition(low, high)
      quickSort(low, p - 1)
      quickSort(p + 1, high)
    ELSE IF low == high
      HIGHLIGHT arr[low] 'SUCCESS'
    END
  END

SEQUENCE
  quickSort(0, LENGTH(arr) - 1)
  PRINT "Sorted:" arr
END
`,

  MergeSort: `SCENE MergeSort

DECLARE
  ARRAY arr = [38, 27, 43, 3, 9, 82, 10]
  ARRAY temp = []

  FUNCTION merge(low, mid, high)
    i = low
    j = mid + 1
    k = 0

    WHILE i <= mid AND j <= high
      COMPARE arr[i] arr[j]
      IF arr[i] <= arr[j]
        INSERT temp[k] arr[i]
        i = i + 1
      ELSE
        INSERT temp[k] arr[j]
        j = j + 1
      END
      k = k + 1
    END
    WHILE i <= mid
      INSERT temp[k] arr[i]
      i = i + 1
      k = k + 1
    END
    WHILE j <= high
      INSERT temp[k] arr[j]
      j = j + 1
      k = k + 1
    END

    t = 0
    WHILE t < k
      UPDATE arr[low + t] temp[t]
      HIGHLIGHT arr[low + t] 'WINDOW'
      t = t + 1
    END
    WHILE LENGTH(temp) > 0
      DELETE temp[0]
    END
    PRINT "Merged [" + low + ".." + high + "]:" arr
  END

  FUNCTION mergeSort(low, high)
    IF low < high
      total = low + high
      mid = (total - total % 2) / 2
      mergeSort(low, mid)
      mergeSort(mid + 1, high)
      merge(low, mid, high)
    END
  END

SEQUENCE
  mergeSort(0, LENGTH(arr) - 1)
  LOOP k FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[k] 'SUCCESS'
  END
  PRINT "Sorted:" arr
END
`,

  HeapSort: `SCENE HeapSort

DECLARE
  ARRAY arr = [12, 11, 13, 5, 6, 7]

  FUNCTION siftDown(start, size)
    parent = start
    keepSifting = 1
    WHILE keepSifting == 1
      largest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        COMPARE arr[left] arr[largest]
        IF arr[left] > arr[largest]
          largest = left
        END
      END
      IF right < size
        COMPARE arr[right] arr[largest]
        IF arr[right] > arr[largest]
          largest = right
        END
      END
      IF largest == parent
        keepSifting = 0
      ELSE
        SWAP arr[parent] arr[largest]
        parent = largest
      END
    END
  END

SEQUENCE
  n = LENGTH(arr)

  half = (n - n % 2) / 2
  i = half - 1
  WHILE i >= 0
    siftDown(i, n)
    i = i - 1
  END
  PRINT "Max-heap (largest value at index 0):" arr

  last = n - 1
  WHILE last > 0
    SWAP arr[0] arr[last]
    HIGHLIGHT arr[last] 'SUCCESS'
    siftDown(0, last)
    PRINT "Moved " + arr[last] + " to index " + last + ":" arr
    last = last - 1
  END
  HIGHLIGHT arr[0] 'SUCCESS'
  PRINT "Sorted:" arr
END
`,

  ShellSort: `SCENE ShellSort

DECLARE
  ARRAY arr = [23, 12, 1, 8, 34, 54, 2, 3]

SEQUENCE
  n = LENGTH(arr)
  gap = (n - n % 2) / 2

  WHILE gap > 0
    PRINT "Gap = " + gap
    i = gap
    WHILE i < n
      j = i
      keepMoving = 1
      WHILE keepMoving == 1
        IF j < gap
          keepMoving = 0
        ELSE
          COMPARE arr[j - gap] arr[j]
          IF arr[j - gap] > arr[j]
            SWAP arr[j - gap] arr[j]
            j = j - gap
          ELSE
            keepMoving = 0
          END
        END
      END
      i = i + 1
    END
    PRINT "  after gap " + gap + ":" arr
    gap = (gap - gap % 2) / 2
  END

  LOOP k FROM 0 TO n - 1
    HIGHLIGHT arr[k] 'SUCCESS'
  END
  PRINT "Sorted:" arr
END
`,

  CocktailShakerSort: `SCENE CocktailShakerSort

DECLARE
  ARRAY arr = [5, 1, 4, 2, 8, 0, 2]

SEQUENCE
  start = 0
  finish = LENGTH(arr) - 1
  swapped = 1

  WHILE swapped == 1 AND start < finish
    swapped = 0
    j = start
    WHILE j < finish
      COMPARE arr[j] arr[j + 1]
      IF arr[j] > arr[j + 1]
        SWAP arr[j] arr[j + 1]
        swapped = 1
      END
      j = j + 1
    END
    HIGHLIGHT arr[finish] 'SUCCESS'
    finish = finish - 1

    IF swapped == 1
      swapped = 0
      j = finish - 1
      WHILE j >= start
        COMPARE arr[j] arr[j + 1]
        IF arr[j] > arr[j + 1]
          SWAP arr[j] arr[j + 1]
          swapped = 1
        END
        j = j - 1
      END
      HIGHLIGHT arr[start] 'SUCCESS'
      start = start + 1
    END
    PRINT "Window now [" + start + ".." + finish + "]:" arr
  END

  k = start
  WHILE k <= finish
    HIGHLIGHT arr[k] 'SUCCESS'
    k = k + 1
  END
  PRINT "Sorted:" arr
END
`,

  CountingSort: `SCENE CountingSort

DECLARE
  ARRAY arr = [4, 2, 2, 8, 3, 3, 1]
  ARRAY counts = []
  ARRAY output = []

SEQUENCE
  n = LENGTH(arr)

  maxValue = arr[0]
  LOOP i FROM 1 TO n - 1
    IF arr[i] > maxValue
      maxValue = arr[i]
    END
  END
  PRINT "Largest value = " + maxValue + ", so counts has indices 0.." + maxValue

  LOOP v FROM 0 TO maxValue
    INSERT counts[v] 0
  END

  LOOP i FROM 0 TO n - 1
    HIGHLIGHT arr[i]
    value = arr[i]
    UPDATE counts[value] counts[value] + 1
    HIGHLIGHT counts[value] 'MARKED'
  END
  PRINT "Counts:" counts

  k = 0
  LOOP v FROM 0 TO maxValue
    HIGHLIGHT counts[v]
    WHILE counts[v] > 0
      INSERT output[k] v
      UPDATE counts[v] counts[v] - 1
      k = k + 1
    END
    HIGHLIGHT counts[v] 'DISCARDED'
  END

  LOOP i FROM 0 TO n - 1
    UPDATE arr[i] output[i]
    HIGHLIGHT arr[i] 'SUCCESS'
  END
  PRINT "Sorted:" arr
END
`,

  RadixSort: `SCENE RadixSort

DECLARE
  ARRAY arr = [170, 45, 75, 90, 802, 24, 2, 66]
  ARRAY digitCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ARRAY output = []

SEQUENCE
  n = LENGTH(arr)
  maxValue = arr[0]
  LOOP i FROM 0 TO n - 1
    INSERT output[i] 0
    IF arr[i] > maxValue
      maxValue = arr[i]
    END
  END

  place = 1
  WHILE place <= maxValue
    LOOP d FROM 0 TO 9
      UPDATE digitCount[d] 0
    END

    LOOP i FROM 0 TO n - 1
      value = arr[i]
      shifted = (value - value % place) / place
      digit = shifted % 10
      UPDATE digitCount[digit] digitCount[digit] + 1
    END

    LOOP d FROM 1 TO 9
      UPDATE digitCount[d] digitCount[d] + digitCount[d - 1]
    END

    LOOP i FROM n - 1 TO 0
      HIGHLIGHT arr[i]
      value = arr[i]
      shifted = (value - value % place) / place
      digit = shifted % 10
      slot = digitCount[digit] - 1
      UPDATE output[slot] value
      UPDATE digitCount[digit] slot
    END

    LOOP i FROM 0 TO n - 1
      UPDATE arr[i] output[i]
    END
    PRINT "Sorted by the digit worth " + place + ":" arr
    place = place * 10
  END

  LOOP k FROM 0 TO n - 1
    HIGHLIGHT arr[k] 'SUCCESS'
  END
  PRINT "Sorted:" arr
END
`,

  CycleSort: `SCENE CycleSort

DECLARE
  ARRAY arr = [20, 40, 50, 10, 30]

SEQUENCE
  n = LENGTH(arr)
  writes = 0

  LOOP cycleStart FROM 0 TO n - 2
    item = arr[cycleStart]
    HIGHLIGHT arr[cycleStart] 'MARKED'

    pos = cycleStart
    LOOP i FROM cycleStart + 1 TO n - 1
      IF arr[i] < item
        pos = pos + 1
      END
    END

    IF pos == cycleStart
      PRINT item + " is already in its place"
    ELSE
      WHILE item == arr[pos]
        pos = pos + 1
      END
      held = arr[pos]
      UPDATE arr[pos] item
      HIGHLIGHT arr[pos] 'SUCCESS'
      PRINT "Write " + item + " to index " + pos + ", pick up " + held
      item = held
      writes = writes + 1

      WHILE pos != cycleStart
        pos = cycleStart
        LOOP i FROM cycleStart + 1 TO n - 1
          IF arr[i] < item
            pos = pos + 1
          END
        END
        WHILE item == arr[pos] AND pos != cycleStart
          pos = pos + 1
        END
        held = arr[pos]
        UPDATE arr[pos] item
        HIGHLIGHT arr[pos] 'SUCCESS'
        PRINT "Write " + item + " to index " + pos + ", pick up " + held
        item = held
        writes = writes + 1
      END
    END
    HIGHLIGHT arr[cycleStart] 'SUCCESS'
  END

  HIGHLIGHT arr[n - 1] 'SUCCESS'
  PRINT "Sorted with " + writes + " writes:" arr
END
`,

  PancakeSort: `SCENE PancakeSort

DECLARE
  ARRAY arr = [3, 6, 1, 10, 7, 2]

  FUNCTION flip(k)
    left = 0
    right = k
    WHILE left < right
      SWAP arr[left] arr[right]
      left = left + 1
      right = right - 1
    END
  END

SEQUENCE
  flips = 0
  size = LENGTH(arr)

  WHILE size > 1
    maxIndex = 0
    LOOP i FROM 1 TO size - 1
      COMPARE arr[i] arr[maxIndex]
      IF arr[i] > arr[maxIndex]
        maxIndex = i
      END
    END

    IF maxIndex != size - 1
      IF maxIndex != 0
        flip(maxIndex)
        flips = flips + 1
        PRINT "Flip top " + (maxIndex + 1) + " to bring " + arr[0] + " to the top:" arr
      END
      flip(size - 1)
      flips = flips + 1
      PRINT "Flip top " + size + " to put " + arr[size - 1] + " at the bottom:" arr
    END
    HIGHLIGHT arr[size - 1] 'SUCCESS'
    size = size - 1
  END

  HIGHLIGHT arr[0] 'SUCCESS'
  PRINT "Sorted with " + flips + " flips:" arr
END
`,

  // ── Practical problems solved with sorting ──────────────────────────────

  ExamRankList: `SCENE ExamRankList

DECLARE
  ARRAY rollNo = [101, 102, 103, 104, 105, 106]
  ARRAY marks = [72, 95, 64, 88, 95, 50]

SEQUENCE
  n = LENGTH(marks)

  LOOP i FROM 0 TO n - 2
    best = i
    LOOP j FROM i + 1 TO n - 1
      COMPARE marks[best] marks[j]
      IF marks[j] > marks[best]
        best = j
      END
    END
    IF best != i
      SWAP marks[i] marks[best]
      SWAP rollNo[i] rollNo[best]
    END
    HIGHLIGHT marks[i] 'SUCCESS'
    HIGHLIGHT rollNo[i] 'SUCCESS'
  END
  HIGHLIGHT marks[n - 1] 'SUCCESS'
  HIGHLIGHT rollNo[n - 1] 'SUCCESS'

  PRINT "Rank list:"
  rank = 1
  LOOP i FROM 0 TO n - 1
    IF i > 0
      IF marks[i] != marks[i - 1]
        rank = i + 1
      END
    END
    PRINT "  Rank " + rank + ": roll no " + rollNo[i] + " with " + marks[i] + " marks"
  END
END
`,

  LeaderboardInsert: `SCENE LeaderboardInsert

DECLARE
  ARRAY board = [980, 870, 850, 640, 500]
  ARRAY newScores = [900, 450, 870, 1000]

SEQUENCE
  boardSize = LENGTH(board)

  LOOP s FROM 0 TO LENGTH(newScores) - 1
    score = newScores[s]
    HIGHLIGHT newScores[s] 'MARKED'

    pos = LENGTH(board)
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF pos == 0
        keepClimbing = 0
      ELSE IF score > board[pos - 1]
        pos = pos - 1
      ELSE
        keepClimbing = 0
      END
    END

    IF pos < boardSize
      INSERT board[pos] score
      HIGHLIGHT board[pos] 'SUCCESS'
      DELETE board[LENGTH(board) - 1]
      PRINT score + " enters the board at rank " + (pos + 1) + ":" board
      HIGHLIGHT board[pos] 'NEUTRAL'
    ELSE
      PRINT score + " is too low for the top " + boardSize
    END
    HIGHLIGHT newScores[s] 'DISCARDED'
  END
END
`,

  CountInversions: `SCENE CountInversions

DECLARE
  ARRAY arr = [3, 1, 5, 2, 4]
  ARRAY temp = []

  FUNCTION mergeCount(low, mid, high)
    i = low
    j = mid + 1
    k = 0
    found = 0
    WHILE i <= mid AND j <= high
      COMPARE arr[i] arr[j]
      IF arr[i] <= arr[j]
        INSERT temp[k] arr[i]
        i = i + 1
      ELSE
        INSERT temp[k] arr[j]
        found = found + (mid - i + 1)
        PRINT "  " + arr[j] + " jumps ahead of " + (mid - i + 1) + " larger value(s)"
        j = j + 1
      END
      k = k + 1
    END
    WHILE i <= mid
      INSERT temp[k] arr[i]
      i = i + 1
      k = k + 1
    END
    WHILE j <= high
      INSERT temp[k] arr[j]
      j = j + 1
      k = k + 1
    END
    t = 0
    WHILE t < k
      UPDATE arr[low + t] temp[t]
      t = t + 1
    END
    WHILE LENGTH(temp) > 0
      DELETE temp[0]
    END
    RETURN found
  END

  FUNCTION sortCount(low, high)
    IF low >= high
      RETURN 0
    END
    total = low + high
    mid = (total - total % 2) / 2
    leftCount = sortCount(low, mid)
    rightCount = sortCount(mid + 1, high)
    crossCount = mergeCount(low, mid, high)
    RETURN leftCount + rightCount + crossCount
  END

SEQUENCE
  inversions = sortCount(0, LENGTH(arr) - 1)
  n = LENGTH(arr)
  PRINT "Inversions: " + inversions + " (the most possible for " + n + " items is " + (n * (n - 1) / 2) + ")"
  PRINT "Sorted:" arr
END
`,

  QuickSelectKth: `SCENE QuickSelectKth

DECLARE
  ARRAY times = [34, 12, 45, 7, 23, 18, 29]

SEQUENCE
  n = LENGTH(times)
  k = (n + 1 - (n + 1) % 2) / 2
  target = k - 1
  low = 0
  high = n - 1
  answer = -1

  WHILE answer == -1
    pivot = times[high]
    HIGHLIGHT times[high] 'MARKED'
    wall = low - 1
    j = low
    WHILE j < high
      COMPARE times[j] times[high]
      IF times[j] < pivot
        wall = wall + 1
        IF wall != j
          SWAP times[wall] times[j]
        END
      END
      j = j + 1
    END
    p = wall + 1
    IF p != high
      SWAP times[p] times[high]
      HIGHLIGHT times[high] 'NEUTRAL'
    END
    PRINT "Pivot " + pivot + " belongs at index " + p

    IF p == target
      answer = times[p]
      HIGHLIGHT times[p] 'SUCCESS'
    ELSE IF p < target
      LOOP x FROM low TO p
        HIGHLIGHT times[x] 'DISCARDED'
      END
      low = p + 1
    ELSE
      LOOP x FROM p TO high
        HIGHLIGHT times[x] 'DISCARDED'
      END
      high = p - 1
    END
  END

  PRINT "Median time (position " + k + " of " + n + " in sorted order) is " + answer
END
`,

  SortCheckAndStability: `SCENE SortCheckAndStability

DECLARE
  ARRAY price = [300, 150, 300, 150, 200]
  ARRAY itemId = [1, 2, 3, 4, 5]

SEQUENCE
  n = LENGTH(price)

  isSorted = 1
  LOOP i FROM 0 TO n - 2
    COMPARE price[i] price[i + 1]
    IF price[i] > price[i + 1]
      isSorted = 0
    END
  END
  IF isSorted == 1
    PRINT "Already sorted, nothing to do"
  ELSE
    PRINT "Not sorted yet, running insertion sort"
  END

  LOOP i FROM 1 TO n - 1
    keyPrice = price[i]
    keyId = itemId[i]
    j = i - 1
    keepShifting = 1
    WHILE keepShifting == 1
      IF j < 0
        keepShifting = 0
      ELSE IF price[j] > keyPrice
        UPDATE price[j + 1] price[j]
        UPDATE itemId[j + 1] itemId[j]
        j = j - 1
      ELSE
        keepShifting = 0
      END
    END
    UPDATE price[j + 1] keyPrice
    UPDATE itemId[j + 1] keyId
  END

  LOOP i FROM 0 TO n - 1
    HIGHLIGHT price[i] 'SUCCESS'
    PRINT "  item " + itemId[i] + " costs " + price[i]
  END
  PRINT "Prices:" price
  PRINT "Item ids:" itemId
END
`
};
