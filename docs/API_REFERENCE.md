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
`SortEngine.ts`, `SortAlgorithms.ts`, `HeapEngine.ts`, `HashMapVisualizer.ts`, `HashMapProgramEngine.ts`,
`TrieVisualizer.ts`) and `packages/runtime/src/data-structures/`.

> **Note:** a keyword being documented here means a confirmed runtime handler
> exists for it. Keywords that merely parse without error but have no confirmed
> handler are listed separately in §11 ("Reserved / Unimplemented") — do not
> assume those execute anything.

---

## 1. Binary Search Tree (BST)

Declared with `BST name` (empty) or `BST name = [50, 30, 70]` (keys inserted
in that order at compile time — the tree appears fully built; duplicate keys
are a compile error). A BST is a pointer tree: everything in §6 (pointer code,
recursion, queues / stacks of pointers) works on it. Implemented in
`packages/runtime/src/core/algorithms/TreeEngine.ts`.

The built-ins below animate the same node-by-node walk and pointer relinking
you would write by hand. The tree name may be omitted when the program has a
single tree (`INSERT 50`).

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert | `INSERT t value` | Walk down comparing, link a new node where the walk falls off. Existing keys are not inserted twice. | O(h) |
| Delete | `DELETE t value` | Leaf: unlink. One child: parent adopts it. Two children: copy the inorder successor's key, unlink the successor. The removed node is freed. | O(h) |
| Search | `SEARCH t value` | Follow one root-to-leaf path. | O(h) |
| Min / Max | `MIN t` / `MAX t` | Follow left / right pointers to the end. | O(h) |
| Traversals | `INORDER t`, `PREORDER t`, `POSTORDER t`, `LEVELORDER t` | Visit every node (inorder = sorted). | O(n) |
| Height / Size / Leaves | `HEIGHT t`, `SIZE t`, `LEAVES t` | Measurements. | O(n) |
| Rotate | `ROTATE t value "LEFT"` / `"RIGHT"` | Rotation at a node (3 pointer writes). | O(n) to find the parent |
| Mirror | `MIRROR t` | Swap every left/right pair. | O(n) |
| Clear | `CLEAR t` | Free every node in postorder. | O(n) |
| Root / empty | `ROOT t`, `IS_EMPTY t` | Report the root / whether it is NULL. | O(1) |

```aqvl
SCENE BSTOperations
DECLARE
  BST t = [50, 30, 70, 20, 40]
SEQUENCE
  INSERT t 60
  SEARCH t 60
  DELETE t 30
  INORDER t
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

Declared with `STACK name [= [value, ...]]` (values listed bottom to top).
Every stack is compiled to a container (`ctr:<name>` anchor plus one
`CONTAINER_ITEM` per element) that the runtime's `TreeEngine` animates
(`containerAdd` / `containerTake` / `containerClear` in
`packages/runtime/src/core/algorithms/TreeEngine.ts`). Without a tree in the
program it is drawn as a vertical column (bottom → top, the top tagged `TOP`);
in a tree program it is a row under the trees and can hold node pointers.

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Push | `PUSH s value` | Put a value on top. `value` is any expression: `5`, `"("`, `arr[i]`, `total + 1`, a node pointer. | O(1) |
| Pop | `x = POP(s)` / `POP s` | Remove the top value (and return it, in an expression). Empty stack → stack-underflow error. | O(1) |
| Peek | `x = PEEK(s)` / `PEEK s` | Read the top value without removing it. Empty stack → stack-underflow error. | O(1) |
| Is empty | `IS_EMPTY(s)` / `IS_EMPTY s` | True when the stack holds nothing (the statement form logs the answer). | O(1) |
| Length | `LENGTH(s)` / `SIZE s` | Number of elements (the statement form logs it). | O(1) |
| Clear | `CLEAR s` | Remove every element. | O(n) |
| Print | `PRINT s` | Prints the stack bottom → top, e.g. `[1, 2, "("]`. | O(n) |
| Highlight | `HIGHLIGHT s[i]` | Highlight one of the initially declared elements (0 = bottom). | O(1) |

`AND` / `OR` short-circuit when the right side reads a stack, so
`WHILE LENGTH(s) > 0 AND PEEK(s) < x` never peeks at an empty stack.

```aqvl
SCENE StackDemo
DECLARE
  STACK s = []
  ARRAY arr = [1, 2, 3]
SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    PUSH s arr[i]
  END
  WHILE LENGTH(s) > 0
    x = POP(s)
    PRINT "Popped" x
  END
END
```

See the Playground's Stacks examples (`packages/demo/src/examples/StackLibrary.ts`)
for complete algorithms.

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
`DOUBLY LINKEDLIST`, or `CIRCULAR LINKEDLIST`; `= []` declares an empty list.
Implemented in `packages/runtime/src/core/algorithms/LinkedListEngine.ts`.

Algorithms are written as pointer code, the way they are in C. A node
reference is an ordinary value held in a variable; `NULL` is the null
pointer.

| Expression / statement | Meaning |
|---|---|
| `list.head` | First node, or `NULL` for an empty list. Assignable: `list.head = n`. |
| `list.tail` | Last node (found by following `next` from the head). Read-only. |
| `p.val` | The node's value (`p.value` / `p.data` also work). Assignable. |
| `p.next` | Next node or `NULL`. Assignable: `prev.next = curr.next`. |
| `p.prev` | Previous node or `NULL` — `DOUBLY` lists only. Assignable. |
| `n = NEW_NODE(list, value)` | Allocate an unlinked node (it appears in the list's heap-memory area). |
| `FREE p` | Release a node's memory (`FREE NULL` does nothing). |
| `list[i]`, `LENGTH(list)` | The node `i` hops from the head (read as its value inside expressions); node count. |
| `PRINT list` | Prints e.g. `10 -> 20 -> NULL` (or `... -> back to 10` for a cycle). |
| `HIGHLIGHT p` / `COMPARE a b` | Accept pointer variables and pointer expressions (`HIGHLIGHT curr.next`). |
| `SWAP a b` | On two list nodes, exchanges their values. |

`AND` / `OR` short-circuit, so `WHILE fast != NULL AND fast.next != NULL`
never dereferences `NULL`.

**Visualization.** Each pointer move (`curr = curr.next`) and each pointer
write is its own animated step, with the arrow followed/changed highlighted
and a console line explaining it. The first node is tagged `HEAD` and the
last `TAIL`; pointer variables appear as tags on the node they point to.
A node not reachable from the head — freshly allocated, or unlinked by a
pointer write that skips over it — moves to the list's heap-memory row
below the list until `FREE`; one that nothing points to any more is flagged
`LEAKED`. Several lists are laid out side by side.

**Run-time errors:** NULL pointer dereference, use after free, double free,
`p.prev` on a non-doubly list, `list[i]` out of range, assigning a
non-node to a pointer field.

Built-in shortcuts — each animates the same pointer walk and relinking
you would write by hand (there is no tail pointer, so reaching the tail
walks the list):

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert at head | `INSERT_HEAD list value` | New node → old head, then head → new node. | O(1); O(n) circular (tail must be re-pointed) |
| Insert at tail | `INSERT_TAIL list value` | Walk to the last node, link the new node after it. | O(n) |
| Delete head | `DELETE_HEAD list` | Head → second node, then free the old head. | O(1); O(n) circular |
| Delete tail | `DELETE_TAIL list` | Walk to the second-to-last node, unlink and free the tail. | O(n) |
| Insert at position | `INSERT list[i] value` | Walk to `i - 1`, link a new node after it. | O(i) |
| Delete at position | `DELETE list[i]` | Walk to `i - 1`, unlink and free the next node. | O(i) |
| Update at position | `UPDATE list[i] value` | Walk to `i`, change its value. | O(i) |
| Search | `SEARCH list value` | Compare values from the head until found or the end. | O(n) |
| Reverse | `REVERSE list` | In-place prev / curr / next reversal (circular lists stay circular). | O(n) |

```aqvl
SCENE ReverseList
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
```

---

## 6. General / Binary Trees

### Binary trees (pointer model)

Declared with `BINARY_TREE t = [1, 2, 3, NULL, 5]` — level order, left to
right, `NULL` for a missing child — or `BINARY_TREE t = []`. Implemented in
`packages/runtime/src/core/algorithms/TreeEngine.ts`.

| Expression / statement | Meaning |
|---|---|
| `t.root` | The top node or `NULL`. Assignable. |
| `node.val` / `node.left` / `node.right` | Value and child pointers. Assignable (`parent.left = n`). |
| `n = NEW_NODE(t, value)` | Allocate a node (children NULL); it waits in heap memory until linked. |
| `FREE n` | Release a node. |
| `LENGTH(t)` | Nodes reachable from the root. |
| `PRINT t` | `Level 0: 1 \| Level 1: 2 3 \| ...` |
| `QUEUE q = []`, `STACK s = []` | In a program with a tree they hold values or node pointers (a `STACK` does in every program): `ENQUEUE q x`, `PUSH s x`, and in expressions `DEQUEUE(q)`, `POP(s)`, `FRONT(q)`, `PEEK(s)`, `IS_EMPTY(q)`, `LENGTH(q)`. |
| `MAX(a, b)`, `MIN(a, b)`, `ABS(x)` | Arithmetic built-ins. |

Recursive `FUNCTION`s (see LANGUAGE_SPEC §7) are the natural way to write
tree algorithms. **Visualization:** every pointer move, pointer write, call
and return is its own step with a console line; pointer variables are tags on
their node, the root is tagged `ROOT`, nodes waiting on the call stack are
tinted, and a call-stack panel is drawn beside the tree. A node cut out of the
tree moves to its heap-memory row until `FREE`; one nothing points to is
flagged `LEAKED`.

**Run-time errors:** NULL pointer dereference, use after free, double free,
`node.parent` (nodes have no parent pointer), a node made its own child,
`DEQUEUE` / `POP` on an empty container.

The built-ins of §1 (except `DELETE`, which needs BST order) also work on a
binary tree; `INSERT t v` fills the first free child slot in level order, and
`SEARCH` / `MIN` / `MAX` check every node.

```aqvl
SCENE Height
DECLARE
  BINARY_TREE t = [1, 2, 3, 4]
  FUNCTION height(node)
    IF node == NULL
      RETURN 0
    END
    RETURN 1 + MAX(height(node.left), height(node.right))
  END
