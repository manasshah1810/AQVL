import type { Area } from './three/life';

/**
 * What the pod does when nothing is asked of it: the whale cruises slow,
 * wide loops round the back of the reef, rising and dipping, and her calf
 * keeps to her side a little behind (now darting ahead, now dropping back).
 * Every so often one of them does something for the joy of it: a barrel
 * roll, a spyhop to look about, a slow nod, a stream of bubbles. It is a
 * function of the ambient clock, so it is smooth and never random-looking,
 * and it stays behind and above the structures: it never gets in the way.
 */

export interface RoamPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  speed: number;
}

function path(area: Area, t: number, out: { x: number; y: number; z: number }): void {
  const a = t * 0.075;
  const RX = area.halfX + 3.6;
  out.x = area.cx + Math.sin(a) * RX;
  out.z = area.cz - area.halfZ - 2.4 + Math.sin(a * 2 + 0.6) * 1.9 - Math.cos(a) * 0.8;
  out.y = area.floorY + area.top + 1.5 + Math.sin(a * 1.3 + 0.4) * 0.8 + Math.sin(a * 3.1) * 0.25;
}

const _a = { x: 0, y: 0, z: 0 };
const _b = { x: 0, y: 0, z: 0 };

/** Where swimmer `who` is on its roam at ambient time `now` (heading from the way the path goes). */
export function roamPose(area: Area, now: number, who: number, out: RoamPose): void {
  // The calf follows a little behind her mother along the same loop, off to her side, bobbing about.
  const lag = who === 0 ? 0 : 1.7 + Math.sin(now * 0.21) * 0.6;
  path(area, now - lag, _a);
  path(area, now - lag + 0.4, _b);
  const dx = _b.x - _a.x, dy = _b.y - _a.y, dz = _b.z - _a.z;
  const yaw = Math.atan2(dx, dz);
  out.yaw = yaw;
  out.pitch = Math.max(-0.5, Math.min(0.5, Math.atan2(dy, Math.hypot(dx, dz))));
  out.speed = Math.hypot(dx, dy, dz) / 0.4;
  out.x = _a.x;
  out.y = _a.y;
  out.z = _a.z;
  if (who === 1) {
    // Beside her, on the outside of the loop, slightly lower; now and then a little higher (a calf at play).
    const side = 0.95 + Math.sin(now * 0.37) * 0.25;
    out.x += Math.cos(yaw) * side;
    out.z -= Math.sin(yaw) * side;
    out.y += -0.45 + Math.sin(now * 0.53 + 1) * 0.3;
  }
}

export type TrickKind = 'none' | 'roll' | 'spyhop' | 'loop' | 'nod';

/** The flourish a swimmer is doing at time `now` (if any): one every so often, chosen by the slot of time it falls in. */
export function trickAt(now: number, who: number): { kind: TrickKind; t: number; weight: number } {
  const period = who === 0 ? 16 : 11;
  const slot = Math.floor((now + who * 5) / period);
  const t = (now + who * 5) % period;
  const h = Math.abs(Math.sin(slot * 12.9898 + who * 78.233) * 43758.5453) % 1;
  const kinds: TrickKind[] = who === 0 ? ['roll', 'loop', 'nod', 'none'] : ['roll', 'spyhop', 'loop', 'nod'];
  const kind = kinds[Math.floor(h * kinds.length)];
  const dur = kind === 'roll' ? 2.4 : kind === 'spyhop' ? 3.2 : kind === 'loop' ? 3 : kind === 'nod' ? 2 : 0;
  const start = 4;
  if (kind === 'none' || t < start || t > start + dur) return { kind: 'none', t: 0, weight: 0 };
  const u = t - start;
  const weight = Math.min(1, u / 0.3, (dur - u) / 0.3);
  return { kind, t: u, weight };
}
