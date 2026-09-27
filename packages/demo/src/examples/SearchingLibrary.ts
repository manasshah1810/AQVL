// Every searching example below is the real algorithm written out with LOOP,
// WHILE, IF / ELSE IF / ELSE and (where it is natural) recursive FUNCTIONs.
// Nothing is hard-coded: loop bounds come from LENGTH(...), the middle of a
// range is computed from low and high, and every decision is made on the live
// values. Change the numbers in DECLARE or the target and the run is still
// correct, including the "not found" case.
//
// Colour legend used across the examples:
//   HIGHLIGHT arr[i]              amber, only for the current step ("checking this cell")
//   HIGHLIGHT arr[i] 'SUCCESS'    green, stays ("found it")
//   HIGHLIGHT arr[i] 'MARKED'     purple, stays (the middle / probe / block end)
//   HIGHLIGHT arr[i] 'WINDOW'     purple, the range that can still hold the target
//   HIGHLIGHT arr[i] 'DISCARDED'  grey, stays ("ruled out, never looked at again")
//   HIGHLIGHT arr[i] 'NEUTRAL'    back to the normal blue
//
// Language facts the examples rely on:
//   * "/" is real division (7 / 2 = 3.5). The middle of a range is written as
//     low + (size - size % 2) / 2 with size = high - low, which is always a
//     whole number, exactly like (low + high) / 2 in C or Java.
//   * LOOP i FROM a TO b counts DOWN when b < a. Wherever a range may be empty
//     (low > high), the examples use WHILE instead, so it runs zero times.
//   * Variables set inside a FUNCTION are local to that call; the arrays in
//     DECLARE are shared, so a FUNCTION can read and colour them.
//   * -1 is used as "not found", the same convention as C, Java and Python.

