# Algorithm Engine Pattern

Audit of how BST, Graph, Heap, HashMap, and Trie currently turn a data-structure
operation into an animated scene mutation, written to fix one canonical pattern
**before** Array/Stack/Queue/LinkedList get dedicated engine classes of their
own. Today those four still live as inline `else if (gen.actionName === 'PUSH')`
branches inside `AnimationController`'s giant `GENERIC_ACTION` switch
(`packages/runtime/src/core/AnimationController.ts:3852-4213` and further, e.g.
PUSH/POP/PEEK for Stack ~3852-4020, ENQUEUE/DEQUEUE for Queue ~4039-4213, and
array/linked-list insert/delete/traverse scattered from ~3400-3850) — mutating
`this.sceneManager`/`this.animationScheduler` directly with no reusable "pure
data structure" layer and no `AlgorithmHandler` registration. That inline style
is *not* the pattern to copy. The five structures below converged (with some
drift — noted at the end) on something better; this doc fixes the target shape
so the four new engines come out identical to each other, not identical to the
PUSH/POP code they're replacing.

## The two-layer split

Every properly-migrated structure is two classes, not one:

1. **Pure data structure** — `packages/runtime/src/data-structures/<Name>.ts`.
   Framework-free: no `SceneManager`, no `AnimationScheduler`, no scene
   elements. Operates on primitive/plain-object state (`elements: number[]`,
   a `table`, node objects with only structural fields). Exists so the logic
   is unit-testable without a fake scene graph (see `unit/heap.test.ts`,
   `unit/sortEngine.test.ts`) and so "what the algorithm did" and "how it's
   drawn" can change independently.

2. **Engine / handler** — `packages/runtime/src/core/algorithms/<Name>Engine.ts`
   (or `<Name>Visualizer.ts` — see naming note below), implementing
   `AlgorithmHandler` from `AlgorithmContext.ts`:
   ```ts
   export interface AlgorithmContext {
     scheduler: AnimationScheduler;
     sceneManager: SceneManager;
     layoutManager: LayoutManager;
     eventDispatcher: EventDispatcher;
     stateManager?: StateManager;
     relationshipManager?: RelationshipManager;
     activeTreeName?: string | null;
     defaultColor: string;
   }

   export interface AlgorithmHandler {
     execute(context: AlgorithmContext, instruction: GenericActionInstruction): void;
   }
   ```
   The engine reconstructs the pure structure's current state **from the live
   scene graph** (scene is the source of truth, not the engine instance —
   engines are stateless and constructed fresh, or hold no scene state
   between calls), calls the pure structure's method, then replays whatever
   the pure structure recorded into `context.scheduler` calls and
   `context.sceneManager` mutations.

Reference implementation to copy: **`MinHeap`**
(`packages/runtime/src/data-structures/Heap.ts`) + **`HeapEngine`**
(`packages/runtime/src/core/algorithms/HeapEngine.ts`). This is the cleanest,
most self-consistent example of the full pattern and is the one the new
Array/Stack/Queue/LinkedList engines should mirror line-for-line in structure.

## Canonical shape (copy this for Array/Stack/Queue/LinkedList)

### Pure data structure — `data-structures/<Name>.ts`

```ts
export type <Name>Step =
  | { type: 'COMPARE'; i: number; j: number }
  | { type: 'SWAP'; i: number; j: number }
  // ... one variant per distinct visualizable micro-action

export class <Name> {
  elements: <ElementType>[] = [];       // or `table`, `root`, etc. — whatever the structure's real state is
  steps: <Name>Step[] = [];             // reset at the START of every mutating call, accumulated during it

  mutatingOperation(...args): <ReturnType> {
    this.steps = [];                    // <-- always reset first, per Heap.ts:62/69/89/161
    // ... pure logic, pushing to this.steps as each visualizable micro-action happens
  }
}
```

Rules, taken directly from `Heap.ts`:
- `steps` is reset (`this.steps = []`) at the top of *each* mutating method,
  not shared/accumulated across calls — except deliberately-composite
  operations like `buildHeap`, which call several internal steps that all
  push into one shared array for that one call.
- Every `type` in the step union is a *visualizable micro-action*
  (`COMPARE`, `SWAP`), not a generic "mutation happened" event — granular
  enough that the engine can animate it 1:1.
- No engine/scheduler/scene imports here at all. This class must be usable
  and unit-testable with zero AQVL runtime context, exactly like
  `MinHeap`/`unit/heap.test.ts` and `SortAlgorithm`/`unit/sortEngine.test.ts`.

### Engine — `core/algorithms/<Name>Engine.ts`