SEQUENCE
  PRINT "height" height(t.root)
END
```

### General trees

Built ad hoc with `ROOT`/`CHILD` actions (no declaration). Implemented in
`packages/runtime/src/core/algorithms/BinaryTreeAlgorithms.ts`.

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Root | `ROOT value` | Create/set the root node. | O(1) |
| Add child | `CHILD parent child` | Attach a child node to a parent. | O(1) |
| Mirror/invert | `MIRROR` / `INVERT` | Recursively swap left/right children of every node. | O(n) |
| Remove leaves | `REMOVE_LEAVES` / `PRUNE` | Remove all current leaf nodes. | O(n) |
| Views | `LEFT_VIEW`, `RIGHT_VIEW`, `TOP_VIEW`, `BOTTOM_VIEW` | Nodes visible from a side. | O(n) – O(n log n) |
| Boundary / vertical / diagonal | `BOUNDARY`, `VERTICAL_ORDER`, `DIAGONAL` | Special traversals. | O(n) – O(n log n) |
| Aggregates | `MAX_VALUE`, `MIN_VALUE`, `SUM`, `AVERAGE`, `MAX_LEVEL_SUM` | Over all node values. | O(n) |

```aqvl
SCENE TreeOperations
SEQUENCE
    ROOT A
    CHILD A B
    CHILD A C
    MIRROR
    LEFT_VIEW
