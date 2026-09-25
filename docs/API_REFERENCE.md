# AQVL API Reference

This document catalogs the built-in data-structure and algorithm operations
available in AQVL source, organized by data structure. For general language
grammar (declarations, control flow, functions, error handling), see
`docs/LANGUAGE_SPEC.md`.

Each entry gives: the exact AQVL syntax, a one-sentence description, standard
textbook Big-O time complexity for that operation, and a short runnable
example. Complexities are the conventional worst/typical-case bounds for the
operation itself (standard CS content), not measurements of this codebase.

This document is based on verified source inspection of:
`packages/runtime/src/core/algorithms/` (`BSTAlgorithms.ts`, `BSTEngine.ts`,
`BinaryTreeAlgorithms.ts`, `GraphEngine.ts`, `GraphAlgorithms.ts`,
`SortEngine.ts`, `SortAlgorithms.ts`, `HeapEngine.ts`, `HashMapVisualizer.ts`,
`TrieVisualizer.ts`) and `packages/runtime/src/data-structures/`.

> **Note:** a keyword being documented here means a confirmed runtime handler
> exists for it. Keywords that merely parse without error but have no confirmed
> handler are listed separately in §11 ("Reserved / Unimplemented") — do not
> assume those execute anything.

---

## 1. Binary Search Tree (BST)

Declared with `BST name [= [n, ...]]`. Fully implemented in
`BSTAlgorithms.ts` / `BSTEngine.ts`.

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert | `INSERT value` | Insert a value, with animated traversal to its insertion point. | O(h); O(log n) balanced, O(n) worst case (degenerate tree) |
| Delete | `DELETE value` | Remove a value. Handles leaf, one-child, and two-children (via inorder successor) cases. | O(h); O(log n) balanced, O(n) worst case |
| Search | `SEARCH value` | Search for a value. | O(h); O(log n) balanced, O(n) worst case |
| Clear | `CLEAR` | Remove all nodes. | O(n) |
| Inorder traversal | `INORDER` | Visit nodes in sorted order (left, root, right). | O(n) |
| Preorder traversal | `PREORDER` | Visit nodes root, left, right. | O(n) |
| Postorder traversal | `POSTORDER` | Visit nodes left, right, root. | O(n) |
| Level-order traversal | `LEVELORDER` | Visit nodes breadth-first by level. | O(n) |
| Minimum | `MIN` / `MIN_VALUE` | Find the minimum value (leftmost node). | O(h) |
| Maximum | `MAX` / `MAX_VALUE` | Find the maximum value (rightmost node). | O(h) |
| Height | `HEIGHT` | Height of the tree. | O(n) |
| Size | `SIZE` | Number of nodes. | O(n) or O(1) if tracked incrementally |
| Root | `ROOT` | Return/highlight the root node. | O(1) |
| Is empty | `IS_EMPTY` | Whether the tree has zero nodes. | O(1) |

```aqvl
SCENE BSTOperations
DECLARE
  BST myTree
SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  SEARCH 60
  DELETE 20
  CLEAR
END
```

---

## 2. Arrays

No dedicated engine — arrays use generic index-based actions.

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert at index | `INSERT arr[i] value` | Insert a value at index `i`. | O(n) (shifting elements) |
| Delete at index | `DELETE arr[i]` | Remove the element at index `i`. | O(n) (shifting elements) |
| Update at index | `UPDATE arr[i] value` | Overwrite the element at index `i`. | O(1) |
| Swap | `SWAP arr[i] arr[j]` | Swap two elements. | O(1) |
| Compare | `COMPARE arr[i] arr[j]` | Visually compare two elements. | O(1) |
| Highlight | `HIGHLIGHT arr[i]` | Highlight an element, e.g. for emphasis. | O(1) |
| Length | `LENGTH(arr)` | Built-in expression returning array length. | O(1) |
| Access | `arr[i]` | Read an element by index. | O(1) |

```aqvl
SCENE ArrayDemo
DECLARE
  ARRAY arr = [10, 20, 30, 40]
SEQUENCE
  COMPARE arr[0] arr[1]
  SWAP arr[0] arr[1]
  UPDATE arr[2] 99
  HIGHLIGHT arr[3] 'SUCCESS'
END
```

