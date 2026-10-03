# Phase 2.2 — engine migration verification

Every structure is now on the two-layer engine pattern
(`docs/design/algorithm-engine-pattern.md`, status table at the top), and
`AnimationController.ts` keeps only routing and lifecycle glue (4408 lines
before the phase, 894 after). This is a refactor: the checks below compare
the work against the pre-refactor code and show no behaviour change.

## What changed

- Array, Stack, Queue, Linked list: pure structures plus engines (commit fbf0390).
- TREE_NODE trees: the last inline tree code moved to `BinaryTreeEngine` (b7179b5).
- Step-array naming: `GraphAlgorithm`'s results use `steps`, not `animationFrames`.
- Pure/handler file split: the pure layers of BST, Graph and Sort now live in
  `data-structures/` (`BST.ts`, `GraphAlgorithm.ts`, `SortAlgorithm.ts`). The
  handlers are `BSTEngine`, `GraphEngine` and `SortEngine`, one file and one
  class each.
- Step-recording layer: `HashMap` and `Trie` record `steps`, and
  `HashMapEngine` / `TrieEngine` replay them. `HashMapProgramEngine` replays
  the same steps for maps driven by real code. `BinarySearchTree` is new: the
  old `BSTEngine` read the scene directly, so BST had no pure layer at all.
- Every step union has a table that maps each step type to an AQIR
  primitive. The tests check every table against the 2.1 vocabulary.
- Out of AnimationController:
  - the heap statement handler, now `HeapProgramEngine.executeStatement`;
  - queue/stack container statements and tree built-in errors, now `TreeEngine.dispatch` and `containerRead`;
  - BST detection and routing, now `BSTEngine.detectActiveTree` and `isBSTTarget`;
  - `buildGraphFromScene`, now `GraphEngine.buildGraphFromScene`;
  - hash-map and trie read detection, now the program engines' `readStep`.
- Registration: every engine declares `static ALGORITHMS`, and the registry
  maps each listed statement to that engine.

## Verification

| Check | Result |
|---|---|
| `scripts/aqir-trace.ts`: 232 corpus programs plus 6 new samples in `scripts/samples/engines/` (the sort, graph, heap, hash-map and trie built-ins and a compiled BST, which the corpus barely exercises). Compared against a baseline recorded from 47994bf, the commit before the phase's first refactor. | Identical for all 238 programs on every channel: instruction stream, timeline frames, events and animation keyframes. |
| BST built-ins (BST_INSERT / DELETE / SEARCH / CLEAR, ROTATE, and INORDER, MIN, ... routed to a BST). The compiler never emits these, so they were driven as hand-written AQIR through `AnimationController.executeInstruction`, on 47994bf and on the new code (53 instructions covering every case: duplicates, the three delete cases, rotations and their errors, an empty tree). | Byte-identical keyframes, events, frames and scene after every instruction. |
| `pnpm test` | 82 files, 1700 passed, 2 todo, 0 failed. New tests: `unit/bstEngine`, `unit/hashMapEngine`, `unit/trieEngine` and `unit/algorithmRegistry`, plus primitive-table checks in `unit/sortEngine` and `unit/graphEngine`. |
| `scripts/audit-examples.ts` (the Phase 1.2 corpus audit) | 229 / 229 pass. The 218 examples from the 2.1 re-audit have the same status; the 11 new rows are the Layout & Camera examples added since, and all pass. |
| `tsc --noEmit` (runtime) | Clean. |

The BST benchmark in `benchmarks/performance.test.ts` (1000 inserts plus
1000 searches) still passes: about 105 ms and 155 ms. `BinarySearchTree.fromLinks`
builds a node's children when they are first read, so a walk from the root
costs its depth, not the size of the tree.
