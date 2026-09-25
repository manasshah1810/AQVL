/**
 * Array-specific lighting/environment tuning for AQVECanvas — see
 * docs/design/array-visual-polish-notes.md for the full before/after rationale.
 *
 * AQVECanvas is structure-agnostic: the same Canvas lighting rig renders arrays, trees,
 * graphs, and everything else. Rather than rewriting that shared rig (which would risk
 * regressing structures nobody asked to touch), this module computes a lighting/environment
 * profile specifically for the array case, gated on the scene actually being array-dominant —
 * every other structure keeps exactly the original values, byte-for-byte.
 *
 * Deliberately NOT touched here: element materials (roughness/metalness/bevel in
 * `@aqvl/shared`'s `MATERIAL_PRESETS.NODE`). array-visual-language-spec.md §2 already
 * evaluated that shared material system and explicitly decided array elements should look
 * materially identical to every other structure ("no divergence recommended... a bespoke
 * array-only [look] would fight consistency for no clarity gain"). Forking materials per
 * structure type here would contradict that already-made decision, so the polish in this
 * module is confined to lighting/environment/shadow-catcher tuning, which no prior spec
 * claimed was already correct for arrays.
 */

import type { SceneState } from '@aqvl/runtime';
import { computeAutoFitTarget } from '../camera/CameraController';

export interface ArraySceneLightingProfile {
  ambientIntensity: number;
  keyIntensity: number;
  keyShadowMapSize: [number, number];
  keyShadowCameraBounds: { left: number; right: number; top: number; bottom: number; near: number; far: number };
  fillIntensity: number;
  rimIntensity: number;
  environmentPreset: 'studio' | 'city';
  environmentIntensity: number;
  contactShadow: { scale: number; blur: number; opacity: number; far: number };
  gridExtent: number;
  gridFadeDistance: number;
}

/** Values used for every non-array (or mixed/ambiguous) scene — identical to AQVECanvas's original, un-tuned defaults. */
export const DEFAULT_LIGHTING_PROFILE: ArraySceneLightingProfile = {
  ambientIntensity: 0.4,
  keyIntensity: 1.5,
  keyShadowMapSize: [1024, 1024],
  // Three.js's own DirectionalLightShadow default (±5, near 0.5, far 500) — left implicit
  // pre-tuning, reproduced explicitly here so the "array vs. default" diff is legible.
  keyShadowCameraBounds: { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 500 },
  fillIntensity: 0,
  rimIntensity: 0,
  environmentPreset: 'city',
  environmentIntensity: 1,
  contactShadow: { scale: 20, blur: 2.5, opacity: 0.6, far: 4 },
  gridExtent: 30,
  gridFadeDistance: 25,
};

const MIN_ARRAY_ELEMENTS_FOR_DOMINANCE = 1;
const ARRAY_DOMINANCE_RATIO = 0.5;

/**
 * True when at least half of the scene's box elements are array elements (`originalType ===
 * 'ARRAY_ELEMENT'`, the same tag `SortAlgorithms`/`ArrayEngine` already stamp on them). A ratio
 * rather than "any" so a structure that merely references an array incidentally doesn't flip
 * the whole canvas into array-tuned lighting.
 */
export function isArrayDominantScene(sceneState: SceneState | null | undefined): boolean {
  if (!sceneState?.elements) return false;

  let boxCount = 0;
  let arrayCount = 0;
  sceneState.elements.forEach((el) => {
    if (el.type !== 'box') return;
    boxCount++;
    if ((el as any).originalType === 'ARRAY_ELEMENT') arrayCount++;
  });

  return boxCount >= MIN_ARRAY_ELEMENTS_FOR_DOMINANCE && arrayCount / boxCount >= ARRAY_DOMINANCE_RATIO;
}

/**
 * Computes the tuned lighting/environment profile for an array-dominant scene, sized to the
 * array's actual current span so wide arrays don't outgrow their shadow catcher, ground grid,
 * or (most importantly, since it defaults to only ±5 world units) the key light's shadow
 * frustum. Falls back to `DEFAULT_LIGHTING_PROFILE` if the scene has no measurable elements.
 */