---

## 3. Stacks

Declared with `STACK name [= [n, ...]]`. Push/pop/peek are implemented in
`packages/runtime/src/core/AnimationController.ts` (handlers for
`PUSH`/`POP`/`PEEK` GENERIC_ACTION instructions).

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Push | `PUSH stack value` | Push a value onto the top of the stack. | O(1) |
| Pop | `POP stack` | Remove and return the top value. Throws `StackUnderflowError` on an empty stack. | O(1) |
| Peek | `PEEK stack` | Look at the top value without removing it. | O(1) |
| Compare | `COMPARE a b` | Compare two elements. | O(1) |
| Swap | `SWAP a b` | Swap two elements. | O(1) |
| Highlight | `HIGHLIGHT target` | Highlight an element (e.g. top of stack). | O(1) |

```aqvl
SCENE StackDemo
DECLARE
  STACK s = [1, 2, 3]
SEQUENCE
  PUSH s 4
  PEEK s
  POP s
END
```

---

## 4. Queues

Declared with `QUEUE name [= [n, ...]]`. Enqueue/dequeue/front/rear are
implemented in `packages/runtime/src/core/AnimationController.ts` (handlers
for `ENQUEUE`/`DEQUEUE`/`FRONT`/`REAR` GENERIC_ACTION instructions).

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Enqueue | `ENQUEUE queue value` | Add a value to the rear of the queue. | O(1) |
| Dequeue | `DEQUEUE queue` | Remove and return the value at the front. Throws `StackUnderflowError` on an empty queue. | O(1) |
| Front | `FRONT queue` | Highlight/inspect the front element. | O(1) |
| Rear | `REAR queue` | Highlight/inspect the rear element. | O(1) |

```aqvl
SCENE QueueDemo
DECLARE
  QUEUE q = [1, 2, 3]
SEQUENCE
  ENQUEUE q 4
  FRONT q
  DEQUEUE q
END
```

---

## 5. Linked Lists

Declared with `LINKEDLIST` (default: singly-linked), `SINGLY LINKEDLIST`,
`DOUBLY LINKEDLIST`, or `CIRCULAR LINKEDLIST`. All three variants share the
same operation set.

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert at head | `INSERT_HEAD list value` | Insert a new node at the head. | O(1) |
| Insert at tail | `INSERT_TAIL list value` | Insert a new node at the tail. | O(1) with tail pointer, O(n) otherwise |
| Delete head | `DELETE_HEAD list` | Remove the head node. | O(1) |
| Delete tail | `DELETE_TAIL list` | Remove the tail node. | O(1) doubly-linked with tail pointer, O(n) singly-linked |
| Reverse | `REVERSE list` | Reverse the list in place. | O(n) |

```aqvl
SCENE LinkedListDemo
DECLARE
  DOUBLY LINKEDLIST list = [1, 2, 3]
SEQUENCE
  INSERT_HEAD list 0
  INSERT_TAIL list 4
  DELETE_HEAD list
  REVERSE list
END
```

---

## 6. General / Binary Trees

Declared with `TREE` / `BINARY_TREE`, or built ad hoc via `ROOT`/`CHILD`
actions. Implemented in
`packages/runtime/src/core/algorithms/BinaryTreeAlgorithms.ts`.

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Root | `ROOT value` | Create/set the root node. | O(1) |
| Add child | `CHILD parent child` | Attach a child node to a parent. | O(1) |
| Mirror/invert | `MIRROR` / `INVERT` | Recursively swap left/right children of every node. | O(n) |
| Clone/copy | `CLONE` / `COPY` | **Caveat:** source comments this as "not fully implemented yet" — it currently only logs a warning and does not actually clone the tree. Do not rely on it. | N/A (not functional) |
| Remove leaves | `REMOVE_LEAVES` / `PRUNE` | Remove all current leaf nodes. | O(n) |
| Left view | `LEFT_VIEW` | Leftmost node visible at each level. | O(n) |
| Right view | `RIGHT_VIEW` | Rightmost node visible at each level. | O(n) |
| Top view | `TOP_VIEW` | Nodes visible from directly above. | O(n log n) typical (sorting by horizontal distance) |
| Bottom view | `BOTTOM_VIEW` | Nodes visible from directly below. | O(n log n) typical |
| Boundary traversal | `BOUNDARY` | Traverse the boundary (left edge, leaves, right edge). | O(n) |
| Vertical order | `VERTICAL_ORDER` | Group nodes by horizontal distance from root. | O(n log n) typical |
| Diagonal traversal | `DIAGONAL` | Traverse nodes along diagonals. | O(n) |
| Max value | `MAX_VALUE` | Maximum value in the tree. | O(n) |
| Min value | `MIN_VALUE` | Minimum value in the tree. | O(n) |
| Sum | `SUM` | Sum of all node values. | O(n) |
| Average | `AVERAGE` | Average of all node values. | O(n) |
| Max level sum | `MAX_LEVEL_SUM` | Level with the maximum sum of values. | O(n) |

