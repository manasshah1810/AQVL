import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text } from '@react-three/drei';
import {
  isElementActive,
  getUnifiedMaterialConfig,
  applyUnifiedMaterial,
  MATERIAL_PRESETS,
} from '@aqvl/shared';
import * as THREE from 'three';
import { EdgeRoute, EdgeStyle, HighlightState, Vec3 } from './types';

export interface PrimitiveEdgeProps {
  from: Vec3;
  to: Vec3;
  color?: string;
  emissiveColor?: string;
  style?: EdgeStyle;
  highlightState?: HighlightState;
  /**
   * How the connection is drawn between the two points (default: a straight
   * line). Pointer edges use it to keep a doubly-linked pair's two arrows
   * apart and to bend long back-pointers (a circular list's wrap-around, a
   * cycle) over the row instead of through the nodes in between.
   */
  route?: EdgeRoute;
  /** Radius of the node the arrow points at — the arrowhead stops at its surface. */
  targetRadius?: number;
  /** Arrowhead size multiplier (1 = default). */
  arrowScale?: number;
  /** Lowest opacity the edge is drawn with, even when idle (idle edges are otherwise faint). */
  minOpacity?: number;
  /** Text drawn at the middle of the path, e.g. a weighted graph edge's weight. */
  label?: string;
}

const ARC_SAMPLES = 28;

/** Points along the edge's path, from source to target. */
function buildPath(from: Vec3, to: Vec3, route: EdgeRoute | undefined): THREE.Vector3[] {
  const offset = route?.offset ?? 0;
  const p1 = new THREE.Vector3(from.x, from.y + offset, from.z);
  const p2 = new THREE.Vector3(to.x, to.y + offset, to.z);

  if (route?.kind === 'loop') {
    // Self-pointer (a one-node circular list): a small loop over the node.
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= ARC_SAMPLES; i++) {
      const a = -Math.PI / 3 + (i / ARC_SAMPLES) * (Math.PI * 5) / 3;
      pts.push(new THREE.Vector3(from.x + Math.cos(a) * 0.4, from.y + 0.95 + Math.sin(a) * 0.4, from.z));
    }
    return pts;
  }

  if (route?.kind === 'arc') {
    const height = route.height ?? 1.2;
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    const control = mid.add(new THREE.Vector3(0, height * 2, 0));
    const curve = new THREE.QuadraticBezierCurve3(p1, control, p2);
    return curve.getPoints(ARC_SAMPLES);
  }

  return [p1, p2];
}

/** Arrowhead placement: its centre sits `stopAt` short of the target, pointing along the path. */
function arrowPlacement(points: THREE.Vector3[], target: THREE.Vector3, stopAt: number) {
  for (let i = points.length - 2; i >= 0; i--) {
    const a = points[i];
    const b = points[i + 1];
    const da = a.distanceTo(target);
    if (da < stopAt) continue;
    const db = b.distanceTo(target);
    const t = da === db ? 0 : Math.min(1, Math.max(0, (da - stopAt) / (da - db)));
    const dir = b.clone().sub(a);
    if (dir.lengthSq() < 1e-12) continue;
    return { pos: a.clone().lerp(b, t), dir: dir.normalize() };
  }
  return null;
}

export const PrimitiveEdge: React.FC<PrimitiveEdgeProps> = ({
  from,
  to,
  color,
  emissiveColor,
  style = 'solid',
  highlightState,
  route,
  targetRadius = 0.6,
  arrowScale = 1,
  minOpacity,
  label,
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

  const coneLength = 0.25 * arrowScale;
  const coneRadius = 0.08 * arrowScale;
  const initialPoints = buildPath(from, to, route);
  const labelPoint = initialPoints[Math.floor((initialPoints.length - 1) / 2)].clone().lerp(
    initialPoints[Math.ceil((initialPoints.length - 1) / 2)],
    0.5
  );

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
      const points = buildPath(from, to, route);

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
      if (minOpacity !== undefined && matConfig.opacity < minOpacity) {
        matConfig.opacity = minOpacity;
      }

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
        const target = route?.kind === 'loop' ? points[points.length - 1] : new THREE.Vector3(to.x, to.y + (route?.offset ?? 0), to.z);
        const stopAt = route?.kind === 'loop' ? coneLength / 2 : Math.sqrt(Math.max(0, targetRadius * targetRadius - (route?.offset ?? 0) ** 2)) + coneLength / 2;
        const placement = points.length >= 2 && (route?.kind === 'loop' || points[0].distanceTo(points[points.length - 1]) > 0.6)
          ? arrowPlacement(points, target, stopAt)
          : null;
        if (placement) {
          arrowRef.current.position.copy(placement.pos);
          arrowRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), placement.dir);
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
        points={initialPoints.map((p) => [p.x, p.y, p.z] as [number, number, number])}
        color={`#${initialMatConfig.color.getHexString()}`}
        lineWidth={MATERIAL_PRESETS.EDGE.lineWidth ?? 2.5}
        dashed={style === 'dashed'}
        dashSize={style === 'dashed' ? 0.15 : undefined}
        gapSize={style === 'dashed' ? 0.1 : undefined}
      />
      {label && (
        <Text
          position={[labelPoint.x, labelPoint.y + 0.22, labelPoint.z + 0.05]}
          fontSize={0.3}
          color="#fbbf24"
          outlineWidth={0.03}
          outlineColor="#0b1120"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
      {style === 'arrow' && (
        <mesh ref={arrowRef}>
          <coneGeometry args={[coneRadius, coneLength, 12]} />
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