END
```

---

## 7. Graphs

Declared with `GRAPH g = ["A-B", "A->C:4", "D"]`:

- `"A-B"` is an undirected edge, `"A->B"` (or the older `"A>B"`) a directed one;
  a graph uses one kind for all its edges (mixing them is a compile error).
- `":4"` gives the edge a weight; without one every weight is 1. In a
  weighted graph the weight is drawn on the edge.
- A lone name (`"D"`) is a vertex with no edges.
- Listing the same edge twice is a compile error.

Vertices are numbered in order of first appearance and edges in the order
listed; that order is what `VERTEX_AT`, `EDGE_AT` and `NEIGHBOR` use.
Implemented in `packages/runtime/src/core/algorithms/GraphProgramEngine.ts`.

### Graph algorithms as code

A vertex (or an edge) held in a variable is a reference, like a tree-node
pointer. Graph algorithms are written with loops, IFs, queues, stacks and
recursion:

| Expression / statement | Meaning |
|---|---|
| `VERTEX(g, "A")` | The vertex named A (error if there is none). |
| `VERTEX_AT(g, i)` | The i-th vertex, from 0. |
| `VERTEX_COUNT(g)` / `LENGTH(g)` | Number of vertices. |
| `EDGE_COUNT(g)` | Number of edges (an undirected edge counts once). |
| `EDGE_AT(g, i)` | The i-th edge, from 0; `e.from`, `e.to`, `e.weight`. |
| `DEGREE(v)` | Number of neighbours: edges leaving v (directed), or touching v (undirected). |
| `IN_DEGREE(v)` | Edges coming into v (equals `DEGREE` in an undirected graph). |
| `NEIGHBOR(v, i)` | v's i-th neighbour, from 0, in edge order. |
| `WEIGHT(u, w)` | Weight of the edge u → w (error if there is none). |
| `HAS_EDGE(u, w)` | `TRUE` when the edge u → w exists. |
| `v.name` | The vertex's name (read-only; also `v.val`). |
| `v.anything` | A field of your own: `v.visited`, `v.dist`, `v.parent = u`, `v.color`, … Assignable on vertices and edges. |
| `ADD_VERTEX g "E"` | Add a vertex. |
| `ADD_EDGE g "A" "B" [weight]` | Add an edge; the ends may be names or vertex variables. A name not in the graph yet becomes a new vertex. |
| `REMOVE_EDGE g "A" "B"` / `REMOVE_VERTEX g "C"` | Remove an edge / a vertex with all its edges. |
| `PRINT g` | Adjacency lists: `A: B(4) C(1) \| B: A(4) \| …`. `PRINT v` prints the name, `PRINT e` prints `A-B(4)`. |
| `QUEUE q = []`, `STACK s = []` | Hold vertices: `ENQUEUE q v`, `w = DEQUEUE(q)`, `PUSH s v`, `POP(s)`, … |
| `TRUE`, `FALSE`, `INFINITY` | Literals, e.g. `v.visited = TRUE`, `v.dist = INFINITY`. |

**Fields.** Every field starts unset, and reading an unset field is an
error, so initialise it first (for example `v.dist = INFINITY` for every
vertex). The one exception is `visited`, which starts as `FALSE`. Field
names are not case-sensitive: `e.inTree` and `e.intree` are the same field.

**Neighbour loops.** Write them as
`i = 0` / `WHILE i < DEGREE(v)` / … / `i = i + 1` / `END`. Avoid
`LOOP i FROM 0 TO DEGREE(v) - 1`: when `DEGREE` is 0 it counts *down*
from 0 to -1.

**Visualization.** Each field write, vertex-pointer move (`w = NEIGHBOR(v, i)`
lights up the edge it followed), call, return and graph edit is its own step
with a console line.

- Pointer variables are drawn as tags above their vertex, and fields as a
  label under it (`dist=4  parent=A`).
- `visited` vertices turn green.
- Vertices held by calls still waiting on the call stack are purple.
- `v.color = "GRAY"` (or `WHITE`, `BLACK`, `RED`, `BLUE`, …, or a number
  0, 1, 2, …) paints a vertex. A negative number leaves it unpainted.
- The edge between a vertex and its `parent`, and any edge with a field set
  to `TRUE` (`e.inTree = TRUE`), is drawn green, so a BFS tree, shortest-path
  tree or spanning tree appears while it is built.

**Run-time errors:**

- an unknown vertex name
- a `NEIGHBOR` / `VERTEX_AT` / `EDGE_AT` index out of range (the message
  gives the valid range)
- reading an unset field
- assigning `name` / `degree` / `from` / `to` / `weight`
- `WEIGHT` of a missing edge
- a NULL or non-vertex operand (`DEGREE(x): x is not a vertex`)
- adding an edge that already exists, or a self-loop

```aqvl
SCENE BFS
DECLARE
  GRAPH g = ["A-B", "A-C", "B-D", "C-D"]
  QUEUE q = []