export function computeArrayLightingProfile(sceneState: SceneState | null): ArraySceneLightingProfile {
  const fit = sceneState ? computeAutoFitTarget(sceneState) : null;
  if (!fit) return DEFAULT_LIGHTING_PROFILE;

  const halfSpanX = fit.spanX / 2;
  // Padding beyond the outermost element so its shadow/reflection isn't clipped at the frustum edge.
  const padding = 6;
  const shadowHalfExtent = Math.max(13, halfSpanX + padding);
  const contactShadowScale = Math.max(DEFAULT_LIGHTING_PROFILE.contactShadow.scale, fit.spanX + padding * 2);
  const gridExtent = Math.max(DEFAULT_LIGHTING_PROFILE.gridExtent, fit.spanX * 1.5);

  return {
    // Less flat ambient fill: a single uniform ambient term at the old 0.4 washes out the
    // key light's shading gradient across each RoundedBox's faces. Dropping it lets the key
    // + fill + rim lights below do the actual form-defining work instead.
    ambientIntensity: 0.22,
    // Slightly down from 1.5 now that a fill light exists too — keeps the total key+fill+rim
    // light budget from crowding the ACES-filmic highlight rolloff r3f's Canvas already
    // applies by default (Canvas has no `flat` prop, so ACESFilmicToneMapping is active).
    keyIntensity: 1.4,
    // 2x the old resolution: the shadow frustum below is up to ~5x wider than the old ±5
    // default, so texel density needs to go up too or shadows get visibly blocky.
    keyShadowMapSize: [2048, 2048],
    // The real fix this module exists for: THREE.DirectionalLightShadow defaults to an
    // orthographic frustum of only ±5 world units. An array wider than ~7 elements (at the
    // ~1.4-unit slot spacing PrimitiveNode/AUTO_FIT already assume) was silently losing
    // shadows for every element outside that band — not a "harsh shadow" so much as a
    // "shadow that quietly stops existing" past a few elements in, which reads as broken
    // once you notice it. Sized to the array's actual current span, not a bigger fixed
    // constant, so a 6-element array doesn't waste shadow-map resolution on empty space.
    keyShadowCameraBounds: { left: -shadowHalfExtent, right: shadowHalfExtent, top: 10, bottom: -10, near: 0.5, far: 60 },
    // A soft, strictly neutral-white fill from the opposite side: lifts the shadow-facing side
    // of each box so it reads as "in soft shadow" rather than "unlit black," without casting
    // its own shadow (a second shadow-casting light would double up on contact-shadow density
    // under a wide row of elements). Kept pure white deliberately — AQVL's semantic color
    // vocabulary depends on exact hues (array-animation-excellence-spec.md §1.2: "different
    // meanings never share a color"), so a warm/cool-tinted fill (the usual 3-point-lighting
    // trick) is a correctness risk here, not just an aesthetic one.
    fillIntensity: 0.32,
    // A dim backlight separates an element's far edge from the near-black (#111111)
    // background — without it, the unlit back of a box can visually merge into the
    // background, especially for DISCARDED (already-dim, low-opacity) elements.
    rimIntensity: 0.16,
    // drei's "city" HDRI has a recognizable rooftop/window skyline; at this NODE material's
    // low metalness (0.1) that shows up as a small, sharp, slightly distracting reflected
    // "window" highlight on each element rather than a soft one. "studio" is an even,
    // soft-box-style environment — the standard product-photography move for making small
    // graphical objects read as considered/tactile without introducing a recognizable scene.
    environmentPreset: 'studio',
    // Dialed down from the implicit default of 1.0 so IBL reflections stay a subtle sheen
    // rather than competing with the emissive-driven semantic color states for attention.
    environmentIntensity: 0.55,
    contactShadow: {
      scale: contactShadowScale,
      // Tighter blur than the 2.5 default: at a wide contact-shadow scale, the old blur
      // radius smears adjacent elements' shadows into one continuous dark band, losing the
      // per-element grounding cue entirely. A tighter blur keeps each element's shadow
      // legibly its own.
      blur: 1.6,
      // Slightly softer than 0.6: with the new directional key+fill actually shading each
      // box's form, the contact shadow's job is just "grounding," not the primary shading
      // source it was effectively acting as before.
      opacity: 0.5,
      far: DEFAULT_LIGHTING_PROFILE.contactShadow.far,
    },
    gridExtent,
    gridFadeDistance: Math.max(DEFAULT_LIGHTING_PROFILE.gridFadeDistance, gridExtent * 0.85),
  };
}
