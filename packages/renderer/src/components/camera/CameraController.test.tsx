import { describe, it, expect } from 'vitest';
import React, { useRef } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { SceneState, SceneElement, CameraFrameState } from '@aqvl/runtime';
import { CameraController, CameraControllerHandle } from './CameraController';
import { ArrayCameraChoreographer } from '../array/ArrayCameraChoreographer';

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

function sceneStateOf(elements: SceneElement[], camera?: CameraFrameState): SceneState {
  const map = new Map<string, SceneElement>();
  elements.forEach((el) => map.set(el.id, el));
  return { elements: map, camera };
}

/** Renders CameraController and exposes its imperative handle for assertions. */
const Harness = React.forwardRef<
  CameraControllerHandle,
  { sceneState: SceneState | null; arrayCameraChoreographer?: ArrayCameraChoreographer }
>(({ sceneState, arrayCameraChoreographer }, ref) => {
  const internalRef = useRef<CameraControllerHandle>(null);
  React.useImperativeHandle(ref, () => internalRef.current as CameraControllerHandle);
  return (
    <CameraController
      ref={internalRef}
      sceneState={sceneState}
      arrayCameraChoreographer={arrayCameraChoreographer}
    />
  );
});

async function createHarness(sceneState: SceneState | null, arrayCameraChoreographer?: ArrayCameraChoreographer) {
  const ref = React.createRef<CameraControllerHandle>();
  const renderer = await ReactThreeTestRenderer.create(
    <Harness ref={ref} sceneState={sceneState} arrayCameraChoreographer={arrayCameraChoreographer} />
  );
  return { renderer, ref };
}

describe('CameraController — AUTO_FIT (default / no CAMERA statement)', () => {
  it('falls back to AUTO_FIT mode when sceneState.camera is absent', async () => {
    const { renderer, ref } = await createHarness(sceneStateOf([makeEl({ id: 'a', type: 'box' })]));
    await renderer.advanceFrames(1, 0.016);
    expect(ref.current!.getMode()).toBe('AUTO_FIT');
  });

  it('lerps the orbit target toward the centroid of element x-positions (small span)', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: -1, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 1, y: 0, z: 0 } }),
    ];
    const { renderer, ref } = await createHarness(sceneStateOf(elements));
    await renderer.advanceFrames(120, 0.05);

    const target = ref.current!.getTarget();
    expect(target.x).toBeCloseTo(0, 1);
  });

  it('does not push the camera back for a small span (<= 6 units)', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: -1, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 1, y: 0, z: 0 } }),
    ];
    const { renderer, ref } = await createHarness(sceneStateOf(elements));
    const initialZ = ref.current!.getCameraPosition().z;
    await renderer.advanceFrames(60, 0.05);

    // A span this small should never trigger the zoom-out branch.
    expect(ref.current!.getCameraPosition().z).toBeCloseTo(initialZ, 5);
  });

  it('zooms the camera out for a wide span (> 6 units)', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: -10, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 10, y: 0, z: 0 } }),
    ];
    const { renderer, ref } = await createHarness(sceneStateOf(elements));
    const initialZ = ref.current!.getCameraPosition().z;
    await renderer.advanceFrames(200, 0.05);

    expect(ref.current!.getCameraPosition().z).toBeGreaterThan(initialZ);
  });

  it('centers the target vertically on tree height for TREE_NODE elements', async () => {
    const elements = [
      makeEl({ id: 'root', type: 'box', originalType: 'TREE_NODE', position: { x: 0, y: 4, z: 0 } }),
      makeEl({ id: 'leaf', type: 'box', originalType: 'TREE_NODE', position: { x: 0, y: 0, z: 0 } }),
    ];
    const { renderer, ref } = await createHarness(sceneStateOf(elements));
    await renderer.advanceFrames(150, 0.05);

    expect(ref.current!.getTarget().y).toBeCloseTo(2, 0);
  });
});

describe('CameraController — AUTO_FIT with an ArrayCameraChoreographer', () => {
  it('pans the AUTO_FIT target toward a registered pivotal instruction beyond the plain centroid', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: -10, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 10, y: 0, z: 0 } }),
    ];
    const choreographer = new ArrayCameraChoreographer();
    const { renderer, ref } = await createHarness(sceneStateOf(elements), choreographer);
    await renderer.advanceFrames(5, 0.016); // let the plain centroid settle first

    choreographer.registerInstruction({
      type: 'FINALIZE',
      significance: 'pivotal',
      participants: [{ x: 9, y: 0, z: 0 }],
      durationMs: 5000, // held well past this test's check window, so emphasis hasn't started settling yet
    });
    await renderer.advanceFrames(60, 0.05);

    // Centroid alone is 0; a pivotal instruction toward x=9 should pull the target positive.
    expect(ref.current!.getTarget().x).toBeGreaterThan(0.5);
  });

  it('leaves AUTO_FIT behavior unchanged when no choreographer is supplied (backward compatible)', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: -1, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 1, y: 0, z: 0 } }),
    ];
    const { renderer, ref } = await createHarness(sceneStateOf(elements));
    await renderer.advanceFrames(120, 0.05);
    expect(ref.current!.getTarget().x).toBeCloseTo(0, 1);
  });

  it('settles the target back toward the plain centroid once the choreographer instruction decays', async () => {
    const elements = [
      makeEl({ id: 'a', type: 'box', position: { x: -10, y: 0, z: 0 } }),
      makeEl({ id: 'b', type: 'box', position: { x: 10, y: 0, z: 0 } }),
    ];
    const choreographer = new ArrayCameraChoreographer();
    const { renderer, ref } = await createHarness(sceneStateOf(elements), choreographer);

    choreographer.registerInstruction({
      type: 'FINALIZE',
      significance: 'pivotal',
      participants: [{ x: 9, y: 0, z: 0 }],
      durationMs: 50,
    });
    await renderer.advanceFrames(10, 0.02);
    const during = ref.current!.getTarget().x;
    expect(during).toBeGreaterThan(0.2);

    // Let the hold window and settle window fully elapse with no new instruction.
    await renderer.advanceFrames(400, 0.05);
    const settled = ref.current!.getTarget().x;
    expect(Math.abs(settled)).toBeLessThan(Math.abs(during));
    expect(settled).toBeCloseTo(0, 0);
  });
});

