# Default Layout Tuning Log

Implements the size-aware defaults in
[`packages/compiler/src/codegen/defaultLayoutParams.ts`](../../packages/compiler/src/codegen/defaultLayoutParams.ts),
wired into `AQIRGenerator.generateDefaultLayout()`
(`packages/compiler/src/aqir/generator.ts`) — the backfill that runs for any
DECLAREd structure with no explicit `LAYOUT` statement
(docs/design/aqir-geometry-spec.md §4).

**Baseline**: [`existing-layout-audit.md`](existing-layout-audit.md) documents
the original hardcoded per-structure constants (the runtime `LayoutStrategy`
classes under `packages/runtime/src/core/layouts/`, now superseded for
default-layout purposes by the AQIR-level table this log covers).

**Size input**: `generateDefaultLayout` passes the structure's *initial*
element/entry count (`ArrayDeclNode.initialElements.length`,
`HashMapDeclNode.initialEntries.length`, etc.) — the only size information
available at compile time. Growth from `INSERT`/`PUSH`/etc. after DECLARE
isn't reflected, since the default is emitted once, at compile time, same as
before this change.

**Design constraint**: every formula returns the *exact* original constant
for count <= 9 ("small"). This was a deliberate choice, not an accident of
the math — `tests/unit/codegen-spatial.test.ts` and
`tests/integration/spatial-compilation.test.ts` assert exact default params
for small (2-3 element) example programs, and Phase 4.2's example gallery is
built almost entirely from small structures. Tuning defaults for large
structures must not silently change how every existing small example already
renders.

---

## LINE — Array, LinkedList, Stack, Queue, HashMap (bucket row)

| Structure | Original (small) | Medium (n=30) | Large (n=200) | Floor |
|---|---|---|---|---|
| Array | spacing 2.2 | 1.20 | 0.60 | 0.6 |
| LinkedList | spacing 2.5 | 1.37 | 0.90 | 0.9 |
| Stack | spacing 1.2 | 0.66 | 0.45 | 0.45 |
| Queue | spacing 1.5 | 0.82 | 0.50 | 0.5 |
| HashMap | spacing 2.2 | 1.20 | 0.60 | 0.6 |

**Size-scaling rule**: `spacing = max(floor, base * sqrt(9 / n))` for n > 9,
else exactly `base`. An inverse-sqrt falloff was chosen over linear falloff
because linear (`base / n`) collapses to the floor far too fast — at n=30 a
linear rule already forces Array below its floor, while `sqrt` keeps
30 elements visually distinct without needing the floor kick in until well
past 100. axis/origin are unchanged by count (a Stack's spacing shrinking
doesn't change that it's still a vertical column starting at y=-2).

**Rationale for the floor value chosen per structure**: LinkedList keeps the
highest floor (0.9) because — per `existing-layout-audit.md` §2 — its
spacing was already deliberately wider than Array's "for arrows" (the edge
between nodes needs room to render as a distinct segment, not overlap the
node meshes); that headroom requirement doesn't go away just because there
are many nodes. Stack's floor is lowest (0.45) since a vertical stack of many
elements is read by scrolling/panning the camera, not by scanning left-right
in one view, so tighter packing is more tolerable.

**Measured check**: ran the actual `LineLayout.compute()` (the runtime class
that consumes these params) against synthetic 3/30/200-element Arrays, old
flat params vs. new size-aware params, and measured the resulting X span:

| n | old span | new span | new spacing |
|---|---|---|---|
| 3 | 4.4 | 4.4 (identical) | 2.20 |
| 30 | 63.8 | 34.9 | 1.20 |
| 200 | 437.8 | 119.4 | 0.60 |

At the original flat 2.2 spacing, 200 elements span ~438 units — many
multiples past `CameraRig`'s zoom-out ceiling (Z clamped to 30,
`existing-layout-audit.md` §8), so most of the array would be offscreen no
matter the camera angle. The new large-tier spacing brings that down to
~120 units, roughly a 3.7x reduction. Small examples (n<=9) are confirmed
identical (4.4 == 4.4), since the formula returns the literal original
constant. (Script: `LineLayout` from
`packages/runtime/dist/runtime/src/layout/strategies/LineLayout.js` fed the
old vs. new params directly — not a rendered screenshot, but the same
position math the renderer consumes.)

---

## HIERARCHY — Tree, BinaryTree, BST, Heap, Trie

| | Original (small) | Medium (n=30) | Large (n=200) |
|---|---|---|---|
| levelGap | 2.0 | 2.52 | 3.2 (capped) |
| siblingGap | 1.5 | 0.82 | 0.6 (floor) |

