import type React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneElement } from '@aqvl/runtime';
import type { CharacterController } from './CharacterController';
import type { ScreenAnchor } from './Character';

/**
 * Carries the screen position of whatever the character is pointing at from
 * inside the 3D canvas (where the camera is) out to the DOM overlay the
 * Character lives in. Framework-agnostic; listeners fire only on real moves.
 */
export class CharacterAnchorBridge {
  private anchor: ScreenAnchor | null = null;
  private listeners: ((a: ScreenAnchor | null) => void)[] = [];

  get(): ScreenAnchor | null {
    return this.anchor;
  }

  set(next: ScreenAnchor | null): void {
    const a = this.anchor;
    if (a === next) return;
    if (a && next && Math.abs(a.x - next.x) < 0.5 && Math.abs(a.y - next.y) < 0.5) return;
    this.anchor = next;
    this.listeners.forEach((l) => l(next));
  }

  subscribe(listener: (a: ScreenAnchor | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

/** A `pointAt` the tracker understands: the scene element to gesture at (e.g. from LinearDirector). */
function elementIdOf(pointAt: unknown): string | null {
  const id = (pointAt as { elementId?: unknown } | null)?.elementId;
  return typeof id === 'string' ? id : null;
}

/**
 * Mounted inside the Canvas: every frame, projects the element the current
 * line points at (`pointAt: { elementId }`) to canvas pixels and hands it to
 * the bridge, so the character's reach follows the element as it moves and
 * as the camera pans. Lines without an element id leave the character docked.
 */
export const CharacterAnchorTracker: React.FC<{
  controller: CharacterController;
  bridge: CharacterAnchorBridge;
  elements: Map<string, SceneElement> | undefined;
}> = ({ controller, bridge, elements }) => {
  const { camera, size } = useThree();
  useFrame(() => {
    const id = elementIdOf(controller.getCurrentLine()?.pointAt);
    const el = id ? elements?.get(id) : undefined;
    if (!el) {
      bridge.set(null);
      return;
    }
    const v = new THREE.Vector3(el.position.x, el.position.y + 0.55, el.position.z).project(camera);
    if (v.z > 1) {
      bridge.set(null);
      return;
    }
    bridge.set({ x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height });
  });
  return null;
};
