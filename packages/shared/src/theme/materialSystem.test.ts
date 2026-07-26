declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => {
  toBe: (expected: any) => void;
  toEqual: (expected: any) => void;
  toBeCloseTo: (expected: number, precision?: number) => void;
  toBeGreaterThan: (expected: number) => void;
};

import {
  MATERIAL_PRESETS,
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
} from './materialSystem';
import * as THREE from 'three';

describe('Unified Material System', () => {
  test('has accurate preset defaults for all categories', () => {
    expect(MATERIAL_PRESETS.NODE.roughness).toBe(0.2);
    expect(MATERIAL_PRESETS.NODE.metalness).toBe(0.1);

    expect(MATERIAL_PRESETS.EDGE.roughness).toBe(0.3);
    expect(MATERIAL_PRESETS.EDGE.metalness).toBe(0.2);

    expect(MATERIAL_PRESETS.RING.roughness).toBe(0.1);
    expect(MATERIAL_PRESETS.RING.metalness).toBe(0.3);

    expect(MATERIAL_PRESETS.CONTAINER.roughness).toBe(0.4);
    expect(MATERIAL_PRESETS.CONTAINER.metalness).toBe(0.05);

    expect(MATERIAL_PRESETS.POINTER.roughness).toBe(0.2);
    expect(MATERIAL_PRESETS.POINTER.metalness).toBe(0.1);
  });

  test('resolves material properties for NEUTRAL NODE', () => {
    const config = getUnifiedMaterialConfig({
      category: 'NODE',
      state: 'NEUTRAL',
      highlightProgress: 0,
    });

    expect(config.roughness).toBe(0.2);
    expect(config.metalness).toBe(0.1);
    expect(config.color.getHexString()).toBe('38bdf8'); // Sky blue neutral
  });

  test('resolves material properties for EVALUATING NODE during highlight', () => {
    const config = getUnifiedMaterialConfig({
      category: 'NODE',
      state: 'EVALUATING',
      highlightProgress: 1.0,
      time: 1.0,
    });

    expect(config.roughness).toBe(0.2);
    expect(config.metalness).toBe(0.1);
    expect(config.opacity).toBe(1.0);
    expect(config.emissiveIntensity).toBeGreaterThan(0.5);
  });

  test('resolves material properties for DISCARDED state', () => {
    const config = getUnifiedMaterialConfig({
      category: 'NODE',
      state: 'DISCARDED',
      highlightProgress: 0,
    });

    expect(config.opacity).toBe(0.4);
    expect(config.transparent).toBe(true);
  });

  test('resolves material properties for CONTAINER category', () => {
    const config = getUnifiedMaterialConfig({
      category: 'CONTAINER',
      state: 'AUXILIARY',
      highlightProgress: 0,
    });

    expect(config.roughness).toBe(0.4);
    expect(config.metalness).toBe(0.05);
    expect(config.opacity).toBe(0.35);
    expect(config.transparent).toBe(true);
  });

  test('applies unified material properties in-place onto THREE.MeshStandardMaterial', () => {
    const mat = new THREE.MeshStandardMaterial();
    const config = getUnifiedMaterialConfig({
      category: 'NODE',
      state: 'SUCCESS',
      highlightProgress: 0,
    });

    applyUnifiedMaterial(mat, config);

    expect(mat.roughness).toBe(0.2);
    expect(mat.metalness).toBe(0.1);
    expect(mat.color.getHexString()).toBe(config.color.getHexString());
    expect(mat.emissive.getHexString()).toBe(config.emissive.getHexString());
  });
});
