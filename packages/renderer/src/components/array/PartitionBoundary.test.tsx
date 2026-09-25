import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';

// troika-three-text (used by drei's <Text>) reaches for browser globals that don't
// exist under this package's node test environment — stand in with a lightweight
// mesh, same workaround as ArrayElementNode.test.tsx.
vi.mock('@react-three/drei', async () => {
  const actual = await vi.importActual<typeof import('@react-three/drei')>('@react-three/drei');
  return {
    ...actual,
    Text: ({ children }: { children?: React.ReactNode }) => (
      <mesh userData={{ isMockText: true, text: String(children) }}>
        <sphereGeometry args={[0.001, 4, 4]} />
        <meshBasicMaterial />
      </mesh>
    ),
  };
});

const { PartitionBoundary } = await import('./PartitionBoundary');

function planeMeshes(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene
    .findAllByType('Mesh')
    .filter((m) => (m.instance as any).geometry?.type === 'PlaneGeometry');
}

describe('PartitionBoundary', () => {
  it('renders two boundary planes bracketing the given index range', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <PartitionBoundary
        startPosition={{ x: 0, y: 0, z: 0 }}
        endPosition={{ x: 4, y: 0, z: 0 }}
      />
    );
    await renderer.advanceFrames(1, 0.016);

    const planes = planeMeshes(renderer);
    expect(planes.length).toBe(2);

    const xs = planes.map((p) => (p.instance as any).position.x).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(0);
    expect(xs[1]).toBeGreaterThan(4);
  });

  it('positions the planes just outside the start/end element positions', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <PartitionBoundary
        startPosition={{ x: 2, y: 1, z: 0 }}
        endPosition={{ x: 6, y: 1, z: 0 }}
      />
    );
    await renderer.advanceFrames(1, 0.016);

    const planes = planeMeshes(renderer);
    const xs = planes.map((p) => (p.instance as any).position.x).sort((a, b) => a - b);

    // Margin should be small (a fraction of an element width), not arbitrary.
    expect(xs[0]).toBeGreaterThan(2 - 1);
    expect(xs[1]).toBeLessThan(6 + 1);
  });

  it('smoothly repositions (does not snap) when the underlying element positions move', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <PartitionBoundary
        startPosition={{ x: 0, y: 0, z: 0 }}
        endPosition={{ x: 4, y: 0, z: 0 }}
      />
    );
    await renderer.advanceFrames(5, 0.016);

    const before = planeMeshes(renderer)
      .map((p) => (p.instance as any).position.x)
      .sort((a, b) => a - b);

    await renderer.update(
      <PartitionBoundary
        startPosition={{ x: 10, y: 0, z: 0 }}
        endPosition={{ x: 14, y: 0, z: 0 }}
      />
    );
    // A single frame should move the planes only partway toward the new target.
    await renderer.advanceFrames(1, 0.016);
    const partway = planeMeshes(renderer)
      .map((p) => (p.instance as any).position.x)
      .sort((a, b) => a - b);

    expect(partway[0]).toBeGreaterThan(before[0]);
    expect(partway[0]).toBeLessThan(10 - 0.55);

    // Given enough frames, it should converge close to the new target.
    await renderer.advanceFrames(60, 0.05);
    const settled = planeMeshes(renderer)
      .map((p) => (p.instance as any).position.x)
      .sort((a, b) => a - b);
    expect(settled[0]).toBeCloseTo(10 - 0.55, 1);
    expect(settled[1]).toBeCloseTo(14 + 0.55, 1);
  });

  it('renders nested boundaries at different depths distinctly (opacity increases, height shrinks with depth)', async () => {
    const outer = await ReactThreeTestRenderer.create(
      <PartitionBoundary startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 8, y: 0, z: 0 }} depth={0} />
    );
    await outer.advanceFrames(1, 0.016);
    const inner = await ReactThreeTestRenderer.create(
      <PartitionBoundary startPosition={{ x: 2, y: 0, z: 0 }} endPosition={{ x: 5, y: 0, z: 0 }} depth={1} />
    );
    await inner.advanceFrames(1, 0.016);

    const outerPlane = planeMeshes(outer)[0];
    const innerPlane = planeMeshes(inner)[0];

    const outerMat = (outerPlane.instance as any).material;
    const innerMat = (innerPlane.instance as any).material;
    expect(innerMat.opacity).toBeGreaterThan(outerMat.opacity);

    const outerHeight = (outerPlane.instance as any).geometry.parameters.height;
    const innerHeight = (innerPlane.instance as any).geometry.parameters.height;
    expect(innerHeight).toBeLessThan(outerHeight);
  });

  it('renders a label when provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <PartitionBoundary
        startPosition={{ x: 0, y: 0, z: 0 }}
        endPosition={{ x: 4, y: 0, z: 0 }}
        label="partition 2"
      />
    );
    await renderer.advanceFrames(1, 0.016);

    const labelMesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => m.instance.userData?.isMockText);
    expect(labelMesh?.instance.userData?.text).toBe('partition 2');
  });

  it('renders no label when omitted', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <PartitionBoundary startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 4, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(1, 0.016);

    const labelMesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => m.instance.userData?.isMockText);
    expect(labelMesh).toBeUndefined();
  });

  it('uses the AUXILIARY violet token for the boundary color', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <PartitionBoundary startPosition={{ x: 0, y: 0, z: 0 }} endPosition={{ x: 4, y: 0, z: 0 }} />
    );
    await renderer.advanceFrames(1, 0.016);

    const plane = planeMeshes(renderer)[0];
    const mat = (plane.instance as any).material;
    expect(mat.color.getHexString()).toBe('a855f7');
  });
});
