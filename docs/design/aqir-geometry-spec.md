# AQIR Geometry Extension Specification

Extends AQIR (compiler → VM → renderer) to carry the spatial constructs defined in
[`spatial-syntax-spec.md`](./spatial-syntax-spec.md) (`LAYOUT`, `CAMERA`, `POSITION`) as
first-class instructions and frame data, instead of leaving layout/camera behavior
implicit in `LayoutManager`/`CameraRig` internals.

**Spec only** — no implementation code. Follows the same additive posture as the syntax
spec it extends: a program with none of the six opcodes below must produce byte-identical
`SceneElement` frames to what today's compiler/runtime emits.

---

## 1. New AQIR opcodes

All six follow the existing `AQIRInstruction` shape (`packages/shared/src/aqir/types.ts`) —
a discriminated union on `action: string` — the same family as `HIGHLIGHT_OBJECT`,
`SWAP_OBJECTS`, `UPDATE_LAYOUT`, etc. They are not built on the newer `Instruction`/
`AQIROpcode` control-flow model in `packages/compiler/src/aqir/InstructionSet.ts`; that
model exists for `JUMP`/`CALL`/control-flow, a different concern from per-element geometry.

### 1.1 `SET_LAYOUT_STRATEGY`

```ts
interface SetLayoutStrategyInstruction extends AQIRInstruction {
  action: 'SET_LAYOUT_STRATEGY';
  targetId: string;                 // structure name, e.g. "arr", "tree", "g"
  strategy: 'LINE' | 'HIERARCHY' | 'CIRCULAR' | 'FORCE_DIRECTED' | 'GRID' | 'CUSTOM';
  params: Record<string, number | string | [number, number, number]>;
  // e.g. LINE: { spacing: 1.5, axis: 'horizontal', origin: [0,0,0] }
  //      HIERARCHY: { levelGap: 2, siblingGap: 1.5, origin: [0,2,0] }
  //      CIRCULAR: { radius: 4, startAngle: 0, origin: [0,0,0] }
  //      FORCE_DIRECTED: { repulsion, springLength, springTension, gravity, iterations }
  //      GRID: { columns, spacingX, spacingY, origin: [0,0,0] }
  //      CUSTOM: {}
}
```

**Timing: once.** Emitted at the program point the `LAYOUT <target> AS ...` statement
appears in source. Records the strategy + params on the target's layout metadata; does
**not** itself move any element — a `COMPUTE_LAYOUT` follows it (§1.3) to materialize
positions. Re-emitted (replacing the prior record) on every subsequent `LAYOUT` statement
for the same target — this is how mid-sequence re-layout (spatial spec §8.13) works.

If source has no `LAYOUT` statement for a structure, the generator synthesizes
`SET_LAYOUT_STRATEGY` with that structure's §4-table default immediately after its
`DECLARE` — this is the backward-compat seam (§4 below).

### 1.2 `SET_POSITION`

```ts
interface SetPositionInstruction extends AQIRInstruction {
  action: 'SET_POSITION';
  elementId: string;          // resolved scene-element id, e.g. "arr[2]" → "obj_arr_2"
  x: number | null;           // null = axis not overridden (LINE(spacing=...)-computed) or, when x=y=z=null, a full release
  y: number | null;
  z: number | null;
}
```

**Timing: once**, per `POSITION <target> AT (...)` statement occurrence. `x: number` pins
that axis; `x: null` means "this axis wasn't named in `AT(...)`, leave it to whatever the
active layout strategy computes." `POSITION target AT ()` (empty arg list, spatial spec
§3 "release") is `{ x: null, y: null, z: null }` and clears any prior pin, marking
`elementId` `layoutPinned: false` (see §2) so it rejoins the target's next
`COMPUTE_LAYOUT`.

### 1.3 `COMPUTE_LAYOUT`

```ts
interface ComputeLayoutInstruction extends AQIRInstruction {
  action: 'COMPUTE_LAYOUT';
  targetId: string;
}
```

**Timing: once**, emitted by the generator at two kinds of points:

1. Immediately after every `SET_LAYOUT_STRATEGY` for `targetId` (materializes the new
   strategy's positions for all of `targetId`'s current, non-pinned elements).
