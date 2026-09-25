import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows } from '@react-three/drei';
import type { SceneState } from '@aqvl/runtime';
import { GenericSceneRenderer } from './generic/GenericSceneRenderer';
import type { CameraControllerHandle } from './camera/CameraController';
import type { ArrayCameraChoreographer } from './array/ArrayCameraChoreographer';
import { isArrayDominantScene, computeArrayLightingProfile, DEFAULT_LIGHTING_PROFILE } from './array/arraySceneLighting';

export interface AQVECanvasProps {
  sceneState: SceneState | null;
  /** Optional array-operation camera emphasis — see ArrayCameraChoreographer.ts. */
  arrayCameraChoreographer?: ArrayCameraChoreographer;
}

export const AQVECanvas: React.FC<AQVECanvasProps> = ({ sceneState, arrayCameraChoreographer }) => {
  const [autoFollow, setAutoFollow] = useState(true);
  const controlsRef = useRef<any>(null);
  const cameraControllerRef = useRef<CameraControllerHandle>(null);

  const handleResetCamera = () => {
    cameraControllerRef.current?.reset();
  };

  // Array scenes get lighting/environment/shadow-catcher tuning specific to them (see
  // arraySceneLighting.ts and docs/design/array-visual-polish-notes.md); every other
  // structure keeps the original, untouched defaults.
  const lighting = isArrayDominantScene(sceneState) ? computeArrayLightingProfile(sceneState) : DEFAULT_LIGHTING_PROFILE;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Camera Controls Overlay */}
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, display: 'flex', gap: '8px' }}>
        <button 
          onClick={handleResetCamera}
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)';
          }}
        >
          Reset Camera {autoFollow ? '(Auto)' : ''}
        </button>
      </div>

      <Canvas shadows camera={{ position: [0, 3, 10], fov: 45 }}>
        {/* @ts-ignore */}
        <color attach="background" args={['#111111']} />

        <ambientLight intensity={lighting.ambientIntensity} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={lighting.keyIntensity}
          castShadow
          shadow-mapSize={lighting.keyShadowMapSize}
          shadow-bias={-0.0001}
          shadow-camera-left={lighting.keyShadowCameraBounds.left}
          shadow-camera-right={lighting.keyShadowCameraBounds.right}
          shadow-camera-top={lighting.keyShadowCameraBounds.top}
          shadow-camera-bottom={lighting.keyShadowCameraBounds.bottom}
          shadow-camera-near={lighting.keyShadowCameraBounds.near}
          shadow-camera-far={lighting.keyShadowCameraBounds.far}
        />
        {/* Soft neutral-white fill (opposite the key) so the shadow-facing side of each
            element reads as "in soft shadow," not unlit black. No castShadow — a second
            shadow-casting light would double up on contact-shadow density. Kept strictly
            neutral: AQVL's semantic color vocabulary depends on exact hues, so a tinted
            fill (the usual 3-point-lighting move) would be a correctness risk here. */}
        {lighting.fillIntensity > 0 && (
          <directionalLight position={[-6, 4, 9]} intensity={lighting.fillIntensity} color="#ffffff" />
        )}
        {/* Dim backlight separating elements' far edge from the near-black background. */}
        {lighting.rimIntensity > 0 && (
          <directionalLight position={[0, 6, -8]} intensity={lighting.rimIntensity} color="#ffffff" />
        )}

        {/* Environment lighting for premium reflections */}
        <Environment preset={lighting.environmentPreset} environmentIntensity={lighting.environmentIntensity} />

        {/* Grid helper for visual reference */}
        <Grid
          position={[0, -0.5, 0]}
          args={[lighting.gridExtent, lighting.gridExtent]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#2a2a2a"
          sectionSize={3}
          sectionThickness={1}
          sectionColor="#444444"
          fadeDistance={lighting.gridFadeDistance}
          fadeStrength={1}
        />

        <ContactShadows
          position={[0, -0.49, 0]}
          opacity={lighting.contactShadow.opacity}
          scale={lighting.contactShadow.scale}
          blur={lighting.contactShadow.blur}
          far={lighting.contactShadow.far}
        />

        {/* Passively render all elements from the scene state via the generic, structure-agnostic renderer,
            which also mounts the CameraController driving SET_CAMERA (AUTO_FIT/FOCUS/ORBIT/POSITION) */}
        <GenericSceneRenderer
          sceneState={sceneState}
          cameraControllerRef={cameraControllerRef}
          onAutoFollowChange={setAutoFollow}
          arrayCameraChoreographer={arrayCameraChoreographer}
        />

        {/* Advanced Camera Controls */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          maxDistance={35}
          minDistance={2}
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going under the floor
        />
      </Canvas>
    </div>
  );
};