SEQUENCE
  start = VERTEX(g, "A")
  start.visited = TRUE
  start.dist = 0
  ENQUEUE q start
  WHILE LENGTH(q) > 0
    v = DEQUEUE(q)
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF w.visited == FALSE
        w.visited = TRUE
        w.dist = v.dist + 1
        w.parent = v
        ENQUEUE q w
      END
      i = i + 1
    END
  END
  PRINT "D is" VERTEX(g, "D").dist "steps from A"
END
```

The Playground's **Graphs** examples cover these algorithms written in full:

- BFS, fewest-hops paths, and iterative and recursive DFS
- connected components
- cycle detection in undirected and directed graphs
- the bipartite check
- topological sort (Kahn's algorithm and DFS)
- Dijkstra and Bellman-Ford
- Prim and Kruskal (with union-find)
- listing all paths by backtracking
- greedy colouring

### One-line built-ins

The same algorithms are also available as single commands that run the
whole algorithm in one step (implemented in `GraphEngine.ts` /
`GraphAlgorithms.ts`):

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

### 8.2 Writing the algorithm yourself

Every Sorting example in the Playground (`packages/demo/src/examples/SortingLibrary.ts`)
is the real algorithm written with `LOOP`, `WHILE`, `IF` / `ELSE`, `COMPARE`,
`SWAP`, `UPDATE`, `INSERT` / `DELETE` on helper arrays, and recursive
`FUNCTION`s declared in `DECLARE` (quick sort, merge sort, heap sort's
`siftDown`). Nothing is hard-coded, so changing the array in `DECLARE` still
gives a correct run. Examples: bubble, selection, insertion, cocktail shaker,
quick, merge, heap, shell, counting, radix, cycle and pancake sort; exam rank
list (parallel arrays), game leaderboard, count inversions, quickselect median,
sorted check and stability.

Two things to know when writing sorts:

- `/` is real division (`7 / 2` is `3.5`). The middle of a range is
  `mid = (total - total % 2) / 2` with `total = low + high`.
- `LOOP i FROM a TO b` counts down when `b < a`. Use `WHILE` when a range can
  be empty.

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

Declared with `HEAP name = [n, ...]` or `HEAP name = []`. The values are
stored in the order given (the declaration does not reorder them). A heap is
an array read as a complete binary tree — index `i` has children `2 * i + 1`
and `2 * i + 2` and parent `(i - 1 - (i - 1) % 2) / 2` — and is drawn both as
that tree and as the array. Min-heap or max-heap is decided by the code you
write. Real heap code is handled by `HeapProgramEngine.ts`, which keeps the
tree and array views in sync; the layout is `HeapLayoutStrategy.ts`.

| Code | Description |
|---|---|
| `h[i]` | Current value at index `i`, usable in any expression. Out-of-range indices stop with an error. |
| `LENGTH(h)` | Current number of values. |
| `SWAP h[i] h[j]` | Exchange two values (the nodes keep their places). |
| `COMPARE h[i] h[j]` | Highlight a comparison and log its result. |
| `h[i] = value` / `UPDATE h[i] value` | Overwrite a value. |
| `INSERT h value` | Append a new last cell (the next free position of the tree). |
| `DELETE h[LENGTH(h) - 1]` | Remove the last cell. Deleting any other index is an error, because the tree must stay complete. |
| `HIGHLIGHT h[i] 'SUCCESS'` | Mark a cell in both views. |
| `PRINT h` | Print the array, e.g. `[10, 20, 15]`. |

```aqvl
SCENE MinHeapInsert
DECLARE
  HEAP h = []

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

