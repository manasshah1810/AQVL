export const LinkedListScripts = {
  PointerArchitecture: `SCENE LinkedListArchitecture

DECLARE
  LINKEDLIST list = [10, 20, 30]

SEQUENCE
  // 1. Traverse nodes
  LOOP i FROM 0 TO 2
    HIGHLIGHT list[i]
    WAIT
  END

  // 2. Insert Head
  INSERT_HEAD list 5

  // 3. Insert Tail
  INSERT_TAIL list 40

  // 4. Delete Head
  DELETE_HEAD list

  // 5. Delete Tail
  DELETE_TAIL list
END
`,
  DoublyLinkedList: `SCENE DoublyLinkedListArchitecture

DECLARE
  DOUBLY LINKEDLIST list = [10, 20, 30]

SEQUENCE
  // 1. Forward Traversal
  LOOP i FROM 0 TO 2
    HIGHLIGHT list[i]
    WAIT
  END

  // 2. Backward Traversal
  HIGHLIGHT list[2]
  WAIT
  HIGHLIGHT list[1]
  WAIT
  HIGHLIGHT list[0]
  WAIT

  // 3. Insert Head
  INSERT_HEAD list 5

  // 4. Insert Tail
  INSERT_TAIL list 40

  // 5. Delete Head
  DELETE_HEAD list

  // 6. Delete Tail
  DELETE_TAIL list
END
`,
  CircularLinkedList: `SCENE CircularLinkedListArchitecture

DECLARE
  CIRCULAR LINKEDLIST list = [10, 20, 30]

SEQUENCE
  // Traverse nodes
  LOOP i FROM 0 TO 2
    HIGHLIGHT list[i]
    WAIT
  END

  // Insert Head
  INSERT_HEAD list 5

  // Insert Tail
  INSERT_TAIL list 40

  // Delete Head
  DELETE_HEAD list

  // Delete Tail
  DELETE_TAIL list
END
`,
  ReverseLinkedList: `SCENE ReverseLinkedList

DECLARE
  LINKEDLIST list = [1, 2, 3, 4, 5]

SEQUENCE
  // Traverse the initial linked list
  LOOP i FROM 0 TO 4
    HIGHLIGHT list[i]
    WAIT
  END
  
  // Reversing the linked list in place
  REVERSE list
  WAIT
  
  // Traverse the reversed linked list
  LOOP i FROM 0 TO 4
    HIGHLIGHT list[i]
    WAIT
  END
END
`,
  ReverseSinglyManual: `SCENE ReverseSinglyManual

DECLARE
  LINKEDLIST original = [1, 2, 3, 4, 5]
  LINKEDLIST reversed = []

SEQUENCE
  // Iteratively moving nodes from the head of 'original' 
  // to the head of 'reversed' to effectively reverse the list pointer-by-pointer.
  
  DELETE_HEAD original
  INSERT_HEAD reversed 1
  WAIT
  
  DELETE_HEAD original
  INSERT_HEAD reversed 2
  WAIT
  
  DELETE_HEAD original
  INSERT_HEAD reversed 3
  WAIT
  
  DELETE_HEAD original
  INSERT_HEAD reversed 4
  WAIT
  
  DELETE_HEAD original
  INSERT_HEAD reversed 5
  WAIT
END
`,
  ReverseDoublyManual: `SCENE ReverseDoublyManual

DECLARE
  DOUBLY LINKEDLIST original = [10, 20, 30]
  DOUBLY LINKEDLIST reversed = []

SEQUENCE
  // Moving nodes one by one. The Doubly Linked List automatically
  // manages rewiring the backward (prev) pointers as we insert.
  
  DELETE_HEAD original
  INSERT_HEAD reversed 10
  WAIT
  
  DELETE_HEAD original
  INSERT_HEAD reversed 20
  WAIT
  
  DELETE_HEAD original
  INSERT_HEAD reversed 30
  WAIT
END
`,
  ReverseCircularManual: `SCENE ReverseCircularManual

DECLARE
  CIRCULAR LINKEDLIST original = [100, 200, 300]
  CIRCULAR LINKEDLIST reversed = []

SEQUENCE
  // Moving nodes one by one. The Circular Linked List automatically
  // maintains the circular wrap-around edge as nodes are added.
  
  DELETE_HEAD original
  INSERT_HEAD reversed 100
  WAIT
  
  DELETE_HEAD original
  INSERT_HEAD reversed 200
  WAIT
  
  DELETE_HEAD original
  INSERT_HEAD reversed 300
  WAIT
END
`,

  FindMiddleNode: `SCENE FindMiddleNode

DECLARE
  LINKEDLIST list = [10, 20, 30, 40, 50]

SEQUENCE
  // Using two pointers (slow and fast) to find the middle node
  HIGHLIGHT list[0]
  WAIT
  
  // Step 1
  HIGHLIGHT list[1]
  HIGHLIGHT list[2]
  WAIT
  
  // Step 2
  HIGHLIGHT list[2]
  HIGHLIGHT list[4]
  WAIT
  
  // Fast is at the end, slow is at the middle (30)
END
`
};
