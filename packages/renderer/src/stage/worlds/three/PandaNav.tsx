import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { StageModel } from '../../model/StageModel';
import { groveClearing } from './layout';

/** The most the viewer can get out of the grove (as a share of the clearing), and how low the camera may go. */
const REACH = 1.05;
const MIN_HEIGHT = 0.9;

/** Navigation limits for the (larger) grove: the same numbers feed the orbit controls and the keyboard walk. */
export function groveNav(model: StageModel) {
  const { clearX, clearZ } = groveClearing(model);
  const reachX = clearX * REACH;
  const reachZ = clearZ * REACH;
  return { reachX, reachZ, maxDistance: Math.max(reachX, reachZ) * 2.4 };
}

interface Controls { target: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }; update(): void }

/** Keep the point the camera orbits inside the grove, and the camera itself above the ground. */
export function clampView(nav: ReturnType<typeof groveNav>, camera: { position: { x: number; y: number; z: number } }, controls: Controls) {
  const t = controls.target;
  const x = Math.max(-nav.reachX, Math.min(nav.reachX, t.x));
  const z = Math.max(-nav.reachZ, Math.min(nav.reachZ, t.z));
  const dx = x - t.x, dz = z - t.z;
  if (dx || dz) {
    t.set(x, t.y, z);
    camera.position.x += dx;
    camera.position.z += dz;
  }
  if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;
}

/**
 * Walk the grove from the keyboard: W/S (or ↑/↓) forward and back, A/D (or ←/→) sideways, Q/E turn, R/F up and down,
 * Shift to go faster. The camera and its orbit point move together, so the view just glides over the ground.
 */
export function PandaNav({ model, controls, onTakeOver }: { model: StageModel; controls: React.RefObject<Controls | null>; onTakeOver: () => void }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const keys = useRef(new Set<string>());
  const nav = groveNav(model);

  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest?.('.cm-editor, [role="textbox"]'));
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (!'wasdqerf'.includes(k) || k.length !== 1) {
        if (!k.startsWith('arrow')) return;
      }
      keys.current.add(k);
      onTakeOver();
      invalidate();
      if (k.startsWith('arrow')) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => void keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [onTakeOver, invalidate, gl]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const held = keys.current;
    if (held.size) {
      const step = Math.min(dt, 0.05);
      const dist = Math.hypot(camera.position.x - c.target.x, camera.position.y - c.target.y, camera.position.z - c.target.z);
      const speed = Math.max(6, dist * 0.55) * (held.has('shift') ? 2.2 : 1);
      // The ground-plane heading of the view.
      let fx = c.target.x - camera.position.x, fz = c.target.z - camera.position.z;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl; fz /= fl;
      const sx = -fz, sz = fx;
      const f = (held.has('w') || held.has('arrowup') ? 1 : 0) - (held.has('s') || held.has('arrowdown') ? 1 : 0);
      const s = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
      const v = (held.has('r') ? 1 : 0) - (held.has('f') ? 1 : 0);
      const turn = (held.has('e') ? 1 : 0) - (held.has('q') ? 1 : 0);
      const mx = (fx * f + sx * s) * speed * step;
      const mz = (fz * f + sz * s) * speed * step;
      const my = v * speed * 0.6 * step;
      camera.position.x += mx; camera.position.z += mz; camera.position.y += my;
      c.target.set(c.target.x + mx, c.target.y, c.target.z + mz);
      if (turn) {
        // Swing the camera around its orbit point.
        const a = turn * 1.1 * step;
        const ox = camera.position.x - c.target.x, oz = camera.position.z - c.target.z;
        camera.position.x = c.target.x + ox * Math.cos(a) - oz * Math.sin(a);
        camera.position.z = c.target.z + ox * Math.sin(a) + oz * Math.cos(a);
      }
      clampView(nav, camera, c);
      c.update();
      invalidate();
    }
  });
  return null;
}