```aqvl
SCENE TreeOperations
SEQUENCE
    ROOT A
    CHILD A B
    CHILD A C
    MIRROR
    LEFT_VIEW
    RIGHT_VIEW
END
```

> **Important:** traversal/search/delete keywords such as `PREORDER`,
> `LEVELORDER`, `SEARCH`, `DELETE` are confirmed to work in the `ROOT`/`CHILD`
> style. `HEIGHT`, `SIZE`, `ROOT` (as a query), `IS_EMPTY`, `MIN`, `MAX` are
> confirmed **only for `BST`** (§1), not for general/binary trees. See §11 for
> the large set of tree-query keywords (`LEAVES`, `IS_BALANCED`, `LCA`, `DEPTH`,
> etc.) that parse but have no confirmed runtime handler for any tree type.

---

## 7. Graphs

Declared with `GRAPH name = ["A-B", "A->B", "A-B:5", ...]`. Implemented in
`GraphEngine.ts` / `GraphAlgorithms.ts`.

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Depth-first search | `DFS g FROM start` | Traverse depth-first from `start`. | O(V + E) |
| Breadth-first search | `BFS g FROM start` | Traverse breadth-first from `start`, tracking per-vertex level. | O(V + E) |
| Dijkstra's algorithm | `DIJKSTRA g FROM start` | Shortest paths from `start` (non-negative weights). | O((V + E) log V) with a priority queue |
| Bellman-Ford | `BELLMAN_FORD g FROM start` | Shortest paths from `start`; detects negative cycles. | O(V · E) |
| A* search | `ASTAR g FROM start TO goal` | Heuristic-guided shortest path from `start` to `goal`. | O(E) in the best case with an admissible heuristic; O((V+E) log V) worst case, comparable to Dijkstra |
| Prim's algorithm | `PRIM g [FROM start]` | Minimum spanning tree, grown from a start vertex. | O(E log V) with a priority queue |
| Kruskal's algorithm | `KRUSKAL g` | Minimum spanning tree via edge sorting + union-find. | O(E log E) |
| Topological sort | `TOPO_SORT g` | Linear ordering of vertices respecting edge direction; detects cycles. | O(V + E) |

Engine return shapes (for reference, not AQVL syntax):
- `depthFirstSearch(startVertex)` → `{ visited, order, animationFrames }`
- `breadthFirstSearch(startVertex)` → `{ visited, order, level, animationFrames }`
- `dijkstra(sourceVertex)` → `{ distances, predecessor, animationFrames }`
- `bellmanFord(sourceVertex)` → `{ distances, predecessor, hasNegativeCycle, animationFrames }`
- `aStar(sourceVertex, goalVertex, heuristic?)` → `{ path, distance, animationFrames }`
- `prim(startVertex?)` → `{ mstEdges, totalWeight, animationFrames }`
- `kruskal()` → `{ mstEdges, totalWeight, animationFrames }`
- `topologicalSort()` → `{ ordering, hasCycle, animationFrames }`

```aqvl
SCENE GraphDemo
DECLARE
  GRAPH g = ["A-B", "B-C"]
SEQUENCE
  DFS g FROM A
  BFS g FROM A
  DIJKSTRA g FROM A
  BELLMAN_FORD g FROM A
  ASTAR g FROM A TO C
  PRIM g FROM A
  KRUSKAL g
  TOPO_SORT g
END
```