2. Immediately after every structure-mutating instruction affecting `targetId` — the
   `INSERT`/`DELETE`/`INSERT_HEAD`/`DELETE_TAIL`/... `GENERIC_ACTION`s. This generalizes
   and scopes today's `UPDATE_LAYOUT` (`packages/shared/src/aqir/types.ts:87-89`, always
   whole-scene, no target) and the direct `this.layoutManager.updateLayout(...)` calls
   `AnimationController` makes synchronously right after each mutation
   (`AnimationController.ts` INSERT/DELETE/REVERSE cases) — same effect, now an explicit,
   targeted AQIR instruction instead of an implementation detail. `UPDATE_LAYOUT` (no
   target, whole scene) remains valid as the untargeted legacy form; `COMPUTE_LAYOUT` is
   its VM-mode, per-structure replacement.

**Interaction with `INSERT`/`DELETE`**: a mutating instruction (`INSERT`, `DELETE`, ...)
always executes *first*, then `COMPUTE_LAYOUT(targetId)` follows immediately after it in
the instruction stream — mirroring the current runtime order (mutate `logicalIndex`s
synchronously, then call `updateLayout`, then enqueue tweens toward the freshly computed
`worldTarget`s). A `SET_POSITION` pin on an element that a later `DELETE` removes is
discarded along with the element; it does not need an explicit release. A `SET_POSITION`
for an element must appear *after* the instruction that creates that element (its
`INSERT`/`VERTEX`/etc.) — targeting an element id that doesn't exist yet is a compile-time
validation error, not a runtime concern of this opcode.

### 1.4 `SET_CAMERA`

```ts
interface SetCameraInstruction extends AQIRInstruction {
  action: 'SET_CAMERA';
  mode: 'FOCUS' | 'AUTO_FIT' | 'ORBIT' | 'POSITION';
  params: {
    targetId?: string;              // FOCUS: structure or indexed-element id
    speed?: number;                 // ORBIT: degrees/second
    x?: number; y?: number; z?: number; // POSITION: absolute camera location
  };
}
```

**Timing: once**, per `CAMERA ...` statement, at that point in the timeline. If source has
no `CAMERA` statement anywhere, the generator synthesizes
`SET_CAMERA { mode: 'AUTO_FIT', params: {} }` as instruction 0 (backward-compat, §4).

### 1.5 `SET_ROTATION`

```ts
interface SetRotationInstruction extends AQIRInstruction {
  action: 'SET_ROTATION';
  elementId: string;
  x: number; y: number; z: number;   // degrees, applied in X→Y→Z order
}
```

**Timing: once**, whenever emitted. **Not synthesized by today's compiler** — current
AQVL grammar (spatial-syntax-spec.md) has no statement that produces rotation, so no
existing or newly-compiled `.aqvl` program emits this opcode yet. It exists so the AQIR/VM
layer is ready for a future per-element orientation statement (or a `CUSTOM`-layout
orientation hint) without another IR revision. Absence for any element means rotation
`{0, 0, 0}` (§2).

### 1.6 `SET_SCALE`

```ts
interface SetScaleInstruction extends AQIRInstruction {
  action: 'SET_SCALE';
  elementId: string;
  x: number; y: number; z: number;   // multiplier; 1 = element's natural size
}
```

**Timing: once**, whenever emitted. Same forward-compatible status as `SET_ROTATION` — no
current grammar surfaces it. Distinct from the transient scale *tweens* `AnimationController`
already runs for feedback (highlight pulse to `1.15`, insert pop from `0`, etc. —
`AnimationController.ts` `HIGHLIGHT_OBJECT`/`INSERT` cases): those are animation-only and
snap back afterward; `SET_SCALE` sets an element's resting scale.

---

## 2. Extended animation frame

Two existing runtime types grow new optional fields. Both are additive — every field a
pre-geometry frame already had keeps its meaning and its absence-implies-default.

```ts
// packages/runtime/src/models/SceneElement.ts

export interface SceneElement {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
  emissiveIntensity: number;
  emissiveColor: string;
  state?: SemanticState | string;
  isHighlighted?: boolean;
  highlightType?: string;
  logicalParent?: string;
  originalType?: string;
  lifecycleState?: LifecycleState;
  visible?: boolean;
  opacity?: number;
  layoutSlot?: number | string;
  animationLayer?: boolean;
  worldTarget?: { x: number; y: number; z: number };

  /** NEW — degrees, X→Y→Z application order. Absent = {0,0,0} (SET_ROTATION never issued). */
  rotation?: { x: number; y: number; z: number };

  /**
   * NEW — true once a SET_POSITION pin is active for this element. Read by
   * LayoutManager: pinned elements are skipped when a COMPUTE_LAYOUT pass
   * recomputes their owning structure's strategy-driven positions. Cleared
   * by POSITION ... AT () (SET_POSITION with x=y=z=null) or by removal.
   */
  layoutPinned?: boolean;
}
```

