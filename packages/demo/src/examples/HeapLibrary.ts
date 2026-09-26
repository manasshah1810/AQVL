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
  // A heap is stored in a plain array, but we READ it as a binary tree.
  // No pointers link the nodes: the index alone says who is related:
  //   left child of i  = 2 * i + 1
  //   right child of i = 2 * i + 2
  //   parent of i      = (i - 1) / 2, rounded down
  // AQVL division keeps decimals (7 / 2 = 3.5), so "rounded down" is
  // written by removing the remainder first: (i - 1 - (i - 1) % 2) / 2
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

  // The last node with a child is the parent of the last index
  lastParent = (n - 2 - (n - 2) % 2) / 2
  PRINT "Indices 0 to " + lastParent + " have children; indices " + (lastParent + 1) + " to " + (n - 1) + " are leaves"
END
`,

  IsValidMinHeap: `SCENE IsValidMinHeap

DECLARE
  HEAP h = [3, 5, 8, 9, 6, 7, 12, 11, 4]

SEQUENCE
  // Min-heap rule: every parent is smaller than (or equal to) both of its
  // children. It is enough to check each parent against its children; the
  // leaves have nothing to check.
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

  // The new value starts at the bottom. While it is smaller than its
  // parent it swaps upwards ("sift up" / "bubble up"). It stops at the
  // root or under a parent that is already smaller.
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
  // Insert: (1) add the value as the new last cell, which is the next free
  // spot in the tree, so the tree stays complete; (2) sift it up.
  // Each insert costs at most one swap per level: O(log n).
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

  // The value at 'start' moves down, swapping with its SMALLER child,
  // until both children are bigger (or it has no children).
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

  // Removes and returns the smallest value (the root)
  FUNCTION extractMin()
    smallestValue = h[0]
    last = LENGTH(h) - 1
    // Only the last cell can be removed without breaking the tree shape,
    // so copy the last value onto the root, then delete the last cell
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

  // Max-heap: the only change from a min-heap is the comparison.
  // Every parent is LARGER than its children, so the biggest bid is on top.
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
  // An auction house keeps every bid in a max-heap, so the highest bid is
  // always at the root, however many bids arrive.
  LOOP k FROM 0 TO LENGTH(incoming) - 1
    INSERT bids incoming[k]
    siftUp(LENGTH(bids) - 1)
    PRINT "Bid " + incoming[k] + " received, highest so far: " + bids[0]
  END

  // Three items are sold: each goes to the highest remaining bid
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

  // Returns how many swaps it made, so the total work can be counted
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
  // Turning an unordered array into a heap. Inserting the values one at a
  // time costs O(n log n). Floyd's method is faster, O(n): every leaf is
  // already a (tiny) heap, so start at the LAST PARENT and sift down each
  // node, walking backwards to the root. When a node is sifted down, both
  // subtrees below it are already heaps.
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

  // Heapify (sift down) written recursively: fix this node, then the one
  // child that received the bigger value is the only place the rule can
  // now be broken, so call heapify on that child. Base case: the node is
  // already smaller than its children.
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
  // Only index 1 breaks the min-heap rule (20 is bigger than 7 and 5).
  // Everything below it is fine, which is exactly when heapify works.
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

  // Lower the value at 'index'. A smaller value can only break the rule
  // with its parent (never with its children), so it only ever sifts UP.
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
  // In Dijkstra's shortest paths the heap holds tentative distances. When a
  // shorter road to a town is found, its distance is lowered in place.
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

  // Remove the value at any index: move the last value into the hole and
  // delete the last cell. The moved value may be too SMALL for its new
  // place (sift up) or too BIG (sift down) - check which.
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

  // Max-heap sift down that only looks at the first 'size' cells; the
  // cells after them are already sorted and must not be touched.
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

  // Phase 1: build a MAX-heap (Floyd's method, last parent back to root)
  i = (n - 2 - (n - 2) % 2) / 2
  WHILE i >= 0
    siftDown(i, n)
    i = i - 1
  END
  PRINT "Max-heap:" h

  // Phase 2: the root is the largest of the unsorted part. Swap it to the
  // end of that part (its final place), shrink the heap, repair the root.
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

  // Max-heap on severity (10 = most urgent). patient[i] is the name of the
  // person whose severity is triage[i]: every swap in the heap swaps the
  // names too, so each patient stays paired with their own severity.
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
  // Patients are NOT seen in arrival order: the most urgent goes first.
  // A doctor becomes free after every second arrival.
  LOOP k FROM 0 TO LENGTH(arrivingName) - 1
    admit(arrivingName[k], arrivingSeverity[k])
    IF k % 2 == 1
      treatNext()
    END
  END

  // Nobody else arrives: treat everyone still waiting
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
  // Top k of a long list without sorting it: keep a MIN-heap of the k best
  // scores seen so far. Its root is the weakest of them, the score to beat.
  // A new score only gets in if it beats the root, and then it replaces the
  // root. Cost: O(n log k), and only k values are ever stored.
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
  // Which delivery was the 3rd fastest? Put every time in a min-heap, then
  // throw away the smallest k - 1 times: the root is now the k-th smallest.
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
  // Joining two ropes costs the sum of their lengths, and the joined rope
  // may be joined again later (paying for its length again). To pay the
  // least, always join the two SHORTEST ropes: a min-heap hands them over.
  // The ropes start unordered, so first make them a heap (Floyd's method).
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
  // Each turn the two heaviest stones are smashed together. Equal stones
  // both break; otherwise the heavier one survives, losing the lighter
  // one's weight. A max-heap always has the heaviest stone on top.
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

  // 'low' is a MAX-heap holding the smaller half of the numbers,
  // 'high' is a MIN-heap holding the bigger half. Their two roots are the
  // numbers in the middle. Each heap needs its own sift functions.
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
  // The median of numbers arriving one by one, without re-sorting them.
  // Rule kept after every number: low has the same size as high, or one more.
  LOOP i FROM 0 TO LENGTH(stream) - 1
    x = stream[i]

    // 1. Put x in the correct half
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

    // 2. Re-balance the sizes by moving one root across
    IF LENGTH(low) > LENGTH(high) + 1
      moved = popLow()
      INSERT high moved
      highSiftUp(LENGTH(high) - 1)
    ELSE IF LENGTH(high) > LENGTH(low)
      moved = popHigh()
      INSERT low moved
      lowSiftUp(LENGTH(low) - 1)
    END

    // 3. Read the median off the roots
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
