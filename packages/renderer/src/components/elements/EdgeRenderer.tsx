import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EdgeElement, SceneState } from '@aqvl/runtime';
import { Line } from '@react-three/drei';
import {
  isElementActive,
  getHighlightAccentColor,
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
  MATERIAL_PRESETS,
} from '@aqvl/shared';
import * as THREE from 'three';

export interface EdgeRendererProps {
  element: EdgeElement;
  sceneState: SceneState;
}

export const EdgeRenderer: React.FC<EdgeRendererProps> = ({ element, sceneState }) => {
  const lineRef = useRef<any>(null);
  const arrowRef = useRef<THREE.Mesh>(null);
  const arrowMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const highlightProgress = useRef<number>(0);

  const initialMatConfig = getUnifiedMaterialConfig({
    category: 'EDGE',
    state: element.state,
    color: element.color,
    emissiveColor: element.emissiveColor,
    emissiveIntensity: element.emissiveIntensity,
    opacity: element.opacity,
    highlightProgress: 0,
  });

  useFrame((state, delta) => {
    const sourceEl = sceneState.elements.get(element.sourceId);
    const targetEl = sceneState.elements.get(element.targetId);

    const sourceActive = sourceEl ? isElementActive(sourceEl) : false;
    const targetActive = targetEl ? isElementActive(targetEl) : false;
    const edgeActive = isElementActive(element) || sourceActive || targetActive;

    const time = state.clock.getElapsedTime();

    highlightProgress.current = THREE.MathUtils.lerp(
      highlightProgress.current,
      edgeActive ? 1.0 : 0.0,
      Math.min(1.0, delta * 12)
    );

    const currentProgress = highlightProgress.current;

    if (sourceEl && targetEl && lineRef.current) {
      const p1 = new THREE.Vector3(sourceEl.position.x, sourceEl.position.y, sourceEl.position.z);
      const p2 = new THREE.Vector3(targetEl.position.x, targetEl.position.y, targetEl.position.z);
      let points = [p1, p2];
      const anyEl = element as any;
      let isCurve = anyEl.backward || anyEl.circular;
      let curve: THREE.QuadraticBezierCurve3 | null = null;

      if (isCurve) {
        const mid = p1.clone().lerp(p2, 0.5);
        mid.y += anyEl.circular ? -2 : 1.5;
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

      // Centralized Material System updates
      const matConfig = getUnifiedMaterialConfig({
        category: 'EDGE',
        state: element.state,
        color: element.color,
        emissiveColor: element.emissiveColor,
        emissiveIntensity: element.emissiveIntensity,
        opacity: element.opacity,
        highlightProgress: currentProgress,
        time,
      });

      if (lineRef.current.material) {
        lineRef.current.material.color.copy(matConfig.color);
        const baseLineWidth = MATERIAL_PRESETS.EDGE.lineWidth ?? 2.5;
        const targetLineWidth = baseLineWidth + currentProgress * 2.5; // 2.5px inactive -> 5.0px active
        if (typeof lineRef.current.material.linewidth !== 'undefined') {
          lineRef.current.material.linewidth = targetLineWidth;
        }
        lineRef.current.material.opacity = matConfig.opacity;
        lineRef.current.material.transparent = matConfig.transparent;
      }

      if (arrowMaterialRef.current) {
        applyUnifiedMaterial(arrowMaterialRef.current, matConfig);
      }

      // If directed, update arrowhead position/rotation
      if (element.directed && arrowRef.current) {
        const distance = p1.distanceTo(p2);
        if (distance > 0.6) {
          let arrowPos: THREE.Vector3;
          let dir: THREE.Vector3;

          if (isCurve && curve) {
            const curveLength = curve.getLength();
            const t = Math.max(0, 1 - 0.7 / curveLength);
            arrowPos = curve.getPointAt(t);
            dir = curve.getTangentAt(t).normalize();
          } else {
            dir = new THREE.Vector3().subVectors(p2, p1).normalize();
            arrowPos = p2.clone().sub(dir.clone().multiplyScalar(0.7));
          }

          arrowRef.current.position.copy(arrowPos);
          arrowRef.current.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
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
      <Line
        ref={lineRef}
        points={[[0, 0, 0], [0, 0, 0]]}
        color={`#${initialMatConfig.color.getHexString()}`}
        lineWidth={MATERIAL_PRESETS.EDGE.lineWidth ?? 2.5}
        dashed={false}
      />
      {element.directed && (
        <mesh ref={arrowRef}>
          <coneGeometry args={[0.15, 0.4, 8]} />
          <meshStandardMaterial
            ref={arrowMaterialRef}
            color={initialMatConfig.color}
            emissive={initialMatConfig.emissive}
            emissiveIntensity={initialMatConfig.emissiveIntensity}
            roughness={initialMatConfig.roughness}
            metalness={initialMatConfig.metalness}
            opacity={initialMatConfig.opacity}
            transparent={initialMatConfig.transparent}
          />
        </mesh>
      )}
    </group>
  );
};
