import { describe, it, expect } from 'vitest';
import type { SceneState, SceneElement } from '@aqvl/runtime';
import {
  isArrayDominantScene,
  computeArrayLightingProfile,
  DEFAULT_LIGHTING_PROFILE,
} from './arraySceneLighting';

function makeEl(partial: Partial<SceneElement> & { id: string; type: string }): SceneElement {
  return {
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: '#4488ff',
    emissiveIntensity: 0.2,
    emissiveColor: '#112233',
    ...partial,
  } as SceneElement;
}

function sceneStateOf(elements: SceneElement[]): SceneState {
  const map = new Map<string, SceneElement>();
  elements.forEach((el) => map.set(el.id, el));
  return { elements: map };
}

describe('isArrayDominantScene', () => {
  it('is false for a null scene state', () => {
    expect(isArrayDominantScene(null)).toBe(false);
  });

  it('is false for a scene with no box elements at all', () => {
    const scene = sceneStateOf([makeEl({ id: 'e', type: 'edge', sourceId: 'a', targetId: 'b', directed: false } as any)]);
    expect(isArrayDominantScene(scene)).toBe(false);
  });

  it('is true when every box element is an ARRAY_ELEMENT', () => {
    const scene = sceneStateOf([
      makeEl({ id: 'a0', type: 'box', originalType: 'ARRAY_ELEMENT' } as any),
      makeEl({ id: 'a1', type: 'box', originalType: 'ARRAY_ELEMENT' } as any),
    ]);
    expect(isArrayDominantScene(scene)).toBe(true);
  });

  it('is false when box elements are a different structure (e.g. tree nodes)', () => {
    const scene = sceneStateOf([
      makeEl({ id: 't0', type: 'box', originalType: 'TREE_NODE' } as any),
      makeEl({ id: 't1', type: 'box', originalType: 'TREE_NODE' } as any),
    ]);
    expect(isArrayDominantScene(scene)).toBe(false);
  });

  it('is true when at least half the box elements are array elements (mixed scene)', () => {
    const scene = sceneStateOf([
      makeEl({ id: 'a0', type: 'box', originalType: 'ARRAY_ELEMENT' } as any),
      makeEl({ id: 'a1', type: 'box', originalType: 'ARRAY_ELEMENT' } as any),
      makeEl({ id: 't0', type: 'box', originalType: 'TREE_NODE' } as any),
    ]);
    expect(isArrayDominantScene(scene)).toBe(true);
  });

  it('is false when array elements are a small minority', () => {
    const scene = sceneStateOf([
      makeEl({ id: 'a0', type: 'box', originalType: 'ARRAY_ELEMENT' } as any),
      makeEl({ id: 't0', type: 'box', originalType: 'TREE_NODE' } as any),
      makeEl({ id: 't1', type: 'box', originalType: 'TREE_NODE' } as any),
      makeEl({ id: 't2', type: 'box', originalType: 'TREE_NODE' } as any),
    ]);
    expect(isArrayDominantScene(scene)).toBe(false);
  });
});

