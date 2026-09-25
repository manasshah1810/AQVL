# AQVL Spatial Syntax Specification

Design of explicit `LAYOUT`, `CAMERA`, and `POSITION` syntax for AQVL, replacing the implicit, hardcoded layout/camera behavior documented in [`existing-layout-audit.md`](./existing-layout-audit.md) with first-class, author-controllable language constructs — without changing the render of any existing `.aqvl` program that doesn't use them.

This is a **spec only**. No compiler/runtime code is implemented here; §7 lists the minimal grammar additions an implementation would need.

---

## 0. Design principles

1. **Additive, not replacing.** Every structure already gets a default layout today (via `LayoutManager`'s type-inference heuristics — audit §7) and a default camera behavior (via `CameraRig` — audit §8). `LAYOUT`/`CAMERA`/`POSITION` statements *override* those defaults; omitting them must reproduce today's output exactly (see §6).
2. **Reuse existing grammar primitives, don't invent new ones.** AQVL already has a general-purpose call syntax (`identifier(args, ...)` → `CallNode`), an assignment-as-expression production (`ident = expr` → `BinaryOpNode`, right-associative, lowest precedence — `parser/index.ts:865-873`), and array indexing (`ident[expr]` → `ArrayAccessNode` — `parser/index.ts:937-947`). The syntax below is built entirely out of these, so `AS LINE(spacing=1.5, axis=horizontal)` parses as an ordinary call whose arguments happen to be assignment-expressions — no new expression grammar needed, only new statement-level keywords.
3. **Statements, not blocks.** Every existing spatial/temporal action in AQVL (`INSERT`, `LINK ... TO ...`, `HIGHLIGHT`, `WAIT`, ...) is a single statement inside `SEQUENCE` (or a `LOOP`/`IF` body), executed in program order. `LAYOUT`, `CAMERA`, and `POSITION` follow the same shape: they are ordinary `SEQUENCE` statements, so a layout can be declared once up front, or changed mid-animation (e.g. switch a graph from `FORCE_DIRECTED` to `CIRCULAR` right before highlighting a cycle), exactly like any other action.
4. **One new statement family, minimal new keywords.** Enum-like argument *values* (`horizontal`, `vertical`) are plain identifiers, validated during semantic analysis — the same pattern AQVL already uses for `SET x STATE active` (state names are identifiers, not keywords). This keeps the new-keyword surface small (§7).

---

## 1. `LAYOUT` statement

Declares (or changes) the spatial arrangement strategy for a named structure.

### Syntax

```
LAYOUT <target> AS <STRATEGY>( <namedArg>, <namedArg>, ... )
```

- `<target>` — an identifier naming a `DECLARE`d structure (`ARRAY`, `LINKEDLIST`, `STACK`, `QUEUE`, `TREE`/`BST`/`BINARY_TREE`, `HEAP`, `TRIE`, `GRAPH`, `HASH_MAP`).
- `<STRATEGY>` — one of `LINE`, `HIERARCHY`, `CIRCULAR`, `FORCE_DIRECTED`, `GRID`, `CUSTOM`.
- `<namedArg>` — `identifier = expression`, comma-separated, all optional (unset args keep the strategy's built-in default — see §4).

### The six strategies

| Strategy | Maps to (audit reference) | Purpose |
|---|---|---|
| `LINE` | `ArrayLayoutStrategy`, `LinkedListLayoutStrategy`, `StackLayoutStrategy`, `QueueLayoutStrategy` (audit §1-4) — these are all the *same shape* (evenly-spaced points along one axis) with different constants | Evenly-spaced row or column |
| `HIERARCHY` | `TreeLayoutStrategy` (audit §5) | Depth-leveled tree/DAG layout |
| `CIRCULAR` | *New* — no current equivalent; closest existing precedent is `GraphLayoutStrategy`'s circular initial seeding (audit §6, `GraphLayoutStrategy.ts:38`), promoted here to a real strategy | Evenly-spaced points around a circle |
| `FORCE_DIRECTED` | `GraphLayoutStrategy` (audit §6) | Physics-simulated node placement |
| `GRID` | `GridLayoutStrategy` (audit, referenced in §7 LayoutManager table) | Row/column matrix placement |
| `CUSTOM` | *New* — escape hatch | Disables automatic layout; every element's position must come from `POSITION` statements |

#### `LINE(spacing=, axis=, origin=)`

```
LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `spacing` | number | strategy-dependent, see §4 | Distance between consecutive elements |
| `axis` | `horizontal \| vertical` | `horizontal` | `vertical` reproduces `Stack`'s bottom-up column (`StackLayoutStrategy` — audit §3); `horizontal` reproduces `Array`/`Queue`/`LinkedList` (audit §1,2,4) |
| `origin` | `(x, y, z)` tuple expression | `(0, 0, 0)` | Center point the row/column is built around |

Order along the line follows the existing per-structure ordering rule — `logicalIndex`/`layoutSlot` for `ARRAY`/`STACK`/`QUEUE`, HEAD-traversal order for `LINKEDLIST` (audit §2) — `LAYOUT` does not change *ordering* semantics, only *spacing/axis/origin*.

#### `HIERARCHY(levelGap=, siblingGap=, origin=)`

```
LAYOUT tree AS HIERARCHY(levelGap=2, siblingGap=1)
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `levelGap` | number | `2.0` | Vertical distance between parent/child depths (was `levelSpacing`, audit §5) |
| `siblingGap` | number | `1.5` | Minimum horizontal distance between sibling subtrees (was `siblingSpacing`, audit §5) |
| `origin` | `(x, y, z)` | `(0, 2, 0)` | Root placement; the ground-clip guard (audit §5, `TreeLayoutStrategy.ts:83`) still applies beneath this |

Applies to `TREE`, `BST`, `BINARY_TREE`, `HEAP` (node view), and `TRIE` — all four currently share one hardcoded `TreeLayoutStrategy` instance (audit §5, §7); `LAYOUT` lets each structure tune `levelGap`/`siblingGap` independently instead of being stuck with one global constant, directly addressing the audit's flagged gap that Heap/Trie get generic tree spacing with no accommodation for their own shape (e.g. wide branching in a `TRIE`).

#### `CIRCULAR(radius=, startAngle=, origin=)`

```
LAYOUT ring AS CIRCULAR(radius=4, startAngle=0)
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `radius` | number | `2.0` | Matches `GraphLayoutStrategy`'s current initial-seed radius (audit §6, `GraphLayoutStrategy.ts:38`) |
| `startAngle` | number (degrees) | `0` | Angle of the first element; elements are then spaced evenly at `360/n` degree intervals |
| `origin` | `(x, y, z)` | `(0, 0, 0)` | Circle center |

No structure defaults to `CIRCULAR` today (see §4) — it's opt-in, useful for e.g. a ring buffer visualization or a graph the author wants frozen into a circle instead of force-simulated.

#### `FORCE_DIRECTED(repulsion=, springLength=, springTension=, gravity=, iterations=)`

```
LAYOUT graph AS FORCE_DIRECTED(repulsion=50, iterations=100)
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `repulsion` | number | `5.0` | Coulomb repulsion constant (audit §6) |
| `springLength` | number | `2.0` | Edge rest length |
| `springTension` | number | `0.1` | Hooke's-law spring constant |
| `gravity` | number | `0.05` | Center-pull coefficient |
| `iterations` | integer | `100` | Simulation steps run per layout pass |

Only `GRAPH` structures default to this strategy (§4). The audit flagged (§6) that the simulation re-runs from scratch on every layout pass with no position continuity across edits — this spec does not change that runtime behavior; it only exposes the five tuning constants for authors instead of leaving them fixed in `GraphLayoutStrategy.ts`. Position-stability across incremental edits is out of scope for this phase (tracked as a follow-up in the audit's migration checklist).

#### `GRID(columns=, spacingX=, spacingY=, origin=)`

```
LAYOUT matrix AS GRID(columns=4, spacingX=1.5, spacingY=1.5)
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `columns` | integer | inferred from declared `row`/`col` fields, or from element count if unset | Matches `GridLayoutStrategy`'s existing `columnsLimit` inference |
| `spacingX` | number | `1.5` | |
| `spacingY` | number | `1.5` | |
| `origin` | `(x, y, z)` | `(0, 0, 0)` | Grid center |

#### `CUSTOM()`

```
LAYOUT freeform AS CUSTOM()
```

Takes no parameters. Declares that `freeform`'s elements are **not** auto-positioned by any strategy — every element must receive an explicit `POSITION` statement (§3) before it is first rendered. An element that reaches render time under `CUSTOM` with no `POSITION` ever issued for it is a **compile-time warning** (not an error — the element still renders at `(0,0,0)` so the scene doesn't silently fail), analogous to how the existing compiler already surfaces non-fatal `warning`-severity diagnostics elsewhere (see `validator.ts`).

### Where `LAYOUT` may appear

`LAYOUT` is a `SEQUENCE`-block statement (§0.3), parsed exactly like `HIGHLIGHT`/`INSERT`/etc. It may appear:
- Immediately after the relevant `DECLARE`, to set the structure's layout before any elements are animated in.
- Anywhere later in `SEQUENCE`, to **re-layout** an already-populated structure (e.g. switching a `GRAPH` from `FORCE_DIRECTED` to `CIRCULAR` mid-sequence to make a cycle visually obvious). A re-layout animates existing elements to their new positions using the same tween path already used for every other position change (`context.scheduler`, per the audit's runtime notes) — no new animation mechanism is introduced.
- Inside `LOOP`/`IF` bodies, since those reuse the same statement dispatch as top-level `SEQUENCE` (`parser/index.ts:706-786`).

---

## 2. `CAMERA` statement

Controls the 3D camera, replacing/augmenting the always-on reactive `CameraRig` behavior (audit §8).

### Syntax

```
CAMERA FOCUS(<target>)
CAMERA AUTO_FIT
CAMERA ORBIT(<speed>)
CAMERA POSITION(<x>, <y>, <z>)
```

| Form | Meaning | Audit correspondence |
|---|---|---|
| `CAMERA FOCUS(target)` | Soft-follow re-centers on `target`'s bounding box specifically (a structure name, or an indexed element like `arr[2]`), instead of the whole-scene centroid `CameraRig` currently computes every frame (audit §8, `AQVECanvas.tsx:30-43`). Uses the same X/Y lerp-rate constants (`0.04`) and Z-distance auto-zoom formula (`8 + spanX*0.75`, clamped `[10,30]`) as today's global behavior, just scoped to one target. | Narrows today's *global* auto-follow to a *scoped* auto-follow |
| `CAMERA AUTO_FIT` | Explicit form of **today's actual default**: global reactive soft-follow across the whole scene, X/Y-centered, tree-aware Y-centering when `TREE_NODE`/`HEAP_NODE`/`TRIE_NODE` elements are present, auto zoom-out past `spanX > 6` (audit §8 in full). Writing `CAMERA AUTO_FIT` is always semantically a no-op vs. omitting `CAMERA` entirely — provided for readability/explicitness and to *return* to auto-fit after a `FOCUS`/`ORBIT`/`POSITION` override earlier in the sequence. | Identical to current implicit behavior |
| `CAMERA ORBIT(speed)` | Continuous auto-rotation around the current target at `speed` degrees/second. **New capability** — no current equivalent in `CameraRig`. Disables the reactive X/Y/Z lerp of `AUTO_FIT`/`FOCUS` while active (rotation and reactive-follow are mutually exclusive) but keeps `OrbitControls`' existing manual-drag-cancels-automation behavior (audit §8: any manual drag sets `autoFollow = false`, same as today). | New |
| `CAMERA POSITION(x, y, z)` | Places the camera at an absolute fixed world position and disables all automation (`autoFollow = false`, same flag `AQVECanvas.tsx` already uses when a user manually drags — audit §8) until a later `CAMERA AUTO_FIT`/`FOCUS`/`ORBIT` statement re-enables it. | New explicit form of the existing manual-override state |

`target` in `FOCUS` accepts the same expression forms as `POSITION`'s target (§3): a bare structure/element identifier, or an indexed element (`arr[2]`).

### Where `CAMERA` may appear

Like `LAYOUT`, `CAMERA` is a `SEQUENCE` statement — it's an instant camera-behavior change taking effect at that point in the timeline, consistent with how `HIGHLIGHT`/`SET ... STATE` take effect at their point in the sequence.

---

## 3. `POSITION` override (per-element)

Pins one element (or one indexed slot of a structure) to an explicit coordinate, overriding whatever its `LAYOUT` strategy would otherwise compute for it.

### Syntax

```
POSITION <target> AT ( x=<expr>, y=<expr>, z=<expr> )
```

- `<target>` — either a bare structure/node identifier (`POSITION headNode AT (...)`) or an indexed array/structure slot (`POSITION arr[2] AT (...)`), reusing the existing `ArrayAccessNode` production (`parser/index.ts:937-947`) unchanged.
- `x=`, `y=`, `z=` — each optional; an omitted axis keeps whatever the active `LAYOUT` strategy computes for that axis (so `POSITION arr[2] AT (y=3)` nudges only the Y coordinate, leaving X/Z on the strategy's line).

### Example

```
POSITION arr[2] AT (x=5, y=2, z=0)
```

### Semantics

- A `POSITION` override is **sticky**: once set, that element is excluded from its structure's `LAYOUT` recomputation on subsequent re-layouts, until either (a) the element is removed/reset by a structure-mutating statement (`DELETE`, `CLEAR`, `POP`, etc. — whatever normally removes it from the scene), or (b) a later `POSITION` statement targeting the same element supplies new coordinates, or explicitly clears the override — see below.
- To **release** a pin back to strategy-computed placement, issue `POSITION <target> AT ()` (empty arg list) — the element rejoins normal layout on the next `LAYOUT`/structural-mutation pass.
- Under a `CUSTOM` layout (§1), `POSITION` is not an override but the *only* source of truth — every element needs one.
- This directly gives authors a language-level equivalent of what `LayoutManager`'s reserved-slot virtual-element mechanism (audit §7, `LayoutManager.ts:114-131`) does internally for in-progress insert placeholders, but exposed for arbitrary author intent instead of being compiler-internal-only.

---

## 4. Default layout mapping (backward-compatible baseline)

This table is the contract: **if a structure never receives a `LAYOUT` statement, the compiler must generate the same strategy + parameters listed here** — reproducing today's `LayoutManager` inference (audit §7) and each strategy's current hardcoded constants (audit §1-6) exactly.

| Structure (`DECLARE` type) | Default `LAYOUT ... AS` | Default params (= today's hardcoded constants) | Audit reference |
|---|---|---|---|
| `ARRAY` | `LINE` | `spacing=2.2, axis=horizontal, origin=(0,0,0)` | §1, `ArrayLayoutStrategy.ts:22` |
| `ARRAY` acting as a `HEAP`'s backing array (`HEAP_ARRAY_ELEMENT`) | `LINE` | `spacing=2.2, axis=horizontal, origin=(0,-4,0)` | §1, `LayoutManager.ts:30` |
| `LINKEDLIST` (any variant: `SINGLY`/`DOUBLY`; `CIRCULAR` variant unsupported — audit §2) | `LINE` | `spacing=2.5, axis=horizontal, origin=(0,0,0)` (order = HEAD-traversal, not index) | §2, `LinkedListLayoutStrategy.ts:17` |
| `STACK` | `LINE` | `spacing=1.2, axis=vertical, origin=(0,-2,0)` | §3, `StackLayoutStrategy.ts:17,19` |
| `QUEUE` | `LINE` | `spacing=1.5, axis=horizontal, origin=(0,0,0)` | §4, `QueueLayoutStrategy.ts:17` |
| `TREE` / `BST` / `BINARY_TREE` | `HIERARCHY` | `levelGap=2.0, siblingGap=1.5, origin=(0,2,0)` | §5, `LayoutManager.ts:29` |
| `HEAP` (node view) | `HIERARCHY` | same as Tree — `levelGap=2.0, siblingGap=1.5, origin=(0,2,0)` (no heap-specific complete-binary-tree placement exists today) | §5, §7 |
| `TRIE` | `HIERARCHY` | same as Tree — `levelGap=2.0, siblingGap=1.5, origin=(0,2,0)` (no trie-specific branching-aware layout exists today) | §5, §7 |
| `GRAPH` | `FORCE_DIRECTED` | `repulsion=5.0, springLength=2.0, springTension=0.1, gravity=0.05, iterations=100` | §6 |
| `MATRIX`/`GRID`-shaped elements (`row`/`col` or `columns` fields present) | `GRID` | `spacingX=1.5, spacingY=1.5, origin=(0,0,0)`, `columns` inferred | §7 |
| `HASH_MAP` buckets (`HASHMAP_BUCKET`) | `LINE` | `spacing=2.2, axis=horizontal, origin=(0,0,0)` — **incidental**, not a designed default: today's `LayoutManager` has no `HASHMAP_BUCKET` case and silently falls through to the same default (`ArrayLayoutStrategy`) every unrecognized type gets (audit §7, §9) | §9 |
| `HASH_MAP` entries (`HASHMAP_ENTRY`) | *(not expressible via the six strategies — see note)* | positioned `chainSpacing=1.1` below their owning bucket, vertically stacked by chain index | §9, `HashMapVisualizer.ts:27,147-152` |
| Any other/unrecognized grouped structure | `LINE` | `spacing=2.2, axis=horizontal, origin=(0,0,0)` (today's ultimate fallback, `LayoutManager`'s `defaultStrategy`) | §7 |

**Cross-structure Z-separation** (unaffected by `LAYOUT`/`CAMERA`/`POSITION`): each distinct top-level structure still gets pushed `-6` units in Z relative to the previous one, in declaration order, exactly as `LayoutManager.updateLayout` does today (audit §7, `LayoutManager.ts:137`). `LAYOUT`'s `origin=` param sets a structure's position *within* its own Z slot, not the slot itself.

**Note on `HASH_MAP` entries**: because entries are positioned relative to their *owning bucket* rather than laid out independently across the whole structure, they don't fit the `LAYOUT <target> AS <STRATEGY>(...)` shape (which lays out one flat collection of elements). This spec intentionally does **not** invent a bucket-relative strategy syntax in this phase — `chainSpacing` remains an internal constant, matching the audit's flag (§9) that HashMap needs a dedicated strategy design pass beyond what the six general-purpose strategies here cover. Authors who need entry-level control can use per-element `POSITION` overrides (§3) today.

**Default camera** (unaffected by any `LAYOUT`): every program behaves as though `CAMERA AUTO_FIT` were the first statement — today's always-on reactive `CameraRig` (audit §8) — unless a `CAMERA` statement appears in `SEQUENCE`, at which point that statement's behavior takes over from that point in the timeline onward.

---

## 5. Grammar rules (BNF)

Notation: `::=` defines a production, `|` alternation, `[...]` optional, `{...}` zero-or-more repetition, `'...'` literal token, `UPPERCASE` a keyword/terminal, `CamelCase` a nonterminal. `Expression`, `Identifier`, and `ArrayAccessNode`'s surface form (`Identifier '[' Expression ']'`) are the existing productions from `packages/compiler/src/parser/index.ts` (`parseExpression`, `parsePrimaryExpression`) and are not redefined here.

```
;; ── New SEQUENCE-block statement alternatives ──
;; (added as additional branches inside parseSequenceBlock / parseLoop / parseIf's
;;  statement-dispatch, alongside the existing COMPARE/SWAP/WAIT/LINK/... branches)

SequenceStatement ::= ... (existing alternatives unchanged) ...
                    | LayoutStatement
                    | CameraStatement
                    | PositionStatement


;; ── LAYOUT ──

LayoutStatement ::= 'LAYOUT' Target 'AS' StrategyCall

StrategyCall     ::= StrategyName '(' [ ArgList ] ')'

StrategyName     ::= 'LINE' | 'HIERARCHY' | 'CIRCULAR'
                    | 'FORCE_DIRECTED' | 'GRID' | 'CUSTOM'

ArgList          ::= NamedArg { ',' NamedArg }

NamedArg         ::= Identifier '=' Expression
                    ;; reuses the existing right-associative '=' production
                    ;; (parser/index.ts:865-873); Expression here includes a
                    ;; 3-tuple written as '(' Expression ',' Expression ',' Expression ')'
                    ;; for origin=(x,y,z)-shaped args, parsed as a parenthesized
                    ;; expression list — no new tuple-literal grammar required
                    ;; beyond what parseExpression + surrounding parens already allow.

Target           ::= Identifier


;; ── CAMERA ──

CameraStatement  ::= 'CAMERA' CameraMode

CameraMode       ::= 'FOCUS' '(' Target ')'
                    | 'AUTO_FIT'
                    | 'ORBIT' '(' Expression ')'
                    | 'POSITION' '(' Expression ',' Expression ',' Expression ')'

;; Target here additionally allows an indexed form, matching PositionTarget below:
Target           ::= Identifier | Identifier '[' Expression ']'


;; ── POSITION ──

PositionStatement ::= 'POSITION' PositionTarget 'AT' '(' [ AxisArgList ] ')'

PositionTarget    ::= Identifier | Identifier '[' Expression ']'
                     ;; identical surface form to the existing ArrayAccessNode
                     ;; production (parser/index.ts:937-947); no grammar change,
                     ;; only a new statement-level consumer of it.

AxisArgList       ::= AxisArg { ',' AxisArg }

AxisArg           ::= ( 'x' | 'y' | 'z' ) '=' Expression
                     ;; an empty AxisArgList — 'AT ( )' — clears a prior override,
                     ;; see §3 "release" semantics.
```

### Disambiguation notes

- `CIRCULAR` is already a reserved keyword used as a `LINKEDLIST` type modifier (`LINKEDLIST TYPE CIRCULAR ...`, `lexer/index.ts:26`). Its use as a `StrategyName` after `LAYOUT target AS` is unambiguous because the parser only looks for a `StrategyName` immediately following `AS` — same disambiguation-by-position technique the grammar already relies on for `TO`/`FROM`/`INTO` being reused as both relationship keywords and generic-action filler words (`parser/index.ts:809`).
- `axis=horizontal` / `axis=vertical`: `horizontal`/`vertical` are **not** new keywords — they parse as ordinary `IdentifierNode`s (the value side of a `NamedArg`), validated during semantic analysis against the allowed enum for that param, exactly like `SET x STATE <name>` already treats state names as unreserved identifiers (`parser/index.ts:821-835`). This keeps them from colliding with any future use of `HORIZONTAL`/`VERTICAL` as identifiers elsewhere in a program.
- `x=`, `y=`, `z=` inside `POSITION ... AT (...)` are likewise plain identifiers in argument-name position, not keywords.

---

## 6. Backward compatibility

**Explicit guarantee**: a program containing zero `LAYOUT`, `CAMERA`, and `POSITION` statements compiles and renders **identically** to how it renders today.

This holds because:
1. §4's default table is not a new design — it is a transcription of `LayoutManager`'s existing type-inference precedence (audit §7) and each strategy's existing hardcoded constructor defaults (audit §1-6). An implementation satisfies backward compatibility by treating "no `LAYOUT` statement for structure X" as sugar for "`LAYOUT X AS <its §4 default>` was implicitly issued right after X's `DECLARE`."
2. "No `CAMERA` statement anywhere in `SEQUENCE`" is sugar for "`CAMERA AUTO_FIT` was implicitly issued as the first statement" — and `AUTO_FIT`'s defined behavior (§2) is a verbatim restatement of today's always-on `CameraRig` logic (audit §8), constants included (`0.04` lerp rates, `spanX>6` threshold, `8+spanX*0.75` clamped `[10,30]`).
3. `POSITION` is purely additive/opt-in per element — an element that never receives a `POSITION` statement is never touched by this feature, and continues to be placed entirely by its structure's active `LAYOUT` strategy, exactly as today.
4. None of the three new statement kinds change existing statement dispatch, existing keyword meanings, or existing AQIR node shapes for anything other than the new `LAYOUT`/`CAMERA`/`POSITION` node types themselves — `SequenceStatement`'s existing alternatives (§5) are unmodified, only extended.

**Not backward-compatible by nature (intentionally new, opt-in only)**: `CAMERA ORBIT(...)` and the `CUSTOM` layout strategy have no prior equivalent — they are new capabilities that only take effect when explicitly written, so they cannot regress any existing program.

---

## 7. New reserved keywords (implementation note)

For an implementation to realize this grammar, the following tokens would need to be added to `KEYWORDS` in `packages/compiler/src/lexer/index.ts:23-49`:

```
LAYOUT, AS, LINE, HIERARCHY, FORCE_DIRECTED, GRID, CUSTOM,
CAMERA, FOCUS, AUTO_FIT, ORBIT,
POSITION, AT
```

(`CIRCULAR` is already present — reused per §5's disambiguation note; no new keyword needed for it.) This is a note for the eventual implementation phase — no code changes are made as part of this spec.

---

## 8. Examples

### 8.1 Array with explicit spacing

```
SCENE ArrayLayoutDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  HIGHLIGHT arr[2]
  WAIT
END
```

### 8.2 Tree with custom level/sibling gaps

```
SCENE TreeLayoutDemo
DECLARE
  BST tree

SEQUENCE
  LAYOUT tree AS HIERARCHY(levelGap=2, siblingGap=1)
  INSERT 50
  INSERT 30
  INSERT 70
  WAIT
END
```

### 8.3 Graph with tuned force-directed constants

```
SCENE GraphLayoutDemo
DECLARE
  GRAPH g

SEQUENCE
  LAYOUT g AS FORCE_DIRECTED(repulsion=50, iterations=100)
  VERTEX a INTO g
  VERTEX b INTO g
  VERTEX c INTO g
  CONNECT a b
  CONNECT b c
  WAIT
END
```

### 8.4 Graph frozen into a circle instead of simulated

```
SCENE RingBufferDemo
DECLARE
  GRAPH ring

SEQUENCE
  LAYOUT ring AS CIRCULAR(radius=4, startAngle=0)
  VERTEX a INTO ring
  VERTEX b INTO ring
  VERTEX c INTO ring
  VERTEX d INTO ring
  CONNECT a b
  CONNECT b c
  CONNECT c d
  CONNECT d a
  WAIT
END
```

### 8.5 Matrix as an explicit grid

```
SCENE MatrixDemo
DECLARE
  ARRAY grid = [1, 2, 3, 4, 5, 6, 7, 8, 9]

SEQUENCE
  LAYOUT grid AS GRID(columns=3, spacingX=1.5, spacingY=1.5)
  HIGHLIGHT grid[4]
  WAIT
END
```

### 8.6 Stack laid out horizontally instead of the default vertical column

```
SCENE HorizontalStackDemo
DECLARE
  STACK s

SEQUENCE
  LAYOUT s AS LINE(spacing=1.2, axis=horizontal, origin=(0, 1, 0))
  PUSH 10
  PUSH 20
  PUSH 30
  WAIT
END
```

### 8.7 Camera focused on one structure among several

```
SCENE MultiStructureDemo
DECLARE
  ARRAY nums = [4, 2, 7]
  BST tree

SEQUENCE
  CAMERA FOCUS(tree)
  INSERT 40
  INSERT 20
  INSERT 60
  CAMERA FOCUS(nums)
  COMPARE nums[0] nums[1]
  WAIT
END
```

### 8.8 Camera returning to global auto-fit after a focused segment

```
SCENE FocusThenAutoFitDemo
DECLARE
  GRAPH g

SEQUENCE
  VERTEX a INTO g
  VERTEX b INTO g
  CONNECT a b
  CAMERA FOCUS(a)
  WAIT
  CAMERA AUTO_FIT
  WAIT
END
```

### 8.9 Slow orbiting camera for a presentation-style pass

```
SCENE OrbitPresentationDemo
DECLARE
  TREE t
  TREE_NODE r = ["Root"] { parent: t }
  TREE_NODE c1 = ["A"] { parent: t }
  TREE_NODE c2 = ["B"] { parent: t }

SEQUENCE
  CAMERA ORBIT(15)
  LINK r TO c1
  WAIT
  LINK r TO c2
  WAIT
END
```

### 8.10 Fixed camera position, then per-element position override

```
SCENE PinnedElementDemo
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  CAMERA POSITION(0, 6, 14)
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  POSITION arr[2] AT (x=5, y=2, z=0)
  HIGHLIGHT arr[2]
  WAIT
END
```

### 8.11 Releasing a pinned element back to strategy-driven placement

```
SCENE ReleasePositionDemo
DECLARE
  ARRAY arr = [1, 2, 3]

SEQUENCE
  POSITION arr[1] AT (y=4)
  WAIT
  POSITION arr[1] AT ()
  WAIT
END
```

### 8.12 Fully custom layout — every element manually placed

```
SCENE CustomLayoutDemo
DECLARE
  ARRAY pts = [1, 2, 3]

SEQUENCE
  LAYOUT pts AS CUSTOM()
  POSITION pts[0] AT (x=-3, y=0, z=0)
  POSITION pts[1] AT (x=0, y=2, z=0)
  POSITION pts[2] AT (x=3, y=0, z=0)
  WAIT
END
```

### 8.13 Re-layout mid-sequence

```
SCENE RelayoutDemo
DECLARE
  GRAPH g

SEQUENCE
  LAYOUT g AS FORCE_DIRECTED(iterations=60)
  VERTEX a INTO g
  VERTEX b INTO g
  VERTEX c INTO g
  CONNECT a b
  CONNECT b c
  CONNECT c a
  WAIT
  ;; Freeze the now-visible cycle into a clean ring for the explanation beat
  LAYOUT g AS CIRCULAR(radius=3)
  WAIT
END
```

### 8.14 No spatial statements at all — today's default behavior, unchanged

```
SCENE PlainBSTDemo
DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  INORDER
  CLEAR
END
```

Renders identically with or without this spec's grammar present in the compiler, per §6.
