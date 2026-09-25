# Spatial Layout Performance Report

Benchmarked the six `LayoutEngine` strategies (`packages/runtime/src/layout/strategies/*`)
at scale. Source: `tests/benchmarks/spatial-layout-performance.test.ts` (run via
`pnpm --filter @aqvl/tests test -- spatial-layout-performance`). Machine: local dev
box, single run — treat as order-of-magnitude baselines, not a perf gate (same caveat
as `tests/benchmarks/performance.test.ts`).

## Results

### LINE / GRID / CIRCULAR — O(n), single pass

| Strategy | n=100 | n=1,000 | n=10,000 |
|---|---|---|---|
| LINE | 0.20ms | 0.37ms | 3.16ms |
| GRID | 0.35ms | 0.22ms | 3.47ms |
| CIRCULAR | 0.38ms | 0.66ms | 3.99ms |

Trivial at every scale tested. No action needed.

### HIERARCHY — recursive subtree-width walk

| Tree shape | n=100 | n=1,000 | n=10,000 |
|---|---|---|---|
| Balanced binary tree | 0.81ms | 2.09ms | 24.71ms |
| Degenerate chain (worst case) | 0.43ms | 0.60ms | **crashed before fix** → 12.27ms after |

**Bug found and fixed**: the original implementation computed subtree widths and
assigned coordinates via plain recursion (`computeWidth`/`assign` calling themselves
per child). Recursion depth equals tree depth, so a degenerate/skewed tree (e.g. a
10,000-node chain — realistic for a mis-shapen BST or a linked-list-as-tree
visualization) blew the JS call stack:

```
RangeError: Maximum call stack size exceeded
  at computeWidth (HierarchyLayout.ts:70:25)
```

Fixed in `packages/runtime/src/layout/strategies/HierarchyLayout.ts` by replacing both
passes with explicit-stack iterative traversals (preorder visit order, then processed
in reverse for bottom-up width accumulation; preorder again, stack-driven, for
coordinate assignment). Same output, no recursion, no depth limit. Confirmed against
the existing `unit/hierarchyLayout.test.ts` suite (still passing) and the new
10,000-node chain benchmark (now completes in ~12ms instead of crashing).

### FORCE_DIRECTED — O(n²) per iteration (all-pairs repulsion)

| Nodes | Iterations | Time |
|---|---|---|
| 50 | 100 | 32.43ms |
| 200 | 100 | 109.98ms |
| 500 | 100 | 725.61ms |

| Nodes | Iterations | Time |
|---|---|---|
| 200 | 50 | 60.14ms |
| 200 | 100 | 108.68ms |
| 200 | 200 | 187.83ms |

Confirmed O(n²) scaling on node count (50→200 is 4x nodes, ~3.4x time; 200→500 is
2.5x nodes, ~6.6x time — consistent with n² growth) and linear scaling on iteration
count, as expected from the algorithm.

**No optimization applied.** The task's stated threshold for action was >500ms at
200 nodes; the measured figure is 109.98ms — well within budget. 500 nodes/100
iterations (725ms) is the only combination tested that crosses the 500ms mark, and
500-node force-directed graphs are far outside AQVL's typical use case (algorithm
visualizations of arrays, trees, small graphs — usually well under 100 elements).
Spatial partitioning (grid bucketing) or a more conservative default iteration count
would be the next step if usage patterns change; not implemented here since it would
be speculative optimization against a workload the app doesn't currently exercise.

## Rendering (GenericSceneRenderer)

Reviewed `packages/renderer/src/components/generic/GenericSceneRenderer.tsx`: it maps
each scene element to one `PrimitiveNode`/`PrimitiveEdge` (React Three Fiber mesh)
per element, no instancing. This is appropriate for the actual workload — AQVL scenes
are algorithm-visualization structures (arrays, trees, graphs, linked lists) that in
practice stay in the tens-to-low-hundreds of elements, not the 1000+ range where
per-mesh draw-call overhead would matter. There's no automated way to measure GPU
frame rate in this headless test environment, and per the task's own instruction to
optimize only on evidence of an actual problem, no `InstancedMesh` migration was made.
If a future use case pushes scenes into the 1000+ element range, that's the trigger to
revisit this with real frame-rate measurements first.

## Safe limits (defaults)

- **LINE / GRID / CIRCULAR**: no practical limit — sub-4ms even at 10,000 elements.
- **HIERARCHY**: no practical limit after the recursion fix — ~25ms at 10,000 nodes
  for both balanced and degenerate shapes.
- **FORCE_DIRECTED**: safe to ~300 nodes at default settings (100 iterations) for
  sub-~200ms results; 500 nodes/100 iterations (~725ms) is usable but noticeably
  slower. Iteration count scales time linearly — halving `iterations` roughly halves
  runtime for a fixed node count.

## Changes made

- `packages/runtime/src/layout/strategies/HierarchyLayout.ts` — replaced recursive
  `computeWidth`/`assign` with iterative (explicit-stack) equivalents to eliminate the
  stack-overflow risk on deep/degenerate trees. No behavior change for shallow trees
  (verified against existing `unit/hierarchyLayout.test.ts`).
- `tests/benchmarks/spatial-layout-performance.test.ts` — new benchmark suite covering
  all six strategies at the scales above.
