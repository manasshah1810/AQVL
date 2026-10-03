export const SYSTEM_PROMPT = `You are an expert in the AlgoQuest Visualization Language (AQVL).
Your task is to translate algorithmic concepts into valid, compile-ready AQVL code.

AQVL Output Contract:

1. REQUIRED PROGRAM SKELETON
All generated AQVL programs must adhere to the following structure:
SCENE <Name>
DECLARE
  // Data structures and functions go here (Optional)
SEQUENCE
  // Algorithmic execution and visualization statements go here
END

- SCENE <Name>: Required. Must begin the file.
- DECLARE: Optional. Used for declaring structures and functions.
- SEQUENCE: Optional but necessary for execution. Contains the main body of execution.
- END: Required to close the SCENE block (and inner blocks).

2. ALLOWED KEYWORDS / STATEMENTS
- Block Controls: SCENE, DECLARE, SEQUENCE, END
- Variables: Implicit scalar assignment (x = 5)
- Actions: COMPARE, SWAP, WAIT, HIGHLIGHT, LINK, SET ... STATE
- Standard I/O: PRINT
- Tree/Node manipulation: ROOT, CHILD, NEW_NODE, FREE

3. ALLOWED DATA STRUCTURES (in DECLARE block)
- ARRAY name = [...]
- STACK name = [...]
- QUEUE name = [...]
- SINGLY LINKEDLIST name = [...]
- DOUBLY LINKEDLIST name = [...]
- CIRCULAR LINKEDLIST name = [...]
- BINARY_TREE name = [...]
- BST name = [...]
- GRAPH name = ["A-B", "A->B:5", ...]

4. CONTROL FLOW
All blocks must be closed with END.
- LOOP identifier FROM expr TO expr ... END
- WHILE expr ... END
- IF expr ... END
- IF expr ... ELSE IF expr ... ELSE ... END
- FUNCTION name(args) ... END
- RETURN expr

5. EXPRESSIONS / OPERATORS
- Binary: <=, >=, ==, !=, +, -, *, /, >, <
- Logical: AND, OR
- Built-in Functions: LENGTH(arr), MAX(a, b), MIN(a, b), ABS(x)
- Member Access: node.val, node.left, list.head, etc.
- Queue/Stack reads: DEQUEUE(q), POP(s), PEEK(s), IS_EMPTY(x)

6. VISUALIZATION / ACTION STATEMENTS
- COMPARE a b
- SWAP a b
- WAIT
- HIGHLIGHT target ['COLOR_OR_LABEL']
- LINK a TO b
- SET target STATE name

7. RESTRICTIONS
- Indentation is NOT semantic: You MUST use END for blocks.
- Imports are NOT supported.
- No Early Escapes: BREAK and CONTINUE are NOT supported. Use a WHILE condition flag.
- Output AQVL only. Do not output markdown fences or explanations.
`;

export interface FewShotExample {
  topic: string;
  aqvl: string;
}

