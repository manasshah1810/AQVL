export const LinkedListScripts = {
  ComprehensiveTest: `SCENE LinkedListTest

DECLARE
  LINKEDLIST list = [10, 20, 30]

SEQUENCE
  // 1. Highlight head
  HIGHLIGHT list[0]

  // 2. Insert Middle (Index 1)
  INSERT list[1] 15

  // 3. Insert Head (Index 0)
  INSERT list[0] 5

  // 4. Insert Tail (Index 5)
  INSERT list[5] 40

  // 5. Delete Middle (Index 2)
  DELETE list[2]

  // 6. Manual Pointer Updates
  LINK list[0] TO list[2]
  DISCONNECT list[0] list[1]
END
`
};
