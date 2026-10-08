import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three';
import type { QualityTier } from './quality';

/**
 * Shared performance plumbing for the stage: one place that decides how
 * often the ambient world redraws, which things are on screen, and what
 * the (hidden) debug monitor reports.
 */

// ── Debug counters (read by the monitor; cheap to write when nobody looks) ─

export interface PerfCounters {
  animalsTotal: number;
  animalsVisible: number;
  animalsAwake: number;
  /** Systems that are animating right now (world ambience, crew, colony, ...). */
  animations: number;
  /** Milliseconds the scene's own frame callbacks took on the last frame. */
  jsMs: number;
  /** Ambient redraw rate the governor is aiming for. */
  targetFps: number;
  offscreen: boolean;
}

export const perfCounters: PerfCounters = { animalsTotal: 0, animalsVisible: 0, animalsAwake: 0, animations: 0, jsMs: 0, targetFps: 60, offscreen: false };

/** Free-form readouts other packages add to the monitor (the voice reports its state here). */
export const perfExtras: Record<string, string | number> = {};

/** The monitor shows up only when asked for: `?perf` in the address, or `localStorage['aqvl.perf'] = '1'`. */
export function perfMonitorEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).has('perf') || window.location.hash.includes('perf=1')) return true;
    return window.localStorage.getItem('aqvl.perf') === '1';
  } catch {
    return false;
  }
}

// ── Frame governor ───────────────────────────────────────────────────────

/**
 * Decides how soon the ambient world should ask for its next frame. Worlds
 * are alive, so they redraw continuously; without a cap a 144 Hz display
 * pays for 144 full scenes a second to show breathing and drifting snow.
 * The cap keeps pacing even (stable frame time beats a fast average).
 * The governor also learns from measured frame times: a weak machine is
 * paced at 45 fps rather than stumbling between 60 and 30.
 */
export class FrameGovernor {
  private level = 0;
  private ema = 16;
  private slow = 0;
  private fast = 0;

  /** 0: 60 fps, 1: 45 fps (struggling), 2: 30 fps (heavily struggling). */
  get pace(): 0 | 1 | 2 {
    return this.level as 0 | 1 | 2;
  }

  get targetFps(): number {
    return this.level === 0 ? 60 : this.level === 1 ? 45 : 30;
  }

  /** Milliseconds between ambient frames. */
  get interval(): number {
    // A little under the nominal period, so vsync alignment does not cost an extra frame.
    return (1000 / this.targetFps) * 0.92;
  }

  /** Feed the wall time between two drawn frames. Returns true when the pace changed. */
  sample(ms: number): boolean {
    if (ms > 250) return false; // a stall (tab switch, GC), not a steady cost
    this.ema += (ms - this.ema) * 0.08;
    const budget = 1000 / this.targetFps;
    if (this.ema > budget * 1.35 && this.level < 2) {
      if (++this.slow > 45) return this.shift(1);
    } else this.slow = 0;
    // Well under the next-faster budget for a long while: recover.
    if (this.level > 0 && this.ema < (1000 / (this.level === 2 ? 45 : 60)) * 0.7) {
      if (++this.fast > 600) return this.shift(-1);
    } else this.fast = 0;
    return false;
  }

  private shift(by: number): boolean {
    this.level = Math.max(0, Math.min(2, this.level + by));
    this.slow = 0;
    this.fast = 0;
    return true;
  }
}

/** The one pace-keeper of the page's stage. */
export const governor = new FrameGovernor();

// ── Quality auto-tuning ──────────────────────────────────────────────────

const TIERS: QualityTier[] = ['low', 'medium', 'high'];

export function higherTier(tier: QualityTier): QualityTier {
  return TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(tier) + 1)];
}

/**
 * Notices that the scene has run at its target pace, steadily, for a long
 * time, so the quality tier can come back up after a dip. Cautious on
 * purpose: one step at a time, a long cooldown, and if a raise is followed
 * soon by a drop, raising is switched off for a good while (no flapping).
 */
