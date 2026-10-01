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
  curr = list.head
  WHILE curr != NULL
    PRINT "Visit" curr.val
    curr = curr.next
  END

  newNode = NEW_NODE(list, 5)
  newNode.next = list.head
  list.head = newNode

  newNode = NEW_NODE(list, 50)
  curr = list.head
  WHILE curr.next != NULL
    curr = curr.next
  END
  curr.next = newNode

  prev = list.head
  WHILE prev.next != NULL AND prev.next.val != 30
    prev = prev.next
  END
  IF prev.next != NULL
    temp = prev.next
    prev.next = temp.next
    FREE temp
  END

  temp = list.head
  list.head = temp.next
  FREE temp

  PRINT "List:" list

  INSERT_TAIL list 60
  DELETE_HEAD list
  PRINT "List:" list
END
`,

  DoublyLinkedList: `SCENE DoublyLinkedList

DECLARE
  DOUBLY LINKEDLIST list = [10, 20, 30, 40]

SEQUENCE
  curr = list.head
  tail = NULL
  WHILE curr != NULL
    PRINT "Forward:" curr.val
    tail = curr
    curr = curr.next
  END

  curr = tail
  WHILE curr != NULL
    PRINT "Backward:" curr.val
    curr = curr.prev
  END

  curr = list.head
  WHILE curr != NULL AND curr.val != 20
    curr = curr.next
  END
  newNode = NEW_NODE(list, 25)
  newNode.prev = curr
  newNode.next = curr.next
  curr.next.prev = newNode
  curr.next = newNode

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
  curr = list.head
  PRINT "Visit" curr.val
  curr = curr.next
  WHILE curr != list.head
    PRINT "Visit" curr.val
    curr = curr.next
  END

  tail = list.head
  WHILE tail.next != list.head
    tail = tail.next
  END
  newNode = NEW_NODE(list, 50)
  newNode.next = list.head
  tail.next = newNode
  tail = newNode

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
  prev = NULL
  curr = list.head
  WHILE curr != NULL
    next = curr.next
    curr.next = prev
    prev = curr
    curr = next
  END
  list.head = prev

  PRINT "Reversed:" list
END
`,

  ReverseDoublyLinkedList: `SCENE ReverseDoublyLinkedList

DECLARE
  DOUBLY LINKEDLIST list = [1, 2, 3, 4, 5]

SEQUENCE
  curr = list.head
  last = NULL
  WHILE curr != NULL
    temp = curr.prev
    curr.prev = curr.next
    curr.next = temp
    last = curr
    curr = curr.prev
  END
  list.head = last

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
  first = list.head
  prev = first
  curr = first.next
  WHILE curr != first
    next = curr.next
    curr.next = prev
    prev = curr
    curr = next
  END
  first.next = prev
  list.head = prev

  PRINT "Reversed:" list
END
`,

  FindMiddleNode: `SCENE FindMiddleNode

DECLARE
  LINKEDLIST list = [10, 20, 30, 40, 50, 60, 70]

SEQUENCE
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
  tail = list.head
  WHILE tail.next != NULL
    tail = tail.next
  END
  tail.next = list.head.next.next
  tail = NULL

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

    slow = list.head
    WHILE slow != fast
      slow = slow.next
      fast = fast.next
    END
    HIGHLIGHT slow 'SUCCESS'
    PRINT "The cycle starts at" slow.val

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
  dummy = NEW_NODE(list, 0)
  dummy.next = list.head
  fast = dummy
  slow = dummy

  LOOP i FROM 1 TO n + 1
    fast = fast.next
  END

  WHILE fast != NULL
    slow = slow.next
    fast = fast.next
  END

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
  slow = list.head
  fast = list.head
  WHILE fast != NULL AND fast.next != NULL
    slow = slow.next
    fast = fast.next.next
  END

  prev = NULL
  curr = slow
  WHILE curr != NULL
    next = curr.next
    curr.next = prev
    prev = curr
    curr = next
  END

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
  curr = list.head
  WHILE curr != NULL AND curr.next != NULL
    IF curr.val == curr.next.val
      dup = curr.next
      curr.next = dup.next
      FREE dup
    ELSE
      curr = curr.next
    END
  END

  PRINT "Without duplicates:" list
END
`,
};
