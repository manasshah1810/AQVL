import React, { memo, useEffect, useMemo, useRef } from 'react';
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
import { HeadroomProbe, ResolutionGovernor, resolutionGovernorEnabled, governor, markFrame, perfCounters, resolution } from './perf';
import { PerfMonitor } from './PerfMonitor';
import { perfMonitorEnabled } from './perf';
import { WorldLayer } from '../worlds/three/WorldLayer';
import { PandaNav, clampView, groveNav } from '../worlds/three/PandaNav';

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
  /** Where the resolution governor reports a change (the canvas redraws at the new pixel ratio). */
  onResolution: (index: number) => void;
  onSlowFrames: () => void;
  /** The scene has run comfortably at its target pace for a long while: quality may come back up a step. */
  onHeadroom?: () => void;
  /** Pixels covered by UI along the top (caption) and right (side panels). */
  insets: { top: number; right: number };
}

/**
 * Everything inside the canvas. One frame callback samples the trace at
 * the playhead's time, places the camera, and hands the sample to every
 * part of the scene; with nothing moving, nothing is redrawn.
 */
export const StageScene = memo(function StageScene({ model, playhead, tier, calm, follow, fonts, phase, onFollowChange, onResolution, onSlowFrames, onHeadroom, insets }: StageSceneProps) {
  const quality = QUALITY[tier];
  const driver = useMemo(() => new StageDriver(), []);
  const sample = useMemo(() => new StageSample(model.slots.length, model.edgeSlots.length), [model]);
  const bounds = useMemo(() => model.sceneBounds(), [model]);
  const controls = useRef<OrbitControlsImpl>(null);
  // The pandas' grove and the penguins' ice shelf are large: they get ground-plane panning, a walk from the keyboard,
  // and limits that match their size.
  const grove = model.world === 'panda' || model.world === 'penguin' || model.world === 'rabbit' ? groveNav(model) : null;
  // The cloud kingdom is explored up and down as well: the camera may dip below an island to look up at the ones above.
  const sky = model.world === 'rabbit';
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const probe = useMemo(() => new FrameProbe(), []);
  const headroom = useMemo(() => new HeadroomProbe(), []);
  const drs = useMemo(() => new ResolutionGovernor(19.5, resolution.index), [])
  const monitor = useMemo(() => perfMonitorEnabled(), []);
  const drsOn = useMemo(() => resolutionGovernorEnabled(), []);
  const phaseStart = useRef(performance.now());
  const lastFrame = useRef(0);
  // Pointer gesture on the canvas: has it moved far enough to count as a drag?
  const gesture = useRef({ active: false, moved: false });
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let x0 = 0, y0 = 0;
    const down = (e: PointerEvent) => {
      x0 = e.clientX;
      y0 = e.clientY;
      gesture.current.moved = false;
    };
    const move = (e: PointerEvent) => {
      if (e.buttons && Math.hypot(e.clientX - x0, e.clientY - y0) > 4) gesture.current.moved = true;
    };
    const wheel = () => {
      gesture.current.moved = true;
    };
    // Capture phase: seen before the orbit controls handle the same event.
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move, true);
    el.addEventListener('wheel', wheel, { passive: true, capture: true });
    return () => {
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move, true);
      el.removeEventListener('wheel', wheel, true);
    };
  }, [gl]);

  useEffect(() => {
    phaseStart.current = performance.now();
    invalidate();
  }, [phase, invalidate]);

  const lastTier = useRef(tier);
  useEffect(() => {
    probe.reset();
    // A tier change is a quality event: the probe that brings quality back up needs to know which way it went.
    const order = ['low', 'medium', 'high'];
    if (lastTier.current !== tier) headroom.changed(order.indexOf(tier) > order.indexOf(lastTier.current));
    lastTier.current = tier;
  }, [tier, probe, headroom]);

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
    markFrame(now);
    // Frames are continuous while the run plays or a living world is drawn; otherwise gaps are just the canvas resting.
    const continuous = playhead.getSnapshot().playing || (model.world !== 'studio' && !calm && !perfCounters.offscreen);
    if (continuous && lastFrame.current > 0) {
      const ms = now - lastFrame.current;
      // First resort: fewer pixels (the cost is mostly per pixel). Only when that is spent, or does not help, change tier or pace.
      const stepped = drsOn ? drs.add(ms, now) : null;
      if (stepped !== null) {
        resolution.index = drs.index;
        onResolution(drs.index);
        probe.reset();
      } else if (!drsOn || drs.exhausted(now)) {
        if (probe.add(ms)) onSlowFrames();
        // Already at the lightest tier and still slow: pace the ambient redraw instead (45 / 30 fps, evenly).
        else if (tier === 'low') governor.sample(ms);
      } else if (drs.index === 0 && tier !== 'high' && tier !== 'low' && onHeadroom && headroom.add(ms, 1000 / 60 + 2)) onHeadroom();
    }
    lastFrame.current = now;
    perfCounters.targetFps = governor.targetFps;

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
    perfCounters.jsMs = performance.now() - now;
  });

  return (
    <>
      {model.world === 'studio' ? <StageEnvironment model={model} bounds={bounds} /> : <WorldLayer model={model} bounds={bounds} driver={driver} calm={calm} playhead={playhead} />}
      <NodeBodies model={model} driver={driver} sphereSegments={quality.sphereSegments} />
      <EdgeRods model={model} driver={driver} />
      <FloorDecals driver={driver} floorY={model.floorY} />
      <NodeShadows model={model} driver={driver} color={model.palette.shadow} opacity={model.palette.shadowOpacity} />
      <HaloRings driver={driver} />
      <LabelLayer model={model} driver={driver} fonts={fonts} />
      {grove && <PandaNav model={model} controls={controls} onTakeOver={() => follow && onFollowChange(false)} />}
      {monitor && <PerfMonitor />}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={grove ? 0.1 : 0.08}
        minDistance={grove ? 3 : 2}
        maxDistance={grove ? grove.maxDistance : 260}
        maxPolarAngle={sky ? Math.PI * 0.8 : Math.PI / 2 - (grove ? 0.05 : 0.12)}
        {...(grove ? { screenSpacePanning: false, panSpeed: 1.6, zoomSpeed: 1.2, rotateSpeed: 0.8 } : {})}
        onStart={() => {
          gesture.current = { active: true, moved: false };
        }}
        onChange={() => {
          // A click (on a node, an animal, the scenery) keeps the camera following; only a real drag takes over.
          const g = gesture.current;
          if (g.active && g.moved && follow) onFollowChange(false);
          if (grove && controls.current) clampView(grove, camera, controls.current);
        }}
        onEnd={() => {
          gesture.current.active = false;
        }}
      />
    </>
  );
});
