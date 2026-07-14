import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EdgeElement, SceneState } from '@aqvl/runtime';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

export interface EdgeRendererProps {
  element: EdgeElement;
  sceneState: SceneState;
}

export const EdgeRenderer: React.FC<EdgeRendererProps> = ({ element, sceneState }) => {
  const lineRef = useRef<any>(null);
  const arrowRef = useRef<THREE.Mesh>(null);

  // We need to continuously update the line endpoints to track moving source/target
  useFrame(() => {
    const sourceEl = sceneState.elements.get(element.sourceId);
    const targetEl = sceneState.elements.get(element.targetId);

    if (sourceEl && targetEl && lineRef.current) {
      const p1 = new THREE.Vector3(sourceEl.position.x, sourceEl.position.y, sourceEl.position.z);
      const p2 = new THREE.Vector3(targetEl.position.x, targetEl.position.y, targetEl.position.z);
      let points = [p1, p2];
      const anyEl = element as any;
      let isCurve = anyEl.backward || anyEl.circular;
      let curve: THREE.QuadraticBezierCurve3 | null = null;
      
      if (isCurve) {
        const mid = p1.clone().lerp(p2, 0.5);
        mid.y += (anyEl.circular ? -2 : 1.5);
        curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
        points = curve.getPoints(20);
      }
      
      // Update line points safely for Drei Line / Line2
      if (lineRef.current.geometry && typeof lineRef.current.geometry.setPositions === 'function') {
        const flatArray: number[] = [];
        points.forEach((p: THREE.Vector3) => {
          flatArray.push(p.x, p.y, p.z);
        });
        lineRef.current.geometry.setPositions(flatArray);
      } else if (typeof lineRef.current.setPoints === 'function') {
        lineRef.current.setPoints(points);
      }

      // If directed, update arrowhead position/rotation
      if (element.directed && arrowRef.current) {
        const distance = p1.distanceTo(p2);
        if (distance > 0.6) {
          let arrowPos: THREE.Vector3;
          let dir: THREE.Vector3;
          
          if (isCurve && curve) {
            // For a curve, calculate position and tangent near the end
            arrowPos = curve.getPointAt(0.9);
            dir = curve.getTangentAt(0.9).normalize();
          } else {
            // Place arrowhead slightly before the target center so it doesn't clip into the box too much
            dir = new THREE.Vector3().subVectors(p2, p1).normalize();
            arrowPos = p2.clone().sub(dir.clone().multiplyScalar(0.7));
          }
          
          arrowRef.current.position.copy(arrowPos);
          arrowRef.current.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), // Cone default points UP (Y-axis)
            dir
          );
          arrowRef.current.visible = true;
        } else {
          arrowRef.current.visible = false;
        }
      }
    }
  });

  return (
    <group>
      {/* The Line component from drei */}
      <Line
        ref={lineRef}
        points={[[0, 0, 0], [0, 0, 0]]}
        color={element.color || '#888888'}
        lineWidth={3}
        dashed={false}
      />
      {element.directed && (
        <mesh ref={arrowRef}>
          <coneGeometry args={[0.15, 0.4, 8]} />
          <meshStandardMaterial 
            color={element.color || '#888888'} 
            emissive={element.emissiveColor || '#000000'} 
            emissiveIntensity={element.emissiveIntensity || 0} 
          />
        </mesh>
      )}
    </group>
  );
};
