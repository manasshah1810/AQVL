import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Sphere } from '@react-three/drei';
import { SceneElement } from '@aqvl/runtime';
import * as THREE from 'three';

export interface SphereRendererProps {
  element: SceneElement;
}

export const SphereRenderer: React.FC<SphereRendererProps> = ({ element }) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (groupRef.current) {
      if (element.position) {
        groupRef.current.position.set(element.position.x, element.position.y, element.position.z);
      }
      if (element.scale) {
        groupRef.current.scale.set(element.scale.x, element.scale.y, element.scale.z);
      }
    }
    
    if (materialRef.current) {
      if (element.color) {
        materialRef.current.color.set(element.color);
      }
      if (element.emissiveColor) {
        materialRef.current.emissive.set(element.emissiveColor);
      }
      if (element.emissiveIntensity !== undefined) {
        materialRef.current.emissiveIntensity = element.emissiveIntensity;
      }
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        <Sphere args={[0.6, 32, 32]} castShadow receiveShadow>
          <meshStandardMaterial 
            ref={materialRef} 
            color={element.color || '#4facfe'} 
            roughness={0.2}
            metalness={0.1}
          />
        </Sphere>
        
        <Text
          position={[0, 0, 0.61]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {String((element as any).value)}
        </Text>

        {(element as any).label && (
          <Text
            position={[0, -0.9, 0]}
            fontSize={0.25}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            {(element as any).label}
          </Text>
        )}
      </group>
    </group>
  );
};