**Size-scaling rule**: `count` (initial element count) stands in for both
breadth and depth, since neither is separately knowable at compile time (the
tree's actual shape isn't decided until `TreeLayoutStrategy`/`HierarchyLayout`
run against the real edges at execution time — see
`existing-layout-audit.md` §5's note that root-finding and tree shape are
runtime-inferred, not compile-time facts). A roughly-balanced tree of `n`
nodes has depth ~log2(n) and each level has up to ~n/depth siblings, so:
- `siblingGap` shrinks with the same inverse-sqrt falloff as LINE (more
  siblings per level => needs tighter horizontal packing to avoid the tree's
  width exploding), floored at 0.6 so leaves never visually merge.
- `levelGap` grows logarithmically (`base * (1 + 0.15 * log2(n/9))`, capped
  at 3.2) — more levels means more vertical room is needed to keep adjacent
  levels visually distinguishable when a highlighted comparison spans two
  levels, but growth is deliberately slow (log, not linear) since depth only
  grows log2(n), not n.

**Rationale for not modeling depth/breadth directly**: an earlier design
considered having `generateDefaultLayout` estimate `ceil(log2(n+1))` as an
explicit depth and picking sibling spacing from `n / depth`, but this
requires assuming a balanced/complete tree — wrong for Heap (always
complete, so accurate) but wrong for a BST built from arbitrary insert order
(can degenerate to a linked list, depth `n`) or a Trie (branching factor is
the alphabet size of inserted words, not 2). Since none of that shape
information exists before the structure is populated at runtime, a single
conservative `count`-based formula (not a depth-based one) was kept for all
five HIERARCHY-default structures, matching how they already share one
`TreeLayoutStrategy`/`HierarchyLayout` implementation today
(`existing-layout-audit.md` §5, "Reused wholesale for Heap-as-tree and
Trie").

**Measured check**: ran `HierarchyLayout.compute()` against a synthetic
complete binary tree (parent of node `i` is `floor((i-1)/2)`, the same shape
Heap always has and BST approximates when reasonably balanced) at 3/30/200
nodes, old vs. new params, measuring the resulting X width (widest level):

| n | old width | new width | new levelGap | new siblingGap |
|---|---|---|---|---|
| 3 | 1.5 | 1.5 (identical) | 2.00 | 1.50 |
| 30 | 21.0 | 11.5 | 2.52 | 0.82 |
| 200 | 148.5 | 59.4 | 3.20 | 0.60 |

A 200-node tree's widest level goes from ~149 units to ~59 (roughly 2.5x
narrower) while `levelGap` grows from 2.0 to 3.2, so per-level separation
along Y is preserved (arguably improved) even as siblings pack tighter along
X. Small examples (n=3) are confirmed identical. (Script: `HierarchyLayout`
from `packages/runtime/dist/runtime/src/layout/strategies/HierarchyLayout.js`.)

---

## FORCE_DIRECTED — Graph

| | Original (small) | Medium (n=30) | Large (n=200) |
|---|---|---|---|
| repulsion | 5.0 | 2.74 | 1.5 (floor) |
| springLength | 2.0 | 2.2 | 2.6 |
| iterations | 100 | 70 | 40 |
| attraction | *(was `springTension: 0.1`, unread)* | 0.1 | 0.1 |

**Correctness fix folded into this tuning pass**: the original
`DEFAULT_LAYOUTS.GRAPH` params (`existing-layout-audit.md` §6,
"Migration Checklist") included `springTension` and `gravity` keys that
`packages/runtime/src/layout/strategies/ForceDirectedLayout.ts` never reads —
its actual attraction-strength param is named `attraction` (default `0.1`,
identical value to the old, dead `springTension: 0.1`, so this is a rename
with no behavior change for existing small graphs, not a new visual
outcome). `gravity` has no reader at all in the current `ForceDirectedLayout`
(no center-pull term is implemented) and was dropped rather than carried
forward as another dead key. `tests/unit/codegen-spatial.test.ts`'s
"tuned physics constants" test was updated to assert `attraction` instead of
`springTension`/`gravity`.

**Size-scaling rule**:
- `repulsion` uses the same inverse-sqrt falloff as LINE/HIERARCHY, floored
  at 1.5. Every pairwise repulsion in `ForceDirectedLayout.compute` is
  O(n^2) — a fixed repulsion constant at large n means both a slower-to-settle
  simulation (large total repulsive force fighting itself across many more
  pairs) and, empirically, nodes flung far enough apart that `CameraRig`'s
  zoom-out saturates. Shrinking it keeps total displacement per iteration in
  a comparable range regardless of graph size.
