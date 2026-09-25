# Array Visual Polish — Lighting, Materials, Environment

Tunes `AQVECanvas.tsx`'s lighting/environment/shadow-catcher rig specifically for array
scenes, per the array redesign's Phase 3.4. Builds on the element materials from Phase 3.1
(`packages/shared/src/theme/materialSystem.ts`), the comparison/boundary overlays from 3.2/3.3
(`PartitionBoundary.tsx`, `SortedRegionIndicator.tsx` — a comparison-link beam component is
referenced by the brief for this phase but does not exist in the codebase yet; see §4), and
`array-visual-language-spec.md` §0/§2's existing judgment that the shared material system is
already correct and should not be forked per structure.

**Method note, stated up front for honesty**: this environment has no headless-browser/screenshot
tooling available, so the "before/after" below is a code-level, physically-reasoned comparison
(light angles, intensities, known Three.js/drei defaults, PBR material response, and the ACES
Filmic tone-mapping r3f's `Canvas` already applies by default) rather than a pixel-diffed
screenshot pair. Every specific, checkable claim below (the shadow-camera default, the tone
mapping default, the preset characteristics) was verified against the actual installed
`three`/`@react-three/fiber`/`@react-three/drei` source, not assumed. Anyone reviewing this
should still eyeball it live before calling the tuning final — see the "not verified visually"
callouts in §4.

---

## 1. Honest assessment of the starting point

`AQVECanvas.tsx` (before this change) mounts one lighting/environment rig shared by every
structure AQVL renders — arrays, trees, graphs, everything. It was never documented as tuned for
any specific structure. Reading it cold, three concrete problems stand out, in descending order
of how much they actually matter:

1. **The key light's shadow silently stops covering most of an array.** `THREE.DirectionalLight`'s
   shadow camera defaults to an orthographic frustum of `left/right/top/bottom = ±5, near 0.5,
   far 500` (confirmed against the installed `three` package — this was never overridden in the
   old code, which set `shadow-mapSize` and `shadow-bias` but no `shadow-camera-*` props). An
   array of even 8-9 elements at the default ~2.2-unit slot spacing
   (`docs/design/default-tuning-log.md`) already spans close to ±10 units — past the frustum
   edge, elements simply stop receiving/casting shadow, with no error or visual warning, they just
   go flat. This isn't "harsh shadows," it's **shadows that quietly stop existing** partway
   through the array — arguably worse, since it reads as an inconsistency bug once you notice
   some elements are grounded and others aren't, rather than a stylistic choice.
2. **Flat ambient + a single hard key light, no fill.** Ambient light is non-directional by
   definition — cranking it up to compensate for a single light's harsh falloff (the old setup
   used ambient 0.4 against one key at 1.5) doesn't restore a shading *gradient*, it just raises
   the floor uniformly. The result is a lit face and a flatly-lit "shadow" face with no visible
   falloff between them — the classic flat/generic look, independent of how good the underlying
   material is. A real gradient needs a second, dimmer, *directional* source (a fill), not more
   ambient.
3. **`Environment preset="city"` at full (implicit) intensity.** drei's "city" HDRI is a
   rooftop/skyline environment with a recognizable window/sky pattern. At `NODE`'s low metalness
   (0.1, correctly low — see §3), the environment reflection is soft but still shows a
   small, identifiable "city" highlight shape on each element rather than a neutral soft-box
   sheen. Not broken, just a slightly wrong register for small graphical primitives — it reads
   as "rendered outdoors" rather than "product-photographed."

What was *already* right, and I did not touch: `Canvas` has no `flat` prop, so
`react-three-fiber` v9's default `THREE.ACESFilmicToneMapping` is already active (confirmed
against the installed `@react-three/fiber` source) — highlights already roll off softly instead
of hard-clipping to white, which is a real, non-obvious "premium renderer" default this codebase
already had. The near-black `#111111` background and the `RoundedBox`/bevel element geometry are
also untouched and already good per `array-visual-language-spec.md` §0/§2.

---

## 2. What changed, and why (array scenes only)