```ts
// packages/runtime/src/models/SceneState.ts

export interface CameraFrameState {
  mode: 'FOCUS' | 'AUTO_FIT' | 'ORBIT' | 'POSITION';
  targetId?: string;                                  // FOCUS
  speed?: number;                                      // ORBIT, degrees/second
  position?: { x: number; y: number; z: number };      // POSITION
}

export interface SceneState {
  elements: Map<string, SceneElement>;

  /** NEW — current camera mode/params. Absent = AUTO_FIT (today's always-on CameraRig behavior, unchanged). */
  camera?: CameraFrameState;

  description?: string;
  timeMs?: number;
}
```

Every element visible in a frame resolves `position` (required, as today) and, when
present, `rotation`/`scale` — a frame never needs a separate lookup to know where or how
an element is oriented; `SceneElementRenderer` reads `element.rotation ?? {x:0,y:0,z:0}`
the same way it already reads `element.scale`.

---

## 3. Coordinate system

| Aspect | Definition |
|---|---|
| **Up-axis** | **Y.** Every existing height/level axis already uses Y: `StackLayoutStrategy`'s vertical axis, `TreeLayoutStrategy`'s per-depth axis (`origin=(0,2,0)`, root above children), `CameraRig`'s tree-aware Y-centering (`AQVECanvas.tsx:33`, `maxTreeY`). `LAYOUT`'s `axis=vertical` (spatial spec §1) means "along Y." |
| **Horizontal plane** | **X-Z.** X is the primary in-plane layout axis — `LINE(axis=horizontal)` runs along X, `HIERARCHY`'s sibling spread is along X, `CIRCULAR`/`GRID` lay out in the X-Z plane at a fixed Y. Z is depth: distinct top-level structures are separated by a constant `-6` per declaration order (spatial spec §4, `LayoutManager.ts:137`), and swap/insert tweens nudge Z transiently for visual "lift" (`AnimationController.ts` SWAP_OBJECTS: `z: worldTarget.z ± 1.5`). |
| **Units** | **Abstract**, not real-world (meters, etc.). Every existing constant (`spacing=2.2`, `radius=4`, element geometry ~1 unit) is a scene-scale number tuned for the default camera distance, not a physical unit. `SET_SCALE`'s multiplier (§1.6) is relative to an element's own abstract natural size, not to any absolute unit. |
| **Origin** | **World origin `(0,0,0)` is the anchor of the first-declared top-level structure's own origin.** Each structure gets its own `origin=(x,y,z)` param (`LAYOUT`'s `origin=`, §4 table) *within* its Z-depth slot — that param does not move the slot itself, only the structure's placement inside it. Camera defaults to looking at `(0,0,0)` (today's always-on `AUTO_FIT`, `controls.target` starts there) at Z-distance ~8-30 depending on scene span (`AQVECanvas.tsx:49-63`). |
| **Rotation representation** | AQIR/`SET_ROTATION` carries **degrees** (author/IR-facing, matches `startAngle` already being degrees in `CIRCULAR`, spatial spec §1). Conversion to radians for `three.js`/`SceneElementRenderer` consumption is a renderer-layer concern, not part of the frame contract — the frame always carries degrees. |

---

## 4. Backward compatibility

**Guarantee**: an AQIR program containing none of the six opcodes above compiles and runs
identically to today, byte-for-byte in the resulting `SceneElement` frames (module the two
new optional fields simply being absent).

Mechanism — the generator/runtime treats absence as sugar for an implicit prefix, exactly
per spatial-syntax-spec.md §6:

1. **No `SET_LAYOUT_STRATEGY` for structure X** ⇒ the runtime's existing type-inference
   default applies unchanged (`LayoutManager`'s `ArrayLayoutStrategy`/`TreeLayoutStrategy`/
   `GraphLayoutStrategy`/... dispatch by `DECLARE` type, already in place). This is
   equivalent to the generator synthesizing `SET_LAYOUT_STRATEGY { targetId: X, strategy:
   <spatial-syntax-spec.md §4 default row for X's DECLARE type>, params: <that row's
   defaults> }` right after X's `DECLARE`, and a `COMPUTE_LAYOUT { targetId: X }` right
   after that.