- `iterations` steps down by tier (100 / 70 / 40) rather than a continuous
  formula — this is explicitly a **performance** knob
  (`existing-layout-audit.md` §6: "blocking, non-incremental... re-runs from
  scratch on every `updateLayout()` call"), and discrete tiers were judged
  clearer to reason about/tune than a continuous curve for a cost that's
  itself a step-like concern (a 200-node graph's O(n^2 * iterations) cost is
  already dominated by n^2; iterations is the one knob available to keep wall
  time bounded without touching the O(n^2) inner loop).
- `springLength` grows slightly by tier (2.0 / 2.2 / 2.6) — more nodes need
  more rest-length between connected pairs to avoid a visually dense cluster
  once repulsion has been turned down to keep the simulation fast.

**Measured check**: ran `ForceDirectedLayout.compute()` against a synthetic
ring graph (n vertices, each connected to the next) at 9/30/200 vertices, old
vs. new params, measuring the resulting X span and wall-clock compute time:

| n | old spanX | new spanX | new iterations | compute time (this machine) |
|---|---|---|---|---|
| 9 | 15.9 | 15.9 (identical) | 100 | 4ms |
| 30 | 51.9 | 40.2 | 70 | 10ms |
| 200 | 124.1 | 65.2 | 40 | 27ms |

At n=200 the new defaults produce roughly half the spread (124 -> 65 units)
*and* run in fewer iterations — confirming the repulsion floor isn't just
"weaker" but actually keeps the settled layout more compact, which is the
visual goal (a 200-node graph that spans less is easier for `CameraRig` to
frame without zooming out to the point every node is a speck). Small
examples (n=9) are confirmed identical. (Script: `ForceDirectedLayout` from
`packages/runtime/dist/runtime/src/layout/strategies/ForceDirectedLayout.js`;
timings are from a single local run and only meant to show iterations
dropping doesn't blow up, not as a formal benchmark.)

---

## CIRCULAR (no structure defaults to it today, see note)

Not wired into `computeDefaultLayoutParams`'s `STRATEGY_BY_KIND` table —
per `existing-layout-audit.md`/`spatial-syntax-spec.md` §4, no DECLARE kind
has ever defaulted to CIRCULAR; it's only reachable via an explicit
`LAYOUT x AS CIRCULAR(...)` statement. `getCircularParams(count)` is still
exported from `defaultLayoutParams.ts` as part of the shared size-aware
surface (the task's requested "size-aware defaults for each structure"
covers the full strategy set, not just the ones currently used as implicit
defaults), for future use if a structure kind is ever given a CIRCULAR
default, or by tooling that wants a sensible starting radius for an explicit
CIRCULAR layout instead of `CircularLayout.ts`'s flat runtime default of 3.

**Size-scaling rule**: `radius = max(3, arcSpacing * n / (2*pi))` with
`arcSpacing = 1.4` (chosen to match LINE structures' rough visual density) —
i.e. "how big a ring is needed for n elements to sit ~1.4 units apart along
its circumference," floored at 3 (matching `CircularLayout.ts`'s own
existing default so a 1-3 element ring is unchanged). radius grows
~linearly with n once past the floor (n≈14): 3 at n=3, 4.46 at n=20, 22.28
at n=100.

## GRID (no structure defaults to it today, see note)

Same status as CIRCULAR — not in `STRATEGY_BY_KIND`, exported for the shared
surface and any future/explicit use. `getGridDimensions(n)` mirrors
`GridLayout.ts`'s own no-rows/no-columns fallback (`columns =
ceil(sqrt(n))`, `rows = ceil(n/columns)`) so a caller can reason about the
shape without running a live layout pass; `getGridParams` adds a
`cellSpacing` that scales down with the same inverse-sqrt falloff as LINE
(base 1.8, floor 0.8) — a large grid needs tighter cells for the same reason
a large LINE structure needs tighter spacing (staying within a readable
overall span).

---

## Summary of changes vs. the original `DEFAULT_LAYOUTS` table

- Every LINE/HIERARCHY/FORCE_DIRECTED structure kind: spacing/gap params are
  now a function of initial element count instead of a flat constant; small
  (<=9) structures are unaffected (identical values, verified by the
  pre-existing exact-match tests in `codegen-spatial.test.ts`/
  `spatial-compilation.test.ts`).
- FORCE_DIRECTED (Graph): `springTension`/`gravity` (dead, unread params)
  replaced with `attraction` (the param `ForceDirectedLayout.ts` actually
  reads) — a correctness fix, not a tuning choice, surfaced while tuning this
  strategy's size-scaling.
- CIRCULAR/GRID: no structure's *default* strategy changed (still no kind
  defaults to either) — their size-aware param functions are additive, for
  the shared module surface and future/explicit use.
