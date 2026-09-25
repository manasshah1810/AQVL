# AQVL True Spatial DSL Certification

**Date**: 2026-09-11

**2 data structures verified via automated acid tests.**

---

## What was tested

For each structure: confirmed absent from the codebase beforehand →
designed a representation from *existing* AQVL primitives only → written as
a real `.aqvl` program using `LAYOUT`/`CAMERA`/`POSITION` for a shape no
single built-in layout strategy produces alone → compiled and executed
through the real pipeline (compiler → VM), not a mock → verified
programmatically that zero renderer source changed.

| Structure | Example | Acid test | Tests |
|---|---|---|---|
| Skip List | [`examples/data-structures/skiplist.aqvl`](../../examples/data-structures/skiplist.aqvl) | [`tests/integration/skiplist-acid-test.test.ts`](../../tests/integration/skiplist-acid-test.test.ts) | 14/14 passing |
| Segment Tree | [`examples/data-structures/segmenttree.aqvl`](../../examples/data-structures/segmenttree.aqvl) | [`tests/integration/segmenttree-acid-test.test.ts`](../../tests/integration/segmenttree-acid-test.test.ts) | 14/14 passing |

Full detail, including every gap found and its exact file:line evidence, is
in [`acid-test-report.md`](./acid-test-report.md).

---

## Final verdict: conditional pass

**AQVL is a genuine spatial DSL for data structures** — for the spatial
half of that claim. Both acid tests confirm, independently and on two
structurally unrelated shapes (a multi-level linked structure and a binary
tree), that:

- Any structure expressible as nodes + directed/undirected edges can be
  laid out and camera-framed using only `NODE`, `LINK`,
  `LAYOUT ... AS CUSTOM()`, `POSITION`, and `CAMERA` — with **zero new
  renderer code**, verified programmatically (sha256, not "I didn't touch
  it") both times.
- `CUSTOM` + per-element `POSITION` is a real, general escape hatch, not a
  one-off hack: it handled Skip List's parallel per-level chains and
  Segment Tree's staggered-depth-but-shared-baseline leaves + non-uniform
  subtree widths — two different reasons to need it, both real, neither
  producible by `LINE`/`HIERARCHY`/`CIRCULAR`/`FORCE_DIRECTED`/`GRID` alone.
- `LINK` is shape-agnostic: the same statement expressed forward pointers,
  tower pointers, and tree parent/child edges with no special-casing.

**AQVL is not yet a DSL where the *algorithm itself* is real AQVL.** Both
acid tests independently hit the same wall: `FUNCTION`/`RETURN` recursion
is scalar-only and structurally cannot call `LINK`/`POSITION`/`HIGHLIGHT`
(confirmed directly from the parser's own doc-comment,
`parser/index.ts:199-205`), `DECLARE` is fully static with no
`SEQUENCE`-time node creation, and there is no runtime-variable indexing.
This is not a Skip-List- or Segment-Tree-specific shortfall — it's true
today for every existing AQVL structure (`BST`/`Heap`/`Trie` insert/delete
are opaque TypeScript runtime built-ins reached by a single keyword
statement, not user-authored AQVL, confirmed via `validator.ts:202`'s
`treeActions` list). Both demos are honest about this: their "algorithm"
is a real, VM-executed, hand-verified `FUNCTION` recursion that
independently re-derives the structure's shape (Skip List's deterministic
level scheme; Segment Tree's range-sum query with genuine O(1) early-exit
on full containment) — but the structure itself is pre-declared, not built
live from arbitrary caller input.

---

## Evidence

- Both acid tests pass, together and individually, with no regressions to
  the pre-existing suite: **48 test files / 588 tests pass**
  (`pnpm --filter @aqvl/tests test`).
- Both acid tests are permanent regression guards in
  `tests/integration/` — the same directory and `vitest` runner as every
  other integration test in the repo, run by the standard
  `pnpm --filter @aqvl/tests test` / root `npm test`.
- No renderer workaround: `packages/renderer/src/` is sha256-verified
  byte-identical to its pre-Skip-List-and-Segment-Tree snapshot
  (`tests/fixtures/renderer-snapshot.json`), checked by both acid tests.
- `pnpm -r build` succeeds for `compiler` and `runtime`. `renderer`'s
  `tsc` currently fails, but on pre-existing, untracked work-in-progress
  files (`GraphEngine.ts`, `Graph.ts`, `Trie.ts`, `UnionFind.ts`,
  `LayoutEngine.ts`, `formatter.ts`) that this task never touched — all
  `TS2802` "requires --downlevelIteration" errors, unrelated to Skip
  List/Segment Tree and out of scope for this certification to fix.

---

## What would close the remaining gap

Documented in full in `acid-test-report.md` §4/§6. In order of leverage:

1. A bridge from `SEQUENCE`/`LOOP`/`IF` into user `FUNCTION`s that can call
   back out to structural statements — the single change that would let
   *any* structure's algorithm move from "opaque TypeScript built-in" to
   "real AQVL."
2. Runtime-created `NODE`/`EDGE` objects during `SEQUENCE` execution, plus
   runtime-variable indexing — needed together for an `insert(key)` that
   works on arbitrary caller input rather than a pre-declared instance.
3. Smaller, independent fixes worth making regardless: the `GRAPH`
   vertex-addressing quoting bug (0%-covered, confirmed broken), wiring
   `DISCONNECT` for generic `NODE`-to-`NODE` edges, and adding
   integer/floor division.