describe('CameraController — FOCUS', () => {
  it('moves the orbit target toward the focused element position', async () => {
    const elements = [makeEl({ id: 'target', type: 'box', position: { x: 5, y: 3, z: -2 } })];
    const camera: CameraFrameState = { mode: 'FOCUS', targetId: 'target' };
    const { renderer, ref } = await createHarness(sceneStateOf(elements, camera));

    const before = ref.current!.getTarget();
    await renderer.advanceFrames(5, 0.05);
    const mid = ref.current!.getTarget();
    // Should have moved meaningfully closer to the target than the starting point.
    expect(Math.abs(mid.x - 5)).toBeLessThan(Math.abs(before.x - 5));

    await renderer.advanceFrames(200, 0.05);
    const settled = ref.current!.getTarget();
    expect(settled.x).toBeCloseTo(5, 0);
    expect(settled.y).toBeCloseTo(3, 0);
    expect(settled.z).toBeCloseTo(-2, 0);
  });

  it('does nothing when the focused targetId is not present in the scene', async () => {
    const elements = [makeEl({ id: 'a', type: 'box', position: { x: 0, y: 0, z: 0 } })];
    const camera: CameraFrameState = { mode: 'FOCUS', targetId: 'missing' };
    const { renderer, ref } = await createHarness(sceneStateOf(elements, camera));
    await renderer.advanceFrames(30, 0.05);

    const target = ref.current!.getTarget();
    expect(target).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('CameraController — ORBIT', () => {
  it('continuously rotates the camera position around the target over time', async () => {
    const camera: CameraFrameState = { mode: 'ORBIT', speed: 1 };
    const { renderer, ref } = await createHarness(sceneStateOf([], camera));

    await renderer.advanceFrames(10, 0.05);
    const p1 = ref.current!.getCameraPosition();
    await renderer.advanceFrames(10, 0.05);
    const p2 = ref.current!.getCameraPosition();
    await renderer.advanceFrames(10, 0.05);
    const p3 = ref.current!.getCameraPosition();

    // Each subsequent snapshot should be a different point (continuous motion, not a static camera).
    expect(p1).not.toEqual(p2);
    expect(p2).not.toEqual(p3);
  });

  it('keeps the camera at roughly constant distance from the orbit target', async () => {
    const camera: CameraFrameState = { mode: 'ORBIT', speed: 0.8 };
    const { renderer, ref } = await createHarness(sceneStateOf([], camera));
    await renderer.advanceFrames(5, 0.05);
    const target = ref.current!.getTarget();
    const initialDistance = Math.hypot(
      ref.current!.getCameraPosition().x - target.x,
      ref.current!.getCameraPosition().z - target.z
    );

    await renderer.advanceFrames(200, 0.05);
    const laterTarget = ref.current!.getTarget();
    const laterDistance = Math.hypot(
      ref.current!.getCameraPosition().x - laterTarget.x,
      ref.current!.getCameraPosition().z - laterTarget.z
    );

    expect(laterDistance).toBeCloseTo(initialDistance, -1);
  });
});

describe('CameraController — POSITION', () => {
  it('smoothly (not instantly) approaches an explicit camera placement', async () => {
    const camera: CameraFrameState = { mode: 'POSITION', position: { x: 20, y: 15, z: 20 } };
    const { renderer, ref } = await createHarness(sceneStateOf([], camera));

    await renderer.advanceFrames(1, 0.05);
    const afterOneFrame = ref.current!.getCameraPosition();
    // A single frame of a 0.05-lerp should be far from the destination — no snap-cut.
    expect(afterOneFrame.x).toBeLessThan(20);

    await renderer.advanceFrames(300, 0.05);
    const settled = ref.current!.getCameraPosition();
    expect(settled.x).toBeCloseTo(20, 0);
    expect(settled.y).toBeCloseTo(15, 0);
    expect(settled.z).toBeCloseTo(20, 0);
  });
});

describe('CameraController — reset()', () => {
  it('re-reports autoFollow as true after reset', async () => {
    const { renderer, ref } = await createHarness(sceneStateOf([makeEl({ id: 'a', type: 'box' })]));
    await renderer.advanceFrames(1, 0.016);
    expect(ref.current!.getAutoFollow()).toBe(true);

    ref.current!.reset();
    expect(ref.current!.getAutoFollow()).toBe(true);
  });
});
