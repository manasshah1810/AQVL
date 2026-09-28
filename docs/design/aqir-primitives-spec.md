# AQIR Primitives Spec (Phase 2.1)

Status: implemented in 2.1. The compiler emits only kernel opcodes and `STEP`s. The VM interprets `STEP`s, and during 2.1 it bridges them to the unchanged AnimationController.

## 1. Why

Before 2.1, every data-structure feature added its own AQIR opcode:
- `SWAP_OBJECTS`, `LL_SET`, `MAP_PUT`, `TRIE_EDIT`, `GRAPH_EDIT`, `CONTAINER_READ`, …
- more than 20 action strings, 11 of them missing from any declared type.

Each new structure widened the instruction set, and so widened every consumer too. 2.1 replaces that with a small, closed set of domain-neutral **primitives**. Every former opcode becomes a **composition** of them.

The rule going forward:

> **Adding a data structure or algorithm must never add an opcode or an op kind.** It adds a composition (a compiler macro) or a library procedure (§5). Domain vocabulary (heap, trie, graph, …) lives in declarations (`objects`), not in instructions.

## 2. The instruction stream

An AQIR program's `instructions` contain exactly two families.

| Family | Opcodes | Owner |
|---|---|---|
| **Kernel** (unchanged) | `JUMP`, `JUMP_IF_FALSE`, `CALL`, `RET`, `PUSH_SCOPE`, `POP_SCOPE`, `SET_VAR` | VM |
| **Effect** (new) | `STEP` | VM (TRANSFORM) and host (everything else) |

```ts
interface StepInstruction {
  opcode: 'STEP';
  ops: PrimitiveOp[];   // applied in order, as ONE beat on the timeline
  lineNumber?: number;  // source line, same as before
  sourceText?: string;  // the statement as written, for console narration
}
```

A `STEP` is one atomic, visible beat. `ops: []` is a beat where nothing changes; that is exactly what `WAIT` was.

**Invariant (2.1): macro expansion is 1:1 per instruction.** Every instruction the old generator emitted becomes exactly one `STEP`. So these are all unchanged, and so is anything counted per instruction (the iteration cap, `INSTRUCTION_START` events):
- program counters
- jump targets
- function entry addresses
- `lineNumber`s

## 3. The primitives (closed set)

Every op has a `kind` and, except `INVOKE`, a `verb` from a fixed list.

| Kind | Verbs | Meaning |
|---|---|---|
| `MUTATE` | `set`, `exchange`, `create`, `destroy` | Change what exists or what it holds |
| `TRANSFORM` | `arrange`, `reflow`, `place`, `view`, `orient`, `scale` | Change where things are or how they are seen |
| `RELATE` | `link`, `unlink` | Add or remove a relation between two entities |
| `ANNOTATE` | `focus`, `contrast`, `state`, `boundary`, `region` | Mark entities or ranges without changing them |
| `EMIT` | `log` | Produce narrative output |
| `INVOKE` | — | Run a named **library procedure** (§5) |

### 3.1 Operands and addresses

An **operand** is any compiled AQIR value: a literal, a variable name, `{ text }`, `{ op, left, right }`, `{ member, object }`, `{ elem, index }`, `{ gfn, args }` or `{ len }`. It can also be a resolved entity reference: a static id `obj_003`, a runtime slot `arr#i`, or `@expr:…`. The host evaluates operands when the step runs, exactly as before.

A target may instead be a tagged **address**:

| Address | Shape | Names |
|---|---|---|
| entity | any operand | the entity it evaluates to |
| slot | `{ at: 'slot', collection, ref, index }` | position `index` of an ordered collection (`arr[i]`); `ref` is the resolved slot reference |
| key | `{ at: 'key', collection, key }` | the member of a keyed collection stored under `key` (`m[k]`, a graph vertex by name) |
| via | `{ at: 'via', from, label }` | the entity reached from `from` along the relation labelled `label` (a trie child) |
| created | `{ at: 'created', op }` | the entity created by op number `op` of this same step |

