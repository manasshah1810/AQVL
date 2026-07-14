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
`
};
