# AQVL Runtime — Performance Reference

This document covers the time/space complexity of every data structure and
algorithm implemented in the AQVL **runtime engines**
(`packages/runtime/src/core/algorithms/*` and
`packages/runtime/src/data-structures/*`) — the plain TypeScript classes that
back AQVL's visual execution, independent of the compiler pipeline. It also
records baseline benchmark numbers captured by
`tests/benchmarks/performance.test.ts`, guidance on which structure/algorithm
to reach for, and general optimization notes.

> Scope note: this document is about the runtime engines directly (`SortAlgorithm`,
> `GraphAlgorithm`, `MinHeap`, `BSTEngine`, `AVLTree`, `RedBlackTree`, `HashMap`,
> `Trie`, ...), not about compiling and running `.aqvl` source through the full
> compiler → AQIR → VM pipeline.

## Table of contents

- [Complexity reference](#complexity-reference)
- [Benchmark results](#benchmark-results)
- [When to use which structure/algorithm](#when-to-use-which-structurealgorithm)
- [Optimization tips](#optimization-tips)

## Complexity reference

All complexities below are for the actual implementations in this repo, not
idealized textbook variants — see the "Notes" column for implementation
specifics (e.g. AQVL's BST engine is scene-backed and its Kruskal builds a
forest, not just a tree).

### Trees

| Structure | Insert | Search | Delete | Space | Notes |
|---|---|---|---|---|---|
| BST (`BSTEngine`) | O(h) | O(h) | O(h) | O(n) | h = O(log n) average, O(n) worst case (degenerates on sorted input — no self-balancing). `computeHeight`/`computeSize`/traversals are O(n). |
| AVL Tree (`AVLTree`) | O(log n) | O(log n) | O(log n) | O(n) | Self-balancing: rebalances via LL/RR/LR/RL rotations after every insert/delete so height stays O(log n) guaranteed, not just average. `isBalanced()` is O(n). |
| Red-Black Tree (`RedBlackTree`) | O(log n) | O(log n) | O(log n) | O(n) | Self-balancing via recoloring + rotations (looser balance than AVL — height ≤ 2·log₂(n+1) — so more inserts skip a rotation, at the cost of a slightly taller tree). `isValid()`/`blackHeight()` are O(n). |

### Heap (`MinHeap`, used by `HeapEngine`, Dijkstra, A*, Prim)

| Operation | Time | Space | Notes |
|---|---|---|---|
| Insert | O(log n) | O(n) | Sift-up after appending to the end of the array. |
| Extract-min | O(log n) | O(n) | Swap root with last element, then sift-down (`heapifyDown`). |
| Peek min | O(1) | — | Root of the array-backed heap. |
| `buildHeap` | O(n) | O(n) | Bottom-up heapify, not n inserts — the classic O(n) build, not O(n log n). |
| `decreaseKey` | O(log n) | — | Used by Dijkstra/A*/Prim via `updatePriority`. |

### Hash Map (`HashMap`)

| Operation | Average | Worst case | Notes |
|---|---|---|---|
| `set` / `get` / `has` / `delete` | O(1) | O(n) | Separate chaining (array-of-arrays buckets); worst case is all keys colliding into one bucket. The hash function is a simple char-code sum mod capacity — intentionally simple/teaching-oriented, not collision-resistant. |
| `resize` | O(n) | O(n) | Doubles capacity and rehashes every entry; triggered automatically once `(size+1)/capacity` exceeds `loadFactor` (default 0.75). Amortized O(1) per insert across a sequence of inserts, same argument as dynamic-array doubling. |

### Trie

| Operation | Time | Space | Notes |
|---|---|---|---|
| Insert / search / prefix search | O(L) | O(total characters stored) | L = length of the word/prefix. Independent of how many words are already stored — this is the Trie's key advantage over a hash map for prefix workloads. |

### Graph algorithms (`GraphAlgorithm`, backed by `Graph`'s adjacency list)

| Algorithm | Time | Space | Notes |
|---|---|---|---|
| DFS (`depthFirstSearch`) | O(V + E) | O(V) | Iterative, explicit stack — no recursion depth limit. |
| BFS (`breadthFirstSearch`) | O(V + E) | O(V) | Iterative, explicit queue; marks visited at enqueue time. |
| Dijkstra | O((V + E) log V) | O(V) | Binary min-heap (`MinHeap`) frontier. Assumes non-negative weights (unweighted edges default to weight 1). |
| Bellman-Ford | O(V · E) | O(V) | Relaxes every edge V−1 times, then one more pass to detect a negative-weight cycle. Handles negative weights, unlike Dijkstra. |
| A* (`aStar`) | O((V + E) log V) worst case | O(V) | Same shape as Dijkstra restricted by a heuristic; with an admissible heuristic it typically expands far fewer than V vertices in practice, though worst-case bound is unchanged. |
| Prim (`prim`) | O((V + E) log V) | O(V) | Binary-heap frontier, same shape as this repo's Dijkstra. Grows one tree from a start vertex; only reaches that vertex's connected component. |
| Kruskal (`kruskal`) | O(E log E) | O(V + E) | Dominated by the edge sort; union-find (`UnionFind`) operations are near-O(1) amortized. Builds a minimum spanning **forest** across the whole graph (unlike `prim`, which is scoped to one component). |
| Topological sort (`topologicalSort`) | O(V + E) | O(V) | Iterative DFS with white/gray/black coloring; detects cycles (a gray-to-gray edge) instead of assuming a DAG. |

### Sorting (`SortAlgorithm`)

| Algorithm | Best | Average | Worst | Space | Stable? | Notes |
|---|---|---|---|---|---|---|
| Bubble sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Early-exits once a full pass makes no swaps. |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | No | Always does ~n²/2 comparisons regardless of input order; minimal swaps (≤ n). |
| Insertion sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Swap-based (gnome-sort style) shifting; fast on nearly-sorted input. |
| Merge sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes | True recursion (`mergeSortRecurse` calls itself); guaranteed O(n log n) regardless of input order, at the cost of O(n) auxiliary space for the merge buffers. |
| Quick sort | O(n log n) | O(n log n) | O(n²) | O(log n) avg (call stack) | No | True recursion; Lomuto partition with last-element pivot, so already-sorted (or reverse-sorted) input triggers the O(n²) worst case. |

## Benchmark results

Captured from an actual run of `tests/benchmarks/performance.test.ts` via
`pnpm --filter @aqvl/tests test -- benchmarks` (Windows 11, Node/vitest 2.1.9,
single run, no warm-up). **These numbers are illustrative of relative
behavior, not a formal performance guarantee** — they'll vary by machine,
JIT warm-up state, and system load. The point of the test file is to catch
gross regressions over time, not to certify these exact figures.

| Benchmark | Input size | Measured time | Notes |
|---|---|---|---|
| `bubbleSort` | 1000 random ints | **120.30 ms** | 498,174 comparisons, 244,577 swaps |
| `mergeSort` | 1000 random ints | **2.29 ms** | 8,736 comparisons |
| `quickSort` | 1000 random ints | **2.59 ms** | 11,572 comparisons |
| DFS | 100 vertices (ring + random chords) | **0.32 ms** | all 100 vertices visited |
| BFS | 100 vertices (ring + random chords) | **0.37 ms** | all 100 vertices visited |
| Dijkstra | 500 vertices, ~1500 weighted edges | **4.19 ms** | all vertices reachable |
| AVL insert | 1000 random values | **3.60 ms** | resulting height = 12, stayed balanced |
| Red-Black insert | 1000 random values | **2.51 ms** | resulting black-height = 7, all invariants held |
| HashMap insert | 10,000 key-value pairs | **40.83 ms** | grew to capacity 16,384, load factor 0.61 |
| HashMap lookup | 10,000 keys | **29.45 ms** | all 10,000 found |

The bubble sort vs. merge/quick sort gap (~50x on just 1000 elements) is the
clearest real-world illustration of O(n²) vs. O(n log n) in this suite —
it will widen sharply as n grows.

## When to use which structure/algorithm

**Plain BST vs. AVL/Red-Black.** Use a plain `BSTEngine` tree only when input
is close to random and you don't control the insertion order — its O(h)
operations degrade to O(n) on sorted/adversarial input, because nothing
rebalances it. Reach for `AVLTree` or `RedBlackTree` whenever insertion order
isn't guaranteed random (user input, streaming data, sorted imports) since
both guarantee O(log n). Between the two: prefer **AVL** when searches
dominate over inserts/deletes (tighter balance → shorter average path);
prefer **Red-Black** when inserts/deletes dominate (fewer rotations per
mutation, at the cost of a slightly taller tree).

**HashMap vs. Trie.** Use `HashMap` for exact-key lookups — O(1) average
regardless of key shape. Use `Trie` specifically when the workload is
prefix-oriented (autocomplete, "all words starting with…", spell-check
dictionaries) — a hash map can't do a prefix query without scanning every
key, while a Trie walks it in O(L).

**Dijkstra vs. Bellman-Ford.** Use `dijkstra` whenever edge weights are
non-negative — it's asymptotically faster (O((V+E) log V) vs. O(V·E)). Use
`bellmanFord` only when negative edge weights are possible, since it's the
only one of the two that stays correct with them (and can additionally
detect a negative-weight cycle, which Dijkstra can't).

**Prim vs. Kruskal (MST).** Use `prim` on dense graphs (E close to V²) since
its cost is driven by V with a heap-based frontier; it also naturally scopes
to one connected component if you don't need a full spanning forest. Use
`kruskal` on sparse graphs, or when you specifically want a minimum spanning
**forest** across a disconnected graph — `prim` only reaches the component of
its start vertex.

**A\* vs. Dijkstra.** Use `aStar` whenever there's a single known goal vertex
and a reasonable admissible heuristic (e.g. Euclidean/grid distance) — it
typically expands far fewer vertices than Dijkstra in practice. Falls back to
plain Dijkstra behavior (restricted to the goal) if no heuristic is passed.

**Sorting: merge sort vs. quick sort vs. simple O(n²) sorts.** Use
`mergeSort` when a worst-case guarantee or stability matters (e.g. sorting
records where equal-key relative order must be preserved) — it's always
O(n log n), at the cost of O(n) extra space. Use `quickSort` when average-case
speed and low memory overhead matter more than worst-case guarantees or
stability — it's typically faster in practice than merge sort due to better
cache locality and no allocation, but degrades to O(n²) on already-sorted
input with this implementation's last-element-pivot scheme. Reach for
`bubbleSort`/`selectionSort`/`insertionSort` only for teaching/visualization
purposes (this repo's actual use case) or genuinely tiny/near-sorted inputs —
`insertionSort` in particular is close to O(n) on nearly-sorted data.

## Optimization tips

- **Balanced trees over plain BST for adversarial/untrusted input order.**
  If insertion order can be influenced by a user or arrives pre-sorted (e.g.
  importing an already-sorted list), a plain BST silently becomes a linked
  list — O(n) per operation. `AVLTree`/`RedBlackTree` cost a constant-factor
  overhead per insert (rotations/recolors) in exchange for an O(log n)
  guarantee that holds no matter the input order.

- **Amortized analysis of `HashMap.resize()`.** Each individual `resize()`
  call is O(n) (it rehashes every existing entry), but because capacity
  doubles each time, the total rehashing work across n inserts sums to
  O(n) — the same amortized-O(1)-per-insert argument as a dynamic array's
  doubling growth. Pre-sizing a `HashMap` (passing a larger initial
  `capacity`) is worth doing when the final size is known in advance, since
  it avoids the rehash passes entirely.

- **Array-based structures beat linked ones for cache locality.** `MinHeap`'s
  array representation (implicit `2i+1`/`2i+2` children) and `SortAlgorithm`'s
  in-place array sorts benefit from contiguous memory layout — sequential
  scans and sibling/parent lookups hit cache far more often than pointer-chasing
  through separately-allocated tree nodes would. This is part of why the heap
  operations and quicksort/mergesort measure in low single-digit milliseconds
  even at n=1000–10,000 in the benchmark table above.

- **Kruskal's cost is dominated by the sort, not the union-find.** With a
  near-O(1) amortized `UnionFind` (path compression + union by rank/size),
  the O(E log E) edge sort is the real bottleneck — if edges are already
  sorted or can be maintained sorted incrementally, Kruskal's real-world cost
  drops close to O(E · α(V)).

- **Dijkstra/Prim/A\* all lean on the same `MinHeap` + `updatePriority`
  pattern.** Because `MinHeap.contains`/`updatePriority` are used instead of
  pushing duplicate entries and filtering stale ones later, the heap never
  grows past O(V) entries — avoid reverting to a "push duplicates, skip stale
  pops" approach, which trades a larger heap (and more log-factor work) for
  simpler code.

- **Early-exit conditions matter more than the asymptotic class on small
  inputs.** `bubbleSort`'s swapped-flag early exit and A*'s goal-popped early
  return both mean these algorithms frequently do far less work than their
  worst-case bound in the common case — don't assume the complexity table
  above predicts wall-clock time on typical (non-adversarial) inputs; the
  benchmark table is the better predictor for realistic workloads.
