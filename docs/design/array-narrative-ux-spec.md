# Array Narrative Layer — UX Spec

Concrete UX design for "why is this happening," building on the three options raised in `array-animation-excellence-spec.md` §3 (A: caption text, B: spatial reason-indicator, C: progress/confirmation marker) and consistent with the states/beam/boundary-marker designs already fixed in `array-visual-language-spec.md`. Where a feature depends on data identified as missing in `array-aqir-semantic-gap.md`, that dependency is called out explicitly rather than assumed solvable in the UI layer alone.

---

## 1. Step-description text system

### Placement decision

**A slim, persistent bar docked to the bottom edge of the canvas** (not a sidebar, not floating text anchored to elements, not the current fully-separate `RuntimeOutputPanel` console).

Rationale, weighed against the alternatives:
- **Not a sidebar**: a persistent side panel steals horizontal canvas width, which actively fights the excellence spec's camera-framing work (§1.3 there) — a narrower viewport means less room for the camera to reframe toward a comparison pair without elements crowding the remaining edge. A sidebar is also spatially far from the action, defeating the "don't make the viewer look away" argument the excellence spec makes against a pure text-only channel.
- **Not floating text anchored to elements**: the visual-language spec already reserves the space directly around active elements for the comparison beam (§4.1 there), the pivot's vertical anchor line (§1.5), and the partition boundary plane (§4.2). Stacking caption text into that same visual field would compete with those elements rather than support them, and floating text has to constantly reposition and re-orient to face the camera as elements move — an unnecessary implementation burden for content that doesn't need to be spatially attached to be understood.
- **Not the current separate DOM console** (`RuntimeOutputPanel`): the audit's narrative-gap finding is specifically that this text exists but is too far from the canvas to be read without looking away — keeping it as a fully separate panel doesn't fix the gap, it just documents it more precisely.
- **Bottom bar wins because**: it's immediately below the canvas (minimal eye travel — a single downward glance, not a sideways scan to a distant panel), it doesn't consume canvas width (only a fixed ~15-20% strip of height, collapsible), and it doesn't visually collide with in-scene indicators since it lives in its own screen region entirely below the 3D viewport.