export const SearchingScripts = {
  LinearSearch: `SCENE LinearSearch

DECLARE
  // Roll numbers in the order students entered the exam hall (NOT sorted)
  ARRAY rollNo = [104, 117, 109, 123, 131, 112, 140]

  // Check every cell from left to right until the target turns up.
  // Returns the index of the first match, or -1 when it is not there.
  FUNCTION linearSearch(target)
    n = LENGTH(rollNo)
    foundAt = -1
    comparisons = 0
    i = 0

    // Two reasons to stop: we ran out of cells, or we already found it
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

  // Paint every cell blue again before the next search
  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(rollNo) - 1
      HIGHLIGHT rollNo[k] 'NEUTRAL'
    END
  END

SEQUENCE
  // Linear search works on ANY array, sorted or not, because it simply
  // looks at every cell. The cost is that a miss checks all n cells.
  present = linearSearch(123)
  resetColours()
  absent = linearSearch(150)

  IF present != -1 AND absent == -1
    PRINT "Best case: 1 comparison, worst case: " + LENGTH(rollNo) + " comparisons (O(n))"
  END
END
`,

  AllOccurrences: `SCENE AllOccurrences

DECLARE
  // Goals scored by a football team in each match of the season
  ARRAY goals = [2, 0, 3, 1, 3, 0, 3, 2, 1, 3]
  ARRAY matches = []

SEQUENCE
  // A plain linear search stops at the first match. To find EVERY match
  // we must not stop early: walk the whole array and record each index.
  target = 3
  n = LENGTH(goals)
  count = 0
  first = -1
  last = -1

  LOOP i FROM 0 TO n - 1
    HIGHLIGHT goals[i]
    IF goals[i] == target
      HIGHLIGHT goals[i] 'SUCCESS'
      INSERT matches[count] i
      count = count + 1
      // The first match is remembered only once; the last one keeps moving
      IF first == -1
        first = i
      END
      last = i
    END
  END

  IF count == 0
    PRINT "The team never scored " + target + " goals"
  ELSE
    PRINT "Scored " + target + " goals in " + count + " matches, at indexes:" matches
    PRINT "First time: match index " + first + ", last time: match index " + last
  END
END
`,

  SentinelLinearSearch: `SCENE SentinelLinearSearch

DECLARE
  // Product barcodes on a supermarket shelf
  ARRAY codes = [5021, 7310, 4402, 9981, 6605, 3217]

  // The normal loop checks TWO things every step: "i < n" and
  // "codes[i] == target". A sentinel search copies the target into the last
  // cell first, so the loop is guaranteed to stop and only needs ONE check.
  // Afterwards the real last value is put back.
  FUNCTION sentinelSearch(target)
    n = LENGTH(codes)
    lastValue = codes[n - 1]
    UPDATE codes[n - 1] target
    HIGHLIGHT codes[n - 1] 'MARKED'

    i = 0
    WHILE codes[i] != target
      HIGHLIGHT codes[i] 'DISCARDED'
      i = i + 1
    END

    // Put the real value back
    UPDATE codes[n - 1] lastValue
    HIGHLIGHT codes[n - 1] 'NEUTRAL'

    // We stopped either on a real match, or on the sentinel in the last cell
    IF i < n - 1 OR lastValue == target
      HIGHLIGHT codes[i] 'SUCCESS'
      PRINT "Barcode " + target + " is at index " + i
      RETURN i
    ELSE
      PRINT "Barcode " + target + " is not on the shelf (only the sentinel matched)"
      RETURN -1
    END
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(codes) - 1
      HIGHLIGHT codes[k] 'NEUTRAL'
    END
  END

SEQUENCE
  sentinelSearch(9981)
  resetColours()
  sentinelSearch(3217)
  resetColours()
  sentinelSearch(1111)
  PRINT "Shelf unchanged after the searches:" codes
END
`,

  BinarySearch: `SCENE BinarySearch

DECLARE
  // Prices in a sorted price list. Binary search NEEDS sorted input.
  ARRAY price = [11, 12, 22, 25, 34, 64, 90, 105, 120]

  // Look at the middle of the window [low .. high]:
  //   equal   -> found
  //   smaller -> the target can only be to the RIGHT, so low = mid + 1
  //   bigger  -> the target can only be to the LEFT,  so high = mid - 1
  // Every step throws away half of the window.
  FUNCTION binarySearch(target)
    low = 0
    high = LENGTH(price) - 1
    step = 0

    WHILE low <= high
      step = step + 1
      size = high - low
      mid = low + (size - size % 2) / 2
      HIGHLIGHT price[mid] 'MARKED'
      PRINT "Step " + step + ": low=" + low + " high=" + high + " mid=" + mid + " (value " + price[mid] + ")"

      IF price[mid] == target
        HIGHLIGHT price[mid] 'SUCCESS'
        PRINT "Found " + target + " at index " + mid + " in " + step + " steps"
        RETURN mid
      ELSE IF price[mid] < target
        // Everything from low to mid is too small: grey it out
        k = low
        WHILE k <= mid
          HIGHLIGHT price[k] 'DISCARDED'
          k = k + 1
        END
        low = mid + 1
      ELSE
        // Everything from mid to high is too big
        k = mid
        WHILE k <= high
          HIGHLIGHT price[k] 'DISCARDED'
          k = k + 1
        END
        high = mid - 1
      END
    END

    // The window became empty (low > high): the target is not there
    PRINT target + " is not in the list (window empty after " + step + " steps)"
    RETURN -1
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(price) - 1
      HIGHLIGHT price[k] 'NEUTRAL'
    END
  END

SEQUENCE
  binarySearch(90)
  resetColours()
  binarySearch(11)
  resetColours()
  binarySearch(50)

  // Worst case: how many times can the window be halved before it is empty?
  size = LENGTH(price)
  maxSteps = 0
  WHILE size > 0
    maxSteps = maxSteps + 1
    size = (size - size % 2) / 2
  END
  PRINT "Never more than " + maxSteps + " steps for " + LENGTH(price) + " prices (O(log n)); linear search may need " + LENGTH(price)
END
`,

  BinarySearchRecursive: `SCENE BinarySearchRecursive

DECLARE
  // Page numbers where chapters start in a textbook (sorted)
  ARRAY chapterStart = [1, 15, 32, 47, 60, 78, 95, 110, 126, 140]

  // The same idea as the loop version, written as a recursive FUNCTION.
  // Each call handles one window [low .. high] and calls itself on the
  // half that can still contain the target. 'depth' is only for printing.
  FUNCTION search(target, low, high, depth)
    IF low > high
      PRINT "  depth " + depth + ": empty window, " + target + " is not a chapter start"
      RETURN -1
    END

    size = high - low
    mid = low + (size - size % 2) / 2
    HIGHLIGHT chapterStart[mid] 'MARKED'
    PRINT "  depth " + depth + ": window [" + low + ".." + high + "], middle page " + chapterStart[mid]

    IF chapterStart[mid] == target
      HIGHLIGHT chapterStart[mid] 'SUCCESS'
      RETURN mid
    ELSE IF chapterStart[mid] < target
      HIGHLIGHT chapterStart[mid] 'DISCARDED'
      RETURN search(target, mid + 1, high, depth + 1)
    ELSE
      HIGHLIGHT chapterStart[mid] 'DISCARDED'
      RETURN search(target, low, mid - 1, depth + 1)
    END
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(chapterStart) - 1
      HIGHLIGHT chapterStart[k] 'NEUTRAL'
    END
  END

SEQUENCE
  PRINT "Does a chapter start on page 110?"
  index = search(110, 0, LENGTH(chapterStart) - 1, 1)
  IF index != -1
    PRINT "Yes, chapter " + (index + 1) + " starts on page 110"
  END

  resetColours()
  PRINT "Does a chapter start on page 50?"
  index = search(50, 0, LENGTH(chapterStart) - 1, 1)
  IF index == -1
    PRINT "No, page 50 is in the middle of a chapter"
  END
END
`,

  FirstAndLastOccurrence: `SCENE FirstAndLastOccurrence

DECLARE
  // Marks of a class, sorted. Several students share the same mark.
  ARRAY marks = [35, 42, 42, 58, 67, 67, 67, 67, 81, 90]

  // Ordinary binary search stops at ANY copy of the target. To find the
  // FIRST copy, keep searching to the left after a match; for the LAST
  // copy, keep searching to the right. 'answer' remembers the best match.
  FUNCTION firstIndex(target)
    low = 0
    high = LENGTH(marks) - 1
    answer = -1
    WHILE low <= high
      size = high - low
      mid = low + (size - size % 2) / 2
      HIGHLIGHT marks[mid]
      IF marks[mid] == target
        answer = mid
        high = mid - 1
      ELSE IF marks[mid] < target
        low = mid + 1
      ELSE
        high = mid - 1
      END
    END
    RETURN answer
  END

  FUNCTION lastIndex(target)
    low = 0
    high = LENGTH(marks) - 1
    answer = -1
    WHILE low <= high
      size = high - low
      mid = low + (size - size % 2) / 2
      HIGHLIGHT marks[mid]
      IF marks[mid] == target
        answer = mid
        low = mid + 1
      ELSE IF marks[mid] < target
        low = mid + 1
      ELSE
        high = mid - 1
      END
    END
    RETURN answer
  END

  FUNCTION report(target)
    first = firstIndex(target)
    IF first == -1
      PRINT "Nobody scored " + target
    ELSE
      last = lastIndex(target)
      k = first
      WHILE k <= last
        HIGHLIGHT marks[k] 'SUCCESS'
        k = k + 1
      END
      count = last - first + 1
      IF count == 1
        PRINT target + " marks: only index " + first + ", so 1 student"
      ELSE
        PRINT target + " marks: first at index " + first + ", last at index " + last + ", so " + count + " students"
      END
    END
  END

SEQUENCE
  report(67)
  report(42)
  report(35)
  report(70)
END
`,

  SearchInsertPosition: `SCENE SearchInsertPosition

DECLARE
  // Today's appointment times at a clinic, sorted (930 means 9:30)
  ARRAY slots = [900, 930, 1015, 1100, 1245, 1400]

  // Find the index of the first slot that is >= newTime (the "lower bound").
  // That is where the new appointment must go to keep the list sorted.
  // When every slot is smaller, the answer is LENGTH(slots): the very end.
  FUNCTION insertPosition(newTime)
    low = 0
    high = LENGTH(slots) - 1
    answer = LENGTH(slots)
    WHILE low <= high
      size = high - low
      mid = low + (size - size % 2) / 2
      HIGHLIGHT slots[mid]
      IF slots[mid] >= newTime
        // mid could be the answer, but something further left might be too
        answer = mid
        high = mid - 1
      ELSE
        low = mid + 1
      END
    END
    RETURN answer
  END

  FUNCTION book(newTime)
    pos = insertPosition(newTime)
    IF pos < LENGTH(slots) AND slots[pos] == newTime
      HIGHLIGHT slots[pos] 'DISCARDED'
      PRINT newTime + " is already booked"
    ELSE
      INSERT slots[pos] newTime
      HIGHLIGHT slots[pos] 'SUCCESS'
      PRINT "Booked " + newTime + " at index " + pos + ":" slots
    END
  END

SEQUENCE
  book(1030)
  book(830)
  book(1500)
  book(1100)
END
`,

  JumpSearch: `SCENE JumpSearch

DECLARE
  // Seat numbers already sold for a show, sorted
  ARRAY sold = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]

  // Integer square root, found with a loop: the largest s with s * s <= n
  FUNCTION intSqrt(n)
    s = 0
    WHILE (s + 1) * (s + 1) <= n
      s = s + 1
    END
    RETURN s
  END

  // Jump ahead in blocks of 'step' cells, looking only at the LAST cell of
  // each block. Once a block's last cell is >= target, the target can only
  // be inside that block, so scan it from left to right.
  FUNCTION jumpSearch(target)
    n = LENGTH(sold)
    step = intSqrt(n)
    blockStart = 0
    blockEnd = step - 1
    jumps = 0

    WHILE blockEnd < n - 1 AND sold[blockEnd] < target
      HIGHLIGHT sold[blockEnd] 'MARKED'
      PRINT "  block end " + sold[blockEnd] + " < " + target + ", jump"
      jumps = jumps + 1
      blockStart = blockEnd + 1
      blockEnd = blockEnd + step
      IF blockEnd > n - 1
        blockEnd = n - 1
      END
    END
    PRINT "  scan block [" + blockStart + ".." + blockEnd + "] after " + jumps + " jumps"

    i = blockStart
    WHILE i <= blockEnd
      HIGHLIGHT sold[i]
      IF sold[i] == target
        HIGHLIGHT sold[i] 'SUCCESS'
        PRINT "Seat " + target + " is sold (index " + i + ")"
        RETURN i
      ELSE IF sold[i] > target
        // Sorted: once we pass the target it cannot appear later
        i = blockEnd
      END
      i = i + 1
    END
    PRINT "Seat " + target + " is still free"
    RETURN -1
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(sold) - 1
      HIGHLIGHT sold[k] 'NEUTRAL'
    END
  END

SEQUENCE
  PRINT "Block size = sqrt(" + LENGTH(sold) + ") = " + intSqrt(LENGTH(sold))
  jumpSearch(23)
  resetColours()
  jumpSearch(8)
  resetColours()
  jumpSearch(31)
END
`,

  ExponentialSearch: `SCENE ExponentialSearch

DECLARE
  // Sorted IDs in a long log. The target is usually near the front.
  ARRAY ids = [2, 4, 7, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105]

  // Phase 1: grow 'bound' as 1, 2, 4, 8 ... until ids[bound] >= target
  //          (or the array ends). Now the target lies in [bound/2 .. bound].
  // Phase 2: an ordinary binary search inside that small range.
  FUNCTION exponentialSearch(target)
    n = LENGTH(ids)
    IF ids[0] == target
      HIGHLIGHT ids[0] 'SUCCESS'
      PRINT target + " found at index 0"
      RETURN 0
    END

    bound = 1
    WHILE bound < n AND ids[bound] < target
      HIGHLIGHT ids[bound] 'MARKED'
      bound = bound * 2
    END
    // Half of the bound, rounded down (bound = 1 gives 0, not 0.5)
    low = (bound - bound % 2) / 2
    high = bound
    IF high > n - 1
      high = n - 1
    END
    PRINT "  bound stopped at " + bound + ", binary search in [" + low + ".." + high + "]"

    WHILE low <= high
      size = high - low
      mid = low + (size - size % 2) / 2
      HIGHLIGHT ids[mid]
      IF ids[mid] == target
        HIGHLIGHT ids[mid] 'SUCCESS'
        PRINT target + " found at index " + mid
        RETURN mid
      ELSE IF ids[mid] < target
        low = mid + 1
      ELSE
        high = mid - 1
      END
    END
    PRINT target + " is not in the log"
    RETURN -1
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(ids) - 1
      HIGHLIGHT ids[k] 'NEUTRAL'
    END
  END

SEQUENCE
  exponentialSearch(10)
  resetColours()
  exponentialSearch(78)
  resetColours()
  exponentialSearch(100)
END
`,

  TernarySearch: `SCENE TernarySearch

DECLARE
  ARRAY arr = [2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 80, 94]

  // Split the window into three parts with two probes, m1 and m2:
  //   target < arr[m1]           -> keep only the left third
  //   target > arr[m2]           -> keep only the right third
  //   otherwise                  -> keep the middle third
  FUNCTION ternarySearch(target)
    low = 0
    high = LENGTH(arr) - 1
    rounds = 0
    WHILE low <= high
      rounds = rounds + 1
      size = high - low
      third = (size - size % 3) / 3
      m1 = low + third
      m2 = high - third
      HIGHLIGHT arr[m1] 'MARKED'
      HIGHLIGHT arr[m2] 'MARKED'
      PRINT "  round " + rounds + ": [" + low + ".." + high + "] probes at " + m1 + " and " + m2

      IF arr[m1] == target
        HIGHLIGHT arr[m1] 'SUCCESS'
        RETURN m1
      ELSE IF arr[m2] == target
        HIGHLIGHT arr[m2] 'SUCCESS'
        RETURN m2
      ELSE IF target < arr[m1]
        high = m1 - 1
      ELSE IF target > arr[m2]
        low = m2 + 1
      ELSE
        low = m1 + 1
        high = m2 - 1
      END
      HIGHLIGHT arr[m1] 'DISCARDED'
      HIGHLIGHT arr[m2] 'DISCARDED'
    END
    RETURN -1
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(arr) - 1
      HIGHLIGHT arr[k] 'NEUTRAL'
    END
  END

SEQUENCE
  found = ternarySearch(45)
  PRINT "45 -> index " + found
  resetColours()
  found = ternarySearch(13)
  PRINT "13 -> index " + found
END
`,

  InterpolationSearch: `SCENE InterpolationSearch

DECLARE
  // House numbers along a street, evenly spaced (sorted and uniform)
  ARRAY houses = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

  // Instead of always probing the middle, GUESS where the target should be,
  // the way you open a dictionary near the back for a word starting with "w":
  //   pos = low + (target - houses[low]) * (high - low) / (houses[high] - houses[low])
  // The division is rounded down with (a - a % b) / b.
  FUNCTION interpolationSearch(target)
    low = 0
    high = LENGTH(houses) - 1
    probes = 0
    WHILE low <= high AND target >= houses[low] AND target <= houses[high]
      probes = probes + 1
      // All values in the window are equal: probe low (and avoid dividing by zero)
      pos = low
      IF houses[high] != houses[low]
        top = (target - houses[low]) * (high - low)
        bottom = houses[high] - houses[low]
        pos = low + (top - top % bottom) / bottom
      END
      HIGHLIGHT houses[pos] 'MARKED'
      PRINT "  probe " + probes + ": guessed index " + pos + " (value " + houses[pos] + ")"

      IF houses[pos] == target
        HIGHLIGHT houses[pos] 'SUCCESS'
        PRINT "House " + target + " found in " + probes + " probe(s)"
        RETURN pos
      ELSE IF houses[pos] < target
        low = pos + 1
      ELSE
        high = pos - 1
      END
    END
    PRINT "House " + target + " is not on this street"
    RETURN -1
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(houses) - 1
      HIGHLIGHT houses[k] 'NEUTRAL'
    END
  END

SEQUENCE
  interpolationSearch(70)
  resetColours()
  interpolationSearch(10)
  resetColours()
  interpolationSearch(55)
  resetColours()
  interpolationSearch(500)
END
`,

  RotatedArraySearch: `SCENE RotatedArraySearch

DECLARE
  // A sorted list of shop opening hours that was "rotated": it starts in
  // the middle of the day and wraps around. [13 .. 23] then [1 .. 11].
  ARRAY hours = [13, 15, 18, 21, 23, 1, 4, 7, 9, 11]

  // At every step at least ONE half of [low .. high] is properly sorted.
  // Find which half it is, check whether the target lies inside it, and
  // keep that half or the other one.
  FUNCTION searchRotated(target)
    low = 0
    high = LENGTH(hours) - 1
    WHILE low <= high
      size = high - low
      mid = low + (size - size % 2) / 2
      HIGHLIGHT hours[mid] 'MARKED'
      IF hours[mid] == target
        HIGHLIGHT hours[mid] 'SUCCESS'
        PRINT target + " found at index " + mid
        RETURN mid
      END

      IF hours[low] <= hours[mid]
        // Left half [low .. mid] is sorted
        IF target >= hours[low] AND target < hours[mid]
          PRINT "  left half " + hours[low] + ".." + hours[mid] + " is sorted and holds " + target
          high = mid - 1
        ELSE
          PRINT "  left half " + hours[low] + ".." + hours[mid] + " is sorted but lacks " + target
          low = mid + 1
        END
      ELSE
        // Right half [mid .. high] is sorted
        IF target > hours[mid] AND target <= hours[high]
          PRINT "  right half " + hours[mid] + ".." + hours[high] + " is sorted and holds " + target
          low = mid + 1
        ELSE
          PRINT "  right half " + hours[mid] + ".." + hours[high] + " is sorted but lacks " + target
          high = mid - 1
        END
      END
      HIGHLIGHT hours[mid] 'DISCARDED'
    END
    PRINT target + " is not in the list"
    RETURN -1
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(hours) - 1
      HIGHLIGHT hours[k] 'NEUTRAL'
    END
  END

SEQUENCE
  searchRotated(7)
  resetColours()
  searchRotated(15)
  resetColours()
  searchRotated(10)
END
`,

  PeakElement: `SCENE PeakOfATrail

DECLARE
  // Heights along a hiking trail: it only goes up, then only goes down
  ARRAY elevation = [120, 180, 260, 340, 410, 460, 430, 350, 240, 150]

  // Binary search on the SLOPE. Compare elevation[mid] with the next point:
  //   going up   (elevation[mid] < elevation[mid + 1]) -> the top is to the right
  //   going down                                  -> the top is mid or left
  // The window shrinks until low == high, which is the summit.

SEQUENCE
  low = 0
  high = LENGTH(elevation) - 1
  WHILE low < high
    size = high - low
    mid = low + (size - size % 2) / 2
    COMPARE elevation[mid] elevation[mid + 1]
    IF elevation[mid] < elevation[mid + 1]
      PRINT "At index " + mid + " the trail climbs (" + elevation[mid] + " -> " + elevation[mid + 1] + "), go right"
      low = mid + 1
    ELSE
      PRINT "At index " + mid + " the trail descends (" + elevation[mid] + " -> " + elevation[mid + 1] + "), go left"
      high = mid
    END
  END
  HIGHLIGHT elevation[low] 'SUCCESS'
  PRINT "Summit: " + elevation[low] + " m at index " + low
END
`,

  SquareRootSearch: `SCENE SquareRootByBinarySearch

DECLARE
  ARRAY numbers = [0, 1, 15, 16, 99, 1000]
  ARRAY roots = []

  // "Binary search on the answer": the array is not searched at all.
  // The answer r is somewhere in 0 .. x, and the question "is r * r <= x?"
  // is TRUE for small r and FALSE for large r. Binary search finds the last
  // r where it is still TRUE: the whole-number square root.
  FUNCTION intSqrt(x)
    low = 0
    high = x
    answer = 0
    steps = 0
    WHILE low <= high
      steps = steps + 1
      size = high - low
      mid = low + (size - size % 2) / 2
      IF mid * mid <= x
        answer = mid
        low = mid + 1
      ELSE
        high = mid - 1
      END
    END
    PRINT "sqrt(" + x + ") rounded down = " + answer + "  (" + steps + " guesses)"
    RETURN answer
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(numbers) - 1
    HIGHLIGHT numbers[i]
    INSERT roots[i] intSqrt(numbers[i])
    HIGHLIGHT roots[i] 'SUCCESS'
  END
  PRINT "Roots:" roots
END
`,

  SortedMatrixSearch: `SCENE CinemaSeatSearch

DECLARE
  // A 3 x 4 cinema seat map stored row by row in one array. Seat numbers
  // increase along each row and each row continues from the previous one,
  // so read left-to-right, top-to-bottom the whole map is sorted.
  //   row 0: 101 102 105 108
  //   row 1: 110 113 117 120
  //   row 2: 124 126 130 133
  ARRAY seats = [101, 102, 105, 108, 110, 113, 117, 120, 124, 126, 130, 133]

  // Binary search over positions 0 .. rows * cols - 1, turning a position
  // into (row, column) with division and remainder.
  FUNCTION findSeat(target, cols)
    low = 0
    high = LENGTH(seats) - 1
    WHILE low <= high
      size = high - low
      mid = low + (size - size % 2) / 2
      col = mid % cols
      row = (mid - col) / cols
      HIGHLIGHT seats[mid]
      IF seats[mid] == target
        HIGHLIGHT seats[mid] 'SUCCESS'
        PRINT "Seat " + target + " is in row " + row + ", column " + col
        RETURN mid
      ELSE IF seats[mid] < target
        low = mid + 1
      ELSE
        high = mid - 1
      END
    END
    PRINT "Seat " + target + " does not exist"
    RETURN -1
  END

SEQUENCE
  columns = 4
  findSeat(117, columns)
  findSeat(126, columns)
  findSeat(111, columns)
END
`,

  MissingRollNumber: `SCENE MissingRollNumber

DECLARE
  // Roll numbers 1 .. 12 handed in, sorted, but one sheet is missing
  ARRAY handedIn = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]

SEQUENCE
  // With nothing missing, handedIn[i] would be i + 1.
  // Left of the gap that is still true; from the gap onwards it is off by one.
  // Binary search for the first index where handedIn[i] != i + 1.
  n = LENGTH(handedIn)
  low = 0
  high = n - 1
  firstWrong = n
  WHILE low <= high
    size = high - low
    mid = low + (size - size % 2) / 2
    HIGHLIGHT handedIn[mid]
    IF handedIn[mid] == mid + 1
      PRINT "index " + mid + " holds " + handedIn[mid] + ": nothing missing up to here"
      low = mid + 1
    ELSE
      PRINT "index " + mid + " holds " + handedIn[mid] + " instead of " + (mid + 1) + ": gap is here or earlier"
      firstWrong = mid
      high = mid - 1
    END
  END

  IF firstWrong < n
    HIGHLIGHT handedIn[firstWrong] 'MARKED'
  END
  PRINT "Missing roll number: " + (firstWrong + 1)
END
`,

  ShipWithinDays: `SCENE DeliveryTruckCapacity

DECLARE
  // Parcel weights (kg), to be shipped IN THIS ORDER within 'days' days.
  // Each day the truck loads parcels from the front until the next one
  // would exceed its capacity. What is the SMALLEST capacity that works?
  ARRAY parcels = [3, 2, 2, 4, 1, 4]

  // How many days does a truck of this capacity need?
  FUNCTION daysNeeded(capacity)
    days = 1
    load = 0
    LOOP i FROM 0 TO LENGTH(parcels) - 1
      IF load + parcels[i] > capacity
        days = days + 1
        load = 0
      END
      load = load + parcels[i]
    END
    RETURN days
  END

SEQUENCE
  allowedDays = 3

  // The capacity is at least the heaviest parcel and at most all of them.
  heaviest = 0
  total = 0
  LOOP i FROM 0 TO LENGTH(parcels) - 1
    total = total + parcels[i]
    IF parcels[i] > heaviest
      heaviest = parcels[i]
    END
  END

  // A bigger truck never needs MORE days, so binary search the capacity.
  low = heaviest
  high = total
  best = total
  WHILE low <= high
    size = high - low
    mid = low + (size - size % 2) / 2
    need = daysNeeded(mid)
    IF need <= allowedDays
      PRINT "capacity " + mid + " kg -> " + need + " days: fits, try smaller"
      best = mid
      high = mid - 1
    ELSE
      PRINT "capacity " + mid + " kg -> " + need + " days: too slow, go bigger"
      low = mid + 1
    END
  END
  PRINT "Smallest truck for " + allowedDays + " days: " + best + " kg"
END
`,

  ContactBookSearch: `SCENE ContactBookSearch

DECLARE
  // Contacts in a phone, sorted alphabetically, with a parallel array of
  // phone extensions: name[i] belongs to ext[i].
  ARRAY name = ["Aarav", "Bhavna", "Chen", "Divya", "Farhan", "Isha", "Kabir", "Meera", "Rohan", "Zoya"]
  ARRAY ext = [201, 214, 238, 245, 260, 272, 289, 301, 317, 342]

  // Text compares in dictionary order ("Chen" < "Divya"), so binary search
  // works on names exactly as it does on numbers.
  FUNCTION lookUp(person)
    low = 0
    high = LENGTH(name) - 1
    WHILE low <= high
      size = high - low
      mid = low + (size - size % 2) / 2
      HIGHLIGHT name[mid]
      IF name[mid] == person
        HIGHLIGHT name[mid] 'SUCCESS'
        HIGHLIGHT ext[mid] 'SUCCESS'
        PRINT person + " -> extension " + ext[mid]
        RETURN mid
      ELSE IF name[mid] < person
        low = mid + 1
      ELSE
        high = mid - 1
      END
    END
    PRINT person + " is not in the contacts"
    RETURN -1
  END

SEQUENCE
  lookUp("Meera")
  lookUp("Chen")
  lookUp("Neha")
END
`,

  BSTSearch: `SCENE BSTSearchPath

DECLARE
  // Library book IDs stored in a binary search tree
  BST shelf = [50, 30, 70, 20, 40, 60, 80, 35, 65]

  // Iterative: follow one path from the root. Smaller -> left, larger -> right.
  FUNCTION searchLoop(key)
    curr = shelf.root
    path = ""
    WHILE curr != NULL AND curr.val != key
      path = path + " " + curr.val
      IF key < curr.val
        curr = curr.left
      ELSE
        curr = curr.right
      END
    END
    IF curr != NULL
      PRINT "Loop: book " + key + " found after visiting" + path
    ELSE
      PRINT "Loop: book " + key + " not found, path was" + path
    END
    RETURN curr
  END

  // Recursive: the same decision, expressed as "search the correct subtree".
  // Returns the number of nodes compared (0 when the key is missing).
  FUNCTION searchRec(node, key, depth)
    IF node == NULL
      RETURN 0
    END
    IF key == node.val
      RETURN depth
    ELSE IF key < node.val
      RETURN searchRec(node.left, key, depth + 1)
    ELSE
      RETURN searchRec(node.right, key, depth + 1)
    END
  END

SEQUENCE
  searchLoop(65)
  searchLoop(45)

  compared = searchRec(shelf.root, 35, 1)
  IF compared > 0
    PRINT "Recursive: book 35 found after comparing " + compared + " nodes (a list of 9 could need 9)"
  END
  compared = searchRec(shelf.root, 99, 1)
  IF compared == 0
    PRINT "Recursive: book 99 is not on the shelf"
  END
END
`,

  MazeDFS: `SCENE MazeExitDFS

DECLARE
  // Rooms of a maze and the corridors between them
  GRAPH maze = ["Entry-Hall", "Hall-Armory", "Hall-Garden", "Armory-Dungeon", "Garden-Well", "Garden-Tower", "Tower-Exit", "Well-Crypt"]
  STACK route = []

  // Depth-first search for ONE room. Walk into an unvisited room, and only
  // when it is a dead end come back (the RETURN) and try the next corridor.
  // Each room remembers the room it was entered from (parent).
  // Returns TRUE as soon as the goal is reached, which stops the search.
  FUNCTION explore(room, goal)
    room.visited = TRUE
    PRINT "Enter " + room.name
    IF room == goal
      RETURN TRUE
    END
    i = 0
    WHILE i < DEGREE(room)
      next = NEIGHBOR(room, i)
      IF next.visited == FALSE
        next.parent = room
        IF explore(next, goal)
          RETURN TRUE
        END
        PRINT "  dead end behind " + next.name + ", back in " + room.name
      END
      i = i + 1
    END
    RETURN FALSE
  END

SEQUENCE
  start = VERTEX(maze, "Entry")
  goal = VERTEX(maze, "Exit")
  start.parent = NULL

  IF explore(start, goal)
    // Follow the parents back from the exit, then pop to print in order
    curr = goal
    WHILE curr != NULL
      PUSH route curr
      curr = curr.parent
    END
    path = ""
    WHILE LENGTH(route) > 0
      r = POP(route)
      path = path + " " + r.name
    END
    PRINT "Way out:" + path
  ELSE
    PRINT "This maze has no exit"
  END
END
`,

  NearestHospitalBFS: `SCENE NearestHospitalBFS

DECLARE
  // City areas joined by roads of equal length
  GRAPH city = ["Home-Market", "Home-School", "Market-Station", "School-Park", "Park-Lake", "Station-Fort", "Lake-Fort", "Station-Airport"]
  QUEUE q = []

SEQUENCE
  // Which areas have a hospital? Every vertex gets a value first.
  LOOP k FROM 0 TO VERTEX_COUNT(city) - 1
    area = VERTEX_AT(city, k)
    area.hospital = FALSE
  END
  fort = VERTEX(city, "Fort")
  fort.hospital = TRUE
  park = VERTEX(city, "Park")
  park.hospital = TRUE

  // Breadth-first search explores areas in rings of 1 road, 2 roads, ...
  // so the FIRST hospital taken out of the queue is the nearest one.
  home = VERTEX(city, "Home")
  home.visited = TRUE
  home.dist = 0
  home.parent = NULL
  ENQUEUE q home
  nearest = NULL

  WHILE LENGTH(q) > 0 AND nearest == NULL
    area = DEQUEUE(q)
    PRINT "Check " + area.name + " (" + area.dist + " road(s) from Home)"
    IF area.hospital
      nearest = area
    ELSE
      i = 0
      WHILE i < DEGREE(area)
        next = NEIGHBOR(area, i)
        IF next.visited == FALSE
          next.visited = TRUE
          next.dist = area.dist + 1
          next.parent = area
          ENQUEUE q next
        END
        i = i + 1
      END
    END
  END

  IF nearest == NULL
    PRINT "No hospital can be reached from Home"
  ELSE
    // Walk the parents back to Home, adding each name to the FRONT
    route = nearest.name
    curr = nearest.parent
    WHILE curr != NULL
      route = curr.name + " -> " + route
      curr = curr.parent
    END
    PRINT "Nearest hospital: " + nearest.name + ", " + nearest.dist + " road(s) away"
    PRINT "Route: " + route
  END
END
`,
};
