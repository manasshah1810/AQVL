# Array Element Visual Language Spec

Design spec for Phase 3 — every color, shape, and transition here is meant to be implemented as written, not interpreted. This extends, rather than replaces, AQVL's existing theme system so array elements stay visually consistent with every other structure (trees, graphs, linked lists) that already consumes the same tokens.

## 0. Foundation — reuse the existing token system

AQVL already has a repo-wide 8-state semantic palette (`packages/shared/src/theme/semanticColors.ts:19-76`) plus a parallel highlight-accent palette with a 9th state, `FOCUS` (`packages/shared/src/theme/highlightStyle.ts:30-55`), and a material system that already gives array elements a "premium" look: `RoundedBox` geometry with 0.1 bevel radius, roughness 0.2 / metalness 0.1 (`materialSystem.ts:33-41`), rendered inside a scene with `Environment preset="city"` reflections, soft `ContactShadows`, and a near-black `#111111` background (`AQVECanvas.tsx:52-80`). This is the correct look-and-feel baseline — dark, glassy, reflective, glowing-on-emphasis — and the array-specific work is choosing **which existing token maps to which array state**, filling the two gaps that don't yet exist (a comparison beam, a partition/sorted-region boundary marker), and adding non-color redundant cues, since 6 of the 9 existing tokens are colors alone with no accompanying shape/motion differentiation today.

Existing tokens (color / emissive / current meaning per the palette source comments):

| Token | Color | Emissive | Existing meaning |
|---|---|---|---|
| `NEUTRAL` | `#38bdf8` (sky blue) | `#0284c7` | idle |
| `EVALUATING` | `#f59e0b` (amber gold) | `#fbbf24` | comparison / evaluation |
| `TRAVERSING` | `#06b6d4` (vivid cyan) | `#22d3ee` | pointer / scan / search |
| `MODIFYING` | `#ec4899` (electric pink) | `#f472b6` | swap / insert / update |
| `SUCCESS` | `#10b981` (emerald) | `#34d399` | confirmation / sorted / found |
| `DISCARDED` | `#6b7280` (slate gray), opacity 0.4 | `#1f2937` | out of scope / eliminated |
| `AUXILIARY` | `#a855f7` (royal violet) | `#c084fc` | helper / temporary structure / **boundary** |
| `STRUCTURAL` | `#6366f1` (indigo) | `#818cf8` | hierarchy roles (not array-relevant) |
| `FOCUS` (highlight-only) | `#a78bfa` (luminous purple) | `#8b5cf6` | pivot / mid / root / target |

**Flag for Phase 3**: `AUXILIARY` (`#a855f7`) and `FOCUS` (`#a78bfa`) are two different violets with overlapping intent (`AUXILIARY`'s own comment says "boundary"; `FOCUS`'s says "pivot / mid element / boundary" — literally duplicated). This spec resolves the overlap by reserving `FOCUS` strictly for an **element state** (the pivot/candidate itself) and `AUXILIARY` strictly for **non-element scene geometry** (boundary markers, beams) — see §4. This is a reassignment of intent, not a new color, so it requires no new hex value, only a documented convention Phase 3 should follow.

---

## 1. Element visual states

Every state below specifies: exact color, a **non-color distinguishing cue** (required so colorblind viewers — the most common forms confuse red/green and blue/purple — never rely on hue alone), and how it differs from its visual neighbors.

### 1.1 Default / untouched
- **Color**: `NEUTRAL` `#38bdf8` / emissive `#0284c7`, emissive intensity 0.1 (dim, present but not glowing).
- **Non-color cue**: flat, minimal specular pop, no ring, no pulse, no scale boost — visually "at rest." This is the baseline every other state is judged against.
- **Shape/scale**: 1.0× base scale.

