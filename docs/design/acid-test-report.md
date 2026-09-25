# Acid test: Skip List and Segment Tree in AQVL, language + LAYOUT/CAMERA only

**Question**: can a Skip List — a structure whose shape (parallel per-level
chains, plus per-key "towers" spanning levels) doesn't match any single
built-in layout strategy — be built entirely from existing AQVL primitives,
with the algorithm itself authored as real AQVL (recursion/loops), and zero
new renderer code?

**Short answer**: the *spatial* half of the claim holds without
qualification — zero new renderer code, `LAYOUT`/`POSITION`/`CAMERA` compose
cleanly into a correct multi-level grid. The *algorithmic* half does not —
"insert/search/delete as real AQVL functions" turns out to be impossible in
the current language, for reasons that have nothing to do with Skip List
specifically. That is the more valuable finding here: no existing AQVL
structure (BST, Heap, Trie, ...) authors its algorithm in user-space AQVL
either — they're all opaque TypeScript runtime built-ins reached through a
single keyword statement. This test is the first attempt to hold a
structure to the "user writes the real algorithm" bar, and it reveals *why*
nothing does that today.

---

## 0. Absence verification

`grep -rniE 'skip.?list|segment.?tree'` across `packages/`, `tests/`,
`docs/`, and every `.aqvl` file in the repo (excluding `node_modules`/`dist`)
returned zero matches. Neither Skip List nor Segment Tree existed anywhere
in source, tests, docs, or examples before this change. Skip List was
chosen over Segment Tree per the brief — its multi-level shape has no
single-strategy match (`LINE`/`HIERARCHY`/`CIRCULAR`/`FORCE_DIRECTED`/`GRID`
each assume a single flat or tree-shaped collection).

---

## 1. Design: representation with existing primitives

`examples/data-structures/skiplist.aqvl` models a 10-key skip list
(keys 3, 6, 7, 9, 12, 17, 19, 21, 25, 26; levels 0–3) as:

- One standalone `NODE` per **(key, level) rung** — e.g. key 9 spans levels
  0–2, so it's three separate `NODE` declarations (`k9_0`, `k9_1`, `k9_2`),
  each holding the key as its value. 22 rungs total (18 key rungs + 4
  header-sentinel rungs `head0..head3`).
- **`LINK`** for both pointer kinds a real skip list has: horizontal
  forward pointers within a level (`LINK k9_0 TO k12_0`), and vertical
  tower pointers between a key's own rungs (`LINK k9_0 TO k9_1`). Both
  compile to the same well-tested `LINK_OBJECTS` AQIR instruction
  (`generator.ts:1118-1128`) — no new relationship kind needed.
- **`LAYOUT sl AS CUSTOM()`** + one **`POSITION <rung> AT (x=.., y=.., z=0)`**
  per rung for the 2D grid a skip list actually needs: x = key rank
  (column), y = level × gap (row). This is exactly the `CUSTOM` +
  per-element `POSITION` pattern already demonstrated for `ARRAY` in the
  spec's §8.12 example and exercised in `spatial-e2e.test.ts` — reused
  verbatim for a different shape.
- **`HIGHLIGHT`** in the exact order a real skip-list search visits nodes,
  and **`SET <node> STATE removed`** for delete.
- Two real `FUNCTION`s (`levelFor`/`isEven`) using genuine `RETURN`-based
  recursion to compute the deterministic level-per-key scheme
  (trailing-zero-count of insertion index — see §4 gap 6 for why not
  true randomization).

