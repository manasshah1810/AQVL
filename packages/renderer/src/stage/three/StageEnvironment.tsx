import React, { useEffect, useMemo } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { StageModel } from '../model/StageModel';
import { createGridMaterial } from '../look/materials';

export interface SceneBounds {
  center: [number, number, number];
  radius: number;
}

/** Layer for everything that is drawn but is not a solid body (floor, marks, shadows, text, rings). */
export const NO_SHADOW_LAYER = 1;

/**
 * The one environment every algorithm stands in, in the site's light or
 * dark mode: a floor the same colour as the background (so it reads as an
 * endless, quiet surface), a faint guide grid that fades out, and a plain studio
 * light (a soft key from the upper left, a gentle fill, and a few light
 * panels for the satin finish to catch). No reflections, no haze, no grain.
 */
export function StageEnvironment({ model, bounds }: { model: StageModel; bounds: SceneBounds }) {
  const palette = model.palette;
  const { center, radius } = bounds;
  const floorY = model.floorY;

  const grid = useMemo(() => createGridMaterial(palette.floorLine, model.theme === 'dark' ? 0.05 : 0.07), [palette, model.theme]);
  useEffect(() => {
    grid.uniforms.uCenter.value = [center[0], center[2]];
    grid.uniforms.uRadius.value = radius * 2.2 + 6;
  }, [grid, center, radius]);
  useEffect(() => () => grid.dispose(), [grid]);

  const floorSize = Math.max(120, radius * 20);
  // Built here rather than in JSX so their layer is set exactly: they must stay out of the contact-shadow pass.
  const floor = useMemo(() => {
    // Not tone mapped, so it is exactly the background colour and the floor has no visible edge.
    const plane = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: palette.floor, toneMapped: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.renderOrder = -1;
    plane.layers.set(NO_SHADOW_LAYER);
    const lines = new Mesh(new PlaneGeometry(1, 1), grid);
    lines.rotation.x = -Math.PI / 2;
    lines.layers.set(NO_SHADOW_LAYER);
    return { plane, lines };
  }, [palette.floor, grid]);
  useEffect(() => {
    floor.plane.position.set(center[0], floorY, center[2]);
    floor.plane.scale.set(floorSize, floorSize, 1);
    floor.lines.position.set(center[0], floorY + 0.002, center[2]);
    floor.lines.scale.set(floorSize, floorSize, 1);
  }, [floor, center, floorY, floorSize]);
  useEffect(
    () => () => {
      floor.plane.geometry.dispose();
      (floor.plane.material as MeshBasicMaterial).dispose();
      floor.lines.geometry.dispose();
    },
    [floor],
  );

  const fogNear = radius * 3 + 10;
  const fogFar = radius * 8 + 40;

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, fogNear, fogFar]} />
      <hemisphereLight args={[palette.lights.sky, palette.lights.ground, palette.lights.ambient]} />
      <directionalLight
        color={palette.lights.key}
        intensity={palette.lights.keyIntensity}
        position={[center[0] - radius * 0.6 - 4, floorY + radius * 1.4 + 8, center[2] + radius + 8]}
      />
      <directionalLight
        color={palette.lights.fill}
        intensity={palette.lights.fillIntensity}
        position={[center[0] + radius + 6, floorY + radius * 0.6 + 3, center[2] + radius * 0.4 + 2]}
      />
      <Environment resolution={128} frames={1} environmentIntensity={palette.lights.envIntensity}>
        <Lightformer form="rect" color="#ffffff" intensity={2} position={[-3, 7, 8]} scale={[14, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#ffffff" intensity={1.2} position={[8, 4, 2]} scale={[3, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#ffffff" intensity={0.8} position={[-8, 4, -4]} scale={[3, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color={palette.floor} intensity={0.5} position={[0, -4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>

      <primitive object={floor.plane} />
      <primitive object={floor.lines} />
    </>
  );
}