### 1.2 Being compared (linked pair)
- **Color**: `EVALUATING` `#f59e0b` / emissive `#fbbf24`, emissive intensity ramps 0.1 → 0.7.
- **Non-color cue**: the two compared elements **lift together** (`y += 0.3`, matching the existing COMPARE choreography in `AnimationController.ts:449-471`) and pulse in sync at a *distinct pulse frequency from every other active state* — see the frequency table in §1.9. Critically, both elements must be visually **linked**, not independently highlighted: a **comparison beam** connects them for the full duration of the comparison (design in §4.1). The beam, not the shared color, is the primary "these two are a pair" signal, since color alone can't distinguish "these two happen to both be amber" from "these two are linked."
- **Outcome divergence** (closes the audit's biggest narrative gap): the instant the comparison resolves, the *losing* element (the one that will move, per whatever operation follows) tints toward `MODIFYING`'s pink before the beam fades, while the element that stays put settles back toward `NEUTRAL` — so the viewer sees the decision, not just the act of comparing, purely from color transition timing.

### 1.3 Being swapped (in motion)
- **Color**: `MODIFYING` `#ec4899` / emissive `#f472b6`, emissive intensity 0.7, held constant for the full motion.
- **Non-color cue**: physical arc motion — see §3.1 for the exact path. The scale boost (1.1×–1.2×) plus a brief motion-blur-style trailing ghost (a low-opacity duplicate mesh fading over ~150ms behind the moving element, reusing the `EDGE` material category's transparency handling) reads as "moving with intent," distinct from a comparison's in-place pulse which has zero position delta.
- **Distinguishing from COMPARE**: COMPARE lifts and holds in place; SWAP lifts and *translates*. Even without color, the presence/absence of net lateral displacement is itself a redundant cue.

### 1.4 Confirmed in final sorted position
- **Color**: `SUCCESS` `#10b981` / emissive `#34d399`, emissive intensity 0.5, then **decays to a steady low glow (~0.2) once settled** — this state is persistent (holds until the run resets), unlike every other state in this table which is transient.
- **Non-color cue**: no pulse at all once settled (pulse = "still being evaluated," steady = "done" — silence-as-signal). A thin glowing floor-level strip appears beneath the element and merges into the growing sorted-region marker (§4.3) — this is what makes "confirmed" visually different from a search "confirmed match" (§1.6), which uses the same green but never gets a floor strip.
- **Shape**: returns to 1.0× scale (no scale boost) — a settled element should look calm, not emphasized, since persistent + glowing + pulsing + scaled-up would read as "still important" when the point is "this is finished and no longer needs attention."

### 1.5 Currently selected/focused (e.g., pivot)
- **Color**: `FOCUS` `#a78bfa` / emissive `#8b5cf6` (reassigned to element-only use per §0).
- **Non-color cue**: a **static** (non-pulsing) elevated position — lifted and held at `y += 0.5` for the entire duration it holds pivot status, not just during a single animation beat. This is the one state that should look "held," not "active-right-now," since a pivot can remain selected across many comparisons. A thin vertical marker line from the element down to the floor plane reinforces "this one is anchored/important" even at a glance from any camera angle.
- **Shape**: subtle scale boost (1.1×) held steady, not pulsing — visually distinct from EVALUATING's pulsing 1.15× and MODIFYING's transient 1.2×.

### 1.6 Being searched / candidate match
- **Color**: `TRAVERSING` `#06b6d4` / emissive `#22d3ee`, emissive intensity 0.6.
- **Non-color cue**: a fast, low-amplitude "scan flicker" — brief opacity dip to 0.7 and back over ~150ms as the search cursor passes through, distinct from EVALUATING's slower symmetric pulse. This is meant to feel like a flashlight beam passing over the element, not a deliberate pause.
- **Distinguishing from EVALUATING**: TRAVERSING never lifts (`y` unchanged); EVALUATING always lifts. Motion-axis difference is the redundant cue.

### 1.7 Confirmed match (search found)
- **Color**: `SUCCESS` `#10b981` / emissive `#34d399`, same hue as sorted-confirmation (§1.4) deliberately, since both mean "this is correct, stop looking further here" — but differentiated structurally:
- **Non-color cue**: a **"target-lock" double-ring pulse** — two concentric rings expand outward from the element and fade, once, on confirmation (using the existing `HighlightRing` component's ring geometry, but two rings offset by ~100ms rather than the single static ring currently used) — then the element holds a steady glow with **no floor strip** (the floor strip is reserved for the cumulative sorted-region marker, which a single found match in a search is not part of). This is the concrete answer to "how is found-in-a-search visually different from sorted": ring-burst-then-steady vs. floor-strip-and-merge.

### 1.8 Out of range / excluded (e.g., outside current partition bounds)
- **Color**: `DISCARDED` `#6b7280` / emissive `#1f2937`, opacity dropped to 0.4 (all values already defined exactly this way in the existing token, `semanticColors.ts:55-61` — no change needed).
- **Non-color cue**: desaturation is itself partially colorblind-safe (gray reads as "dimmed" independent of hue perception), reinforced by the opacity drop to 0.4 (translucency is a non-color, universally perceptible cue) and **disabling all interaction affordances** — excluded elements never pulse, never lift, never participate in a comparison beam even if the underlying algorithm technically touches them (defensive: if code ever does compare against an out-of-partition element by mistake, it should not visually read as an active comparison).
- **Shape**: scale drops slightly to 0.92× — a small, deliberate shrink (not just color/opacity) makes "excluded" readable even in a black-and-white screenshot.

### 1.9 Redundant-cue summary table (accessibility cross-check)

| State | Pulse? | Lift (Δy)? | Lateral motion? | Scale | Persistent? |
|---|---|---|---|---|---|
| Default | no | no | no | 1.0× | — |
| Compared | yes, 5 Hz sync pair | +0.3 | no | 1.15× | no |
| Swapped | no (motion itself is the cue) | +1.8 during arc | yes | 1.1-1.2× | no |
| Sorted-confirmed | no (silence = done) | no | no | 1.0× | **yes** |
| Focused/pivot | no (static hold) | +0.5, held | no | 1.1×, held | while pivot holds |
| Searching | flicker, ~150ms | no | no | 1.0× | no |
| Found-match | one-shot double ring | no | no | 1.0× after burst | yes (until reset) |
| Excluded | no | no | no | 0.92× | while excluded |

No two states share the same combination of (pulse behavior, lift, lateral motion, persistence) — this table is the actual accessibility guarantee, not the color table above.

---

## 2. Element shape and material

- **Base shape**: keep `RoundedBox` (`args=[1,1,1]`, bevel radius 0.1, smoothness 4) — already implemented (`PrimitiveNode.tsx:124-131`) and appropriately distinctive against spheres (used for other structures) without inventing a new geometry that would break visual continuity across data-structure types. No change recommended here; a bespoke "array-only" shape would fight consistency for no clarity gain.
- **Value display**: keep the floating 3D `Text` centered in front of the box (`fontSize 0.4`, white, `PrimitiveNode.tsx:182-192`) as the primary legible value — this already works and is legible. Do **not** move to an "engraved on the face" approach (harder to light/read at oblique camera angles against a rotating/arcing element mid-swap); floating billboard text stays readable through motion since it can face the camera continuously.
- **Index label**: keep the secondary gray `arr[i]`-style label below the box (`fontSize 0.25`, `#aaaaaa`, `PrimitiveNode.tsx:194-204`), but it must update **only after** a swap/insert/delete's position animation completes (already true for SWAP per the audit's confirmed callback-timing finding) — this is a behavioral note for Phase 3/4, not a new visual element.
- **Optional magnitude-height mode**: for numeric arrays, offer an opt-in "bar mode" where element height scales with value (`scale.y = baseHeight * (value / maxValueInArray)`, clamped to a minimum of ~0.3× so zero/near-zero values remain visible boxes rather than disappearing slivers) while width/depth stay fixed at 1.0 — this gives a bar-chart read of relative magnitude at a glance, in addition to the printed number, without changing the box-family shape language. This should be a toggle, not the default: default stays uniform-size boxes (matches every other structure's node sizing and keeps focus on position/color storytelling per the excellence spec), and bar mode is offered specifically for array/sorting contexts where relative magnitude is pedagogically central. When bar mode is active, vertical growth should itself animate (ease in/out, not snap) whenever a value updates, giving UPDATE a visible magnitude-change cue it currently lacks entirely (audit found UPDATE has no visual differentiation of old-vs-new value).
- **Material/lighting**: no divergence from the existing premium setup (`Environment preset="city"`, `ContactShadows`, roughness 0.2/metalness 0.1) — array elements should look identical in material quality to every other structure; distinctiveness comes from the states/motion/beams in this document, not a separate material tier. Introducing an array-specific material would fragment the "one coherent product" feel the excellence spec's success criteria implicitly assume (an observer shouldn't feel like they've switched apps between visualizing a tree and an array).

---

## 3. Motion vocabulary

### 3.1 Swap — the arc path

Elements must never travel in a straight line through each other's old position (reads as a glitch/pass-through). Path, viewed from above (top-down, X = array axis, Z = depth):

```
Before:      A@i ---------------------------- B@j
                    (adjacent or distant, same Z=0 line)

Arc phase:   A rises to y+1.8, moves along X toward j's slot,
             offset to Z = +1.5 (in front of the baseline)
             B rises to y+1.8, moves along X toward i's slot,
             offset to Z = -1.5 (behind the baseline)

             Top-down view during crossing:
                    A ─────────────╮
                                    ╲
              ­­Z=+1.5 ───────────────╲──────────────
              Z=0    i ─ ─ ─ ─ ─ ─ ─╲─ ─ ─ ─ ─ ─ j
              Z=-1.5 ──────────────╱───────────────
                                  ╱
                    B ───────────╯

After:       A settles at j's slot (Z back to 0, y back to floor, bounce)
             B settles at i's slot (Z back to 0, y back to floor, bounce)
```

The two elements pass at different depths (Z offset) so their paths never intersect on screen even when the array is viewed dead-on, which is what makes the crossing read unambiguously as "these two traded places" rather than "one vanished as the other appeared." Landing uses an overshoot-bounce (per the excellence spec's weight/anticipation principle), not a hard stop. **This must be the single implementation for all swaps** — the audit found builtin-sort swaps currently skip the arc/lift entirely and use a flat tween; that inconsistency should not survive into Phase 3's implementation.

### 3.2 Compare (no swap results) — the pulse-and-release

Both elements lift together (§1.2), hold at peak for a brief pause (long enough to register as a deliberate decision beat, not a flicker), then release back down in sync. The comparison beam (§4.1) draws in during the lift and fades during the release — the beam's presence is what turns "two elements happened to glow at the same time" into "a decision is being made about these two specifically." If the comparison *does* trigger a subsequent swap, the release phase blends directly into the swap's arc lift (no full return-to-neutral in between) — the two motions should feel continuous, not sequential-and-separate, since they represent one causal event (compare → decide → act).

### 3.3 Insert — making room

1. All elements from the insertion point rightward begin sliding to their new slot **immediately and simultaneously** (not staggered one-by-one, which would look like a slow mechanical shuffle) — the whole affected region moves as one coordinated block.
2. The new element's entry point should be visually motivated: rather than spawning at an arbitrary fixed off-screen coordinate (the audit's finding for current behavior), it should rise up from directly below its destination slot — "arriving from below" reads as "a new thing entering the structure" without implying it came from anywhere specific in the data, which is honest given the language doesn't currently carry a source-value origin.
3. Landing uses the bounce-and-scale-pop already implemented (`easeOutBounce`/`easeOutBack`, audit §INSERT) — keep this, it already satisfies the weight/anticipation principle.

### 3.4 Delete — closing the gap

1. The deleted element's pre-removal beat (§1.8's "about to be removed" framing, borrowing `DISCARDED` gray) should show *before* the shrink starts — a brief (~150ms) desaturation flash, not an instant cut to shrinking, so the viewer has a moment to register "this one is leaving" before it's gone.
2. Shrink-and-lift-away uses accelerating motion (ease-in, not linear) — consistent with §1.1's "things falling away speed up" principle.
3. Once the gap opens, remaining elements slide left as one coordinated block (same "move together, not staggered" rule as insert) and should have a small settle-bounce on arrival at their new slot, not a hard stop — small enough not to look bouncy/silly for a routine shift, but present enough to avoid the "snapped into place" mechanical feel.

---

## 4. Connecting / relationship indicators

### 4.1 Comparison beam

A thin, glowing tube/line primitive (`EDGE` material category already exists for exactly this purpose: roughness 0.3, metalness 0.2, transparent, `materialSystem.ts:42-50`) drawn between the two compared elements' centers, arcing slightly upward (matching their lifted `y` position) rather than a flat straight segment through the floor:

```
        ╭──────────────╮
       ╱   (amber beam)  ╲
      ●                    ●
   arr[i]                arr[j]
   (lifted,               (lifted,
    pulsing amber)         pulsing amber)
```

- **Color**: `EVALUATING` amber `#f59e0b`, opacity ramping 0 → 0.85 as the beam "draws in" over the first ~150ms of the comparison (using the existing draw-in easing pattern from `easeOutExpo` lifts elsewhere in the system), rather than snapping to full opacity instantly.
- **On resolution**: the beam's midpoint briefly flashes toward whichever side "won" (tints toward that element's outgoing color, e.g. pink if that element is about to move) before fading out — a compact way to show the *outcome* spatially, complementing the element-level color divergence in §1.2.
- **Thickness**: constant regardless of the distance between compared elements (a far-apart comparison, e.g. in merge sort, still gets a full beam spanning the gap) — this is important because the excellence spec's merge-sort signature depends on being able to see two distant regions related to each other, which a beam does and a shared color alone does not.

### 4.2 Partition boundary indicator (quicksort-style)

A vertical, translucent plane (or a floor-level bracket if a full plane is visually heavy) positioned at the boundary between the current active partition and everything outside it, using the `AUXILIARY` violet token (`#a855f7`, already commented in source as "helper / temporary structure / boundary" — exactly this use case, `semanticColors.ts:62-68`):

```
   [confirmed]  |  ACTIVE PARTITION (normal brightness)  |  [excluded, dimmed]
   ░░░░░░░░░░░  ┃                                        ┃  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                ┃←── violet boundary plane, semi-transparent
```

The boundary should move (slide along X) rather than jump-cut whenever the partition narrows (e.g., after a pivot lock-in splits the region), reinforcing the "the working region is shrinking" narrative from the excellence spec's algorithm-distinguishability section. Elements outside the plane's bounds get the `DISCARDED` treatment from §1.8 automatically — the boundary plane and the excluded-element dimming should always be kept in sync (driven by the same partition-bounds data), never animated independently, to avoid a boundary that visually disagrees with which elements are actually dimmed.

### 4.3 Sorted-region boundary / progress marker

A thin glowing strip along the floor beneath the array, in `SUCCESS` green (`#10b981`), that grows to cover exactly the elements currently in `SUCCESS`-confirmed state (§1.4):

```
   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ░░░░░░░░░░░░░░░░░░░░░░
   ══════════════════════
   ↑ sorted-region strip (grows left→right as elements confirm)
```

- The strip's leading edge should ease forward (not snap) each time a new element joins the confirmed region, giving a continuous "progress bar" feel rather than a stepped one.
- For algorithms whose confirmed region isn't a single contiguous block from one end (this shouldn't occur for the sorts currently implemented, all of which confirm monotonically from an end — flagged here only so Phase 3 doesn't need to design for a non-contiguous case unless a future algorithm requires it).
- This is the same visual object referenced as the "growing/shrinking active region" signature in the excellence spec's per-algorithm section (§2 there) — for Bubble Sort the *inverse* framing applies (the strip grows from the unsorted end backward, since bubble sort confirms the max/min to one end per pass); the strip should support growing from either end depending on which end the algorithm confirms toward, driven by algorithm-provided bounds data rather than being hardcoded to "always grows left-to-right."
