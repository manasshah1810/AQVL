import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { getUnifiedMaterialConfig, applyUnifiedMaterial, MATERIAL_PRESETS } from '@aqvl/shared';
import { buildPath } from '../generic/PrimitiveEdge';
import type { EdgeRoute, HighlightState, Vec3 } from '../generic/types';

/**
 * A linked-list pointer (`next` / `prev`) that is never just "there": it
 * DRAWS itself from the node that owns it to the node it points at, the
 * arrowhead riding the growing tip so the direction is unmistakable, and a
 * pointer that stops existing RETRACTS back into its owner while fading.
 * LinearPointerLayer pairs the two when a pointer is reassigned, so the old
 * arrow withdraws while the new one draws — the reference visibly changes.
 */
export interface PointerArrowProps {
  from: Vec3;
  to: Vec3;
  route?: EdgeRoute;
  color?: string;
  emissiveColor?: string;
  highlightState?: HighlightState;
  mode: 'draw' | 'retract';
  /** Tint for a retracting arrow (the "just removed" accent). */
  retractColor?: string;
  /** Called once a retracting arrow has fully withdrawn. */
  onDone?: () => void;
}

export const DRAW_SECONDS = 0.5;
export const RETRACT_SECONDS = 0.45;
/** Samples along the visible part of the path (constant, so the line geometry is reused). */
const SAMPLES = 24;
const TARGET_RADIUS = 0.6;
const CONE_LENGTH = 0.4;
const CONE_RADIUS = 0.13;
const MIN_OPACITY = 0.85;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** The path cut short at the target node's surface (and at a self-loop's end). */
function trimmedPath(from: Vec3, to: Vec3, route?: EdgeRoute): THREE.Vector3[] {
  const points = buildPath(from, to, route);
  if (route?.kind === 'loop') return points;
  const target = new THREE.Vector3(to.x, to.y + (route?.offset ?? 0), to.z);
  const stopAt = Math.sqrt(Math.max(0, TARGET_RADIUS * TARGET_RADIUS - (route?.offset ?? 0) ** 2));
  const out: THREE.Vector3[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const db = b.distanceTo(target);
    if (db >= stopAt) {
      out.push(b);
      continue;
    }
    const da = a.distanceTo(target);
    const t = da === db ? 0 : Math.min(1, Math.max(0, (da - stopAt) / (da - db)));
    out.push(a.clone().lerp(b, t));
    break;
  }
  return out;
}

/** `SAMPLES` points covering the first `fraction` of the path's length. */
export function partialPath(points: THREE.Vector3[], fraction: number): THREE.Vector3[] {
  if (points.length < 2) return Array.from({ length: SAMPLES }, () => (points[0] ?? new THREE.Vector3()).clone());
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = lengths[lengths.length - 1];
  const upTo = total * Math.min(1, Math.max(0, fraction));
  const out: THREE.Vector3[] = [];
  let seg = 1;
  for (let s = 0; s < SAMPLES; s++) {
    const d = (upTo * s) / (SAMPLES - 1);
    while (seg < points.length - 1 && lengths[seg] < d) seg++;
    const a = points[Math.max(0, seg - 1)];
    const b = points[Math.min(points.length - 1, seg)];
    const span = lengths[seg] - lengths[seg - 1] || 1;
    out.push(a.clone().lerp(b, Math.min(1, Math.max(0, (d - (lengths[seg - 1] ?? 0)) / span))));
  }
  return out;
}

export const PointerArrow: React.FC<PointerArrowProps> = ({
  from,
  to,
  route,
  color,
  emissiveColor,
  highlightState,
  mode,
  retractColor = '#f87171',
  onDone,
}) => {
  const lineRef = useRef<any>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const coneMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  // draw: 0 -> 1, retract: 1 -> 0.
  const progress = useRef(mode === 'draw' ? 0 : 1);
  const finished = useRef(false);

  const initial = partialPath(trimmedPath(from, to, route), mode === 'draw' ? 0.001 : 1);

  useFrame((state, delta) => {
    if (mode === 'draw') progress.current = Math.min(1, progress.current + delta / DRAW_SECONDS);
    else progress.current = Math.max(0, progress.current - delta / RETRACT_SECONDS);
    const shown = mode === 'draw' ? easeOutCubic(progress.current) : easeOutCubic(progress.current);

    const points = partialPath(trimmedPath(from, to, route), Math.max(0.001, shown));
    const flat: number[] = [];
    points.forEach((p) => flat.push(p.x, p.y, p.z));

    const config = getUnifiedMaterialConfig({
      category: 'EDGE',
      state: mode === 'retract' ? undefined : highlightState?.state,
      color: mode === 'retract' ? retractColor : color,
      emissiveColor: mode === 'retract' ? retractColor : emissiveColor,
      highlightProgress: mode === 'draw' ? 1 - progress.current * 0.6 : 0,
      time: state.clock.getElapsedTime(),
    });
    config.opacity = Math.max(config.opacity, MIN_OPACITY) * (mode === 'retract' ? progress.current : 1);
    config.transparent = true;

    const line = lineRef.current;
    if (line?.geometry?.setPositions) line.geometry.setPositions(flat);
    if (line?.material) {
      line.material.color.copy(config.color);
      line.material.opacity = config.opacity;
      line.material.transparent = true;
      if (typeof line.material.linewidth !== 'undefined') {
        line.material.linewidth = (MATERIAL_PRESETS.EDGE.lineWidth ?? 2.5) + (mode === 'draw' ? (1 - progress.current) * 2 : 0);
      }
    }
    if (coneMaterialRef.current) applyUnifiedMaterial(coneMaterialRef.current, config);

    const cone = coneRef.current;
    if (cone) {
      const tip = points[points.length - 1];
      const before = points[points.length - 2];
      const dir = tip.clone().sub(before);
      if (dir.lengthSq() > 1e-8 && shown > 0.02) {
        dir.normalize();
        // The cone's base sits on the line's tip, pointing onward.
        cone.position.copy(tip.clone().sub(dir.clone().multiplyScalar(CONE_LENGTH / 2)));
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        cone.visible = true;
      } else {
        cone.visible = false;
      }
    }

    if (mode === 'retract' && progress.current <= 0 && !finished.current) {
      finished.current = true;
      onDone?.();
    }
  });

  return (
    <group>
      <Line
        ref={lineRef}
        points={initial.map((p) => [p.x, p.y, p.z] as [number, number, number])}
        color={color ?? '#cbd5e1'}
        lineWidth={MATERIAL_PRESETS.EDGE.lineWidth ?? 2.5}
        transparent
      />
      <mesh ref={coneRef} visible={false}>
        <coneGeometry args={[CONE_RADIUS, CONE_LENGTH, 14]} />
        <meshStandardMaterial ref={coneMaterialRef} color={color ?? '#cbd5e1'} transparent />
      </mesh>
    </group>
  );
};
