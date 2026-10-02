import { clamp01, lerp } from '../motion/spring';
import { locate, type BeatTable } from '../timeline/beats';
import type { StageModel, ViewKey } from './StageModel';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  /** Distance to the point the step is about. */
  focusDistance: number;
  focus: [number, number, number];
}

/** A slight turn to the left: enough to show depth, never an odd angle. */
const YAW = -0.16;
/** Looking down on a structure spread across the floor (graphs, grids): about 42°. */
const FLAT_PITCH = 0.74;
/** The content fills at most this much of the free view in each direction, leaving an even margin. */
const FILL = 0.84;
const MIN_DISTANCE = 6;

interface KeyPose {
  target: [number, number, number];
  yaw: number;
  pitch: number;
  distance: number;
  focus: [number, number, number];
}

/**
 * Exact fit: the camera distance and look-at point at which all eight
 * corners of the box project inside the view (with the margin), and the
 * projected box is centred. Solved per corner (no approximation of the
 * perspective), then re-centred once and solved again.
 */
function fitBox(center: [number, number, number], half: [number, number, number], yaw: number, pitch: number, vfov: number, hfov: number) {
  const cp = Math.cos(pitch);
  const back = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [back[1] * right[2] - back[2] * right[1], back[2] * right[0] - back[0] * right[2], back[0] * right[1] - back[1] * right[0]];
  const tx = Math.tan(hfov / 2) * FILL;
  const ty = Math.tan(vfov / 2) * FILL;
  const target: [number, number, number] = [center[0], center[1], center[2]];
  let distance = MIN_DISTANCE;
  for (let pass = 0; pass < 3; pass++) {
    distance = MIN_DISTANCE;
    for (let c = 0; c < 8; c++) {
      const dx = center[0] + (c & 1 ? half[0] : -half[0]) - target[0];
      const dy = center[1] + (c & 2 ? half[1] : -half[1]) - target[1];
      const dz = center[2] + (c & 4 ? half[2] : -half[2]) - target[2];
      const r = dx * right[0] + dy * right[1] + dz * right[2];
      const u = dx * up[0] + dy * up[1] + dz * up[2];
      const t = dx * back[0] + dy * back[1] + dz * back[2];
      distance = Math.max(distance, t + Math.abs(r) / tx, t + Math.abs(u) / ty);
    }
    if (pass === 2) break;
    // Centre what the camera actually sees: perspective makes the near side look bigger.
    let minR = Infinity, maxR = -Infinity, minU = Infinity, maxU = -Infinity;
    for (let c = 0; c < 8; c++) {
      const dx = center[0] + (c & 1 ? half[0] : -half[0]) - target[0];
      const dy = center[1] + (c & 2 ? half[1] : -half[1]) - target[1];
      const dz = center[2] + (c & 4 ? half[2] : -half[2]) - target[2];
      const depth = distance - (dx * back[0] + dy * back[1] + dz * back[2]);
      const r = (dx * right[0] + dy * right[1] + dz * right[2]) / depth;
      const u = (dx * up[0] + dy * up[1] + dz * up[2]) / depth;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    }
    const sr = ((minR + maxR) / 2) * distance;
    const su = ((minU + maxU) / 2) * distance;
    for (let i = 0; i < 3; i++) target[i] += right[i] * sr + up[i] * su;
  }
  return { target, distance };
}

function poseForKey(view: ViewKey, t: number, aspect: number, fovDeg: number, upright: number): KeyPose {
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  let yaw = YAW;
  // Across structures that stand up (arrays, stacks, trees) the model picks the angle: about 22° over one row, 30° over rows.
  const pitch = view.flat ? FLAT_PITCH : upright;
  if (view.mode === 'POSITION' && view.position) {
    const [px, py, pz] = view.position;
    const dx = px - view.center[0];
    const dy = py - view.center[1];
    const dz = pz - view.center[2];
    const distance = Math.max(2, Math.hypot(dx, dy, dz));
    return {
      target: [view.center[0], view.center[1], view.center[2]],
      yaw: Math.atan2(dx, dz),
      pitch: Math.asin(Math.max(-0.99, Math.min(0.99, dy / distance))),
      distance,
      focus: view.focus,
    };
  }
  if (view.mode === 'ORBIT') yaw += ((view.orbitSpeed * Math.PI) / 180) * t;
  const { target, distance } = fitBox(view.center, view.half, yaw, pitch, vfov, hfov);
  return { target, yaw, pitch, distance, focus: view.focus };
}

function smoother(x: number): number {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * The camera at time t: the whole structure framed and centred from one
 * fixed, slightly raised angle, with no drift. Framing is keyed to the
 * middle of each step and eased between keys, so the camera starts making
 * room for a change before it happens, and it is a pure function of t like
 * everything else. `calm` is accepted for symmetry with the sampler: the
 * camera already moves only when the framing must change.
 */
export function cameraAt(model: StageModel, table: BeatTable, t: number, aspect: number, fovDeg: number, _calm: boolean): CameraPose {
  const p = locate(table, t);
  const n = model.frameCount;
  const keyTime = (k: number) => (k <= 0 ? 0 : table.ends[k] - table.durations[k] * 0.5);
  let k0: number;
  let k1: number;
  if (p.k === 0) {
    k0 = 0;
    k1 = Math.min(1, n - 1);
  } else if (t < keyTime(p.k)) {
    k0 = p.k - 1;
    k1 = p.k;
  } else {
    k0 = p.k;
    k1 = Math.min(p.k + 1, n - 1);
  }
  const t0 = keyTime(k0);
  const t1 = keyTime(k1);
  const s = k0 === k1 || t1 <= t0 ? 0 : smoother((t - t0) / (t1 - t0));
  const a = poseForKey(model.framing(k0), t, aspect, fovDeg, model.uprightPitch);
  const b = k0 === k1 ? a : poseForKey(model.framing(k1), t, aspect, fovDeg, model.uprightPitch);

  const target: [number, number, number] = [lerp(a.target[0], b.target[0], s), lerp(a.target[1], b.target[1], s), lerp(a.target[2], b.target[2], s)];
  const focus: [number, number, number] = [lerp(a.focus[0], b.focus[0], s), lerp(a.focus[1], b.focus[1], s), lerp(a.focus[2], b.focus[2], s)];
  const yaw = lerp(a.yaw, b.yaw, s);
  const pitch = lerp(a.pitch, b.pitch, s);
  const distance = lerp(a.distance, b.distance, s);
  const position: [number, number, number] = [
    target[0] + distance * Math.sin(yaw) * Math.cos(pitch),
    target[1] + distance * Math.sin(pitch),
    target[2] + distance * Math.cos(yaw) * Math.cos(pitch),
  ];
  const focusDistance = Math.hypot(position[0] - focus[0], position[1] - focus[1], position[2] - focus[2]);
  return { position, target, focusDistance, focus };
}
