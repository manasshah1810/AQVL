import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneState, CameraFrameState } from '@aqvl/runtime';
import type { ArrayCameraChoreographer } from '../array/ArrayCameraChoreographer';

export interface CameraControllerProps {
  sceneState: SceneState | null;
  /** Fired whenever auto-follow (AUTO_FIT tracking, suspended by user drag) changes. */
  onAutoFollowChange?: (autoFollow: boolean) => void;
  /**
   * Optional array-operation camera emphasis (see ArrayCameraChoreographer.ts). When present,
   * AUTO_FIT blends its baseline whole-array framing with this choreographer's bounded
   * attention nudge instead of using the plain array-centroid/span framing directly. Absent by
   * default so every non-array structure (and every existing caller) is unaffected.
   */
  arrayCameraChoreographer?: ArrayCameraChoreographer;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface CameraControllerHandle {
  /** Re-enables auto-follow and returns orbit controls to their default pose. */
  reset: () => void;
  getAutoFollow: () => boolean;
  getMode: () => CameraFrameState['mode'] | 'AUTO_FIT';
  getTarget: () => Vec3Like;
  getCameraPosition: () => Vec3Like;
}

const LERP_TARGET = 0.04;
const LERP_ZOOM = 0.03;
const LERP_POSITION = 0.05;
const DEFAULT_ORBIT_SPEED = 0.3;
const MIN_ORBIT_RADIUS = 6;

export function computeAutoFitTarget(sceneState: SceneState): { center: Vec3Like; spanX: number } | null {
  if (!sceneState.elements) return null;

  let totalX = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let count = 0;
  let hasTree = false;
  let maxTreeY = 0;
  // Linked lists can span several rows (side-by-side lists, heap-memory
  // rows), so frame their full vertical extent too.
  let hasList = false;
  let minListY = Infinity;
  let maxListY = -Infinity;
  // A pointer tree's name and call-stack panel extend left of its anchor.
  let treeLabelX = Infinity;

  sceneState.elements.forEach((el) => {
    if (el.originalType === 'TREE_NODE' || el.originalType === 'HEAP_NODE' || el.originalType === 'TRIE_NODE') {
      hasTree = true;
      if (el.position && el.position.y > maxTreeY) maxTreeY = el.position.y;
    }
    if (
      el.originalType === 'LINKEDLIST_NODE' ||
      el.originalType === 'LINKEDLIST' ||
      // Pointer trees and their queues / stacks: framed the same way (rows of
      // tree levels, heap memory and containers).
      el.originalType === 'BINARYTREE' ||
      el.originalType === 'CONTAINER' ||
      el.originalType === 'CONTAINER_ITEM' ||
      (el.originalType === 'TREE_NODE' && /^bt:/.test(el.id))
    ) {
      hasList = true;
      const y = ((el as any).worldTarget ?? el.position)?.y ?? 0;
      minListY = Math.min(minListY, y);
      maxListY = Math.max(maxListY, y);
      if (el.originalType === 'BINARYTREE' || el.originalType === 'CONTAINER') {
        const x = ((el as any).worldTarget ?? el.position)?.x ?? 0;
        treeLabelX = Math.min(treeLabelX, x - (el.originalType === 'BINARYTREE' ? 3.6 : 2.4));
      }
    }
    if (el.position) {
      totalX += el.position.x;
      if (el.position.x < minX) minX = el.position.x;
      if (el.position.x > maxX) maxX = el.position.x;
      count++;
    }
  });

  if (count === 0) return null;

  if (hasList) {
    // Room above for HEAD / pointer tags; the span grows with the rows so everything fits.
    const top = maxListY + 1.6;
    const bottom = minListY - 1.2;
    if (Number.isFinite(treeLabelX)) minX = Math.min(minX, treeLabelX);
    return {
      center: { x: (minX + maxX) / 2, y: (top + bottom) / 2, z: 0 },
      // Scaled down: the shared distance curve is tuned for arrays of small
      // boxes and leaves a list (spheres + arrows + tags) needlessly far away.
      // A tree scene keeps a minimum span so a lone node isn't filling the view.
      spanX: Math.max(maxX - minX + 2, (top - bottom) * 1.9, Number.isFinite(treeLabelX) ? 11 : 0) * 0.72,
    };
  }

  return {
    center: { x: totalX / count, y: hasTree && maxTreeY > 0 ? maxTreeY / 2 : 0, z: 0 },
    spanX: maxX - minX,
  };
}

/**
 * Reads SET_CAMERA state off the current scene frame (`SceneState.camera`)
 * and drives the R3F camera/orbit-controls target accordingly. All mode
 * transitions are lerped so switching mode or target never snap-cuts.
 * Absent `sceneState.camera` (no CAMERA statement compiled) falls back to
 * AUTO_FIT, preserving the original CameraRig bounds-fit behavior.
 */
export const CameraController = forwardRef<CameraControllerHandle, CameraControllerProps>(
  ({ sceneState, onAutoFollowChange, arrayCameraChoreographer }, ref) => {
    const { controls, camera } = useThree();
    const [, forceRender] = useState(0);
    const autoFollowRef = useRef(true);
    const targetRef = useRef(new THREE.Vector3(0, 0, 0));
    const orbitAngleRef = useRef(0);
    const modeRef = useRef<CameraFrameState['mode'] | 'AUTO_FIT'>('AUTO_FIT');

    const setAutoFollow = (value: boolean) => {
      if (autoFollowRef.current === value) return;
      autoFollowRef.current = value;
      onAutoFollowChange?.(value);
      forceRender((n) => n + 1);
    };

    useImperativeHandle(ref, () => ({
      reset: () => {
        setAutoFollow(true);
        const ctrls = controls as any;
        if (ctrls?.reset) ctrls.reset();
      },
      getAutoFollow: () => autoFollowRef.current,
      getMode: () => modeRef.current,
      getTarget: () => ({ x: targetRef.current.x, y: targetRef.current.y, z: targetRef.current.z }),
      getCameraPosition: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
    }), [controls, camera]);

    useEffect(() => {
      const ctrls = controls as any;
      if (!ctrls?.addEventListener) return undefined;
      const handleStart = () => setAutoFollow(false);
      ctrls.addEventListener('start', handleStart);
      return () => ctrls.removeEventListener('start', handleStart);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controls]);

    useFrame((_state, delta) => {
      if (!sceneState) return;
      const cameraState: CameraFrameState | undefined = sceneState.camera;
      const mode = cameraState?.mode ?? 'AUTO_FIT';
      modeRef.current = mode;
      const ctrls = controls as any;
      const target = targetRef.current;

      switch (mode) {
        case 'AUTO_FIT': {
          if (!autoFollowRef.current) break;
          const fit = computeAutoFitTarget(sceneState);
          if (!fit) break;

          let desiredTargetX = fit.center.x;
          let desiredTargetY = fit.center.y;
          let desiredTargetZ: number | null = null;
          let desiredDistance: number | null = fit.spanX > 6 ? Math.max(10, Math.min(30, 8 + fit.spanX * 0.75)) : null;

          if (arrayCameraChoreographer) {
            arrayCameraChoreographer.update(delta * 1000);
            const baselineDistance = desiredDistance ?? camera.position.z;
            const emphasized = arrayCameraChoreographer.getCameraFrame(
              { target: fit.center, distance: baselineDistance },
              { center: fit.center, halfSpanX: fit.spanX / 2 }
            );
            desiredTargetX = emphasized.target.x;
            desiredTargetY = emphasized.target.y;
            desiredTargetZ = emphasized.target.z;
            desiredDistance = emphasized.distance;
          }

          target.x = THREE.MathUtils.lerp(target.x, desiredTargetX, LERP_TARGET);
          target.y = THREE.MathUtils.lerp(target.y, desiredTargetY, LERP_TARGET);
          if (desiredTargetZ !== null) {
            target.z = THREE.MathUtils.lerp(target.z, desiredTargetZ, LERP_TARGET);
          }
          if (desiredDistance !== null) {
            camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredDistance, LERP_ZOOM);
          }
          break;
        }

        case 'FOCUS': {
          const targetEl = cameraState?.targetId ? sceneState.elements?.get(cameraState.targetId) : undefined;
          if (!targetEl?.position) break;
          target.x = THREE.MathUtils.lerp(target.x, targetEl.position.x, LERP_POSITION);
          target.y = THREE.MathUtils.lerp(target.y, targetEl.position.y, LERP_POSITION);
          target.z = THREE.MathUtils.lerp(target.z, targetEl.position.z, LERP_POSITION);
          if (!ctrls) camera.lookAt(target);
          break;
        }

        case 'ORBIT': {
          const speed = cameraState?.speed ?? DEFAULT_ORBIT_SPEED;
          orbitAngleRef.current += speed * delta;
          const radius = Math.max(MIN_ORBIT_RADIUS, camera.position.distanceTo(target));
          const desiredX = target.x + Math.cos(orbitAngleRef.current) * radius;
          const desiredZ = target.z + Math.sin(orbitAngleRef.current) * radius;
          camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredX, LERP_POSITION);
          camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredZ, LERP_POSITION);
          camera.lookAt(target);
          break;
        }

        case 'POSITION': {
          const pos = cameraState?.position;
          if (!pos) break;
          camera.position.x = THREE.MathUtils.lerp(camera.position.x, pos.x, LERP_POSITION);
          camera.position.y = THREE.MathUtils.lerp(camera.position.y, pos.y, LERP_POSITION);
          camera.position.z = THREE.MathUtils.lerp(camera.position.z, pos.z, LERP_POSITION);
          if (!ctrls) camera.lookAt(target);
          break;
        }

        default:
          break;
      }

      if (ctrls?.target) {
        ctrls.target.copy(target);
        ctrls.update?.();
      }
    });

    return null;
  }
);

CameraController.displayName = 'CameraController';
