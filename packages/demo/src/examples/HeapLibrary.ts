/**
 * Heap examples, each written as the real algorithm (LOOP, WHILE, IF / ELSE
 * and FUNCTIONs over h[i]) rather than a one-line built-in. A HEAP is drawn
 * twice: as a binary tree on top and as the array it really is underneath.
 * Index i's children are 2i + 1 and 2i + 2, its parent is (i - 1) / 2
 * rounded down, written (i - 1 - (i - 1) % 2) / 2 since AQVL division keeps
 * decimals.
 */
export const HeapScripts = {
  HeapIndexMap: `SCENE HeapIndexMap

DECLARE
  HEAP h = [10, 20, 15, 40, 50, 30, 25]

SEQUENCE
  n = LENGTH(h)
  PRINT "The heap has " + n + " values:" h

  LOOP i FROM 0 TO n - 1
    HIGHLIGHT h[i] 'MARKED'
    left = 2 * i + 1
    right = 2 * i + 2

    IF i == 0
      PRINT "Index 0 holds " + h[0] + ": the root, it has no parent"
    ELSE
      parent = (i - 1 - (i - 1) % 2) / 2
      PRINT "Index " + i + " holds " + h[i] + ": its parent is index " + parent + " (" + h[parent] + ")"
    END

    IF left < n
      IF right < n
        PRINT "  children: index " + left + " (" + h[left] + ") and index " + right + " (" + h[right] + ")"
      ELSE
        PRINT "  only a left child: index " + left + " (" + h[left] + ")"
      END
    ELSE
      PRINT "  no children, so it is a leaf"
    END
    HIGHLIGHT h[i] 'NEUTRAL'
  END

  lastParent = (n - 2 - (n - 2) % 2) / 2
  PRINT "Indices 0 to " + lastParent + " have children; indices " + (lastParent + 1) + " to " + (n - 1) + " are leaves"
END
`,

  IsValidMinHeap: `SCENE IsValidMinHeap

DECLARE
  HEAP h = [3, 5, 8, 9, 6, 7, 12, 11, 4]

SEQUENCE
  n = LENGTH(h)
  problems = 0

  LOOP i FROM 0 TO n - 1
    left = 2 * i + 1
    right = 2 * i + 2

    IF left < n
      COMPARE h[i] h[left]
      IF h[left] < h[i]
        PRINT "Broken: parent " + h[i] + " (index " + i + ") is bigger than its left child " + h[left] + " (index " + left + ")"
        HIGHLIGHT h[left] 'DISCARDED'
        problems = problems + 1
      END
    END

    IF right < n
      COMPARE h[i] h[right]
      IF h[right] < h[i]
        PRINT "Broken: parent " + h[i] + " (index " + i + ") is bigger than its right child " + h[right] + " (index " + right + ")"
        HIGHLIGHT h[right] 'DISCARDED'
        problems = problems + 1
      END
    END
  END

  IF problems == 0
    PRINT "Every parent is <= its children: this IS a valid min-heap"
  ELSE
    PRINT "Found " + problems + " broken parent-child pair(s): this is NOT a min-heap"
  END
END
`,

  MinHeapInsert: `SCENE MinHeapInsert

DECLARE
  HEAP h = []
  ARRAY arrivals = [35, 33, 42, 10, 14, 19, 27, 44, 26]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        COMPARE h[child] h[parent]
        IF h[child] < h[parent]
          SWAP h[child] h[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(arrivals) - 1
    value = arrivals[k]
    HIGHLIGHT arrivals[k] 'MARKED'
    INSERT h value
    siftUp(LENGTH(h) - 1)
    PRINT "After inserting " + value + ":" h
  END
  HIGHLIGHT h[0] 'SUCCESS'
  PRINT "The smallest value, " + h[0] + ", is at the root"
END
`,

  ExtractMin: `SCENE ExtractMin

DECLARE
  HEAP h = [5, 9, 8, 17, 12, 11, 20, 25]

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(h)
    keepSifting = 1
    WHILE keepSifting == 1
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        COMPARE h[left] h[smallest]
        IF h[left] < h[smallest]
          smallest = left
        END
      END
      IF right < size
        COMPARE h[right] h[smallest]
        IF h[right] < h[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        keepSifting = 0
      ELSE
        SWAP h[parent] h[smallest]
        parent = smallest
      END
    END
  END

  FUNCTION extractMin()
    smallestValue = h[0]
    last = LENGTH(h) - 1
    h[0] = h[last]
    DELETE h[last]
    IF LENGTH(h) > 1
      siftDown(0)
    END
    RETURN smallestValue
  END

SEQUENCE
  PRINT "Start:" h
  LOOP round FROM 1 TO 4
    taken = extractMin()
    PRINT "Extracted " + taken + ", heap is now:" h
  END
  PRINT "Values come out smallest first: that is what makes a heap a priority queue"
END
`,

  MaxHeapAuction: `SCENE MaxHeapAuction

DECLARE
  HEAP bids = []
  ARRAY incoming = [250, 400, 150, 900, 600, 300, 750]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        COMPARE bids[child] bids[parent]
        IF bids[child] > bids[parent]
          SWAP bids[child] bids[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(bids)
    keepSifting = 1
    WHILE keepSifting == 1
      largest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF bids[left] > bids[largest]
          largest = left
        END
      END
      IF right < size
        IF bids[right] > bids[largest]
          largest = right
        END
      END
      IF largest == parent
        keepSifting = 0
      ELSE
        SWAP bids[parent] bids[largest]
        parent = largest
      END
    END
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(incoming) - 1
    INSERT bids incoming[k]
    siftUp(LENGTH(bids) - 1)
    PRINT "Bid " + incoming[k] + " received, highest so far: " + bids[0]
  END

  LOOP item FROM 1 TO 3
    winning = bids[0]
    HIGHLIGHT bids[0] 'SUCCESS'
    last = LENGTH(bids) - 1
    bids[0] = bids[last]
    DELETE bids[last]
    siftDown(0)
    PRINT "Item " + item + " sold for " + winning
  END
  PRINT "Bids still waiting:" bids
END
`,

  BuildHeapBottomUp: `SCENE BuildHeapBottomUp

DECLARE
  HEAP h = [9, 4, 7, 1, 8, 2, 6, 3, 5]

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(h)
    swapsMade = 0
    keepSifting = 1
    WHILE keepSifting == 1
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        COMPARE h[left] h[smallest]
        IF h[left] < h[smallest]
          smallest = left
        END
      END
      IF right < size
        COMPARE h[right] h[smallest]
        IF h[right] < h[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        keepSifting = 0
      ELSE
        SWAP h[parent] h[smallest]
        swapsMade = swapsMade + 1
        parent = smallest
      END
    END
    RETURN swapsMade
  END

SEQUENCE
  n = LENGTH(h)
  swaps = 0
  PRINT "Unordered:" h

  lastParent = (n - 2 - (n - 2) % 2) / 2
  i = lastParent
  WHILE i >= 0
    HIGHLIGHT h[i] 'MARKED'
    swaps = swaps + siftDown(i)
    PRINT "After sifting down index " + i + ":" h
    i = i - 1
  END

  HIGHLIGHT h[0] 'SUCCESS'
  PRINT "Min-heap built with " + swaps + " swaps; smallest value " + h[0] + " is at the root"
END
`,

  HeapifyRecursive: `SCENE HeapifyRecursive

DECLARE
  HEAP h = [1, 20, 2, 7, 5, 4, 9, 8, 10, 6, 11]

  FUNCTION heapify(i)
    size = LENGTH(h)
    smallest = i
    left = 2 * i + 1
    right = 2 * i + 2
    IF left < size
      COMPARE h[left] h[smallest]
      IF h[left] < h[smallest]
        smallest = left
      END
    END
    IF right < size
      COMPARE h[right] h[smallest]
      IF h[right] < h[smallest]
        smallest = right
      END
    END
    IF smallest != i
      PRINT "  " + h[i] + " at index " + i + " is bigger than its child " + h[smallest] + ": swap, then heapify index " + smallest
      SWAP h[i] h[smallest]
      heapify(smallest)
    ELSE
      PRINT "  " + h[i] + " at index " + i + " is not bigger than its children: stop"
    END
  END

SEQUENCE
  HIGHLIGHT h[1] 'DISCARDED'
  PRINT "Before:" h
  heapify(1)
  PRINT "After:" h
END
`,

  DecreaseKey: `SCENE DecreaseKey

DECLARE
  HEAP dist = [4, 8, 6, 12, 10, 9, 7, 15, 13]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        COMPARE dist[child] dist[parent]
        IF dist[child] < dist[parent]
          SWAP dist[child] dist[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION decreaseKey(index, newValue)
    IF newValue >= dist[index]
      PRINT "Not a decrease: " + newValue + " is not smaller than " + dist[index] + ", nothing changes"
    ELSE
      PRINT "Decrease index " + index + " from " + dist[index] + " to " + newValue
      dist[index] = newValue
      siftUp(index)
      PRINT "  heap is now:" dist
    END
  END

SEQUENCE
  PRINT "Distances:" dist
  decreaseKey(7, 3)
  decreaseKey(5, 5)
  decreaseKey(3, 20)
  HIGHLIGHT dist[0] 'SUCCESS'
  PRINT "Closest town is now at distance " + dist[0]
END
`,

  DeleteAtIndex: `SCENE DeleteAtIndex

DECLARE
  HEAP h = [1, 10, 2, 11, 12, 3, 4, 13, 14, 15, 16, 5]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        COMPARE h[child] h[parent]
        IF h[child] < h[parent]
          SWAP h[child] h[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(h)
    keepSifting = 1
    WHILE keepSifting == 1
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF h[left] < h[smallest]
          smallest = left
        END
      END
      IF right < size
        IF h[right] < h[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        keepSifting = 0
      ELSE
        SWAP h[parent] h[smallest]
        parent = smallest
      END
    END
  END

  FUNCTION deleteAt(index)
    removed = h[index]
    last = LENGTH(h) - 1
    HIGHLIGHT h[index] 'DISCARDED'
    h[index] = h[last]
    DELETE h[last]
    IF index < LENGTH(h)
      movedUp = 0
      IF index > 0
        parent = (index - 1 - (index - 1) % 2) / 2
        IF h[index] < h[parent]
          PRINT "  moved value " + h[index] + " is smaller than its parent " + h[parent] + ": sift up"
          siftUp(index)
          movedUp = 1
        END
      END
      IF movedUp == 0
        PRINT "  moved value " + h[index] + " is not smaller than its parent: sift down"
        siftDown(index)
      END
    END
    PRINT "Deleted " + removed + " from index " + index + ":" h
  END

SEQUENCE
  PRINT "Start:" h
  deleteAt(8)
  deleteAt(2)
END
`,

  HeapSortInPlace: `SCENE HeapSortInPlace

DECLARE
  HEAP h = [12, 11, 13, 5, 6, 7, 3, 9]

  FUNCTION siftDown(start, size)
    parent = start
    keepSifting = 1
    WHILE keepSifting == 1
      largest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        COMPARE h[left] h[largest]
        IF h[left] > h[largest]
          largest = left
        END
      END
      IF right < size
        COMPARE h[right] h[largest]
        IF h[right] > h[largest]
          largest = right
        END
      END
      IF largest == parent
        keepSifting = 0
      ELSE
        SWAP h[parent] h[largest]
        parent = largest
      END
    END
  END

SEQUENCE
  n = LENGTH(h)

  i = (n - 2 - (n - 2) % 2) / 2
  WHILE i >= 0
    siftDown(i, n)
    i = i - 1
  END
  PRINT "Max-heap:" h

  last = n - 1
  WHILE last > 0
    SWAP h[0] h[last]
    HIGHLIGHT h[last] 'SUCCESS'
    siftDown(0, last)
    PRINT "Placed " + h[last] + " at index " + last + ":" h
    last = last - 1
  END
  HIGHLIGHT h[0] 'SUCCESS'
  PRINT "Sorted, smallest to largest:" h
END
`,

  EmergencyRoom: `SCENE EmergencyRoom

DECLARE
  HEAP triage = []
  ARRAY patient = []
  ARRAY arrivingName = ["Asha", "Ben", "Chen", "Diya", "Eli", "Farah"]
  ARRAY arrivingSeverity = [3, 7, 5, 9, 2, 7]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        IF triage[child] > triage[parent]
          SWAP triage[child] triage[parent]
          SWAP patient[child] patient[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(triage)
    keepSifting = 1
    WHILE keepSifting == 1
      largest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF triage[left] > triage[largest]
          largest = left
        END
      END
      IF right < size
        IF triage[right] > triage[largest]
          largest = right
        END
      END
      IF largest == parent
        keepSifting = 0
      ELSE
        SWAP triage[parent] triage[largest]
        SWAP patient[parent] patient[largest]
        parent = largest
      END
    END
  END

  FUNCTION admit(name, severity)
    INSERT triage severity
    INSERT patient[LENGTH(patient)] name
    siftUp(LENGTH(triage) - 1)
    PRINT name + " arrives with severity " + severity + "; next to be seen: " + patient[0]
  END

  FUNCTION treatNext()
    HIGHLIGHT triage[0] 'SUCCESS'
    PRINT "Doctor sees " + patient[0] + " (severity " + triage[0] + ")"
    last = LENGTH(triage) - 1
    triage[0] = triage[last]
    patient[0] = patient[last]
    DELETE triage[last]
    DELETE patient[last]
    IF LENGTH(triage) > 1
      siftDown(0)
    END
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(arrivingName) - 1
    admit(arrivingName[k], arrivingSeverity[k])
    IF k % 2 == 1
      treatNext()
    END
  END

  WHILE LENGTH(triage) > 0
    treatNext()
  END
  PRINT "Waiting room is empty"
END
`,

  TopKScores: `SCENE TopKScores

DECLARE
  HEAP best = []
  ARRAY scores = [67, 92, 45, 88, 73, 99, 51, 84, 95, 60]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        IF best[child] < best[parent]
          SWAP best[child] best[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(best)
    keepSifting = 1
    WHILE keepSifting == 1
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF best[left] < best[smallest]
          smallest = left
        END
      END
      IF right < size
        IF best[right] < best[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        keepSifting = 0
      ELSE
        SWAP best[parent] best[smallest]
        parent = smallest
      END
    END
  END

SEQUENCE
  k = 3
  LOOP i FROM 0 TO LENGTH(scores) - 1
    score = scores[i]
    IF LENGTH(best) < k
      INSERT best score
      siftUp(LENGTH(best) - 1)
      PRINT score + " joins (the top " + k + " is not full yet)"
    ELSE IF score > best[0]
      PRINT score + " beats the weakest of the top " + k + " (" + best[0] + "), which drops out"
      best[0] = score
      siftDown(0)
      HIGHLIGHT scores[i] 'SUCCESS'
    ELSE
      PRINT score + " does not beat " + best[0] + ", ignored"
      HIGHLIGHT scores[i] 'DISCARDED'
    END
  END
  PRINT "Top " + k + " scores (weakest at the root):" best
END
`,

  KthSmallest: `SCENE KthSmallest

DECLARE
  HEAP h = []
  ARRAY deliveryMinutes = [42, 17, 58, 23, 35, 11, 49, 30]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        IF h[child] < h[parent]
          SWAP h[child] h[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(h)
    keepSifting = 1
    WHILE keepSifting == 1
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF h[left] < h[smallest]
          smallest = left
        END
      END
      IF right < size
        IF h[right] < h[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        keepSifting = 0
      ELSE
        SWAP h[parent] h[smallest]
        parent = smallest
      END
    END
  END

  FUNCTION removeRoot()
    last = LENGTH(h) - 1
    h[0] = h[last]
    DELETE h[last]
    IF LENGTH(h) > 1
      siftDown(0)
    END
  END

SEQUENCE
  k = 3
  LOOP i FROM 0 TO LENGTH(deliveryMinutes) - 1
    INSERT h deliveryMinutes[i]
    siftUp(LENGTH(h) - 1)
  END
  PRINT "All times in a min-heap:" h

  LOOP r FROM 1 TO k - 1
    PRINT "Fastest #" + r + " was " + h[0] + " minutes, remove it"
    removeRoot()
  END
  HIGHLIGHT h[0] 'SUCCESS'
  PRINT "Fastest #" + k + " delivery took " + h[0] + " minutes"
END
`,

  ConnectRopes: `SCENE ConnectRopes

DECLARE
  HEAP ropes = [8, 4, 6, 12, 3]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        IF ropes[child] < ropes[parent]
          SWAP ropes[child] ropes[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(ropes)
    keepSifting = 1
    WHILE keepSifting == 1
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF ropes[left] < ropes[smallest]
          smallest = left
        END
      END
      IF right < size
        IF ropes[right] < ropes[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        keepSifting = 0
      ELSE
        SWAP ropes[parent] ropes[smallest]
        parent = smallest
      END
    END
  END

  FUNCTION takeShortest()
    shortest = ropes[0]
    last = LENGTH(ropes) - 1
    ropes[0] = ropes[last]
    DELETE ropes[last]
    IF LENGTH(ropes) > 1
      siftDown(0)
    END
    RETURN shortest
  END

SEQUENCE
  i = (LENGTH(ropes) - 2 - (LENGTH(ropes) - 2) % 2) / 2
  WHILE i >= 0
    siftDown(i)
    i = i - 1
  END
  PRINT "Ropes as a min-heap:" ropes

  totalCost = 0
  WHILE LENGTH(ropes) > 1
    first = takeShortest()
    second = takeShortest()
    joined = first + second
    totalCost = totalCost + joined
    PRINT "Join " + first + " + " + second + " = " + joined + " (total cost so far " + totalCost + ")"
    INSERT ropes joined
    siftUp(LENGTH(ropes) - 1)
  END
  HIGHLIGHT ropes[0] 'SUCCESS'
  PRINT "One rope of length " + ropes[0] + ", minimum total cost " + totalCost
END
`,

  LastStoneWeight: `SCENE LastStoneWeight

DECLARE
  HEAP stones = []
  ARRAY pile = [2, 7, 4, 1, 8, 1]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        IF stones[child] > stones[parent]
          SWAP stones[child] stones[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(stones)
    keepSifting = 1
    WHILE keepSifting == 1
      largest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF stones[left] > stones[largest]
          largest = left
        END
      END
      IF right < size
        IF stones[right] > stones[largest]
          largest = right
        END
      END
      IF largest == parent
        keepSifting = 0
      ELSE
        SWAP stones[parent] stones[largest]
        parent = largest
      END
    END
  END

  FUNCTION takeHeaviest()
    heaviest = stones[0]
    last = LENGTH(stones) - 1
    stones[0] = stones[last]
    DELETE stones[last]
    IF LENGTH(stones) > 1
      siftDown(0)
    END
    RETURN heaviest
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(pile) - 1
    INSERT stones pile[i]
    siftUp(LENGTH(stones) - 1)
  END
  PRINT "Stones as a max-heap:" stones

  WHILE LENGTH(stones) > 1
    heavy = takeHeaviest()
    light = takeHeaviest()
    IF heavy == light
      PRINT "Smash " + heavy + " and " + light + ": both are destroyed"
    ELSE
      PRINT "Smash " + heavy + " and " + light + ": a stone of " + (heavy - light) + " is left"
      INSERT stones heavy - light
      siftUp(LENGTH(stones) - 1)
    END
  END

  IF LENGTH(stones) == 1
    HIGHLIGHT stones[0] 'SUCCESS'
    PRINT "Last stone weighs " + stones[0]
  ELSE
    PRINT "No stones are left"
  END
END
`,

  RunningMedian: `SCENE RunningMedian

DECLARE
  HEAP low = []
  HEAP high = []
  ARRAY stream = [5, 15, 1, 3, 8, 7, 9, 10]

  FUNCTION lowSiftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        IF low[child] > low[parent]
          SWAP low[child] low[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION lowSiftDown(start)
    parent = start
    size = LENGTH(low)
    keepSifting = 1
    WHILE keepSifting == 1
      largest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF low[left] > low[largest]
          largest = left
        END
      END
      IF right < size
        IF low[right] > low[largest]
          largest = right
        END
      END
      IF largest == parent
        keepSifting = 0
      ELSE
        SWAP low[parent] low[largest]
        parent = largest
      END
    END
  END

  FUNCTION highSiftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        IF high[child] < high[parent]
          SWAP high[child] high[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

  FUNCTION highSiftDown(start)
    parent = start
    size = LENGTH(high)
    keepSifting = 1
    WHILE keepSifting == 1
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF high[left] < high[smallest]
          smallest = left
        END
      END
      IF right < size
        IF high[right] < high[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        keepSifting = 0
      ELSE
        SWAP high[parent] high[smallest]
        parent = smallest
      END
    END
  END

  FUNCTION popLow()
    top = low[0]
    last = LENGTH(low) - 1
    low[0] = low[last]
    DELETE low[last]
    IF LENGTH(low) > 1
      lowSiftDown(0)
    END
    RETURN top
  END

  FUNCTION popHigh()
    top = high[0]
    last = LENGTH(high) - 1
    high[0] = high[last]
    DELETE high[last]
    IF LENGTH(high) > 1
      highSiftDown(0)
    END
    RETURN top
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(stream) - 1
    x = stream[i]

    goesLow = 0
    IF LENGTH(low) == 0
      goesLow = 1
    ELSE IF x <= low[0]
      goesLow = 1
    END
    IF goesLow == 1
      INSERT low x
      lowSiftUp(LENGTH(low) - 1)
    ELSE
      INSERT high x
      highSiftUp(LENGTH(high) - 1)
    END

    IF LENGTH(low) > LENGTH(high) + 1
      moved = popLow()
      INSERT high moved
      highSiftUp(LENGTH(high) - 1)
    ELSE IF LENGTH(high) > LENGTH(low)
      moved = popHigh()
      INSERT low moved
      lowSiftUp(LENGTH(low) - 1)
    END

    median = 0
    IF LENGTH(low) == LENGTH(high)
      median = (low[0] + high[0]) / 2
    ELSE
      median = low[0]
    END
    PRINT "After " + x + ": median = " + median
  END
  PRINT "Smaller half (max-heap):" low
  PRINT "Bigger half (min-heap):" high
END
`,
};