export class HeadroomProbe {
  private good = 0;
  private lastChange = 0;
  private lastRaise = 0;
  private bannedUntil = 0;
  constructor(private readonly steadyFrames = 1500, private readonly cooldownMs = 45000) {}

  /** A tier change happened (by this probe or the slow-frame probe). */
  changed(raised: boolean, now = performance.now()): void {
    if (!raised && now - this.lastRaise < 30000) this.bannedUntil = now + 10 * 60000;
    if (raised) this.lastRaise = now;
    this.lastChange = now;
    this.good = 0;
  }

  /** Feed the time between drawn frames and the pace being aimed for; true once when quality can go up. */
  add(ms: number, targetMs: number, now = performance.now()): boolean {
    if (ms > 250) return false;
    if (ms > targetMs * 1.2) {
      this.good = 0;
      return false;
    }
    if (++this.good < this.steadyFrames) return false;
    this.good = 0;
    return now - this.lastChange > this.cooldownMs && now > this.bannedUntil;
  }
}

// ── Visibility ───────────────────────────────────────────────────────────

const _m = new Matrix4();
const _s = new Sphere();

/**
 * Which points are in view this frame. `update()` once per frame; `sees()`
 * is then a few multiplications, so every animal can be asked each frame
 * (an animal that is out of shot does not need its pose recomputed).
 */
export class ViewCuller {
  private readonly frustum = new Frustum();

  update(camera: Camera): void {
    // The camera is placed during this frame's callbacks, before the renderer refreshes its matrices.
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(_m);
  }

  sees(x: number, y: number, z: number, radius: number): boolean {
    _s.center.set(x, y, z);
    _s.radius = radius;
    return this.frustum.intersectsSphere(_s);
  }
}

const _d = new Vector3();

/** Distance from the camera, for distance-based update rates. */
export function distanceTo(camera: Camera, x: number, y: number, z: number): number {
  return _d.set(x, y, z).distanceTo(camera.position);
}

/**
 * Decides, per animal, whether this frame is one it must be fully animated
 * in. In view: always. Out of view: only every `period` seconds, with the
 * time that passed handed back so behaviour (walking, deciding) carries on
 * at the right pace. Returns the elapsed time to simulate, or 0 to skip.
 */
export class SleepGate {
  private acc = 0;
  /** Seconds between updates while out of view. */
  constructor(private readonly period = 0.1) {}

  step(dt: number, visible: boolean): number {
    if (visible) {
      const all = this.acc + dt;
      this.acc = 0;
      return all;
    }
    this.acc += dt;
    if (this.acc < this.period) return 0;
    const all = Math.min(0.25, this.acc);
    this.acc = 0;
    return all;
  }
}

// ── Governed invalidation ────────────────────────────────────────────────

let frameStartedAt = 0;

/** Called once at the top of each drawn frame: the pace is measured from here. */
export function markFrame(now: number): void {
  frameStartedAt = now;
}

/**
 * `invalidate()` that keeps to the governor's pace. A world asks for "one
 * more frame" from many places; asked from inside a frame, the request is
 * held until the pace allows the next one (and many requests make one).
 * Asked from outside a frame (a click, a key), it is immediate.
 */
export function useGovernedInvalidate(): () => void {
  const invalidate = useThree((s) => s.invalidate);
  return useMemo(() => {
    let timer = 0;
    return () => {
      // A canvas scrolled out of view does not ask to be drawn.
      if (timer || perfCounters.offscreen) return;
      // The timer fires a little early; the browser then holds the draw to the next display refresh.
      const wait = governor.interval - 5 - (performance.now() - frameStartedAt);
      if (wait < 2) invalidate();
      else
        timer = window.setTimeout(() => {
          timer = 0;
          invalidate();
        }, wait);
    };
  }, [invalidate]);
}
