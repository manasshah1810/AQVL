import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { MATERIAL_PRESETS } from '@aqvl/shared';
import { Vec3 } from '../generic/types';
import { ArrayElementState, getArrayElementVisualTreatment } from './elementStates';
import { formatArrayValue, getIndexLabelDensityConfig, getValueLabelDensityConfig } from './valueFormatting';

export interface ArrayElementNodeProps {
  /** Resting (non-lifted) world position of this element's slot. */
  position: Vec3;
  /** Array index, used for the secondary `arr[i]` label. */
  index: number;
  value: number | string | boolean;
  state?: ArrayElementState;
  /** Total element count, used to scale label density (see valueFormatting.ts). */
  arrayLength: number;
  /** Largest |value| in the array, used to normalize magnitude-scaling height. Defaults to |value|. */
  maxAbsValue?: number;
  /** Opt-in "bar mode": element height scales with value (spec §2). */
  magnitudeScaling?: boolean;
  /** Forces value/index labels back on even past the density hide-threshold. */
  forceShowLabels?: boolean;
}

const BASE_ARGS: [number, number, number] = [1, 1, 1];
const MIN_HEIGHT_RATIO = 0.3;
const RING_BURST_DURATION = 0.6;
const RING_BURST_OFFSET = 0.1;

interface RingBurstProps {
  color: string;
  emissiveColor: string;
  active: boolean;
}

const RingBurst: React.FC<RingBurstProps> = ({ color, emissiveColor, active }) => {
  const startRef = useRef<number | null>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!active) {
      startRef.current = null;
      return;
    }
    const now = state.clock.getElapsedTime();
    if (startRef.current === null) startRef.current = now;
    const elapsed = now - startRef.current;

    applyRingFrame(ring1.current, elapsed);
    applyRingFrame(ring2.current, elapsed - RING_BURST_OFFSET);
  });

  function applyRingFrame(mesh: THREE.Mesh | null, t: number) {
    if (!mesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (t < 0 || t > RING_BURST_DURATION) {
      material.opacity = 0;
      return;
    }
    const p = t / RING_BURST_DURATION;
    const scale = 1 + p * 1.5;
    mesh.scale.set(scale, scale, scale);
    material.opacity = (1 - p) * 0.85;
  }

  if (!active) return null;

  return (
    <>
      <mesh ref={ring1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.75, 0.04, 16, 48]} />
        <meshStandardMaterial color={color} emissive={emissiveColor} transparent opacity={0} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.75, 0.04, 16, 48]} />
        <meshStandardMaterial color={color} emissive={emissiveColor} transparent opacity={0} />
      </mesh>
    </>
  );
};

/**
 * Specialized array-element visual, built alongside (not inside) the generic
 * PrimitiveNode: it owns its own per-frame material/position/scale animation
 * so every array element state from the visual-language spec can hit its
 * exact color/emissive/lift/pulse combination, rather than going through
 * PrimitiveNode's structure-agnostic highlight heuristics.
 */
export const ArrayElementNode: React.FC<ArrayElementNodeProps> = ({
  position,
  index,
  value,
  state = 'default',
  arrayLength,
  maxAbsValue,
  magnitudeScaling = false,
  forceShowLabels = false,
}) => {
  const treatment = getArrayElementVisualTreatment(state);
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const currentHeightRatio = useRef<number>(1);

  const targetHeightRatio = useMemo(() => {
    if (!magnitudeScaling || typeof value !== 'number' || Number.isNaN(value)) return 1;
    const denom = maxAbsValue && maxAbsValue > 0 ? maxAbsValue : Math.max(Math.abs(value), 1e-9);
    const ratio = Math.abs(value) / denom;
    return Math.max(MIN_HEIGHT_RATIO, Math.min(1, ratio));
  }, [magnitudeScaling, value, maxAbsValue]);

  useFrame((state3f, delta) => {
    const time = state3f.clock.getElapsedTime();

    currentHeightRatio.current = THREE.MathUtils.lerp(
      currentHeightRatio.current,
      targetHeightRatio,
      Math.min(1, delta * 6)
    );

    let liftY = treatment.liftY;
    if (treatment.pulseHz && !treatment.staticHold) {
      liftY += Math.sin(time * treatment.pulseHz * Math.PI * 2) * 0.02;
    }

    if (groupRef.current) {
      groupRef.current.position.set(position.x, position.y + liftY, position.z);
      groupRef.current.scale.set(
        treatment.scale,
        treatment.scale * currentHeightRatio.current,
        treatment.scale
      );
    }

    let opacity = treatment.opacity;
    if (treatment.flicker) {
      const cyclePosition = (time % 0.6) / 0.6;
      opacity = cyclePosition < 0.25 ? Math.min(treatment.opacity, 0.7) : treatment.opacity;
    }

    let emissiveIntensity = treatment.emissiveIntensity;
    if (treatment.pulseHz) {
      const pulse = (Math.sin(time * treatment.pulseHz * Math.PI * 2) + 1) / 2;
      emissiveIntensity = THREE.MathUtils.lerp(0.1, treatment.emissiveIntensity, pulse);
    }

    if (materialRef.current) {
      materialRef.current.color.set(treatment.color);
      materialRef.current.emissive.set(treatment.emissiveColor);
      materialRef.current.emissiveIntensity = emissiveIntensity;
      materialRef.current.opacity = opacity;
      materialRef.current.transparent = opacity < 0.999;
    }
  });

  const valueDensity = getValueLabelDensityConfig(arrayLength, forceShowLabels);
  const indexDensity = getIndexLabelDensityConfig(arrayLength, forceShowLabels);
  const formattedValue = formatArrayValue(value);

  return (
    <group>
      <group ref={groupRef}>
        <RoundedBox
          args={BASE_ARGS}
          radius={MATERIAL_PRESETS.NODE.bevelRadius ?? 0.1}
          smoothness={4}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            ref={materialRef}
            color={treatment.color}
            emissive={treatment.emissiveColor}
            emissiveIntensity={treatment.emissiveIntensity}
            roughness={MATERIAL_PRESETS.NODE.roughness}
            metalness={MATERIAL_PRESETS.NODE.metalness}
            opacity={treatment.opacity}
            transparent={treatment.opacity < 0.999}
          />
        </RoundedBox>

        {valueDensity.visible && (
          <Text
            position={[0, 0, 0.51]}
            fontSize={valueDensity.fontSize}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {formattedValue}
          </Text>
        )}

        {indexDensity.visible && (
          <Text
            position={[0, -0.8, 0]}
            fontSize={indexDensity.fontSize}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            {`arr[${index}]`}
          </Text>
        )}

        {treatment.staticHold && (
          <mesh position={[0, -0.5 - treatment.liftY / 2, 0]}>
            <cylinderGeometry args={[0.015, 0.015, treatment.liftY + 1, 8]} />
            <meshStandardMaterial
              color={treatment.color}
              emissive={treatment.emissiveColor}
              emissiveIntensity={0.6}
              transparent
              opacity={0.6}
            />
          </mesh>
        )}

        {treatment.floorStrip && (
          <mesh position={[0, -0.52, 0]}>
            <boxGeometry args={[1, 0.03, 0.15]} />
            <meshStandardMaterial
              color={treatment.color}
              emissive={treatment.emissiveColor}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
            />
          </mesh>
        )}

        <RingBurst color={treatment.color} emissiveColor={treatment.emissiveColor} active={treatment.ringBurst} />
      </group>
    </group>
  );
};