describe('computeArrayLightingProfile', () => {
  it('falls back to the default (untuned) profile when the scene has no positioned elements', () => {
    const profile = computeArrayLightingProfile(sceneStateOf([]));
    expect(profile).toEqual(DEFAULT_LIGHTING_PROFILE);
  });

  it('falls back to the default profile for a null scene state', () => {
    expect(computeArrayLightingProfile(null)).toEqual(DEFAULT_LIGHTING_PROFILE);
  });

  it('reduces ambient intensity and adds a fill + rim light relative to the default profile', () => {
    const scene = sceneStateOf([
      makeEl({ id: 'a0', type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: -3, y: 0, z: 0 } } as any),
      makeEl({ id: 'a1', type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: 3, y: 0, z: 0 } } as any),
    ]);
    const profile = computeArrayLightingProfile(scene);

    expect(profile.ambientIntensity).toBeLessThan(DEFAULT_LIGHTING_PROFILE.ambientIntensity);
    expect(profile.fillIntensity).toBeGreaterThan(0);
    expect(profile.rimIntensity).toBeGreaterThan(0);
  });

  it('switches to the studio environment preset with reduced intensity', () => {
    const scene = sceneStateOf([
      makeEl({ id: 'a0', type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: 0, y: 0, z: 0 } } as any),
    ]);
    const profile = computeArrayLightingProfile(scene);
    expect(profile.environmentPreset).toBe('studio');
    expect(profile.environmentIntensity).toBeLessThan(DEFAULT_LIGHTING_PROFILE.environmentIntensity);
  });

  it('widens the key light shadow-camera frustum well beyond the default ±5 units for a wide array', () => {
    const elements = Array.from({ length: 30 }, (_, i) =>
      makeEl({ id: `a${i}`, type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: (i - 15) * 1.4, y: 0, z: 0 } } as any)
    );
    const profile = computeArrayLightingProfile(sceneStateOf(elements));

    // 30 elements at 1.4 spacing span ~40.6 units — the default ±5 frustum would clip most of them.
    const arrayHalfSpan = (29 * 1.4) / 2;
    expect(profile.keyShadowCameraBounds.right).toBeGreaterThan(arrayHalfSpan);
    expect(profile.keyShadowCameraBounds.left).toBeLessThan(-arrayHalfSpan);
    expect(profile.keyShadowCameraBounds.right).toBeGreaterThan(DEFAULT_LIGHTING_PROFILE.keyShadowCameraBounds.right);
  });

  it('does not oversize the shadow frustum/contact-shadow/grid for a small array', () => {
    const scene = sceneStateOf([
      makeEl({ id: 'a0', type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: -1, y: 0, z: 0 } } as any),
      makeEl({ id: 'a1', type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: 1, y: 0, z: 0 } } as any),
    ]);
    const profile = computeArrayLightingProfile(scene);

    // Should stay at (or near) the sensible floor rather than shrinking to something tiny/degenerate.
    expect(profile.keyShadowCameraBounds.right).toBeGreaterThanOrEqual(10);
    expect(profile.contactShadow.scale).toBeGreaterThanOrEqual(DEFAULT_LIGHTING_PROFILE.contactShadow.scale);
    expect(profile.gridExtent).toBeGreaterThanOrEqual(DEFAULT_LIGHTING_PROFILE.gridExtent);
  });

  it('scales the contact-shadow catcher and grid to comfortably cover a wide array', () => {
    const elements = Array.from({ length: 40 }, (_, i) =>
      makeEl({ id: `a${i}`, type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: (i - 20) * 1.4, y: 0, z: 0 } } as any)
    );
    const scene = sceneStateOf(elements);
    const profile = computeArrayLightingProfile(scene);
    const spanX = 39 * 1.4;

    expect(profile.contactShadow.scale).toBeGreaterThan(spanX);
    expect(profile.gridExtent).toBeGreaterThan(spanX);
  });

  it('uses a tighter contact-shadow blur and lower opacity than the default profile (crisper per-element grounding)', () => {
    const scene = sceneStateOf([
      makeEl({ id: 'a0', type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: -3, y: 0, z: 0 } } as any),
      makeEl({ id: 'a1', type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: 3, y: 0, z: 0 } } as any),
    ]);
    const profile = computeArrayLightingProfile(scene);
    expect(profile.contactShadow.blur).toBeLessThan(DEFAULT_LIGHTING_PROFILE.contactShadow.blur);
    expect(profile.contactShadow.opacity).toBeLessThan(DEFAULT_LIGHTING_PROFILE.contactShadow.opacity);
  });

  it('never returns a negative or zero shadow-camera extent, contact-shadow scale, or grid extent regardless of array width', () => {
    for (const n of [1, 2, 5, 40, 200]) {
      const elements = Array.from({ length: n }, (_, i) =>
        makeEl({ id: `a${i}`, type: 'box', originalType: 'ARRAY_ELEMENT', position: { x: i * 1.4, y: 0, z: 0 } } as any)
      );
      const profile = computeArrayLightingProfile(sceneStateOf(elements));
      expect(profile.keyShadowCameraBounds.right).toBeGreaterThan(0);
      expect(profile.keyShadowCameraBounds.left).toBeLessThan(0);
      expect(profile.contactShadow.scale).toBeGreaterThan(0);
      expect(profile.gridExtent).toBeGreaterThan(0);
    }
  });
});
