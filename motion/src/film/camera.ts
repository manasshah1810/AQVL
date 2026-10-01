import * as THREE from 'three';
import {easeInOut} from '../lib/motion';

// One continuous camera through the AQVL world: keyed spherical rig around a
// moving target, interpolated with Catmull-Rom (non-zero velocity through
// keys, so it never stops and starts) and eased at both ends.

export type CamKey = {t: number; x: number; y: number; z: number; az: number; el: number; d: number; fov: number; shift: number};

const K = (t: number, x: number, y: number, z: number, az: number, el: number, d: number, fov = 24, shift = 0.12): CamKey => ({t, x, y, z, az, el, d, fov, shift});

// hero centers on the floor
export const HERO = {
  heap: new THREE.Vector3(0, 0, 0),
  merge: new THREE.Vector3(19, 0, -5),
  dijkstra: new THREE.Vector3(38, 0, 2),
  fib: new THREE.Vector3(57, 0, -3),
  tag: new THREE.Vector3(66, 0, -1),
};

export const KEYS: CamKey[] = [
  K(11.0, 0, 1.3, 0, -30, 21, 23, 24, 0),
  K(12.6, 0, 1.4, 0, -28, 22, 23, 24, 0.12),
  K(13.6, 0, 1.6, 0, -25, 23, 23, 24, 0.17),
  K(15.2, 0, 1.9, 0, -12, 26, 22, 24, 0.17),
  K(17.2, 0.2, 2.1, 0, 10, 28, 21.5, 24, 0.17),
  K(18.9, 0.5, 2.0, 0, 22, 28, 22, 24, 0.17),
  K(19.85, 19, 1.1, -4.8, 18, 36, 23.5, 24, 0.17),
  K(21.6, 19, 1.0, -4.8, 6, 37, 22.5, 24, 0.17),
  K(23.4, 19, 1.1, -4.8, -12, 34, 22, 24, 0.17),
  K(24.6, 19.5, 1.0, -4.8, -22, 33, 22.5, 24, 0.17),
  K(25.55, 38.3, 0.6, 1.8, -14, 46, 25, 24, 0.17),
  K(27.4, 38.3, 0.6, 1.8, -2, 50, 24, 24, 0.17),
  K(29.4, 38.3, 0.6, 1.8, 16, 46, 23.5, 24, 0.17),
  K(30.25, 38.8, 0.8, 1.8, 26, 42, 24, 24, 0.17),
  K(31.15, 58.4, 2.3, -3, 22, 22, 21, 24, 0.17),
  K(33.0, 58.4, 2.4, -3, 8, 20, 20.5, 24, 0.17),
  K(35.0, 58.4, 2.5, -3, -14, 19, 20, 24, 0.17),
  K(36.2, 59.5, 2.0, -3, -26, 25, 21, 24, 0.08),
  K(37.2, 63, 1.0, -1.5, -32, 48, 27, 24, 0),
  K(38.6, 66, 0.8, -1, -34, 58, 30, 24, 0),
];

const catmull = (p0: number, p1: number, p2: number, p3: number, t0: number, t1: number, t2: number, t3: number, u: number) => {
  // non-uniform Catmull-Rom via Hermite with finite-difference tangents
  let m1 = ((p2 - p0) / Math.max(1e-6, t2 - t0)) * (t2 - t1);
  let m2 = ((p3 - p1) / Math.max(1e-6, t3 - t1)) * (t2 - t1);
  // monotone: no overshoot past a key on long sweeps
  const d = p2 - p1;
  if ((p1 - p0) * d <= 0) m1 = 0;
  if ((p3 - p2) * d <= 0) m2 = 0;
  const lim = 3 * Math.abs(d);
  m1 = Math.max(-lim, Math.min(lim, m1));
  m2 = Math.max(-lim, Math.min(lim, m2));
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
};

const fields: (keyof CamKey)[] = ['x', 'y', 'z', 'az', 'el', 'd', 'fov', 'shift'];

export const camAt = (t: number): CamKey => {
  const k = KEYS;
  const first = k[0];
  const last = k[k.length - 1];
  // ease the very start and end of the path
  const tt = Math.min(last.t, Math.max(first.t, t));
  let i = 0;
  while (i < k.length - 2 && k[i + 1].t < tt) i++;
  const a = k[Math.max(0, i - 1)];
  const b = k[i];
  const c = k[i + 1];
  const d = k[Math.min(k.length - 1, i + 2)];
  let u = (tt - b.t) / Math.max(1e-6, c.t - b.t);
  if (i === 0) u = easeInOut(u) * 0.5 + u * 0.5;
  const out = {t} as CamKey;
  for (const f of fields) {
    (out[f] as number) = catmull(a[f] as number, b[f] as number, c[f] as number, d[f] as number, i === 0 ? b.t - 1 : a.t, b.t, c.t, i + 2 >= k.length ? c.t + 1 : d.t, u);
  }
  return out;
};

const D2R = Math.PI / 180;
export const applyCam = (cam: THREE.PerspectiveCamera, k: CamKey, w: number, h: number, nudge?: THREE.Vector3) => {
  const target = new THREE.Vector3(k.x, k.y, k.z);
  if (nudge) target.add(nudge);
  const az = k.az * D2R;
  const el = k.el * D2R;
  cam.position.set(target.x + Math.sin(az) * Math.cos(el) * k.d, target.y + Math.sin(el) * k.d, target.z + Math.cos(az) * Math.cos(el) * k.d);
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  cam.fov = k.fov;
  cam.aspect = w / h;
  // shift the principal point so the hero sits right of the editor panel
  cam.setViewOffset(w, h, -k.shift * w, 0, w, h);
  cam.updateProjectionMatrix();
  return target;
};