---

## 8. Sorting

Implemented in `SortEngine.ts` (class `SortAlgorithm`, static methods),
wired into animation via `SortAlgorithms.ts`. Each algorithm returns
`{ array, steps: SortStep[], comparisons, swaps }`, where a `SortStep`'s kind is
one of `COMPARE | SWAP | OVERWRITE | PIVOT`.

Two ways to sort are available:

### 8.1 One-shot builtin keywords

| Operation | Syntax | Description | Time Complexity | Space |
|---|---|---|---|---|
| Bubble sort | `BUBBLE_SORT arr` | Repeatedly swap adjacent out-of-order elements. | O(n²) avg/worst, O(n) best | O(1) |
| Selection sort | `SELECTION_SORT arr` | Repeatedly select the minimum remaining element. | O(n²) all cases | O(1) |
| Insertion sort | `INSERTION_SORT arr` | Insert each element into its sorted position. | O(n²) avg/worst, O(n) best | O(1) |
| Merge sort | `MERGE_SORT arr` | True recursive divide-and-conquer merge sort. | O(n log n) all cases | O(n) |
| Quick sort | `QUICK_SORT arr` | True recursive partition-based quicksort. | O(n log n) avg, O(n²) worst | O(log n) avg (recursion stack) |

```aqvl
SCENE SortDemo
DECLARE
  ARRAY arr = [5, 2, 8, 1, 9]
SEQUENCE
  BUBBLE_SORT arr
END
```

### 8.2 Manual/unrolled teaching style

A manual style built from `LOOP`/`COMPARE`/`SWAP`/`IF` also exists and is what
the demo/teaching example library (`packages/demo/src/examples`) uses; the
one-shot keywords above are a newer builtin form covered by the test suite.
Both styles are valid AQVL.

```aqvl
SCENE BubbleSort
DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]
SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    LOOP j FROM 0 TO LENGTH(arr) - i - 2
      COMPARE arr[j] arr[j+1]
      IF arr[j] > arr[j+1]
        SWAP arr[j] arr[j+1]
      END
    END
    HIGHLIGHT arr[LENGTH(arr) - i - 1]
  END
  HIGHLIGHT arr[0]
END
```

---

## 9. Heap

Declared with `HEAP name [= [n, ...]]`. Min-heap only — there is no max-heap
variant. Implemented in `HeapEngine.ts` (`MinHeap` in
`packages/runtime/src/data-structures/Heap.ts`).

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert | `HEAP_INSERT heapName value` | Insert a value and sift up. | O(log n) |
| Extract min | `HEAP_EXTRACT heapName` | Remove and return the minimum (root), then sift down. | O(log n) |
| Decrease key | `HEAP_DECREASE heapName index newValue` | Decrease the value at `index` and sift up. | O(log n) |
| Build heap | `BUILD_HEAP heapName` | Build a heap from existing (unordered) array contents. | O(n) |
| Heapify | `HEAPIFY heapName` | Restore the heap property from a given node downward. | O(log n) per call |

```aqvl
SCENE HeapDemo
DECLARE
  HEAP h = [5, 3, 7]
SEQUENCE
  HEAP_INSERT h 10
  HEAP_DECREASE h 2 1
  HEAP_EXTRACT h
END
```

---

## 10. HashMap

Declared with `HASH_MAP name [= {k1: v1, k2: v2}]`. Implemented in
`HashMapVisualizer.ts` with a real separate-chaining `HashMap` in
`packages/runtime/src/data-structures/HashMap.ts`, which resizes at load
factor 0.75.

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert | `HASHMAP_INSERT name key value` | Insert or overwrite a key/value pair. | O(1) average, O(n) worst case (hash collisions / resize) |
| Lookup | `HASHMAP_LOOKUP name key` | Look up the value for a key. | O(1) average, O(n) worst case |
| Delete | `HASHMAP_DELETE name key` | Remove a key/value pair. | O(1) average, O(n) worst case |
| Init (compiler-emitted) | *(auto-emitted, not written directly)* | `HASHMAP_INIT` plus one `HASHMAP_INSERT` per entry is auto-generated from a `HASH_MAP name = {...}` declaration's literal entries. | O(k) for k literal entries |

