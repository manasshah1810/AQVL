import React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows } from '@react-three/drei';
import type { SceneState } from '@aqvl/runtime';
import { SceneElementRenderer } from './SceneElementRenderer';
import * as THREE from 'three';

export interface AQVECanvasProps {
  sceneState: SceneState | null;
}

const CameraRig = ({ sceneState }: { sceneState: SceneState | null }) => {
  const { controls } = useThree();
  useFrame(() => {
    if (!sceneState || !controls) return;
    
    // Calculate center of elements that are active (raised y > 0.1)
    let totalX = 0;
    let count = 0;
    sceneState.elements.forEach((el) => {
      if (el.position && el.position.y > 0.1) {
        totalX += el.position.x;
        count++;
      }
    });

    if (count > 0 && (controls as any).target) {
      const centerX = totalX / count;
      const target = (controls as any).target as THREE.Vector3;
      // Soft lerp camera target towards center X
      target.x = THREE.MathUtils.lerp(target.x, centerX, 0.03);
    }
  });
  return null;
};

export const AQVECanvas: React.FC<AQVECanvasProps> = ({ sceneState }) => {
  return (
    <Canvas shadows camera={{ position: [0, 3, 10], fov: 45 }}>
      {/* @ts-ignore */}
      <color attach="background" args={['#111111']} />
      
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />
      
      {/* Environment lighting for premium reflections */}
      <Environment preset="city" />

      {/* Grid helper for visual reference */}
      <Grid 
        position={[0, -0.5, 0]} 
        args={[30, 30]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor="#2a2a2a" 
        sectionSize={3} 
        sectionThickness={1} 
        sectionColor="#444444" 
        fadeDistance={25} 
        fadeStrength={1} 
      />

      <ContactShadows position={[0, -0.49, 0]} opacity={0.6} scale={20} blur={2.5} far={4} />

      {/* Camera logic */}
      <CameraRig sceneState={sceneState} />

      {/* Passively render all elements from the scene state */}
      {sceneState && Array.from(sceneState.elements.values()).map((element: any) => (
        <SceneElementRenderer key={element.id} element={element} />
      ))}

      {/* Basic camera controls */}
      <OrbitControls makeDefault />
    </Canvas>
  );
};
