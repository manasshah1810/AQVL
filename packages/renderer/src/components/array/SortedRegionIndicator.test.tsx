import { describe, it, expect } from 'vitest';
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SortedRegionIndicator } from './SortedRegionIndicator';

function stripMesh(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene.findAllByType('Mesh')[0];
}

describe('SortedRegionIndicator', () => {
  it('renders a single floor strip spanning the given start/end range', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SortedRegionIndicator startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 4, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(1, 0.016);

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(1);
  });

  it('positions and sizes the strip beneath the array, centered on the index range', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SortedRegionIndicator startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 4, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(60, 0.05);

    const mesh = stripMesh(renderer);
    const pos = (mesh.instance as any).position;
    const scale = (mesh.instance as any).scale;

    expect(pos.x).toBeCloseTo(2, 1); // midpoint of 0..4
    expect(pos.y).toBeLessThan(0); // floor-level, beneath the elements
    expect(scale.x).toBeGreaterThan(4); // spans the full range plus margin
  });

  it('handles a single-element region (start === end)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SortedRegionIndicator startPosition={{ x: 3, y: 0, z: 0 }} endPosition={{ x: 3, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(60, 0.05);

    const mesh = stripMesh(renderer);
    expect((mesh.instance as any).position.x).toBeCloseTo(3, 1);
    expect((mesh.instance as any).scale.x).toBeGreaterThan(0);
  });

  it('supports a region growing from either end (start fixed, end advancing)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SortedRegionIndicator startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 2, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(60, 0.05);
    const before = (stripMesh(renderer).instance as any).scale.x;

    await renderer.update(
      <SortedRegionIndicator startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 6, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(60, 0.05);
    const after = (stripMesh(renderer).instance as any).scale.x;

    expect(after).toBeGreaterThan(before);
  });

  it('supports a region growing from the other end (end fixed, start receding — bubble sort direction)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SortedRegionIndicator startPosition={{ x: 8, y: 0, z: 0 }} endPosition={{ x: 9, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(60, 0.05);
    const beforeCenter = (stripMesh(renderer).instance as any).position.x;

    await renderer.update(
      <SortedRegionIndicator startPosition={{ x: 5, y: 0, z: 0 }} endPosition={{ x: 9, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(60, 0.05);
    const afterCenter = (stripMesh(renderer).instance as any).position.x;
    const afterScale = (stripMesh(renderer).instance as any).scale.x;

    expect(afterCenter).toBeLessThan(beforeCenter);
    expect(afterScale).toBeGreaterThan(1);
  });

  it('animates growth smoothly rather than snapping instantly', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SortedRegionIndicator startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 1, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(30, 0.05);

    await renderer.update(
      <SortedRegionIndicator startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 10, y: 0, z: 0 }} />
    );
    // A single small-delta frame should not have reached the fully-grown width yet.
    await renderer.advanceFrames(1, 0.016);
    const partway = (stripMesh(renderer).instance as any).scale.x;
    const fullyGrownWidth = 10 + 1; // range + both margins

    expect(partway).toBeLessThan(fullyGrownWidth - 0.5);

    await renderer.advanceFrames(120, 0.05);
    const settled = (stripMesh(renderer).instance as any).scale.x;
    expect(settled).toBeCloseTo(fullyGrownWidth, 0);
  });

  it('uses the SUCCESS green token for the strip color', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SortedRegionIndicator startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 4, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(1, 0.016);

    const mat = (stripMesh(renderer).instance as any).material;
    expect(mat.color.getHexString()).toBe('10b981');
  });
});