export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    "topic": "Array Foundation: core operations like traversal, insertion, deletion, and swap",
    "aqvl": "SCENE ArrayFoundation\n\nDECLARE\n  ARRAY arr = [10, 20, 30, 40, 50]\n\nSEQUENCE\n  LOOP i FROM 0 TO LENGTH(arr) - 1\n    HIGHLIGHT arr[i]\n  END\n\n  INSERT arr[2] 25\n  PRINT \"After INSERT:\" arr\n\n  DELETE arr[4]\n  PRINT \"After DELETE:\" arr\n\n  UPDATE arr[0] 15\n  PRINT \"After UPDATE:\" arr\n\n  SWAP arr[1] arr[3]\n  PRINT \"After SWAP:\" arr\n\n  target = 30\n  foundAt = -1\n  i = 0\n  WHILE i < LENGTH(arr) AND foundAt == -1\n    HIGHLIGHT arr[i]\n    IF arr[i] == target\n      HIGHLIGHT arr[i] 'SUCCESS'\n      foundAt = i\n    END\n    i = i + 1\n  END\n\n  IF foundAt == -1\n    PRINT target + \" is not in the array\"\n  ELSE\n    PRINT \"Found \" + target + \" at index \" + foundAt\n  END\nEND\n"
  },
  {
    "topic": "Reverse Array: reversing an array in-place using two pointers",
    "aqvl": "SCENE ArrayReverse\n\nDECLARE\n  ARRAY arr = [1, 2, 3, 4, 5, 6]\n\nSEQUENCE\n  left = 0\n  right = LENGTH(arr) - 1\n\n  WHILE left < right\n    SWAP arr[left] arr[right]\n    HIGHLIGHT arr[left] 'SUCCESS'\n    HIGHLIGHT arr[right] 'SUCCESS'\n    left = left + 1\n    right = right - 1\n  END\n\n  IF left == right\n    HIGHLIGHT arr[left] 'SUCCESS'\n  END\n\n  PRINT \"Reversed:\" arr\nEND\n"
  },
  {
    "topic": "Bubble Sort: sorting an array by repeatedly swapping adjacent out-of-order elements",
    "aqvl": "SCENE BubbleSort\n\nDECLARE\n  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]\n\nSEQUENCE\n  n = LENGTH(arr)\n  pass = 0\n  swapped = 1\n\n  WHILE swapped == 1 AND pass < n - 1\n    swapped = 0\n    LOOP j FROM 0 TO n - pass - 2\n      COMPARE arr[j] arr[j + 1]\n      IF arr[j] > arr[j + 1]\n        SWAP arr[j] arr[j + 1]\n        swapped = 1\n      END\n    END\n    HIGHLIGHT arr[n - pass - 1] 'SUCCESS'\n    pass = pass + 1\n    PRINT \"After pass \" + pass + \":\" arr\n  END\n\n  IF swapped == 0\n    PRINT \"Pass \" + pass + \" made no swaps, so the array is already sorted\"\n  END\n\n  k = 0\n  WHILE k < n - pass\n    HIGHLIGHT arr[k] 'SUCCESS'\n    k = k + 1\n  END\n  PRINT \"Sorted:\" arr\nEND\n"
  },
  {
    "topic": "Singly Linked List: node creation, traversal, insertion, and deletion",
    "aqvl": "SCENE SinglyLinkedList\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30, 40]\n\nSEQUENCE\n  curr = list.head\n  WHILE curr != NULL\n    PRINT \"Visit\" curr.val\n    curr = curr.next\n  END\n\n  newNode = NEW_NODE(list, 5)\n  newNode.next = list.head\n  list.head = newNode\n\n  newNode = NEW_NODE(list, 50)\n  curr = list.head\n  WHILE curr.next != NULL\n    curr = curr.next\n  END\n  curr.next = newNode\n\n  prev = list.head\n  WHILE prev.next != NULL AND prev.next.val != 30\n    prev = prev.next\n  END\n  IF prev.next != NULL\n    temp = prev.next\n    prev.next = temp.next\n    FREE temp\n  END\n\n  temp = list.head\n  list.head = temp.next\n  FREE temp\n\n  PRINT \"List:\" list\n\n  INSERT_TAIL list 60\n  DELETE_HEAD list\n  PRINT \"List:\" list\nEND\n"
  },
  {
    "topic": "Binary Tree Basics: building nodes, traversal, and freeing a leaf",
    "aqvl": "SCENE BinaryTreeBasics\n\nDECLARE\n  BINARY_TREE t = []\n\nSEQUENCE\n  root = NEW_NODE(t, 10)\n  t.root = root\n\n  a = NEW_NODE(t, 20)\n  b = NEW_NODE(t, 30)\n  root.left = a\n  root.right = b\n\n  a.left = NEW_NODE(t, 40)\n  a.right = NEW_NODE(t, 50)\n  b.right = NEW_NODE(t, 60)\n  PRINT \"Tree by levels:\" t\n\n  PRINT \"root.left.right.val =\" root.left.right.val\n\n  curr = t.root\n  WHILE curr.left != NULL\n    curr = curr.left\n  END\n  PRINT \"Leftmost node:\" curr.val\n\n  curr = t.root\n  WHILE curr.right != NULL\n    curr = curr.right\n  END\n  PRINT \"Rightmost node:\" curr.val\n  IF curr.left == NULL AND curr.right == NULL\n    PRINT curr.val \"is a leaf (both children are NULL)\"\n  END\n\n  leaf = b.right\n  b.right = NULL\n  FREE leaf\n  PRINT \"After removing 60:\" t\nEND\n"
  },
  {
    "topic": "Linear Search: checking every element sequentially to find a target",
    "aqvl": "SCENE LinearSearch\n\nDECLARE\n  ARRAY rollNo = [104, 117, 109, 123, 131, 112, 140]\n\n  FUNCTION linearSearch(target)\n    n = LENGTH(rollNo)\n    foundAt = -1\n    comparisons = 0\n    i = 0\n\n    WHILE i < n AND foundAt == -1\n      HIGHLIGHT rollNo[i]\n      comparisons = comparisons + 1\n      IF rollNo[i] == target\n        foundAt = i\n        HIGHLIGHT rollNo[i] 'SUCCESS'\n      ELSE\n        HIGHLIGHT rollNo[i] 'DISCARDED'\n      END\n      i = i + 1\n    END\n\n    IF foundAt != -1\n      PRINT \"Roll no \" + target + \" found at index \" + foundAt + \" after \" + comparisons + \" comparisons\"\n    ELSE\n      PRINT \"Roll no \" + target + \" is absent: all \" + comparisons + \" cells were checked\"\n    END\n    RETURN foundAt\n  END\n\n  FUNCTION resetColours()\n    LOOP k FROM 0 TO LENGTH(rollNo) - 1\n      HIGHLIGHT rollNo[k] 'NEUTRAL'\n    END\n  END\n\nSEQUENCE\n  present = linearSearch(123)\n  resetColours()\n  absent = linearSearch(150)\n\n  IF present != -1 AND absent == -1\n    PRINT \"Best case: 1 comparison, worst case: \" + LENGTH(rollNo) + \" comparisons (O(n))\"\n  END\nEND\n"
  },
  {
    "topic": "Binary Search: finding a target in a sorted array by halving the search space",
    "aqvl": "SCENE BinarySearch\n\nDECLARE\n  ARRAY price = [11, 12, 22, 25, 34, 64, 90, 105, 120]\n\n  FUNCTION binarySearch(target)\n    low = 0\n    high = LENGTH(price) - 1\n    step = 0\n\n    WHILE low <= high\n      step = step + 1\n      size = high - low\n      mid = low + (size - size % 2) / 2\n      HIGHLIGHT price[mid] 'MARKED'\n      PRINT \"Step \" + step + \": low=\" + low + \" high=\" + high + \" mid=\" + mid + \" (value \" + price[mid] + \")\"\n\n      IF price[mid] == target\n        HIGHLIGHT price[mid] 'SUCCESS'\n        PRINT \"Found \" + target + \" at index \" + mid + \" in \" + step + \" steps\"\n        RETURN mid\n      ELSE IF price[mid] < target\n        k = low\n        WHILE k <= mid\n          HIGHLIGHT price[k] 'DISCARDED'\n          k = k + 1\n        END\n        low = mid + 1\n      ELSE\n        k = mid\n        WHILE k <= high\n          HIGHLIGHT price[k] 'DISCARDED'\n          k = k + 1\n        END\n        high = mid - 1\n      END\n    END\n\n    PRINT target + \" is not in the list (window empty after \" + step + \" steps)\"\n    RETURN -1\n  END\n\n  FUNCTION resetColours()\n    LOOP k FROM 0 TO LENGTH(price) - 1\n      HIGHLIGHT price[k] 'NEUTRAL'\n    END\n  END\n\nSEQUENCE\n  binarySearch(90)\n  resetColours()\n  binarySearch(11)\n  resetColours()\n  binarySearch(50)\n\n  size = LENGTH(price)\n  maxSteps = 0\n  WHILE size > 0\n    maxSteps = maxSteps + 1\n    size = (size - size % 2) / 2\n  END\n  PRINT \"Never more than \" + maxSteps + \" steps for \" + LENGTH(price) + \" prices (O(log n)); linear search may need \" + LENGTH(price)\nEND\n"
  },
  {
    "topic": "For Loop Basics: standard loops over arrays and ranges",
    "aqvl": "SCENE ForLoopBasics\n\nDECLARE\n  ARRAY marks = [72, 85, 64, 90, 58]\n\nSEQUENCE\n  n = LENGTH(marks)\n  PRINT \"The class has \" + n + \" students\"\n\n  iterations = 0\n  passed = 0\n  LOOP i FROM 0 TO n - 1\n    HIGHLIGHT marks[i]\n    PRINT \"Student \" + (i + 1) + \" (index \" + i + \") scored \" + marks[i]\n    IF marks[i] >= 60\n      passed = passed + 1\n      HIGHLIGHT marks[i] 'SUCCESS'\n    END\n    iterations = iterations + 1\n  END\n  PRINT \"The loop body ran \" + iterations + \" times, once per student\"\n  PRINT passed + \" of \" + n + \" students scored 60 or more\"\n\n  sum = 0\n  LOOP k FROM 1 TO 10\n    sum = sum + k\n  END\n  PRINT \"1 + 2 + ... + 10 = \" + sum\n\n  evens = \"\"\n  LOOP k FROM 1 TO 5\n    evens = evens + (2 * k) + \" \"\n  END\n  PRINT \"First five even numbers: \" + evens\nEND\n"
  }
];
