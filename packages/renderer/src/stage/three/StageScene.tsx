import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { PerspectiveCamera, Vector3 } from 'three';
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
import { StageEnvironment } from './StageEnvironment';
import { FrameProbe, QUALITY, type QualityTier } from './quality';

export const STAGE_FOV = 38;

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
  const dof = useRef<DepthOfFieldEffect>(null);
  const focusPoint = useMemo(() => new Vector3(), []);
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
    camera.far = 400;
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
    focusPoint.set(pose.focus[0], pose.focus[1], pose.focus[2]);
    if (follow) {
      camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
      camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
      controls.current?.target.set(pose.target[0], pose.target[1], pose.target[2]);
    }
    if (dof.current) {
      dof.current.target = focusPoint;
      dof.current.cocMaterial.focusRange = Math.max(10, bounds.radius * 3);
    }
    driver.publish(sample);
  });

  const effects = [];
  if (quality.depthOfField && !calm) effects.push(<DepthOfField key="dof" ref={dof} focusRange={10} bokehScale={1} resolutionScale={0.5} />);
  if (model.palette.bloom > 0) {
    effects.push(<Bloom key="bloom" mipmapBlur luminanceThreshold={0.86} luminanceSmoothing={0.1} intensity={0.9 * model.palette.bloom} radius={0.6} />);
  }
  effects.push(<Vignette key="vignette" offset={0.3} darkness={model.theme === 'dark' ? 0.55 : 0.22} />);
  effects.push(<Noise key="noise" premultiply opacity={0.03} blendFunction={BlendFunction.ADD} />);
  effects.push(<ToneMapping key="tone" mode={ToneMappingMode.NEUTRAL} />);

  return (
    <>
      <StageEnvironment model={model} quality={quality} bounds={bounds} />
      <NodeBodies model={model} driver={driver} shadows={quality.shadows} sphereSegments={quality.sphereSegments} />
      <EdgeRods model={model} driver={driver} shadows={quality.shadows} additive={model.theme === 'dark'} />
      <FloorDecals driver={driver} floorY={model.floorY} />
      <HaloRings driver={driver} glow={model.theme === 'dark' ? 1.15 : 0.9} additive={model.theme === 'dark'} />
      <LabelLayer model={model} driver={driver} fonts={fonts} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={140}
        maxPolarAngle={Math.PI / 2 - 0.04}
        onStart={() => {
          if (follow) onFollowChange(false);
        }}
      />
      {quality.post && (
        <EffectComposer multisampling={quality.multisampling} enableNormalPass={false}>
          {effects}
        </EffectComposer>
      )}
    </>
  );
}