```aqvl
SCENE HashMapDemo
DECLARE
  HASH_MAP h = {k1: v1, k2: v2}
SEQUENCE
  HASHMAP_LOOKUP h k1
  HASHMAP_DELETE h k1
END
```

---

## 11. Trie

Declared with `TRIE name [= ["str", "str", ...]]`. Implemented in
`TrieVisualizer.ts` (`Trie` in `packages/runtime/src/data-structures/Trie.ts`).

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert | `TRIE_INSERT name word` | Insert a word. | O(m), m = word length |
| Search | `TRIE_SEARCH name word` | Check whether a full word exists. | O(m) |
| Delete | `TRIE_DELETE name word` | Remove a word (pruning now-unused nodes). | O(m) |
| Autocomplete | `TRIE_AUTOCOMPLETE name prefix` | List all words with the given prefix. | O(p + k), p = prefix length, k = number of matching nodes visited |
| Starts-with | `TRIE_STARTSWITH name prefix` | Check whether any word has the given prefix. | O(p), p = prefix length |
| Init (compiler-emitted) | *(auto-emitted, not written directly)* | `TRIE_INIT` is auto-generated from a `TRIE name = [...]` declaration. | O(total characters across literal words) |

```aqvl
SCENE TrieDemo
DECLARE
  TRIE t = ["cat", "car"]
SEQUENCE
  TRIE_SEARCH t cat
  TRIE_AUTOCOMPLETE t ca
  TRIE_DELETE t cat
END
```

---

## 12. Reserved / Unimplemented Keywords (do not rely on these)

### 12.1 Tree-query keywords with no confirmed runtime handler

The following keywords are lexed and parsed successfully as generic action
statements — the compiler will not reject them — but a repository-wide search
of `packages/runtime/src/core/algorithms/` found **no confirmed runtime
handler** for any of them, for any tree type (general, binary, or BST). Do not
write examples that assume these produce output or side effects:

```
PARENT, LEFT_CHILD, RIGHT_CHILD, SIBLING, GRANDPARENT, UNCLE, COUSINS,
PARENTOF, CHILDRENOF, ANCESTORS, DESCENDANTS, SIBLINGS, PATH, LCA, DISTANCE,
DEPTH, LEVEL, MAX_DEPTH, MIN_DEPTH, LEAVES (generic, non-BST), INTERNAL,
DEGREE, STATS, COUNT_NODES, COUNT_LEAVES, COUNT_INTERNAL, COUNT_LEFT_LEAVES,
COUNT_RIGHT_LEAVES, COUNT_FULL, COUNT_HALF, IS_FULL, IS_COMPLETE, IS_PERFECT,
IS_BALANCED, IS_DEGENERATE, IS_LEFT_SKEWED, IS_RIGHT_SKEWED, IS_SYMMETRIC,
REVERSE, ZIGZAG, REVERSELEVELORDER, ROOT_TO_NODE, ROOT_TO_LEAVES,
LONGEST_PATH, SHORTEST_PATH
```

The only confirmed matches for height/size/balance-style queries in the
algorithms directory are the BST-specific `HEIGHT`, `SIZE`, `ROOT`,
`IS_EMPTY`, `MIN`, `MAX` documented in §1, and an unrelated match in
`HashMapVisualizer.ts`.

### 12.2 Structures with no AQVL syntax at all

`AVLTree.ts` and `RedBlackTree.ts` (`packages/runtime/src/data-structures/`)
contain full, tested self-balancing tree implementations (real rotations and
recoloring — see `tests/integration/balancing.test.ts`), but there is
currently **no lexer keyword or parser rule** that constructs or manipulates
them from AQVL source. `AVL`, `AVL_TREE`, `RED_BLACK`, and `RBT` are not valid
AQVL keywords. These structures are implemented at the runtime-engine level
only.

### 12.3 `IMPORT`

`IMPORT` appears in the keyword list but has no parser rule; using it is a
parse error. See `docs/LANGUAGE_SPEC.md` §11.1.

---

## 13. See also

- `docs/LANGUAGE_SPEC.md` — full grammar, declarations, control flow, type
  system, and error handling.
