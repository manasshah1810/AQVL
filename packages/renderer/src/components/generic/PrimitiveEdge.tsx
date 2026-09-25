import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import {
  isElementActive,
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
  MATERIAL_PRESETS,
} from '@aqvl/shared';
import * as THREE from 'three';
import { EdgeStyle, HighlightState, Vec3 } from './types';

export interface PrimitiveEdgeProps {
  from: Vec3;
  to: Vec3;
  color?: string;
  emissiveColor?: string;
  style?: EdgeStyle;
  highlightState?: HighlightState;
}

export const PrimitiveEdge: React.FC<PrimitiveEdgeProps> = ({
  from,
  to,
  color,
  emissiveColor,
  style = 'solid',
  highlightState,
}) => {
  const lineRef = useRef<any>(null);
  const arrowRef = useRef<THREE.Mesh>(null);
  const arrowMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const highlightProgress = useRef<number>(0);

  const initialMatConfig = getUnifiedMaterialConfig({
    category: 'EDGE',
    state: highlightState?.state,
    color,
    emissiveColor,
    highlightProgress: 0,
  });

  useFrame((state, delta) => {
    const active = isElementActive(highlightState ?? {});
    const time = state.clock.getElapsedTime();

    highlightProgress.current = THREE.MathUtils.lerp(
      highlightProgress.current,
      active ? 1.0 : 0.0,
      Math.min(1.0, delta * 12)
    );

    const currentProgress = highlightProgress.current;

    if (lineRef.current) {
      const p1 = new THREE.Vector3(from.x, from.y, from.z);
      const p2 = new THREE.Vector3(to.x, to.y, to.z);
      const points = [p1, p2];

      if (lineRef.current.geometry && typeof lineRef.current.geometry.setPositions === 'function') {
        const flatArray: number[] = [];
        points.forEach((p) => flatArray.push(p.x, p.y, p.z));
        lineRef.current.geometry.setPositions(flatArray);
      } else if (typeof lineRef.current.setPoints === 'function') {
        lineRef.current.setPoints(points);
      }

      const matConfig = getUnifiedMaterialConfig({
        category: 'EDGE',
        state: highlightState?.state,
        color,
        emissiveColor,
        highlightProgress: currentProgress,
        time,
      });

      if (lineRef.current.material) {
        lineRef.current.material.color.copy(matConfig.color);
        const baseLineWidth = MATERIAL_PRESETS.EDGE.lineWidth ?? 2.5;
        const targetLineWidth = baseLineWidth + currentProgress * 2.5;
        if (typeof lineRef.current.material.linewidth !== 'undefined') {
          lineRef.current.material.linewidth = targetLineWidth;
        }
        lineRef.current.material.opacity = matConfig.opacity;
        lineRef.current.material.transparent = matConfig.transparent;
      }

      if (arrowMaterialRef.current) {
        applyUnifiedMaterial(arrowMaterialRef.current, matConfig);
      }

      if (style === 'arrow' && arrowRef.current) {
        const distance = p1.distanceTo(p2);
        if (distance > 0.6) {
          const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
          const arrowPos = p2.clone().sub(dir.clone().multiplyScalar(0.62));

          arrowRef.current.position.copy(arrowPos);
          arrowRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
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
        points={[
          [from.x, from.y, from.z],
          [to.x, to.y, to.z],
        ]}
        color={`#${initialMatConfig.color.getHexString()}`}
        lineWidth={MATERIAL_PRESETS.EDGE.lineWidth ?? 2.5}
        dashed={style === 'dashed'}
        dashSize={style === 'dashed' ? 0.15 : undefined}
        gapSize={style === 'dashed' ? 0.1 : undefined}
      />
      {style === 'arrow' && (
        <mesh ref={arrowRef}>
          <coneGeometry args={[0.08, 0.25, 8]} />
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