### 3.2 Fields per verb

| Op | Fields |
|---|---|
| `MUTATE set` | `target`, `field?` (named property of target), `value` |
| `MUTATE exchange` | `target`, `with` (the two exchange contents) |
| `MUTATE create` | `collection?`, `key?`, `value?`, `bind?` (variable receiving the new reference), `assignTo?` (display hint) |
| `MUTATE destroy` | `target` |
| `TRANSFORM arrange` | `target` (structure), `strategy`, `params` |
| `TRANSFORM reflow` | `target?` (structure; omitted = whole scene) |
| `TRANSFORM place` | `target` (element), `x`, `y`, `z` (`null` = defer to layout; all `null` = release pin) |
| `TRANSFORM view` | `mode`, `params` (camera) |
| `TRANSFORM orient` / `scale` | `target`, `x`, `y`, `z` |
| `RELATE link` | `source`, `target?`, `collection?` (relation belongs to this collection's edge set), `label?`, `directed?`, `weight?` |
| `RELATE unlink` | `source`, `target?`, `all?` (every relation of `source` instead of one), `collection?`, `label?` |
| `ANNOTATE focus` | `targets[]`, `color` |
| `ANNOTATE contrast` | `targets[]` (two), `persist?` (stays until cleared), `clear?`, `style?` |
| `ANNOTATE state` | `targets[]`, `state` |
| `ANNOTATE boundary` | `collection`, `range?` (`[start, end]`), `label?`, `clear?` |
| `ANNOTATE region` | `collection`, `range`, `state` |
| `EMIT log` | `parts[]` |
| `INVOKE` | `procedure`, `args[]`, `bind?`, `assignTo?`, `subject?`, `scope?` (`{ collection, index? }`) |

Ops that take user-supplied operand lists (graph edits) carry any operands beyond the verb's arity in `extra[]`, untouched. Arity errors are still reported by the host, with the same messages as before. `texts?` records how operands were written in source (e.g. `{ source: 'curr' }`), for error messages.

### 3.3 Well-formedness (checked by `validateStep`)

- `ops` is an array. Every `kind` and `verb` is from the tables above, with its required fields present.
- `INVOKE` is the only op in its step, because a library call is its own beat.
- A `TRANSFORM` op is the only op in its step in 2.1, because the VM owns geometry and the host owns everything else.
- An `{ at: 'created', op: n }` address refers to an earlier `MUTATE create` in the same step.

## 4. Every former opcode as a composition

These are the compiler macros (`packages/compiler/src/aqir/macros.ts`). "Never emitted" rows are not produced by today's generator, but their macro exists and round-trips.

| Former opcode | Composition |
|---|---|
| `COMPARE_OBJECTS a b` | `ANNOTATE contrast [a, b]` |
| `SHOW_COMPARISON_LINK a b` *(never emitted)* | `ANNOTATE contrast [a, b] persist` |
| `HIDE_COMPARISON_LINK a b` *(never emitted)* | `ANNOTATE contrast [a, b] clear` |
| `SWAP_OBJECTS a b` | `MUTATE exchange a with b` |
| `HIGHLIGHT_OBJECT t color` | `ANNOTATE focus [t] color` |
| `MAP_HIGHLIGHT m k color` | `ANNOTATE focus [key(m, k)] color` |
| `SET_STATE t s` | `ANNOTATE state [t] s` |
| `SET_PARTITION_BOUNDARY s i j label` *(never emitted)* | `ANNOTATE boundary s [i, j] label` |
| `CLEAR_PARTITION_BOUNDARY s` *(never emitted)* | `ANNOTATE boundary s clear` |
| `MARK_SORTED_REGION s i j` *(never emitted)* | `ANNOTATE region s [i, j] state='sorted'` |
| `LINK_OBJECTS a b directed type` | `RELATE link a → b directed label=type` |
| `LL_SET obj.f = v` | `MUTATE set obj field=f value=v` |
| `UPDATE arr[i] v` / `arr[i] = v` | `MUTATE set slot(arr, i) value=v` |
| `MAP_PUT m[k] = v` | `MUTATE set key(m, k) value=v` |
| `MAP_DELETE m[k]` | `MUTATE destroy key(m, k)` |
| `LL_NEW list v → t` | `MUTATE create collection=list value=v bind=t` |
| `LL_FREE p` | `MUTATE destroy p` |
| `TRIE_EDIT ADD_CHILD n ch` | `MUTATE create`; `RELATE link n → created(0) label=ch` |
| `TRIE_EDIT REMOVE_CHILD n ch` | `MUTATE destroy via(n, ch)` |
| `GRAPH_EDIT ADD_VERTEX g v` | `MUTATE create collection=g key=v` |
| `GRAPH_EDIT REMOVE_VERTEX g v` | `RELATE unlink v all collection=g`; `MUTATE destroy key(g, v)` |
| `GRAPH_EDIT ADD_EDGE g a b w` | `RELATE link a → b collection=g weight=w` |
| `GRAPH_EDIT REMOVE_EDGE g a b` | `RELATE unlink a → b collection=g` |
| `PRINT parts` | `EMIT log parts` |
| `WAIT` | *(empty step)* |
| `SET_LAYOUT_STRATEGY s strat params` | `TRANSFORM arrange s strat params` |
| `COMPUTE_LAYOUT s` | `TRANSFORM reflow s` |
| `UPDATE_LAYOUT` *(never emitted)* | `TRANSFORM reflow` |
| `SET_POSITION e x y z` | `TRANSFORM place e x y z` |
| `SET_CAMERA mode params` | `TRANSFORM view mode params` |
| `SET_ROTATION` / `SET_SCALE` *(never emitted)* | `TRANSFORM orient` / `TRANSFORM scale` |
| `CONTAINER_READ POP(s) → t` | `INVOKE POP [s] bind=t` |
| `GENERIC_ACTION name args` | `INVOKE name args` |
| `LOOP` *(retired)* | kernel: `PUSH_SCOPE`, `SET_VAR`, `JUMP_IF_FALSE`, body, `SET_VAR`, `JUMP`, `POP_SCOPE` (what `generateLoop` emits) |

**Every composition is distinguishable by content alone.** The lowering (§6) picks the former opcode from the op kinds, verbs, address forms and op count. It never uses a name tag. For example:
- `MUTATE destroy key(…)` alone is a map delete.
- The same op preceded by a cascade `RELATE unlink` is a vertex removal.

## 5. Library procedures (`INVOKE`)

Some statements name a **data-dependent algorithm**. Their primitive expansion depends on values only known at run time, for example:
- `BUBBLE_SORT arr`, `HEAP_INSERT h v`, `INORDER t`, `BST_INSERT t 5`, `HASHMAP_INSERT m k v`, `PUSH s v`.

The compiler cannot expand these statically. They compile to `INVOKE`, the library analogue of the kernel `CALL`, and the runtime's procedure library expands them. `INVOKE` is not an escape hatch for new opcodes: its vocabulary is procedure names, which are open like function names. The op set stays closed.

What each procedure family emits, as the contract for 2.2 (today's handlers already produce these effects through their own animation calls):

| Procedure family | Primitive expansion at run time |
|---|---|
| Sorts (`BUBBLE_SORT`, …) | repeat { `ANNOTATE contrast`; maybe `MUTATE exchange` }; `ANNOTATE boundary`/`region` as ranges settle |
| Heap (`HEAP_INSERT`, `HEAP_EXTRACT`, `HEAPIFY`, …) | `MUTATE create`/`destroy` at the end slot; repeat { `ANNOTATE contrast` parent/child; `MUTATE exchange` } |
| Tree queries (`INORDER`, `HEIGHT`, `LCA`, …) | `ANNOTATE focus`/`state` along the walk; `EMIT log` result |
| BST (`BST_INSERT`, …) | `ANNOTATE contrast` down the search path; `MUTATE create`; `RELATE link` |
| Hash map / trie builders (`HASHMAP_INSERT`, `TRIE_INSERT`, …) | `MUTATE create`/`set`; `RELATE link` |
| Containers (`PUSH`, `ENQUEUE`, `POP`, …) | `MUTATE create`/`destroy` at an end; `bind` for reads |
| Graph algorithms (`BFS`, `DIJKSTRA`, …) | `ANNOTATE focus`/`state` on vertices and edges; `EMIT log` |

## 6. VM side

`AQVLVirtualMachine` executes `STEP`s:

1. **TRANSFORM** is interpreted natively from the op's fields:
   - `arrange`, `reflow <structure>`, `place` and `view` update VM-owned geometry: layout strategies, resolved positions, pins and the camera.
   - `orient`, `scale` and whole-scene `reflow` go to the host, as before.
2. **Everything else** belongs to the host (AnimationController). In 2.1 the VM reaches it through the **legacy bridge** (`packages/runtime/src/aqir/legacyBridge.ts`). The bridge lowers the step back to the exact instruction AnimationController has always received, and the VM passes that to the existing legacy handler. In 2.2 the VM hands `STEP`s to AnimationController directly and the bridge is deleted.
3. The emitted `ExecutionFrame.instruction` is the lowered (legacy-shaped) instruction, so `ExecutionEngine`'s step visibility and labels are unchanged. The original `STEP` is on `ExecutionFrame.programInstruction`.

Hand-written legacy action instructions (tests, runtime-internal callers) are still accepted and pass straight through.

## 7. Compatibility guarantee and how it is checked

- `scripts/aqir-trace.ts` records, for every example and `.aqvl` sample:
  - the key-exact stream of instructions AnimationController receives
  - every scene timeline frame
  - every dispatched event
  - the outcome

  Phase 2.1 is accepted only if this trace is identical to the pre-2.1 baseline.
- Round-trip tests: `lower(expand(x)) ≡ x` for every former opcode, including the never-emitted ones.
- Shape tests assert the primitive form the compiler emits for each statement kind.

### 7.1 Result at the end of 2.1

| Gate | Before 2.1 | After 2.1 |
|---|---|---|
| Behavioral trace (`scripts/aqir-trace.ts`, 218 examples + 3 `.aqvl` samples) | baseline | **identical**, all 221 programs, all channels |
| Corpus audit (`scripts/audit-examples.ts`) | 218/218 pass | 218/218 pass |
| Root suite | 1293 passed, 2 todo | 1581 passed, 2 todo (288 new in `tests/unit/aqir-primitives.test.ts`) |
| Renderer / demo suites | 152 / 35 | 152 / 35 |
| Compiled examples emitting any legacy `action` instruction | 218 | 0 |

There are **no behavioral differences**. These representation changes are intentional:
- `compile()` output now holds `STEP`s. Tests that assert on what AnimationController receives read the program through `legacyView()` (`tests/utils/testHelpers.ts`), and their assertions are unchanged. The demo's AQIR debug panels show each step's lowered form (`instructionViews`), so they look as before.
- `ExecutionFrame.instruction` of a `STEP` is its lowered form, with the `STEP` on `programInstruction`.
- The compiler's `AQIROpcode` lists kernel opcodes and `STEP`. The former action names moved to `LegacyAction`.
- `scripts/inspect-aqir.ts` now prints `STEP`s.

## 8. Out of scope for 2.1

- AnimationController consuming primitives natively (2.2).
- The renderer (2.3).
- Moving library procedures onto primitives (2.2).
- Merging `SET_LAYOUT_STRATEGY` + `COMPUTE_LAYOUT` into one step. It is possible now, but it breaks the 1:1 invariant.
- AI/ML or blockchain vocabulary. It must arrive as compositions and procedures, never as new kinds.