```ts
export class <Name>Engine implements AlgorithmHandler {
  static readonly NODE_COLOR = '#...';
  static readonly NODE_EMISSIVE = '#000000';

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();
    if (action === '<NAME>_INSERT') this.insert(context, instruction);
    else if (action === '<NAME>_REMOVE') this.remove(context, instruction);
    // ... one branch per registered action name
  }

  // Scene helpers: read current values back OUT of the scene graph, keyed by
  // `logicalParent` + `originalType` (+ `logicalIndex` for positional lookup).
  private getElements(context: AlgorithmContext, name: string): any[] { ... }
  private getValues(context: AlgorithmContext, name: string): number[] { ... }

  private insert(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    if (!name) { this.log(context, 'ERROR', '<NAME>_INSERT requires a name.', 'warning'); return; }

    const ds = new <Name>();
    ds.elements = this.getValues(context, name);   // rehydrate from scene
    ds.insert(value);                                // run the PURE operation

    this.log(context, '<NAME>_INSERT', `Inserting ${value} into "${name}"...`, 'operation');
    this.replaySteps(context, name, ds.steps);        // turn recorded steps into animation

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, '<NAME>_INSERT', `...`, 'result');
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `<Name> insert ${value}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  // Shared by every mutating method: turns the pure structure's .steps into
  // scheduler animation + scene value writes.
  private replaySteps(context: AlgorithmContext, name: string, steps: <Name>Step[]): void {
    steps.forEach((step) => {
      // look up live scene elements for step.i / step.j via getElements/logicalIndex
      // enqueue "highlight" animation, commitGroup(true), advanceCursor(ms)
      // mutate .value on the live elements to reflect the step
      // enqueue "un-highlight" animation, commitGroup(true)
    });
  }

  private log(context: AlgorithmContext, keyword: string, message: string, kind: string = 'operation'): void {
    context.scheduler.enqueue({ targets: {}, duration: 1, complete: () => {
      context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
    }});
    context.scheduler.commitGroup(true);
  }
}
```

Rules extracted from `HeapEngine`:
- **No constructor / no instance state.** One instance is created once at
  module load (`new HeapEngine()`) and reused for every call — all per-call
  state is local variables inside each method.
- **Scene lookups are always `logicalParent` + `originalType` filters**
  (`el.logicalParent === name && el.originalType === '<TYPE>_ELEMENT'`),
  never an id list kept on the engine. The scene graph is the only source of
  truth for "what currently exists"; the engine re-derives everything from
  it on every call (see `HeapEngine.getValues`/`getPairAt`, always called
  fresh, never cached).
- Every operation logs **twice**: once immediately (`'operation'` kind,
  describing intent) and once inside a zero-duration
  `scheduler.enqueue({ complete: () => ... })` at the very end (`'result'`
  kind, describing outcome) — this final callback is also where
  `stateManager.saveState()` + `STATE_UPDATED` dispatch happens, i.e. state
  snapshots for scrub/seek (see the scrub-backward work) are saved **once
  per top-level operation, after all its animation is enqueued**, not per
  intermediate step.
- `replaySteps` is the one method every mutating operation funnels through,
  and it's the direct analogue of a video codec's frame decoder: it knows
  nothing about *why* a COMPARE/SWAP happened, only how to animate one.
  Keep operation-specific narrative logic (spawn/remove, error messages) in
  the calling method, and keep `replaySteps` generic across every operation
  that shares the same step-type union.
- Bulk animation idiom, copy verbatim: `scheduler.enqueue(...)` (repeat for
  each parallel target) → `scheduler.commitGroup(true)` → optionally
  `scheduler.advanceCursor(ms)` if the next block must wait for this one to
  visually finish first. `commitGroup(true)` commits and advances the
  cursor by the max duration in the group; `advanceCursor` inserts an
  additional no-op gap.

### Registration — `core/algorithms/index.ts` + `AnimationController.ts`

```ts
// index.ts
export * from './<Name>Engine';
```
```ts
// AnimationController.ts, alongside the other AlgorithmRegistry.register calls near the top of the file
AlgorithmRegistry.register(['<NAME>_INSERT', '<NAME>_REMOVE', ...], new <Name>Engine());
```
These calls run once at module load (top-level statements, `AnimationController.ts:15-48`), *before* the `AnimationController` class body. `AlgorithmRegistry` (`AlgorithmRegistry.ts`) is a static `Map<string, AlgorithmHandler>` — `register` just does repeated `.set()`, `getHandler` does `.get()`. The instruction actually reaches the handler via one shared dispatch block, unchanged for all five existing structures and to be reused as-is for the new four:
```ts
// AnimationController.ts:509-540 (GENERIC_ACTION case)
const handler = AlgorithmRegistry.getHandler(actionName);
if (handler) {
  const context: AlgorithmContext = {
    scheduler: this.animationScheduler,
    sceneManager: this.sceneManager,
    layoutManager: this.layoutManager,
    eventDispatcher: this.eventDispatcher,
    stateManager: this.stateManager,
    relationshipManager: this.relationshipManager,
    activeTreeName: this.activeTreeName,
    defaultColor: this.defaultColor
  };
  handler.execute(context, gen);
  break;
}
```
New engines require **zero changes** to this dispatch block — only a
`register()` call naming the new action strings, and the files above it.

## Naming conventions to follow

| Piece | Convention | Example |
|---|---|---|
| Pure structure file | `data-structures/<Name>.ts`, PascalCase class matching filename | `Heap.ts` → `MinHeap` (exception: name doesn't exactly match file; prefer exact match for new ones, e.g. `Stack.ts` → `Stack`) |
| Step type | `<Name>Step`, discriminated union on a `type` field, one member per visualizable micro-action | `HeapStep = {type:'COMPARE',...} \| {type:'SWAP',...}` |
| Steps field | **`steps`** (not `animationFrames` — see inconsistency note below) | `heap.steps` |
| Engine file | `core/algorithms/<Name>Engine.ts` | `HeapEngine.ts` |
| Engine class | `<Name>Engine`, `implements AlgorithmHandler` | `class HeapEngine implements AlgorithmHandler` |
| Scene `originalType` | `<NAME>_ELEMENT` for flat/array-shaped storage, `<NAME>_NODE` for node/tree-shaped storage | `STACK_ELEMENT`, `QUEUE_ELEMENT`, `HEAP_NODE` |
| Registered action names | `<NAME>_<VERB>`, matching AQVL DSL keywords uppercased | `HEAP_INSERT`, `HASHMAP_DELETE` |

Suggested mapping for the four pending structures (align with existing
`originalType` strings already used by the inline code so scene/layout/render
compatibility isn't broken):

| Structure | Pure class | Engine class | `originalType` | Actions to register |
|---|---|---|---|---|
| Array | `ArrayStructure` (`Array` collides with the JS global) | `ArrayEngine` | `ARRAY_ELEMENT` (already used) | `ARRAY_INSERT`, `ARRAY_DELETE`, `ARRAY_SET`, ... |
| Stack | `Stack` | `StackEngine` | `STACK_ELEMENT` (already used) | `PUSH`, `POP`, `PEEK` |
| Queue | `Queue` | `QueueEngine` | `QUEUE_ELEMENT` (already used) | `ENQUEUE`, `DEQUEUE`, `PEEK` (or `FRONT`) |
| Linked List | `LinkedList` | `LinkedListEngine` | `LINKEDLIST_NODE` (already used) | `LIST_INSERT`, `LIST_DELETE`, `LIST_TRAVERSE` |

## Known inconsistencies in the existing five (do not propagate these)

The five existing structures did **not** actually converge on one pattern —
they drifted in three ways worth calling out explicitly so the new four don't
pick a random one of these by accident:

1. **Step-array field name**: `MinHeap`/`SortAlgorithm` use `.steps`;
   `GraphAlgorithm`'s result objects use `.animationFrames`; `HashMap`/`Trie`
   have **no recorded step array at all** — their engines
   (`HashMapVisualizer`, `TrieVisualizer`) compute hash/collision/path facts
   inline and hand-write the animation sequence per operation, with no pure
   "here's what happened" data handed back. **Standardize on `.steps`** for
   the new four — it's shorter, matches the two cleanest examples, and
   "frames" wrongly implies a 1:1 relationship with rendered animation
   frames when a step is really a semantic micro-action that may expand into
   several animation calls.
2. **Engine file naming**: `HeapEngine.ts` holds the full `AlgorithmHandler`;
   `BSTEngine.ts` holds only the pure/static logic (the actual handler is a
   *separate* file, `BSTAlgorithms.ts`); `GraphEngine.ts` similarly holds
   only the pure layer (class is even named `GraphAlgorithm`, not
   `GraphEngine`) with `GraphAlgorithms.ts` as the handler. **Standardize on
   the `HeapEngine` shape** — one file, one class, both roles — since Array/
   Stack/Queue/LinkedList operations are simple enough (unlike BST rotations
   or graph search) that splitting pure-vs-handler into two files would be
   overhead with no reuse benefit. Revisit only if a future structure needs
   its pure algorithm invoked from multiple different handlers.
3. **Constructor shape**: every engine (`HeapEngine`, `HashMapVisualizer`,
   `TrieVisualizer`, `GraphAlgorithms`, `BSTAlgorithms`, `SortAlgorithms`) is
   already no-arg / stateless, constructed once at `AnimationController`
   module load — this one *is* consistent and should stay that way. Do not
   give the new engines a constructor that takes scene/scheduler
   references; those always arrive per-call via `AlgorithmContext`.

## What this doc deliberately does not cover

`LayoutManager`/`LayoutStrategy` (how `.position` gets computed once
elements exist) is a separate, already-consistent system documented in
`docs/design/existing-layout-audit.md` — engines call
`context.layoutManager.updateLayout(...)` and read back `.worldTarget` the
same way regardless of structure; nothing about the engine pattern above
should reinvent that. Similarly, `LifecycleManager` (`spawn`/`activate`/
`remove`/`destroy`) is orthogonal and used as-is by the inline PUSH/POP code
today — the new engines should keep using it for element creation/removal,
not replace it.
