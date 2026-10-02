import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera } from 'three';
type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;
import type { StageModel } from '../model/StageModel';
import { ENVELOPE_SECONDS, StageSample, sampleStage } from '../model/sampler';
import { cameraAt } from '../model/camera';
import type { Playhead } from '../timeline/Playhead';
import { StageDriver } from './driver';
import { NodeBodies } from './NodeBodies';
import { EdgeRods } from './EdgeRods';
import { FloorDecals } from './FloorDecals';
import { HaloRings } from './HaloRings';
import { LabelLayer, type StageFonts } from './LabelLayer';
import { NO_SHADOW_LAYER, StageEnvironment } from './StageEnvironment';
import { NodeShadows } from './NodeShadows';
import { FrameProbe, QUALITY, type QualityTier } from './quality';

/** A long-ish lens: little perspective distortion, so rows stay rows and columns stay upright. */
export const STAGE_FOV = 26;

export interface StageSceneProps {
  model: StageModel;
  playhead: Playhead;
  tier: QualityTier;
  calm: boolean;
  follow: boolean;
  fonts: StageFonts;
  /** 'out' plays this scene's exit (a new program is replacing it). */
  phase: 'in' | 'steady' | 'out';
  onFollowChange: (follow: boolean) => void;
  onSlowFrames: () => void;
  /** Pixels covered by UI along the top (caption) and right (side panels). */
  insets: { top: number; right: number };
}

/**
 * Everything inside the canvas. One frame callback samples the trace at
 * the playhead's time, places the camera, and hands the sample to every
 * part of the scene; with nothing moving, nothing is redrawn.
 */
export function StageScene({ model, playhead, tier, calm, follow, fonts, phase, onFollowChange, onSlowFrames, insets }: StageSceneProps) {
  const quality = QUALITY[tier];
  const driver = useMemo(() => new StageDriver(), []);
  const sample = useMemo(() => new StageSample(model.slots.length, model.edgeSlots.length), [model]);
  const bounds = useMemo(() => model.sceneBounds(), [model]);
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const probe = useMemo(() => new FrameProbe(), []);
  const phaseStart = useRef(performance.now());
  const lastFrame = useRef(0);

  useEffect(() => {
    phaseStart.current = performance.now();
    invalidate();
  }, [phase, invalidate]);

  useEffect(() => {
    probe.reset();
  }, [tier, probe]);

  // Redraw whenever the playhead moves; otherwise the canvas rests.
  useEffect(() => playhead.onTick(() => invalidate()), [playhead, invalidate]);
  useEffect(() => {
    invalidate();
  }, [calm, follow, tier, model, invalidate, insets.top, insets.right]);

  useEffect(() => {
    camera.fov = STAGE_FOV;
    camera.near = 0.1;
    camera.far = 600;
    camera.layers.enable(NO_SHADOW_LAYER);
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame(() => {
    const now = performance.now();
    if (playhead.getSnapshot().playing && lastFrame.current > 0) {
      if (probe.add(now - lastFrame.current)) onSlowFrames();
    }
    lastFrame.current = now;

    const p = playhead.position();
    const elapsed = (now - phaseStart.current) / 1000;
    const envelope = phase === 'steady' ? undefined : { kind: phase, t: elapsed };
    sampleStage(model, p.k, p.tau, p.duration, sample, { reducedMotion: calm, envelope });
    if (phase !== 'steady' && elapsed < ENVELOPE_SECONDS + 0.1) invalidate();

    // UI panels over the canvas: shift the optical centre into the free area, and frame for that area.
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    const right = Math.min(insets.right, w * 0.45);
    const top = Math.min(insets.top, h * 0.35);
    if (right > 0 || top > 0) {
      camera.aspect = (w + right) / (h + top);
      camera.setViewOffset(w + right, h + top, right, 0, w, h);
    } else if (camera.view) {
      camera.aspect = w / h;
      camera.clearViewOffset();
    }
    const freeAspect = (w - right) / Math.max(1, h - top);
    const freeFov = (2 * Math.atan(Math.tan((STAGE_FOV * Math.PI) / 360) * ((h - top) / (h + top))) * 180) / Math.PI;
    const pose = cameraAt(model, playhead.table, playhead.time, freeAspect, freeFov, calm);
    if (follow) {
      camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
      camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
      controls.current?.target.set(pose.target[0], pose.target[1], pose.target[2]);
    }
    driver.publish(sample);
  });

  return (
    <>
      <StageEnvironment model={model} bounds={bounds} />
      <NodeBodies model={model} driver={driver} sphereSegments={quality.sphereSegments} />
      <EdgeRods model={model} driver={driver} />
      <FloorDecals driver={driver} floorY={model.floorY} />
      <NodeShadows model={model} driver={driver} color={model.palette.shadow} opacity={model.palette.shadowOpacity} />
      <HaloRings driver={driver} />
      <LabelLayer model={model} driver={driver} fonts={fonts} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={260}
        maxPolarAngle={Math.PI / 2 - 0.12}
        onStart={() => {
          if (follow) onFollowChange(false);
        }}
      />
    </>
  );
}