2. **No `SET_CAMERA` anywhere** ⇒ equivalent to a synthesized
   `SET_CAMERA { mode: 'AUTO_FIT', params: {} }` as instruction 0 — the verbatim
   restatement of today's always-on `CameraRig` (0.04 lerp rate, `spanX>6` zoom-out
   threshold, tree-aware Y centering).
3. **No `SET_POSITION`** for an element ⇒ `layoutPinned` is never set on it; it is
   recomputed by every `COMPUTE_LAYOUT` pass for its structure, same as every element is
   unconditionally repositioned by `layoutManager.updateLayout()` today.
4. **No `SET_ROTATION`/`SET_SCALE`** ⇒ `rotation` stays absent (renderer treats as
   `{0,0,0}`); `scale` is driven exclusively by the existing animation-tween logic, exactly
   as today — these two opcodes add a capability, they don't gate an existing one.
5. A renderer/VM built against the geometry extension that receives an **old, pre-geometry
   AQIR program** (no `objects`/`instructions` referencing any of the six opcodes) falls
   back to (1)-(4) uniformly: no crash, no missing visuals, output identical to running
   that program on today's compiler/runtime.

**Not backward-compatible by nature (new, opt-in only, cannot regress anything)**:
`CAMERA ORBIT`/`SET_CAMERA{mode:'ORBIT'}`, the `CUSTOM` layout strategy, and
`SET_ROTATION`/`SET_SCALE` altogether — none have a prior equivalent, so they only affect
programs that explicitly opt in.

---

## 5. Worked example

Source (spatial-syntax-spec.md §8.10 — camera pin + layout + per-element position override):

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

### Compiled `objects` (unchanged shape — `AQIRObject[]`, one per array element)

```json
[
  { "id": "obj_arr_0", "type": "ARRAY_ELEMENT", "logicalParent": "arr", "logicalIndex": 0, "value": 5 },
  { "id": "obj_arr_1", "type": "ARRAY_ELEMENT", "logicalParent": "arr", "logicalIndex": 1, "value": 3 },
  { "id": "obj_arr_2", "type": "ARRAY_ELEMENT", "logicalParent": "arr", "logicalIndex": 2, "value": 8 },
  { "id": "obj_arr_3", "type": "ARRAY_ELEMENT", "logicalParent": "arr", "logicalIndex": 3, "value": 1 },
  { "id": "obj_arr_4", "type": "ARRAY_ELEMENT", "logicalParent": "arr", "logicalIndex": 4, "value": 9 }
]
```

### Compiled `instructions` (full AQIR sequence, in program order)

```json
[
  { "action": "SET_CAMERA", "mode": "POSITION", "params": { "x": 0, "y": 6, "z": 14 } },

  { "action": "SET_LAYOUT_STRATEGY", "targetId": "arr", "strategy": "LINE",
    "params": { "spacing": 1.5, "axis": "horizontal", "origin": [0, 0, 0] } },
  { "action": "COMPUTE_LAYOUT", "targetId": "arr" },

  { "action": "SET_POSITION", "elementId": "obj_arr_2", "x": 5, "y": 2, "z": 0 },

  { "action": "HIGHLIGHT_OBJECT", "targetId": "obj_arr_2", "color": "SUCCESS" },
  { "action": "WAIT" }
]
```

### Resulting frame after instruction 4 (`SET_POSITION`) — the interesting one

```ts
sceneState.elements.get("obj_arr_2") === {
  id: "obj_arr_2",
  type: "box",
  position: { x: 5, y: 2, z: 0 },     // pinned coordinate, not LINE's computed x=1.5*(2-2)=0-offset slot
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 },     // SET_ROTATION never issued
  color: "#...",
  layoutPinned: true,                 // excluded from arr's next COMPUTE_LAYOUT
  logicalParent: "arr",
  logicalIndex: 2,
  // ...
}

sceneState.camera === {
  mode: "POSITION",
  position: { x: 0, y: 6, z: 14 }
}
```

Elements `obj_arr_0/1/3/4` sit at `LINE(spacing=1.5, axis=horizontal, origin=(0,0,0))`'s
computed slots (`x = 1.5 * (logicalIndex - 2)`, `y = 0`, `z = 0`), unaffected by
`obj_arr_2`'s pin — exactly matching spatial-syntax-spec.md §3's "nudges only the named
axes, leaving the rest on the strategy's line" semantics translated into this IR.
