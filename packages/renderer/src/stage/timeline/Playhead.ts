import type { ExecutionTrace } from '@aqvl/runtime';
import { buildBeatTable, completedStep, locate, type BeatPosition, type BeatTable } from './beats';

/** What React re-renders on: changes a few times per step, not every frame. */
export interface PlayheadSnapshot {
  /** Steps fully shown (0 = the starting picture). */
  step: number;
  /** The step currently playing or last played (whose caption is shown). */
  active: number;
  totalSteps: number;
  playing: boolean;
  speed: number;
  atEnd: boolean;
  /** Total length at 1x, in seconds. */
  duration: number;
}

const SEEK_SECONDS = 0.32;

/**
 * The single clock of a visualisation. Time is measured in "1x seconds"
 * along the trace's beat table; the scene is a pure function of it.
 * Play / pause / step / scrub / speed only ever change this number, so
 * every way of reaching a moment shows exactly the same picture.
 *
 * Owns its own requestAnimationFrame loop (so captions and the scrubber run
 * even without WebGL) and stops it whenever nothing is moving.
 */
export class Playhead {
  readonly table: BeatTable;
  private t = 0;
  private playing = false;
  private speed = 1;
  /** A time being eased to (step / step back), with where it started. */
  private seek: { from: number; to: number; elapsed: number } | null = null;
  private raf = 0;
  private last = 0;
  private snapshot: PlayheadSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly tickListeners = new Set<(t: number) => void>();
  private disposed = false;

  constructor(readonly trace: ExecutionTrace) {
    this.table = buildBeatTable(trace);
    this.snapshot = this.makeSnapshot();
  }

  // ── Reading ─────────────────────────────────────────────────────────────

  get time(): number {
    return this.t;
  }

  get totalSteps(): number {
    return this.trace.frames.length - 1;
  }

  position(): BeatPosition {
    return locate(this.table, this.t);
  }

  /** Time at which step k is at rest. */
  timeOfStep(k: number): number {
    const i = Math.max(0, Math.min(this.totalSteps, k));
    return this.table.ends[i];
  }

  getSnapshot = (): PlayheadSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Called with the time on every animation frame while anything moves (and on every jump). */
  onTick(listener: (t: number) => void): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  // ── Control ─────────────────────────────────────────────────────────────

  play(): void {
    if (this.totalSteps === 0) return;
    if (this.t >= this.table.total - 1e-9) this.t = 0;
    this.seek = null;
    this.playing = true;
    this.kick();
    this.publish();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.publish();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(8, speed));
    this.publish();
  }

  /** Jump to time t (scrubbing). */
  scrubTo(t: number): void {
    this.seek = null;
    this.playing = false;
    this.t = Math.max(0, Math.min(this.table.total, t));
    this.publish(true);
  }

  /** Jump straight to step k at rest. */
  jumpToStep(k: number): void {
    this.scrubTo(this.timeOfStep(k));
  }

  /** Play exactly the next step, then stop. */
  stepForward(): void {
    const target = this.timeOfStep(completedStep(this.table, this.t) + 1);
    this.playing = false;
    if (target <= this.t) return;
    this.seek = { from: this.t, to: target, elapsed: 0 };
    this.kick();
    this.publish();
  }

  /** Rewind to the previous step's resting picture (the step plays backwards). */
  stepBack(): void {
    const done = completedStep(this.table, this.t);
    const p = this.position();
    const target = this.timeOfStep(p.u < 1 - 1e-9 ? done : done - 1);
    this.playing = false;
    if (target >= this.t) return;
    this.seek = { from: this.t, to: target, elapsed: 0 };
    this.kick();
    this.publish();
  }

  restart(): void {
    this.scrubTo(0);
  }

  dispose(): void {
    this.disposed = true;
    this.playing = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.listeners.clear();
    this.tickListeners.clear();
  }

  /**
   * Advance by `dtSeconds` of wall time. Exposed for tests; the rAF loop
   * calls it with real frame deltas (clamped, so a stalled tab never jumps).
   */
  advance(dtSeconds: number): void {
    const dt = Math.min(0.1, Math.max(0, dtSeconds));
    if (this.seek) {
      // Step / step back: the beat plays at its own speed, quick when rewinding.
      const forward = this.seek.to > this.seek.from;
      const span = Math.abs(this.seek.to - this.seek.from);
      const rate = forward ? this.speed : Math.max(this.speed, span / SEEK_SECONDS);
      this.seek.elapsed += dt * rate;
      if (this.seek.elapsed >= span) {
        this.t = this.seek.to;
        this.seek = null;
      } else {
        this.t = this.seek.from + (forward ? 1 : -1) * this.seek.elapsed;
      }
    } else if (this.playing) {
      this.t = Math.min(this.table.total, this.t + dt * this.speed);
      if (this.t >= this.table.total) this.playing = false;
    }
    this.publish(true);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private get moving(): boolean {
    return this.playing || this.seek !== null;
  }

  private kick(): void {
    if (this.raf || this.disposed || typeof requestAnimationFrame === 'undefined') return;
    this.last = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const loop = (now: number) => {
      this.raf = 0;
      if (this.disposed) return;
      const dt = (now - this.last) / 1000;
      this.last = now;
      this.advance(dt);
      if (this.moving) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private makeSnapshot(): PlayheadSnapshot {
    const p = locate(this.table, this.t);
    const step = completedStep(this.table, this.t);
    return {
      step,
      active: p.k,
      totalSteps: this.totalSteps,
      playing: this.moving && this.playing,
      speed: this.speed,
      atEnd: this.t >= this.table.total - 1e-9,
      duration: this.table.total,
    };
  }

  private publish(ticked = false): void {
    if (ticked) this.tickListeners.forEach((l) => l(this.t));
    const next = this.makeSnapshot();
    const prev = this.snapshot;
    if (
      next.step !== prev.step ||
      next.active !== prev.active ||
      next.playing !== prev.playing ||
      next.speed !== prev.speed ||
      next.atEnd !== prev.atEnd ||
      next.totalSteps !== prev.totalSteps
    ) {
      this.snapshot = next;
      this.listeners.forEach((l) => l());
    }
  }
}