**Detail: two-line layout inside the bar.**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Comparing arr[2]=7 and arr[3]=3 — 7 > 3, so they will be swapped    │  ← line 1: current step (§1.2 below)
│  Quick Sort · Partitioning [0-7]     Pass —     Sorted: 0 of 8        │  ← line 2: identity + progress (§2, §3)
└──────────────────────────────────────────────────────────────────────┘
```
Line 1 is the per-step narrative text (this section). Line 2 is the persistent algorithm-identity + progress readout (§2 and §3 below) — kept on the same bar but visually separated (smaller/dimmer type, always-present regardless of whether a step is mid-flight) so a viewer can tell "what's happening right now" from "where are we overall" without the two competing for the same line of attention. The existing detailed `RuntimeOutputPanel` console remains available as an optional expandable drawer beneath this bar for viewers who want the full scrollback (search results, error messages, non-array narration) — this spec does not remove it, it demotes it from primary to secondary channel.

**Timing**: line 1's text updates in sync with the *start* of each operation's animation (not after it completes), so the caption is available to read throughout the motion rather than appearing only once the visual has already resolved — consistent with the visual-language spec's comparison-beam draw-in timing (both should begin together).

### Text templates

Ten templates covering the operation range. `{arr}` = array name, `{i}`/`{j}` = indices, `{v}` = value. Bracketed alternates show the outcome-dependent branch where relevant.

1. **Compare, outcome pending** *(shown for the lift/beam-draw-in phase before resolution — see §4 on why this exists as a distinct beat)*:
   `Comparing {arr}[{i}]={v1} and {arr}[{j}]={v2}`

2. **Compare, resolved — will swap**:
   `{v1} > {v2} — {arr}[{i}] and {arr}[{j}] will be swapped`

3. **Compare, resolved — already in order**:
   `{v1} ≤ {v2} — already in order, no swap needed`

4. **Swap, in motion**:
   `Swapping {arr}[{i}] and {arr}[{j}]`

5. **Finalize (bubble/selection/insertion confirming a position)**:
   `{arr}[{i}] has reached its final sorted position`

6. **Pivot selection (quicksort)**:
   `Selecting {arr}[{i}]={v} as the pivot for this partition`

7. **Pivot lock-in + split (quicksort)**:
   `Pivot {v} locked into its final position at {arr}[{i}] — partition splits into [{left}-{i-1}] and [{i+1}-{right}]`

8. **New running candidate (selection sort)**:
   `New minimum found: {arr}[{i}]={v} is now the candidate`

9. **Merge step (merge sort)**:
   `Merging sorted runs [{left}-{mid}] and [{mid+1}-{right}]`

10. **Insert / Delete / Update (mutation operations, unchanged in kind from what the audit found already correct in content)**:
    `Inserting {v} at index {i} — elements shifted right` / `Removing {arr}[{i}] — elements shifted left to close the gap` / `{arr}[{i}] updated from {oldV} to {v}`

11. **Search — candidate check**:
    `Checking {arr}[{i}]={v} — is this the target {target}?`

12. **Search — confirmed match**:
    `Found! {arr}[{i}]={v} matches the target`

(12 given rather than a strict 8-10, since search needed two templates and mutation ops share one line-shape across three operations — all read as concrete, low-ambiguity single sentences per the excellence spec's "no jargon, plain narration" intent.)

---

## 2. Algorithm identity display

A compact, always-visible chip on line 2 of the bottom bar (never a modal or a separate always-open panel — it should be readable at a glance, not something the viewer has to seek out):

```
Quick Sort · Partitioning [0-7]
```

- **Format**: `{Algorithm Name} · {Phase}`, where phase is itself contextual (partition bounds for quicksort, pass number for bubble/selection/insertion sort — see §3, merge range for merge sort). Not every algorithm has a "phase" beyond "running" (e.g. linear search has no sub-phase); in that case the chip simply reads `Linear Search` with no `·` separator, rather than inventing an artificial phase label.
- **Phase transitions**: when the phase segment changes (e.g. quicksort recursing into a new sub-partition, `[0-7]` → `[0-3]`), the text should cross-fade (not hard-cut) over ~200ms — consistent with the visual-language spec's general preference for eased transitions over snaps, and different enough from any operation-level pulse timing (§1.9 there) that a viewer doesn't confuse a phase change with an element-level highlight.
- **Nesting**: for divide-and-conquer algorithms with simultaneously-active sub-regions (merge sort's two concurrent runs, quicksort's post-split recursion), the chip shows the *currently narrated* region only — the one the step-description line (§1) is currently talking about — rather than trying to enumerate every simultaneously-active region in the chip itself. Simultaneity is communicated visually (multiple spatially-separated active regions on screen, per the excellence spec §2), not textually; the chip's job is to answer "what is the text below currently referring to," not "everything happening in parallel."

---

## 3. Progress / state summary

Also on line 2, positioned at the right edge of the bar (identity chip left-aligned, progress readout right-aligned — the two never need to share the same horizontal space since they answer different questions: "what algorithm/phase" vs. "how far along"):

- **Comparison-sweep sorts (bubble/cocktail)**: `Pass {n} of {est. max} · {k} of {m} comparisons this pass` — e.g. `Pass 2 of 7 · 3 of 6 comparisons this pass`. The "of {est. max}" figure is an upper bound (`n-1` passes for an n-element bubble sort), not a guarantee, since early termination (no swaps in a pass) can end the sort sooner — the label should say "of at most {n-1}" or drop the denominator entirely once an early-exit becomes likely, rather than presenting a countdown that could visibly overshoot expectations if the sort finishes early. Simpler alternative if that nuance is judged not worth the UI complexity: drop the "of N" denominator and show only `Pass 2 · 3 of 6 comparisons this pass`.
- **Selection/insertion sort**: `{k} of {n} elements confirmed sorted` — a plain count, always well-defined and monotonically increasing, no estimate needed.
- **Quicksort/merge sort**: `Sorted: {k} of {n} confirmed` using the same confirmed-count phrasing as above for consistency across algorithm families, even though the *mechanism* by which elements become confirmed differs per algorithm (this is deliberate — one shared progress vocabulary across all sort types, so a viewer who's watched one sort recognizes the same readout style in another, per the visual-language spec's cross-algorithm consistency principle).
- **Search algorithms**: `Checked {k} of {n} elements` (linear) or `Range narrowed to [{left}-{right}] ({k} elements remaining)` (binary/ternary/interpolation search) — the latter directly visualizes the shrinking-search-space narrative that binary search's whole pedagogical point depends on.

This progress readout **must update live, in sync with each FINALIZE/confirmation event** (§4 below), not on a timer or a fixed cadence — it is a direct reflection of algorithm state, not an independently-paced UI animation.

---

## 4. Pacing tied to narrative significance

The excellence spec (§1.5) and the semantic gap analysis (§1.5, §2 there) together establish which events are "decisive" vs. "routine," and what data each requires:

| Event | Significance | Dwell-time treatment |
|---|---|---|
| Routine compare, no swap follows | routine | fast: shortened lift/hold/release (~600-700ms total vs. the current ~1000ms), caption line 1 updates and clears quickly, no camera reaction beyond the default participant-focus |
| Decisive compare (immediately followed by a swap) | pivotal | full dwell: the existing ~1000ms compare beat is kept at full length or slightly extended (~1200ms), caption text includes the outcome clause ("…so they will be swapped" per template 2) rather than just "comparing," and this is the one compare variant that should visibly blend into the following swap's anticipation lift (per the visual-language spec §3.2) rather than fully releasing first |
| Ordinary swap (mid-array, not a lock-in) | pivotal-but-routine | standard full arc/lift/cross/drop per the visual-language spec's unified swap choreography — no further slow-down beyond what §3.1 there already specifies |
| FINALIZE (an element reaches its confirmed final position) | most significant | longest dwell of any per-element event: the settle-to-`SUCCESS`-green transition (visual-language spec §1.4) should hold slightly longer than a routine highlight before the progress readout (§3) increments, so the viewer has time to register "that one's done" before attention moves on; this is also the one event that should be allowed a brief camera acknowledgment (a small push-in or hold on the newly-confirmed element) per the excellence spec's "camera should mark decisive moments" principle |
| Pivot selection / pivot lock-in | most significant | pivot selection gets a held (non-pulsing) beat, consistent with the visual-language spec's "static hold" treatment for FOCUS state (§1.5 there); pivot lock-in is treated identically to FINALIZE above, plus the identity chip's phase-transition crossfade (§2) should be timed to begin exactly as lock-in resolves, not before or after, so the "partition splits" text change feels causally connected to the visual split rather than arbitrarily timed |
| Early-pass routine comparisons (e.g., bubble sort's first pass on a mostly-unsorted array) | low significance, high volume | these are the primary candidate for the "compress the obvious" side of variable pacing — if the redesign implements pass-aware pacing, early passes with many non-decisive comparisons should run at the fast tier above by default, not merely "possible to speed up," since the excellence spec explicitly calls out early-pass compression as part of what makes pacing feel intentional rather than arbitrary |

**What decides "decisive" vs. "routine"**: exactly the `decisive`/`pass` fields on `SortStep` proposed in the semantic gap analysis §1.5 (a `COMPARE` step immediately followed by a `SWAP` on the same pair) — this is runtime-computable today with zero schema change for builtin-sort scripts (the full step trace already exists before replay begins), but is a **genuine open gap for hand-written scripts** that call `COMPARE`/`SWAP` directly without going through a builtin sort keyword, per the gap analysis's finding that the VM executes one instruction at a time with no precomputed lookahead. See the backend-dependency table below for the exact scoping of this.

---

## 5. Backend dependency mapping

Every feature above, categorized by what it needs to be built:

| Feature | Category | What's needed |
|---|---|---|
| Bottom-bar placement, two-line layout, expandable console drawer | **Frontend-only** | Pure demo-app UI work; no runtime/AQIR dependency. Consumes the existing `RUNTIME_LOG` event stream, just renders it in a new location. |
| Templates 1, 4, 10 (compare-pending, swap, insert/delete/update) | **Frontend-only** | Content for these is already correct and available today per the audit — the values, indices, and array name are already in the existing `RUNTIME_LOG` text; this is a re-templating/re-styling task, not new data. |
| Templates 2, 3 (compare outcome — "will be swapped" / "no swap needed") | **Runtime handler fix, no AQIR schema change** | Per the semantic gap analysis §1.2, the outcome is computed today but too late (inside the animation-complete callback) to drive anything but the log text. Fix: move the comparator evaluation earlier in `AnimationController.ts`'s `COMPARE_OBJECTS` handler (and `SortAlgorithms.ts`'s inline compare branch) so it's available at caption-render time. No new instruction field required — `leftEl.value`/`rightEl.value` are already populated before the handler runs. |
| Template 5 (Finalize) | **New runtime-internal data (`SortStep` enrichment), not AQIR** | Requires the `FINALIZE` `SortStep` variant proposed in the semantic gap analysis §2 — a new field/variant on `SortEngine.ts`'s step model, populated inside the existing sort loops. No compiler or AQIR instruction change, since builtin sorts never surface algorithm structure to AQIR in the first place (confirmed §0 of that document). |
| Template 6, 7 (pivot selection, pivot lock-in + split) | **New runtime-internal data** | Pivot selection already has a `PIVOT` step (supported today); lock-in needs the same `FINALIZE` reuse as above, plus `left`/`right` partition-bounds fields on the relevant `SortStep` variants (per the gap analysis's Quick Sort section) so the caption can name the split ranges. Runtime-internal only. |
| Template 8 (selection sort candidate) | **New runtime-internal data** | Needs either a `candidate` field on the `COMPARE` step or a dedicated `CANDIDATE` step variant, per the gap analysis's Selection Sort section — runtime-internal, populated from `minIdx`, already in scope in the existing loop. |
| Template 9 (merge step) | **New runtime-internal data** | Needs `left`/`mid`/`right` fields attached to `COMPARE`/`OVERWRITE` steps inside `merge()`, per the gap analysis's Merge Sort section — runtime-internal; note the gap analysis's flagged open question about whether a simple depth check is sufficient to detect the *globally final* merge for progress-counting purposes (§3 below inherits this same open question). |
| Templates 11, 12 (search checking / found) | **Frontend-only** | Search operations already emit sufficient data today (candidate index/value, target value) via existing `HIGHLIGHT`/`COMPARE` instructions and `RUNTIME_LOG` text — this is a re-templating task like the mutation-operation templates. |
| Algorithm identity chip — name | **Frontend-only** | The algorithm name is already known at script level (`actionName:'BUBBLE_SORT'` etc. on the `GENERIC_ACTION` instruction, per the gap analysis §0) — trivially available without any new data. |
| Algorithm identity chip — phase (partition bounds / pass number / merge range) | **New runtime-internal data** | Depends on the same `left`/`right`/`pass` fields requested above for quicksort/merge/bubble sort — no separate new mechanism, this reuses the exact same `SortStep` enrichment already listed for the text templates. |
| Progress readout — pass/comparison counts (bubble, selection, insertion) | **New runtime-internal data (`pass` field)** | Per the gap analysis §1.5, `pass` is trivially attachable at push time from the existing outer-loop index, but isn't attached today. Runtime-internal, no AQIR change. |
| Progress readout — confirmed-count (all algorithms) | **New runtime-internal data** | Directly depends on the `FINALIZE` step existing and being counted by the replay loop — same dependency as template 5, not a separate gap. |
| Progress readout — binary-search range narrowing | **Frontend-only** | The search bounds are already implicit in which indices get `HIGHLIGHT`/`TRAVERSING` treatment per existing instructions; deriving "range narrowed to [x-y]" is a frontend computation over already-emitted highlight events, not new backend data. |
| Pacing — routine vs. decisive compare (builtin-sort scripts) | **New runtime-internal data (`decisive` field)**, buildable today | Per the gap analysis §1.5, the full step trace already exists in memory before replay for builtin sorts — attaching `decisive: boolean` at push time (known the instant the swap-or-not branch resolves, one line after the comparison) requires zero AQIR/compiler change. |
| Pacing — routine vs. decisive compare (hand-written `COMPARE`/`SWAP` scripts) | **Open gap, VM/controller-level, not simply "add a field"** | Per the gap analysis §1.5, there is no precomputed lookahead for direct-script instruction sequences — the VM executes one instruction at a time. Two paths, neither of which is "add a field to `CompareObjectsInstruction`": (i) a runtime one-to-few-instruction lookahead inside the VM/`AnimationController` (peek the next few instructions in the already-flat instruction array for a same-pair `SWAP_OBJECTS`), or (ii) accept coarser pacing for hand-written scripts and reserve fast/slow pacing for builtin-sort-driven comparisons only. This spec does not resolve which; flagged here as the one pacing feature that is not simply "runtime enrichment," since it may require VM/controller logic changes beyond a data-model addition. |
| Pacing — FINALIZE/pivot-lock-in extended dwell + camera acknowledgment | **New runtime-internal data + a camera-focus mechanism** | The dwell-timing part is a rendering/handler change once `FINALIZE` exists (no further new data). The camera-acknowledgment part additionally depends on the `SET_CAMERA` `targetIds` field and the "who's active right now" synthesis mechanism from the gap analysis §1.3 — this is the one piece of this whole spec that does touch a formal AQIR/instruction-schema change (`SetCameraInstruction.params.targetIds?: string[]`), not just a runtime-internal `SortStep` enrichment. |
| Comparison beam draw-in synced with caption text | **Runtime handler addition + possible AQIR-adjacent field addition** | The beam itself (visual-language spec §4.1) depends on the `LinkObjectsInstruction`/`RelationshipEdge` gaps identified in the semantic gap analysis §3B: never emitted by compare/swap handlers today (handler-code addition, no schema change for that part), but the beam's "comparing → resolved → decided" color grammar needs the proposed `state`/`style` fields added to `RelationshipEdge` (and optionally `LinkObjectsInstruction` if scripted `LINK` statements should support it too) — a field addition to an existing runtime/instruction model, not a new instruction type. |

**Net summary for phase planning**: the large majority of this narrative layer — all step-description text content, the algorithm-name half of the identity chip, search progress, and the pacing decision for builtin-sort scripts — is buildable as **runtime-internal (`SortStep`) enrichment plus frontend re-templating**, requiring no changes to the formal AQIR instruction schema at all. Exactly two things in this spec require an actual AQIR/instruction-type change: the camera `targetIds` field (for FINALIZE/pivot-lock-in camera acknowledgment) and the `RelationshipEdge`/`LinkObjectsInstruction` `state`/`style`/`transient` fields (for the comparison beam's resolving-color grammar) — both already scoped precisely in `array-aqir-semantic-gap.md` §1.3 and §3B respectively. One item — decisive-pacing for hand-written (non-builtin-sort) scripts — is an open architectural question (VM lookahead vs. scope reduction) rather than a defined data-shape fix, and should be explicitly decided before Phase 2/4 commits to an approach.
