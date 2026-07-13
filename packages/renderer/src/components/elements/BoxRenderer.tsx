import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import { BoxElement } from '@aqvl/runtime';
import * as THREE from 'three';

export interface BoxRendererProps {
  element: BoxElement;
}

export const BoxRenderer: React.FC<BoxRendererProps> = ({ element }) => {
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
      {/* Animated part: the box and the value */}
      <group ref={groupRef}>
        <RoundedBox args={[1, 1, 1]} radius={0.1} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial 
            ref={materialRef} 
            color={element.color || '#4facfe'} 
            roughness={0.2}
            metalness={0.1}
          />
        </RoundedBox>
        
        <Text
          position={[0, 0, 0.51]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {String(element.value)}
        </Text>
      </group>

      {/* Fixed part: the label remains at the element's original logical slot */}
      {element.label && element.logicalIndex !== undefined && (
        <Text
          position={[element.logicalIndex * 1.5, -0.8, 0]}
          fontSize={0.25}
          color="#aaaaaa"
          anchorX="center"
          anchorY="middle"
        >
          {element.label}
        </Text>
      )}
    </group>
  );
};