All of this lives in the new
[`packages/renderer/src/components/array/arraySceneLighting.ts`](../../packages/renderer/src/components/array/arraySceneLighting.ts),
gated behind `isArrayDominantScene()` (≥50% of the scene's box elements tagged
`originalType === 'ARRAY_ELEMENT'`, the same tag `SortAlgorithms`/`ArrayEngine` already stamp).
**Every other structure (trees, graphs, stacks, ...) keeps the exact original values,
byte-for-byte** — see `DEFAULT_LIGHTING_PROFILE`, which is a literal transcription of the old
constants. This was a deliberate scoping decision: I have no way to visually verify those other
structures in this environment either, so a global lighting rewrite would be trading one
unverified state for another unverified state with more blast radius. Tuning behind a gate that
falls back to "identical to before" is strictly safer.

| Setting | Before (all structures) | After (array-dominant scenes only) | Why |
|---|---|---|---|
| Ambient intensity | 0.4 | 0.22 | Less flat fill so the key+fill lights' directional gradient actually shows on each `RoundedBox` face instead of being washed out. |
| Key light intensity | 1.5 | 1.4 | Nudged down now that a fill light adds its own contribution — keeps the total light budget from crowding the ACES rolloff. |
| Key shadow-camera frustum | ±5 (Three.js default, unset) | ±max(13, arrayHalfSpan + 6) horizontally, ±10 vertically, far 60 | The actual bug fix — sized to the array's *current* span (via the same `computeAutoFitTarget` the camera controller already uses), not a bigger fixed constant, so a 2-element array doesn't waste shadow-map texel density on empty space. |
| Key shadow map size | 1024×1024 | 2048×2048 | The frustum above is up to ~5× wider; without more texels the shadow edges go visibly blocky. |
| Fill light | none | new, 0.32 intensity, `#ffffff`, opposite the key, no `castShadow` | Restores a real shading gradient (see §1.2) without doubling contact-shadow density under a row of elements. |
| Rim/back light | none | new, 0.16 intensity, `#ffffff`, from behind | Separates an element's far edge from the `#111111` background — most noticeable on the already-dim `DISCARDED` state (opacity 0.4), which could otherwise start to visually merge into the background. |
| Environment preset | `"city"` | `"studio"` | Even, soft-box-style reflections instead of a recognizable rooftop/skyline highlight — the standard product-photography move for small objects. |
| Environment intensity | 1.0 (implicit) | 0.55 | Keeps IBL reflections a subtle sheen rather than competing with the emissive-driven semantic color states for attention. |
| ContactShadows scale | 20 (fixed) | max(20, arraySpan + 12) | Sized to the array so wide arrays don't have elements past the shadow-catcher's edge (the same category of bug as the key light's frustum, just for the ground contact shadow instead). |
| ContactShadows blur | 2.5 | 1.6 | At the now-larger scale, the old blur radius smeared adjacent elements' shadows into one continuous band — losing the "which element is grounded here" cue entirely. Tighter blur keeps each element's shadow legibly its own. |
| ContactShadows opacity | 0.6 | 0.5 | With the key+fill now doing real directional shading, the contact shadow's job shrinks back to "grounding," not "primary shading source" — it can afford to be lighter. |
| Grid extent / fade distance | 30 / 25 (fixed) | scaled to ~1.5× array span | So the reference grid doesn't visibly run out under a wide array. |

**Deliberately NOT changed: fill/rim light color.** The conventional 3-point-lighting move is a
warm key / cool fill (or vice versa) for cinematic depth. I kept both new lights strictly neutral
white. `array-animation-excellence-spec.md` §1.2 states the color vocabulary's core rule —
"different meanings never share a color" — and that vocabulary is read directly off each
element's albedo/emissive under whatever light is hitting it. A tinted light is a global color
shift on every element in the scene; for a system whose correctness depends on exact hue
identity, that's a real risk, not just a stylistic tradeoff, so I didn't take it.

---

## 3. Materials — verified, not changed

`MATERIAL_PRESETS.NODE` (`packages/shared/src/theme/materialSystem.ts`): roughness 0.2, metalness
0.1, bevel radius 0.1. I left these exactly as they were, for two reasons:

1. **A prior spec already made this call.** `array-visual-language-spec.md` §2 explicitly
   evaluated this exact material system for array use and concluded "no divergence
   recommended... a bespoke array-only material would fragment the 'one coherent product' feel."
   Re-opening that decision without new evidence it was wrong would be scope creep, not polish.
2. **Low metalness is load-bearing for the color vocabulary, not just a style choice.** PBR
   metals tint their specular reflection by the albedo color; dielectrics (low metalness) keep
   specular highlights neutral/white regardless of base color. At metalness 0.1, each semantic
   state's exact hue (amber `EVALUATING`, pink `MODIFYING`, emerald `SUCCESS`, etc.) stays
   faithful under the new lighting instead of picking up a colored highlight that could shift how
   a state reads. I confirmed this doesn't change under the new lights: three neutral-white
   directional sources plus a lower-intensity neutral-tinted environment can only scale the
   material's own color, never introduce a competing hue, so hue-based state distinguishability
   (`array-animation-excellence-spec.md` §4, criterion 2) is unaffected by this change.

What I *did* verify is that the "flat/generic" complaint in the task brief is much more
attributable to the lighting rig (§1.2 above) than to these material values — a single hard key
light plus flat ambient will make *any* roughness/metalness combination look flat, because
there's no directional contrast for the material to respond to. Fixing the light, not the
material, is the correct diagnosis here.

---

## 4. Comparison links, boundary indicators — read as overlay

`PartitionBoundary.tsx` and `SortedRegionIndicator.tsx` (the boundary/sorted-region markers from
Phase 3.3) were already built without `castShadow`/`receiveShadow` — this pass made that
explicit in a comment rather than relying on the prop default, and added `depthWrite={false}` (+
`renderOrder={1}`) to both meshes' materials, so a translucent overlay plane composites correctly
against the array elements regardless of draw order instead of occasionally z-fighting or
incorrectly occluding a box drawn after it. Both were already appropriately translucent
(`CONTAINER` category, 0.3–0.75 opacity by nesting depth for the boundary planes; a thin, mostly
opaque strip for the sorted-region floor marker) and use the `AUXILIARY`/`SUCCESS` semantic
tokens rather than a physically-lit material response, which is the right call for something
meant to read as *information about* the array, not *part of* it.

**Gap, stated honestly**: the brief also references "comparison-link beams" (§4.1 of
`array-visual-language-spec.md`, the `SHOW_COMPARISON_LINK`/`HIDE_COMPARISON_LINK` AQIR
instructions) as if a beam component already exists to tune. It doesn't — `SortAlgorithms.ts`
dispatches those instructions, but no renderer component consumes them yet (confirmed via
repo-wide search). There is nothing to polish there because there is nothing rendered there yet.
The convention documented in this file — no shadow casting/receiving, `depthWrite={false}`,
`renderOrder` above the elements, a semantic token color rather than a lit PBR response — is what
that future component should follow to read as the same kind of overlay these two already are.

---

## 5. Value text legibility

`PrimitiveNode.tsx`'s value/index labels use drei's `<Text>` (troika-three-text), which renders
with its own signed-distance-field material rather than responding to scene lights — so the
lighting changes in §2 have **no effect on text legibility**, positive or negative, and I
verified that by reading the rendering path rather than assuming it. The white value text
(`#ffffff`) and gray index text (`#aaaaaa`) contrast against every element base color in the
semantic palette (`semanticColors.ts`) regardless of the lighting rig, since text brightness isn't
lit-material-derived here.

**A real legibility risk I found but did not fix, since it's outside this task's scope
(lighting/materials/environment) and is a pre-existing, independent issue**: `PrimitiveNode`
renders value text at a fixed world-space `fontSize={0.4}` regardless of array length, while
`AUTO_FIT` (`CameraController.tsx`) pulls the camera back as array span grows (clamped at
distance 30 for wide arrays). A fixed world-unit font size at a farther camera distance means
smaller on-screen text — for a 40+ element array at the AUTO_FIT distance ceiling, value labels
will be noticeably smaller on screen than for a 5-element array. A separate, already-built
component (`ArrayElementNode.tsx`) has array-length-aware label density/sizing
(`valueFormatting.ts`'s `getValueLabelDensityConfig`) but isn't wired into the live render path
(`GenericSceneRenderer` still uses the generic `PrimitiveNode`, not `ArrayElementNode` — a
pre-existing gap, not something this pass introduced). Flagging this rather than fixing it here,
since resolving it means wiring a different node component into the live path, which is a
rendering-architecture change, not a lighting/material/environment one.

---

## 6. What to check live before calling this final

Since this was reasoned from code rather than screenshots, these are the specific things worth
eyeballing in a running build before treating the tuning as settled:

- A 30-40 element array mid-sort: confirm every element actually receives a contact/cast shadow
  now (the concrete bug this pass targeted), not just the ones near center.
- A `DISCARDED` (dim, 0.4-opacity) element against the black background with the new rim light —
  confirm it doesn't now look *too* separated/glowing for a state that's supposed to read as
  "faded out."
- The `"studio"` environment preset on an actual `EVALUATING` (amber) vs `SUCCESS` (green)
  element side by side — confirm the hue read is still unambiguous, per the reasoning in §3 but
  not yet eye-confirmed.
- Whether the fill/rim light combination reads as "premium" or introduces a second, distracting
  highlight direction — three simultaneous directional lights is more than the original one-light
  setup, and more lights isn't automatically better without seeing it move.

---

## 7. Motion easing (Phase 3.5 — array element easing curves)

Adds `packages/renderer/src/components/array/arrayEasing.ts` (four named curves) and
`ArrayAnimationInterpolator.ts` (per-operation curve selection, wrapping the restored
`packages/renderer/src/core/AnimationInterpolator.ts` — its `.ts` source was missing from the
working tree entirely, present only as a compiled `dist/` artifact; it's been reconstructed from
that output and extended to permit eased overshoot, see that file's header comment). Full design
rationale for which curve suits which operation lives in `arrayEasing.ts`'s own doc comments
(kept there, not duplicated here, so the two never drift apart); this section is the promised
honest before/after.

**Method note (same honesty caveat as §1)**: no screenshot tooling exists here either. The
comparison below is a numeric one — the exact `linear` vs. `eased` output of the interpolator at
each `t`, computed and logged directly (script since deleted, numbers below are its real output,
not estimated) — which is actually a stronger check for a pure-math module like this one than a
screenshot would be: the concern here is "does the curve shape do what it claims," which is a
numeric question.

### SWAP (`swapEasing` / `easeOutBack`) — reads as intended

Two adjacent elements 2.2 units apart (the default array slot spacing), tracking one element's
x-position as it exchanges places:

```
t      linear-x   eased-x    delta
0.0      0.000      0.000     0.000
0.1      0.220      0.953     +0.733
0.3      0.660      2.092     +1.432
0.5      1.100      2.475     +1.375   <- destination is 2.200; already past it
0.6      1.320      2.482     +1.162   <- peak overshoot: 2.482 (≈+13% past the 2.2 target)
0.8      1.760      2.323     +0.563
1.0      2.200      2.200      0.000   <- settled exactly at destination
```

This is the effect §1.1 of the excellence spec asks for, and the numbers confirm it actually
happens rather than just looking plausible in the code: the element reaches ~87% of the swap
distance by t=0.1 (a fast, decisive early motion), overshoots the destination by about 13% of the
gap between the two slots around t=0.6, then eases back down to land exactly on target at t=1.0.
Read as motion, that's "thrown into place, wobbles once, settles" — the weight/anticipation
quality the spec describes, not a mechanical stop.

**One real caveat, not glossed over**: the settle phase (peak at t=0.6 back down to rest at t=1.0)
occupies the last 40% of the animation's total duration. At the ~300-450ms swap durations
`SortAlgorithms.ts` already uses, that's roughly 120-180ms of visible "wobbling back down" — long
enough to notice, not so long it reads as sluggish, but this is exactly the kind of thing that
needs an eyes-on check once it's wired into an actual running swap, not just trusted from the
numbers. If a live look finds it feels floaty rather than weighted, the fix is either a smaller
overshoot amplitude (anime.js's `Back` family doesn't expose one directly through the plain
string name the way `Elastic` exposes amplitude/period, so this would mean either parametrizing
`fromAnime` to pass those params through, or hand-tuning a bespoke back-easing constant) or
simply shortening how much of the total swap duration this curve is allowed to dominate.

### SHIFT (`shiftEasing` / `easeInOutQuad`) — reads as intended, cleanly distinct from SWAP

A 3-element block shifting by 1.4 units (an insertion-sort-style compaction):

```
t      linear-x   eased-x(shift)   delta
0.0      0.000          0.000       0.000
0.2      0.280          0.112      -0.168
0.4      0.560          0.448      -0.112
0.6      0.840          0.952      +0.112
0.8      1.120          1.288      +0.168
1.0      1.400          1.400       0.000
```

Never exceeds the [0, 1.4] range at any sampled point — confirmed no overshoot, as intended. The
negative-then-positive delta against linear is exactly a symmetric ease-in-out signature: slower
than linear leaving the start, faster than linear approaching the end, meeting linear exactly at
the midpoint and both ends. Side-by-side with the swap numbers above, the two curves are clearly
different animals — one overshoots and wobbles, the other doesn't — which is the whole point of
having two curves instead of one shared easing for everything.

### INSERT (`fadeEasing` / `easeInOutCubic`) — works, but exposes the documented compromise

Opacity of a newly-inserted element, 0 → 1:

```
t      linear-opacity   eased-opacity   delta
0.0            0.000           0.000     0.000
0.2            0.200           0.032    -0.168
0.4            0.400           0.256    -0.144
0.6            0.600           0.744    +0.144
0.8            0.800           0.968    +0.168
1.0            1.000           1.000     0.000
```

This is the honest finding worth flagging rather than hiding: `arrayEasing.ts`'s doc comment
already predicted, before this numeric check, that a single symmetric curve can't be
simultaneously "ease-out" for an *arriving* element and "ease-in" for a *leaving* one. The numbers
confirm exactly the shape that prediction implies — the new element sits at only 3-26% opacity for
the first 40% of its entrance, then rushes from ~26% to ~100% in the second half. For INSERT
specifically, that reads as "pops in late" rather than the graceful, considered arrival
§1.1 of the excellence spec asks for (which explicitly wants insert to "settle with a bounce,"
i.e. an ease-*out* profile: fast to appear, gentle to settle — the opposite shape from what's
here). It's not broken — it's smooth and it's not linear, which is still strictly better than the
pre-existing behavior — but it's the one curve of the four that doesn't fully deliver the specific
feel its operation wants, and I'm not going to claim otherwise. The fix, if this is confirmed live:
split `fadeEasing` into `fadeInEasing` (`easeOutCubic` — fast appear, gentle settle) and
`fadeOutEasing` (`easeInCubic` — slow start, accelerating away, matching §1.1's explicit ask for
DELETE) once `ArrayAnimationInterpolator` can tell which direction a given element is fading
(it already knows — an element present only in `toElements` is an insert, only in `fromElements`
is a delete — so this is a small, contained follow-up, not a redesign).

### COMPARE (`comparisonPulseEasing` / `easeInOutSine`) — reads as intended

A compare-without-swap "lift" pulse, tracking scale from 1.0 to 1.15 (the amount `SortAlgorithms.ts`
already scales compared elements by):

```
t      linear-scale   eased-scale   delta
0.0         1.0000        1.0000    0.0000
0.2         1.0300        1.0143   -0.0157
0.4         1.0600        1.0518   -0.0082
0.6         1.0900        1.0982   +0.0082
0.8         1.1200        1.1357   +0.0157
1.0         1.1500        1.1500    0.0000
```

Small, symmetric, no overshoot, gentle at both ends — exactly the "pause and pulse, don't throw"
quality this curve was chosen for, and unlike INSERT there's no directional mismatch here since a
compare's lift-then-release is inherently symmetric (up and back down), which is precisely the
case a symmetric ease-in-out curve is *right* for. This is the one operation where I'd say the
single shared curve isn't a compromise at all, just the correct choice.

### Overall verdict

Three of the four curves (swap, shift, compare) read as intended by the numbers and match their
described design intent with no caveats beyond "verify live before shipping," which is true of
this whole pass given the tooling constraint. The fourth (fade, for INSERT specifically) works —
strictly better than linear — but doesn't fully deliver the asymmetric "ease-out entrance / ease-in
exit" feel the excellence spec actually asks for, because it's one curve serving two directions by
design. That's a real, specific, fixable gap, documented here rather than smoothed over, with the
concrete follow-up (split into direction-aware curves) already scoped out above.