SEQUENCE
  INSERT h 35
  siftUp(LENGTH(h) - 1)
  INSERT h 10
  siftUp(LENGTH(h) - 1)
  PRINT h
END
```

The Playground has 16 heap examples written this way (`HeapLibrary.ts`):
index map, min-heap check, insert, extract-min, max-heap, Floyd's bottom-up
build, recursive heapify, decrease-key, delete at any index, in-place heap
sort, and practical problems — emergency-room triage, top-k scores, k-th
smallest, connecting ropes, last stone weight and the running median with two
heaps.

The older one-line min-heap shortcuts still work, implemented in
`HeapEngine.ts` (`MinHeap` in `packages/runtime/src/data-structures/Heap.ts`):

| Operation | Syntax | Description | Complexity |
|---|---|---|---|
| Insert | `HEAP_INSERT heapName value` | Insert a value and sift up. | O(log n) |
| Extract min | `HEAP_EXTRACT heapName` | Remove the minimum (root), then sift down. | O(log n) |
| Decrease key | `HEAP_DECREASE heapName index newValue` | Decrease the value at `index` and sift up. | O(log n) |
| Build heap | `BUILD_HEAP heapName` | Build a heap from existing (unordered) contents. | O(n) |
| Heapify | `HEAPIFY heapName index` | Restore the heap property from a given node downward. | O(log n) per call |

---

## 10. HashMap

Declared with `HASH_MAP name [= {k1: v1, k2: v2}]` (a bare word in the literal is
text). A hash map is used from real code, run by `HashMapProgramEngine.ts`, with
a real separate-chaining `HashMap` in
`packages/runtime/src/data-structures/HashMap.ts`: 8 buckets to start, doubling
(with every key rehashed) when a new key would push the load factor above 0.75.
Integer keys hash as `key % capacity`; any other key as the sum of its
character codes `% capacity`. Keys keep their type (`7` and `"7"` differ).

| Code | Description | Complexity |
|---|---|---|
| `m[key] = value` | Insert a key, or overwrite its value (also `UPDATE m[key] value`). | O(1) average, O(n) worst case (collisions / resize) |
| `m[key]` | The key's value inside any expression; a missing key stops the program. | O(1) average, O(n) worst case |
| `CONTAINS(m, key)` | `TRUE` when the key is stored. | O(1) average, O(n) worst case |
| `DELETE m[key]` | Remove a key; a missing key stops the program. | O(1) average, O(n) worst case |
| `LENGTH(m)` | Number of keys. | O(1) |
| `KEY_AT(m, i)` | The i-th key (0 to `LENGTH(m) - 1`), bucket by bucket, each chain top to bottom. | O(n) |
| `BUCKET_OF(m, key)` / `CAPACITY(m)` | The bucket a key hashes to / the number of buckets. | O(1) |
| `HIGHLIGHT m[key] 'COLOR'` | Mark a key's entry. | O(1) |
| `PRINT m` | Print `{key: value, ...}` in bucket order. | O(n) |

Reads of `m[key]` / `CONTAINS` in an assignment, IF / WHILE condition, call
argument or RETURN animate the lookup (hash, bucket, chain walk); the right
side of `AND` / `OR` only when it is evaluated.

Text built-ins, usable anywhere: `TEXT_LENGTH(s)`, `CHAR_AT(s, i)` and
`CHAR_CODE(s, i)` (positions from 0; out of range stops the program).

```aqvl
SCENE WordCount
DECLARE
  HASH_MAP freq
  ARRAY words = ["the", "cat", "the"]
SEQUENCE
  LOOP i FROM 0 TO LENGTH(words) - 1
    IF CONTAINS(freq, words[i])
      freq[words[i]] = freq[words[i]] + 1
    ELSE
      freq[words[i]] = 1
    END
  END
  PRINT freq
END
```

The one-line built-ins run by `HashMapVisualizer.ts` still work:
`HASHMAP_INSERT name key value`, `HASHMAP_LOOKUP name key`,
`HASHMAP_DELETE name key`. A `HASH_MAP name = {...}` declaration compiles to
`HASHMAP_INIT` plus one `HASHMAP_INSERT` per entry.

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