No new AST node, no new AQIR instruction, no new runtime type, no new
renderer component. A single `GRAPH sl` with no initializer exists purely
as a `parent:`/`LAYOUT` anchor (see §4 gap 5 for why it isn't the
initializer-populated `GRAPH` the spec's own graph examples use).

---

## 2. Ran through the real pipeline

`tests/integration/skiplist-acid-test.test.ts` compiles the actual file
(`compile(source)`) and runs it through the real VM
(`createVM(aqir.instructions, aqir.functionTable, {}, undefined, aqir.objects)`),
not a mock. **14/14 tests pass**; full existing suite (47 files / 574 tests)
still passes unchanged, confirming no regression.

| # | What it checks | Result |
|---|---|---|
| 1 | Compiles with no errors | ✅ |
| 2 | AQIR: exactly one `SET_LAYOUT_STRATEGY` (`CUSTOM`, target `sl`), immediately followed by `COMPUTE_LAYOUT` | ✅ |
| 3 | AQIR: 22 `SET_POSITION` instructions, one per rung, every axis a concrete literal | ✅ |
| 4 | AQIR: 29 `LINK_OBJECTS` (11 tower + 18 forward pointers), all directed | ✅ |
| 5 | Runtime: every rung resolves to its declared (key-rank, level) coordinate after `COMPUTE_LAYOUT`/`SET_POSITION` | ✅ |
| 6 | Runtime: same-key rungs share one x column (towers line up vertically) | ✅ |
| 7 | Runtime: `levelFor()`/`isEven()` — real `CALL`/`RET` recursion, more execution frames than source instructions (not unrolled) — reproduces the hand-derived level scheme | ✅ |
| 8 | Level-0 forward chain visits all 10 keys in sorted order | ✅ |
| 9 | Level 3 contains exactly one rung (key 21) | ✅ |
| 10 | `HIGHLIGHT` order matches the real top-down, drop-a-level search path for key 19 | ✅ |
| 11 | Delete marks the found node's state (`removed`) via `SET_STATE` | ✅ |
| 12 | `packages/renderer/src/` — all 13 files, sha256-verified byte-identical to a pre-change snapshot (`tests/fixtures/renderer-snapshot.json`), no files added/removed | ✅ |

---

## 3. What SUCCEEDED

- **Zero new renderer code**, verified programmatically (test #12 above),
  not just "I didn't touch it." `GenericSceneRenderer` consumes `NODE`s and
  `LINK`-created edges exactly as it already does for every other
  structure — a Skip List is invisible to the renderer as a *concept*; it's
  just nodes and edges with coordinates.
- **`LAYOUT`/`POSITION`/`CAMERA` genuinely compose** to express a shape none
  of the six built-in strategies produce alone. `CUSTOM` + per-element
  `POSITION` is expressive enough for an arbitrary 2D (or 3D) arrangement —
  this is a real, general escape hatch, not a Skip-List-specific hack.
- **`LINK` is shape-agnostic**: the same statement expresses both a
  same-level forward pointer and a cross-level tower pointer with no
  special-casing, because AQIR's edge model doesn't know or care what a
  "level" is.
- **Real recursion, real results**: `levelFor()` executes genuine `CALL`/
  `RET` frames at runtime (test #7) and its output matches, by hand
  verification, the level scheme the DECLARE section encodes — recursion
  is not decoration here, it independently re-derives the structure's shape.

---

## 4. What FAILED — precise, quoted gaps

### Gap 1 (the headline one): `FUNCTION`/recursion cannot touch structure

The task asked for insert/search/delete "as real AQVL functions (Phase 1-2
recursion/loops)." This is not achievable for **any** AQVL structure, Skip
List included. The parser's own doc-comment says why:

> `parser/index.ts:199-205`: "Statement dispatcher for function bodies
> (brace-delimited, general computation): RETURN, IF/ELSE, nested FUNCTION
> declarations, and plain expression statements (including function
> calls). This is separate from the animation SEQUENCE/LOOP/IF grammar
> above, which stays END-delimited for backward compatibility."

Concretely (`parser/index.ts:206-220`), a `FUNCTION` body's statement
dispatcher only accepts `RETURN`, `IF`/`ELSE`, nested `FUNCTION`, and
`ExpressionStatementNode` (arithmetic/scalar calls). It has no branch for
`LINK`, `POSITION`, `LAYOUT`, `HIGHLIGHT`, or `SET ... STATE` — those only
exist in the separate `SEQUENCE`/`LOOP`/`IF` (`END`-delimited) grammar
(`parser/index.ts:657-797`), which in turn has no way to *call* a
user-defined `FUNCTION` and perform structural work as a result. The two
statement families don't intersect: one can compute, the other can build,
and nothing bridges them.

This matches how every existing structure already works: `validator.ts:202`
lists `INSERT`/`DELETE`/`SEARCH`/... as `treeActions` whose "dynamically
created node IDs... aren't defined in the DECLARE block" — i.e. `BST
INSERT`, `HEAP_INSERT`, `TRIE_INSERT` are single opaque keyword statements
implemented by TypeScript engines in the runtime (`BSTEngine`,
`HeapEngine`, ...), not algorithms an AQVL author writes. The Skip List demo
is honest about this: its "insert" is the visible, real, executing act of
progressively `LINK`ing and `POSITION`ing pre-declared nodes on screen
(genuinely running through the VM, test-verified), not a live decision
procedure that decides *where* to splice a new key from scratch.

### Gap 2: `DECLARE` is fully static — no runtime node creation

There is no `SEQUENCE`-level construct to create a new `NODE`/`EDGE`
mid-animation; every object must be named and typed in the compile-time
`DECLARE` block (`parser/index.ts:103-157`). All 22 rungs had to be
pre-declared. Combined with Gap 1, this rules out a genuine "insert(key)"
that works for an arbitrary, caller-supplied key.

### Gap 3: no runtime-variable indexing

Independently confirmed by `recursion.test.ts`'s own docblock ("the grammar
only resolves `arr[i]` to a concrete object id for a *literal* index at
compile time") and by `generator.ts:1280-1284`, where a non-literal index
resolves to an unresolved symbolic placeholder
(`` `${expr.array.name}#${this.stringifyIndexExpr(indexExpr)}` ``) rather
than a usable id. Even setting Gaps 1–2 aside, a "walk the list comparing
keys" loop has no way to read an arbitrary element's value at a
runtime-computed position.

### Gap 4: `LAYOUT`/`POSITION`/`CAMERA` numeric args must be compile-time literals

`evaluateExpressionNumber` (`generator.ts:1315-1339`) is what turns a
`LAYOUT`/`POSITION` param expression into the number baked into AQIR. It
handles only `LiteralNode` and `BinaryOpNode` with operators `+ - > < =` —
no `*`, no `/`, and no `CallNode`. Concretely: `POSITION n AT (x=colX(4))`
does not compile. This was discovered directly — the original design called
a `FUNCTION` to compute each rung's grid coordinate from its column/level
index; it had to be replaced with hand-precomputed literals
(`x=-9.6, y=0`, etc.) once this limit was hit. The two `FUNCTION`s in the
final file are real and load-bearing (Gap 7), but their results can't feed
back into geometry.

### Gap 5: `GRAPH`'s per-vertex addressing syntax is broken (0%-covered, unexercised)

The spec's own `GRAPH`-based examples (§8.3/8.4) suggest declaring vertices
via a `GRAPH g = ["a", "b", "a-b"]` initializer and addressing one later via
`g["a"]`-style indexing. Tracing the actual compiled symbol keys shows this
path is broken:

- At `DECLARE` time, a graph vertex's lookup key is registered *with*
  embedded quote characters: `generator.ts:822`,
  `` this.symbolMap.set(`${graph.name.name}["${nodeName}"]`, nodeId) `` →
  e.g. `sl["a"]`.
- At use time (e.g. `POSITION sl["a"] AT (...)`), the same lookup is
  reconstructed *without* quotes: `generator.ts:1269`,
  `` const logicalName = `${expr.array.name}[${idx}]`; `` → `sl[a]`.

These two strings never match, so any attempt to `POSITION`/`HIGHLIGHT`/
`CAMERA FOCUS` an individual `GRAPH`-declared vertex by name silently fails
to resolve. This isn't a hypothetical: the exact `symbolMap.set` line at
`generator.ts:822` shows **0% statement coverage** in the committed coverage
report (`tests/coverage/compiler/src/aqir/generator.ts.html:3174`),
confirming no existing test exercises it. This is why the final design uses
standalone `NODE` declarations (bare-identifier addressing — the fully
tested, `TREE_NODE`-style path) instead of a `GRAPH`'s initializer-list
vertices, even though a `GRAPH` would have been the more natural container
for a set of connected key-rungs.

### Gap 6: no generic edge removal

`DISCONNECT` is a lexer keyword but has zero handling in the code
generator (no match anywhere in `generator.ts`) — it passes through as an
uninterpreted `GENERIC_ACTION` with no defined runtime behavior for a
plain `NODE`-to-`NODE` `LINK` edge. There is no way to actually sever a
forward pointer once `LINK`ed. The demo's delete step (`SET k19_0 STATE
removed`) marks the node rather than splicing it out of the chain — a
direct, load-bearing consequence of this gap, not a stylistic choice.

### Gap 7: no source of randomness

`RANDOM` (or equivalent) is not in the lexer's `KEYWORDS` set
(`lexer/index.ts:23-52`). The textbook Skip List algorithm assigns each
new key's level by repeated coin flips; AQVL has no way to express that.
The demo substitutes the well-known **deterministic** level-assignment
scheme (level = trailing-zero-count of insertion index — a real technique
used by deterministic skip list variants), which happens to be expressible
with real `FUNCTION` recursion (Gap 1's one genuine win) and is
independently verified at runtime (test #7).

---

## 5. Verdict

| Clause of the acceptance test | Verdict |
|---|---|
| Skip List (and Segment Tree) confirmed absent beforehand | ✅ Pass |
| Representation composed from existing primitives (no new base type) | ✅ Pass — `NODE` + `LINK`, zero new AST/AQIR/runtime types |
| `LAYOUT`/`CAMERA` used to arrange the multi-level structure | ✅ Pass — `CUSTOM` + `POSITION` grid, `CAMERA POSITION` |
| Compiles and runs through the full real pipeline | ✅ Pass — 14/14 tests, compiler → VM → resolved positions |
| Zero new renderer code | ✅ Pass — sha256-verified byte-identical, programmatically |
| Insert/search/delete implemented as real AQVL functions (recursion/loops driving structural mutation) | ❌ **Fail** — impossible in the current language, for the reasons in Gaps 1–3, 6 above; not achievable for *any* AQVL structure today, not a Skip-List-specific shortfall |

**"AQVL is a complete spatial DSL for data structures"** — supported for the
*spatial* half: any shape expressible as nodes + directed/undirected edges
can be laid out and camera-framed with existing primitives, no renderer
work required.

**"AQVL needs [specific feature] to be complete"** — for the *algorithmic*
half, three concrete, additive features would close the gap, in order of
leverage:

1. A bridge from the `SEQUENCE`/`LOOP`/`IF` grammar into user `FUNCTION`s
   that can call back out to `LINK`/`POSITION`/`HIGHLIGHT`/structural
   statements (Gap 1) — the single biggest unlock, since it would let
   *any* structure's algorithm move from "opaque TypeScript built-in" to
   "real AQVL," not just Skip List.
2. Runtime-created `NODE`/`EDGE` objects during `SEQUENCE` execution
   (Gap 2), plus runtime-variable indexing (Gap 3) — needed together for a
   genuine `insert(key)` that works on caller-supplied input rather than a
   pre-declared fixed instance.
3. Fixing the `GRAPH` vertex-addressing quoting bug (Gap 5) and wiring
   `DISCONNECT` (Gap 6) would matter less on their own, but both are small,
   isolated, currently-dead-code fixes worth making regardless of the
   larger gaps above.

---

## 6. Second confirmation: Segment Tree

Per the follow-up scoping decision, §1–5 above are read as: the
spatial/`LAYOUT`/`CAMERA`/zero-renderer-code clause is the pass/fail bar for
this test (it cleared cleanly), and Gaps 1–7 stand as documented, separate
findings rather than blockers to re-run against. This section repeats the
same acid test against a structurally different shape — a binary tree, not
a multi-level linked structure — to check the finding generalizes rather
than being an artifact of Skip List's particular geometry.

**File**: `examples/data-structures/segmenttree.aqvl` — a segment tree over
`[2, 5, 1, 4, 9, 3]` (11 nodes: 5 internal ranges + 6 leaves).

**Representation**: identical primitive set as Skip List — standalone
`NODE` per tree node, `LINK` for parent→child pointers, `LAYOUT st AS
CUSTOM()` + `POSITION` per node, `HIGHLIGHT`/`SET ... STATE` for the
animated walk. No new AST/AQIR/runtime type; no new renderer code.

**Why `CUSTOM` was still necessary** (not just reused out of habit): a
segment tree *is* a binary tree, so `HIERARCHY` was the obvious first
strategy to try — and it doesn't produce the conventional segment-tree
drawing, concretely:
- `HIERARCHY` places every node by its exact tree depth. This tree's
  leaves sit at *different* depths (leaf2/leaf5 at depth 3, the other four
  leaves at depth 4, because the array length isn't a power of two), so
  `HIERARCHY` would draw a visibly staggered bottom row. The convention —
  and what this file's `POSITION` statements do — is to force all leaves
  onto one shared baseline row representing the array underneath,
  regardless of depth. Verified at runtime (acid test #6 below): all 6
  leaves resolve to the same `y`.
- `HIERARCHY`'s `siblingGap` spaces siblings by a constant, independent of
  subtree size. This file's internal-node `x` is instead the true midpoint
  of its two children's `x` — so `seg_0_2` (whose left child `seg_0_1`
  roots a 2-leaf subtree, right child `leaf2` a 1-leaf subtree) sits pulled
  toward its wider child, not centered between the two subtrees' outer
  edges the way equal spacing would place it. Verified at runtime
  (acid test #7): every internal node's `x` equals its children's midpoint.

**Real recursion — and a *different* legitimate limitation surfaced**:
`query(l, r, ql, qr)` in the file is a genuine segment-tree range-sum query
— it early-exits to a precomputed `nodeSum(l, r)` on full containment
(the O(1)/O(log n) behavior that is the actual point of a segment tree,
not a leaf-by-leaf brute-force sum) and recurses on partial overlap.
Writing it surfaced a gap not visible in the Skip List demo: AQVL has **no
integer/floor division** — only float `/` — so a generic split point
`(l + r) / 2` does not match this tree's actual integer boundaries
(`(0 + 5) / 2 = 2.5`, not the tree's real split at `2`). The file works
around this with a small hardcoded `splitPoint(l, r)` dispatch over the
tree's 5 actual internal nodes, the same honest pattern as `nodeSum`/
`leafValue` — real recursion over a fixed, hand-verified instance, not a
generic algorithm over arbitrary input (the same root cause as Gaps 1–3:
no dynamic node creation, no runtime indexing, so nothing *forces* the
split points to be computed generically instead of looked up).

**Results** (`tests/integration/segmenttree-acid-test.test.ts`, 14/14
passing):

| # | What it checks | Result |
|---|---|---|
| 1 | Compiles with no errors | ✅ |
| 2 | AQIR: one `SET_LAYOUT_STRATEGY` (`CUSTOM`, target `st`) + matching `COMPUTE_LAYOUT` | ✅ |
| 3 | AQIR: 11 `SET_POSITION` (one per node), all axes concrete literals | ✅ |
| 4 | AQIR: `SET_CAMERA` (absolute `POSITION`) | ✅ |
| 5 | AQIR: 10 `LINK_OBJECTS` (n−1 edges for 11 nodes — a valid tree) | ✅ |
| 6 | Runtime: every node resolves to its declared coordinate; all 6 leaves share one baseline `y` despite differing tree depth | ✅ |
| 7 | Runtime: internal-node `x` equals the true midpoint of its children, not an equal sibling gap | ✅ |
| 8 | Runtime: `query()` — real `CALL`/`RET` recursion — returns the correct sum for 5 different ranges (`[0,5]`=24, `[0,2]`=8, `[3,5]`=16, `[1,4]`=19, `[4,4]`=9), and produces more execution frames than source AQIR instructions (not unrolled) | ✅ |
| 9 | Runtime proxy for early-exit: the animated `query(1,4)` walk's `HIGHLIGHT` sequence never visits `leaf3`/`leaf4` individually, because `seg_3_4=[3,4]` is fully contained and resolved via `nodeSum` in one step | ✅ |
| 10 | Structural: every internal node links to exactly its two real children | ✅ |
| 11 | Structural: `HIGHLIGHT` order matches `query()`'s real traversal path; excluded leaves (`leaf0`, `leaf5`) marked via `SET ... STATE`, not silently dropped | ✅ |
| 12 | Renderer: all 13 files under `packages/renderer/src/` sha256-verified byte-identical to the pre-change snapshot | ✅ |

**Conclusion**: the §5 verdict generalizes. Spatial composition
(`LAYOUT`/`POSITION`/`CAMERA`, zero renderer code) passes cleanly on a
second, structurally unrelated shape, for a second, independently
motivated reason to need `CUSTOM` (staggered-depth leaves + non-uniform
subtree widths, vs. Skip List's multi-level parallel chains). The
algorithmic-functions gap also generalizes, and surfaced one gap Skip List
didn't (no integer/floor division), reinforcing that Gaps 1–3 are the
binding constraint regardless of which structure is attempted — not
something specific to multi-level linked structures.

Full existing test suite (48 files / 588 tests, both acid tests included)
passes with no regressions. `pnpm -r build` across `compiler`/`runtime`
succeeds; `renderer`'s `tsc` currently fails on pre-existing, untracked
work-in-progress files this task never touched (`GraphEngine.ts`,
`Graph.ts`, `Trie.ts`, `UnionFind.ts`, `LayoutEngine.ts`,
`formatter.ts` — all TS2802 "iteration requires --downlevelIteration"
errors from the runtime/shared packages, unrelated to Skip List/Segment
Tree and out of this task's scope to fix).
