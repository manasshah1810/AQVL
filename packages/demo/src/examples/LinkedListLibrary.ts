/**
 * Linked-list examples. Every one is written the way it would be in C:
 * pointer variables (`curr`, `prev`, `slow`, `fast`, ...) walk the list with
 * loops, IFs decide, pointer writes (`prev.next = curr.next`) relink nodes,
 * NEW_NODE allocates and FREE releases memory. Each pointer move and each
 * pointer write is animated as its own step, and the variables are shown as
 * tags on the node they point to.
 */
export const LinkedListScripts = {
  SinglyLinkedList: `SCENE SinglyLinkedList

DECLARE
  LINKEDLIST list = [10, 20, 30, 40]

SEQUENCE
  // 1. Traverse: start at the head, follow next pointers until NULL
  curr = list.head
  WHILE curr != NULL
    PRINT "Visit" curr.val
    curr = curr.next
  END

  // 2. Insert 5 at the head: point the new node at the old head, then move head
  newNode = NEW_NODE(list, 5)
  newNode.next = list.head
  list.head = newNode

  // 3. Insert 50 at the tail: walk to the last node (the one whose next is NULL)
  newNode = NEW_NODE(list, 50)
  curr = list.head
  WHILE curr.next != NULL
    curr = curr.next
  END
  curr.next = newNode

  // 4. Delete 30: stop at the node BEFORE it, then make that node skip over it
  prev = list.head
  WHILE prev.next != NULL AND prev.next.val != 30
    prev = prev.next
  END
  IF prev.next != NULL
    temp = prev.next
    prev.next = temp.next   // 30 is unlinked and drops into heap memory
    FREE temp               // only now is its memory released
  END

  // 5. Delete the head
  temp = list.head
  list.head = temp.next
  FREE temp

  PRINT "List:" list

  // The same operations also exist as one-line built-ins,
  // which animate exactly the same pointer walk:
  INSERT_TAIL list 60
  DELETE_HEAD list
  PRINT "List:" list
END
`,

  DoublyLinkedList: `SCENE DoublyLinkedList

DECLARE
  DOUBLY LINKEDLIST list = [10, 20, 30, 40]

SEQUENCE
  // 1. Forward: follow next pointers from the head (remember the last node)
  curr = list.head
  tail = NULL
  WHILE curr != NULL
    PRINT "Forward:" curr.val
    tail = curr
    curr = curr.next
  END

  // 2. Backward: follow prev pointers from the tail
  curr = tail
  WHILE curr != NULL
    PRINT "Backward:" curr.val
    curr = curr.prev
  END

  // 3. Insert 25 after 20 — four pointers change
  curr = list.head
  WHILE curr != NULL AND curr.val != 20
    curr = curr.next
  END
  newNode = NEW_NODE(list, 25)
  newNode.prev = curr
  newNode.next = curr.next
  curr.next.prev = newNode
  curr.next = newNode

  // 4. Delete 30 — its neighbours skip over it in both directions
  curr = list.head
  WHILE curr != NULL AND curr.val != 30
    curr = curr.next
  END
  curr.prev.next = curr.next
  curr.next.prev = curr.prev
  FREE curr
  curr = NULL

  PRINT "List:" list
END
`,

  CircularLinkedList: `SCENE CircularLinkedList

DECLARE
  CIRCULAR LINKEDLIST list = [10, 20, 30, 40]

SEQUENCE
  // 1. One lap: there is no NULL at the end,
  //    so stop when we arrive back at the head
  curr = list.head
  PRINT "Visit" curr.val
  curr = curr.next
  WHILE curr != list.head
    PRINT "Visit" curr.val
    curr = curr.next
  END

  // 2. Insert 50 at the end: find the tail (the node whose next is the head)
  tail = list.head
  WHILE tail.next != list.head
    tail = tail.next
  END
  newNode = NEW_NODE(list, 50)
  newNode.next = list.head   // the new tail wraps around to the head
  tail.next = newNode
  tail = newNode

  // 3. Delete the head: the tail must skip it to keep the circle closed
  temp = list.head
  tail.next = temp.next
  list.head = temp.next
  FREE temp

  PRINT "List:" list
END
`,

  ReverseSinglyLinkedList: `SCENE ReverseSinglyLinkedList

DECLARE
  LINKEDLIST list = [1, 2, 3, 4, 5]

SEQUENCE
  // In-place reversal with three pointers: O(n) time, O(1) extra space
  prev = NULL
  curr = list.head
  WHILE curr != NULL
    next = curr.next    // remember the rest of the list
    curr.next = prev    // flip this node's arrow backwards
    prev = curr         // advance prev
    curr = next         // advance curr
  END
  list.head = prev      // the old tail is the new head

  PRINT "Reversed:" list
END
`,

  ReverseDoublyLinkedList: `SCENE ReverseDoublyLinkedList

DECLARE
  DOUBLY LINKEDLIST list = [1, 2, 3, 4, 5]

SEQUENCE
  // Reversing a doubly linked list = swapping every node's prev and next
  curr = list.head
  last = NULL
  WHILE curr != NULL
    temp = curr.prev
    curr.prev = curr.next
    curr.next = temp
    last = curr
    curr = curr.prev    // prev now holds the old next node
  END
  list.head = last

  // Check both directions
  curr = list.head
  WHILE curr != NULL
    PRINT "Forward:" curr.val
    last = curr
    curr = curr.next
  END
  curr = last
  WHILE curr != NULL
    PRINT "Backward:" curr.val
    curr = curr.prev
  END
END
`,

  ReverseCircularLinkedList: `SCENE ReverseCircularLinkedList

DECLARE
  CIRCULAR LINKEDLIST list = [1, 2, 3, 4, 5]

SEQUENCE
  // Same prev / curr / next idea as a singly list, but the loop ends when we
  // come back around to the first node, and the circle is re-closed at the end
  first = list.head
  prev = first
  curr = first.next
  WHILE curr != first
    next = curr.next
    curr.next = prev
    prev = curr
    curr = next
  END
  first.next = prev     // the old head now points to the old tail...
  list.head = prev      // ...which becomes the new head

  PRINT "Reversed:" list
END
`,

  FindMiddleNode: `SCENE FindMiddleNode

DECLARE
  LINKEDLIST list = [10, 20, 30, 40, 50, 60, 70]

SEQUENCE
  // slow moves one node per step, fast moves two.
  // When fast reaches the end, slow has covered exactly half the list.
  slow = list.head
  fast = list.head
  WHILE fast != NULL AND fast.next != NULL
    slow = slow.next
    fast = fast.next.next
  END

  HIGHLIGHT slow 'SUCCESS'
  PRINT "Middle node:" slow.val
END
`,

  DetectCycleFloyd: `SCENE DetectCycleFloyd

DECLARE
  LINKEDLIST list = [1, 2, 3, 4, 5, 6]

SEQUENCE
  // Set-up: make the last node point back to node 3, creating a cycle
  tail = list.head
  WHILE tail.next != NULL
    tail = tail.next
  END
  tail.next = list.head.next.next
  tail = NULL

  // Phase 1 (Floyd): slow moves 1 step, fast moves 2.
  // If there is a cycle, fast laps slow and they meet inside it.
  slow = list.head
  fast = list.head
  hasCycle = 0
  WHILE fast != NULL AND fast.next != NULL AND hasCycle == 0
    slow = slow.next
    fast = fast.next.next
    IF slow == fast
      hasCycle = 1
    END
  END

  IF hasCycle == 1
    PRINT "Cycle detected: slow and fast meet at" slow.val

    // Phase 2: restart slow from the head and move both one step at a time.
    // They meet again exactly where the cycle begins.
    slow = list.head
    WHILE slow != fast
      slow = slow.next
      fast = fast.next
    END
    HIGHLIGHT slow 'SUCCESS'
    PRINT "The cycle starts at" slow.val

    // Phase 3: find the last node of the cycle and break the loop
    fast = slow
    WHILE fast.next != slow
      fast = fast.next
    END
    fast.next = NULL
    PRINT "Cycle removed:" list
  ELSE
    PRINT "No cycle:" list
  END
END
`,

  MergeTwoSortedLists: `SCENE MergeTwoSortedLists

DECLARE
  LINKEDLIST listA = [1, 4, 7, 9]
  LINKEDLIST listB = [2, 3, 8]
  LINKEDLIST merged = []

SEQUENCE
  // Walk both lists at once; always copy the smaller front value
  // to the end of 'merged' (last points at merged's current tail).
  a = listA.head
  b = listB.head
  last = NULL
  WHILE a != NULL OR b != NULL
    takeA = 0
    IF b == NULL
      takeA = 1
    ELSE IF a != NULL AND a.val <= b.val
      takeA = 1
    END

    value = 0
    IF takeA == 1
      value = a.val
      a = a.next
    ELSE
      value = b.val
      b = b.next
    END

    newNode = NEW_NODE(merged, value)
    IF last == NULL
      merged.head = newNode
    ELSE
      last.next = newNode
    END
    last = newNode
  END

  PRINT "Merged:" merged
END
`,

  RemoveNthFromEnd: `SCENE RemoveNthFromEnd

DECLARE
  LINKEDLIST list = [10, 20, 30, 40, 50, 60]

SEQUENCE
  n = 2
  // A dummy node before the head means even the head can be removed
  // without a special case
  dummy = NEW_NODE(list, 0)
  dummy.next = list.head
  fast = dummy
  slow = dummy

  // 1. Move fast n + 1 nodes ahead: now n nodes separate slow and fast
  LOOP i FROM 1 TO n + 1
    fast = fast.next
  END

  // 2. Move both together; when fast falls off the end,
  //    slow is right before the node to remove
  WHILE fast != NULL
    slow = slow.next
    fast = fast.next
  END

  // 3. Unlink the nth node from the end, then free it
  temp = slow.next
  PRINT "Removing node" temp.val
  slow.next = temp.next
  FREE temp

  list.head = dummy.next
  FREE dummy
  PRINT "List:" list
END
`,

  PalindromeLinkedList: `SCENE PalindromeLinkedList

DECLARE
  LINKEDLIST list = [1, 2, 3, 2, 1]

SEQUENCE
  // 1. Find the middle with slow / fast pointers
  slow = list.head
  fast = list.head
  WHILE fast != NULL AND fast.next != NULL
    slow = slow.next
    fast = fast.next.next
  END

  // 2. Reverse the second half in place, starting at the middle
  prev = NULL
  curr = slow
  WHILE curr != NULL
    next = curr.next
    curr.next = prev
    prev = curr
    curr = next
  END

  // 3. Walk inward from both ends comparing values
  left = list.head
  right = prev
  isPalindrome = 1
  WHILE right != NULL AND isPalindrome == 1
    COMPARE left right
    IF left.val != right.val
      isPalindrome = 0
    ELSE
      left = left.next
      right = right.next
    END
  END

  IF isPalindrome == 1
    PRINT "The list is a palindrome"
  ELSE
    PRINT "The list is NOT a palindrome"
  END

  // 4. Restore the list: reverse the second half back
  curr = prev
  prev = NULL
  WHILE curr != NULL
    next = curr.next
    curr.next = prev
    prev = curr
    curr = next
  END
  PRINT "Restored:" list
END
`,

  RemoveDuplicates: `SCENE RemoveDuplicatesFromSortedList

DECLARE
  LINKEDLIST list = [1, 1, 2, 3, 3, 3, 4]

SEQUENCE
  // In a sorted list equal values sit next to each other,
  // so compare each node with the one after it
  curr = list.head
  WHILE curr != NULL AND curr.next != NULL
    IF curr.val == curr.next.val
      dup = curr.next
      curr.next = dup.next   // skip the duplicate
      FREE dup               // and release its memory
    ELSE
      curr = curr.next
    END
  END

  PRINT "Without duplicates:" list
END
`,
};
