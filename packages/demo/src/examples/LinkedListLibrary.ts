export const LinkedListScripts = {
  PointerArchitecture: `SCENE LinkedListArchitecture

DECLARE
  LINKEDLIST list = [10, 20, 30]

SEQUENCE
  // 1. Traverse nodes
  HIGHLIGHT list[0]
  HIGHLIGHT list[1]
  HIGHLIGHT list[2]

  // 2. Insert Head
  INSERT_HEAD list 5

  // 3. Insert Tail
  INSERT_TAIL list 40

  // 4. Delete Head
  DELETE_HEAD list

  // 5. Delete Tail
  DELETE_TAIL list
END
`
};
