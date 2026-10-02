import React, { useEffect, useMemo } from 'react';
import { Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { DirectionalLight, Object3D } from 'three';
import type { StageModel } from '../model/StageModel';
import { createGridMaterial } from '../look/materials';
import type { QualitySettings } from './quality';

export interface SceneBounds {
  center: [number, number, number];
  radius: number;
}

/**
 * The one environment every algorithm stands in: a warm void the fog
 * fades into, a glossy floor that reflects the nodes, a fixed three-light
 * rig (warm key, cool rim, soft sky fill) and a small studio of light
 * panels for the clear-coat to catch. Nothing here depends on the program.
 */
export function StageEnvironment({ model, quality, bounds }: { model: StageModel; quality: QualitySettings; bounds: SceneBounds }) {
  const palette = model.palette;
  const { center, radius } = bounds;
  const floorY = model.floorY;
  const scene = useThree((s) => s.scene);

  const keyLight = useMemo(() => new DirectionalLight(palette.lights.key, palette.lights.keyIntensity), [palette]);
  const keyTarget = useMemo(() => new Object3D(), []);
  useEffect(() => {
    keyLight.target = keyTarget;
    scene.add(keyTarget);
    return () => {
      scene.remove(keyTarget);
    };
  }, [keyLight, keyTarget, scene]);

  useEffect(() => {
    const reach = radius * 1.6 + 4;
    keyLight.position.set(center[0] - reach * 0.45, floorY + reach * 1.1, center[2] + reach * 0.75);
    keyTarget.position.set(center[0], floorY, center[2]);
    keyLight.castShadow = quality.shadows;
    const cam = keyLight.shadow.camera;
    cam.left = -reach;
    cam.right = reach;
    cam.top = reach;
    cam.bottom = -reach;
    cam.near = 0.5;
    cam.far = reach * 4;
    cam.updateProjectionMatrix();
    keyLight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 4;
    keyLight.shadow.map?.dispose();
    keyLight.shadow.map = null as never;
  }, [keyLight, keyTarget, center, radius, floorY, quality]);

  const grid = useMemo(() => createGridMaterial(palette.floorLine, model.theme === 'dark' ? 0.04 : 0.06), [palette, model.theme]);
  useEffect(() => {
    grid.uniforms.uCenter.value = [center[0], center[2]];
    grid.uniforms.uRadius.value = radius * 2.6 + 8;
  }, [grid, center, radius]);
  useEffect(() => () => grid.dispose(), [grid]);

  const floorSize = Math.max(80, radius * 16);
  const fogNear = radius * 2.2 + 6;
  const fogFar = radius * 6.5 + 24;

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, fogNear, fogFar]} />
      <hemisphereLight args={[palette.lights.sky, palette.lights.ground, palette.lights.ambient]} />
      <primitive object={keyLight} />
      <directionalLight
        color={palette.lights.rim}
        intensity={palette.lights.rimIntensity}
        position={[center[0] + radius + 6, floorY + radius + 5, center[2] - radius * 1.8 - 8]}
      />
      <Environment resolution={128} frames={1} environmentIntensity={palette.lights.envIntensity}>
        <Lightformer form="rect" color={palette.lights.key} intensity={2.4} position={[-4, 6, 9]} scale={[12, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color={palette.lights.rim} intensity={3.2} position={[7, 3, -7]} scale={[2, 9, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" color={palette.lights.rim} intensity={2} position={[-8, 3, -6]} scale={[2, 7, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" color={palette.lights.key} intensity={1.2} position={[0, 9, 0]} scale={6} target={[0, 0, 0]} />
        <Lightformer form="rect" color={palette.floor} intensity={0.6} position={[0, -4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], floorY, center[2]]} receiveShadow={quality.shadows}>
        <planeGeometry args={[floorSize, floorSize]} />
        {quality.reflections ? (
          <MeshReflectorMaterial
            color={palette.floor}
            blur={[300, 90]}
            resolution={512}
            mixBlur={1}
            mixStrength={model.theme === 'dark' ? 1.6 : 0.28}
            mixContrast={1}
            roughness={0.82}
            metalness={0.25}
            depthScale={0.9}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.3}
            mirror={model.theme === 'dark' ? 0.45 : 0.18}
            envMapIntensity={0.12}
          />
        ) : (
          <meshStandardMaterial color={palette.floor} roughness={0.88} metalness={0.05} />
        )}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], floorY + 0.002, center[2]]} renderOrder={0} material={grid}>
        <planeGeometry args={[floorSize, floorSize]} />
      </mesh>
    </>
  );
}
