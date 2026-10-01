import { clamp01, lerp } from '../motion/spring';
import { locate, type BeatTable } from '../timeline/beats';
import type { StageModel, ViewKey } from './StageModel';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  /** Distance to the point the step is about (depth of field focuses here). */
  focusDistance: number;
  focus: [number, number, number];
}

const BASE_YAW = -0.2;
const FLAT_PITCH = 0.82;
const UPRIGHT_PITCH = 0.32;
/** How far framing leans from the whole scene towards the step's actors. */
const FOCUS_PULL = 0.12;
/** How far (0..1) a large scene zooms from the whole picture towards the step neighbourhood. */
const MAX_ZOOM = 0.36;

interface KeyPose {
  target: [number, number, number];
  yaw: number;
  pitch: number;
  distance: number;
  focus: [number, number, number];
}

/** Margin around the framed box, as a fraction of the view. */
const FRAME_MARGIN = 1.06;

/**
 * Distance at which a box of the given half extents, seen from (yaw, pitch),
 * fills the view with a margin: the box is projected onto the camera's
 * right / up axes and fitted to the horizontal and vertical field of view.
 */
function fitDistance(half: [number, number, number], yaw: number, pitch: number, vfov: number, hfov: number): number {
  const [hx, hy, hz] = half;
  const cy = Math.abs(Math.cos(yaw));
  const sy = Math.abs(Math.sin(yaw));
  const cp = Math.abs(Math.cos(pitch));
  const sp = Math.abs(Math.sin(pitch));
  const across = hx * cy + hz * sy;
  const depth = hz * cy + hx * sy;
  const up = hy * cp + depth * sp;
  const toward = depth * cp + hy * sp;
  const d = Math.max(across / Math.tan(hfov / 2), up / Math.tan(vfov / 2)) * FRAME_MARGIN;
  return Math.max(5, d + toward * 0.6);
}

function poseForKey(view: ViewKey, t: number, aspect: number, fovDeg: number, calm: boolean): KeyPose {
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  // A big scene leans in towards the step's neighbourhood (never all the way: context stays in view).
  const zoom = view.mode === 'AUTO_FIT' || view.mode === 'ORBIT' ? MAX_ZOOM * clamp01((view.radius - 10) / 10) : 0;
  const pull = view.mode === 'FOCUS' ? 0.1 : FOCUS_PULL + zoom;
  const target: [number, number, number] = [
    lerp(view.center[0], view.focus[0], pull),
    lerp(view.center[1], view.focus[1], pull * 0.5),
    lerp(view.center[2], view.focus[2], pull),
  ];
  const half: [number, number, number] = [
    lerp(view.half[0], view.focusHalf[0], zoom),
    lerp(view.half[1], view.focusHalf[1], zoom),
    lerp(view.half[2], view.focusHalf[2], zoom),
  ];
  let yaw = BASE_YAW;
  let pitch = view.flat ? FLAT_PITCH : UPRIGHT_PITCH;
  let distance = fitDistance(half, yaw, pitch, vfov, hfov);
  if (view.mode === 'ORBIT') {
    yaw += ((view.orbitSpeed * Math.PI) / 180) * t;
  } else if (!calm) {
    // A slow, shallow drift: the scene breathes without anything to chase.
    yaw += 0.07 * Math.sin((2 * Math.PI * t) / 38);
    pitch += 0.018 * Math.sin((2 * Math.PI * t) / 53);
  }
  if (view.mode === 'POSITION' && view.position) {
    const [px, py, pz] = view.position;
    const dx = px - view.center[0];
    const dy = py - view.center[1];
    const dz = pz - view.center[2];
    distance = Math.max(2, Math.hypot(dx, dy, dz));
    yaw = Math.atan2(dx, dz);
    pitch = Math.asin(Math.max(-0.99, Math.min(0.99, dy / distance)));
    target[0] = view.center[0];
    target[1] = view.center[1];
    target[2] = view.center[2];
  }
  return { target, yaw, pitch, distance, focus: view.focus };
}

function smoother(x: number): number {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * The camera at time t. Framing is keyed to the middle of each step, so it
 * starts easing towards a step's actors before they move (predictive), and
 * it is a pure function of t like everything else.
 */
export function cameraAt(model: StageModel, table: BeatTable, t: number, aspect: number, fovDeg: number, calm: boolean): CameraPose {
  const p = locate(table, t);
  const n = model.frameCount;
  // Key k sits at the middle of step k; key 0 at time 0.
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
  const a = poseForKey(model.rest(k0).view, t, aspect, fovDeg, calm);
  const b = k0 === k1 ? a : poseForKey(model.rest(k1).view, t, aspect, fovDeg, calm);

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
