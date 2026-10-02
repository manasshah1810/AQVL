import { InstantTimelineEngine } from '../core/TimelineEngine';

/** anime.js parameter keys that configure a tween rather than name a property to animate. */
const RESERVED_KEYS = new Set([
  'targets', 'duration', 'delay', 'endDelay', 'easing', 'round', 'loop', 'direction', 'autoplay',
  'timelineOffset', 'keyframes', 'complete', 'update', 'begin', 'change', 'changeBegin', 'changeComplete',
  'loopBegin', 'loopComplete', 'narrativeText', 'suggestedDurationMultiplier', 'priority',
]);

type Frame = { params: Record<string, unknown>; offset: number; order: number };

function toTargets(targets: unknown): Record<string, unknown>[] {
  if (Array.isArray(targets)) return targets.filter((t): t is Record<string, unknown> => !!t && typeof t === 'object');
  return targets && typeof targets === 'object' ? [targets as Record<string, unknown>] : [];
}

/** The value an anime.js property spec ends on, for `target` (index `i` of `n` targets). */
function endValue(spec: unknown, target: Record<string, unknown>, key: string, i: number, n: number): unknown {
  let v = spec;
  for (let guard = 0; guard < 4; guard++) {
    if (typeof v === 'function') v = (v as (t: unknown, i: number, n: number) => unknown)(target, i, n);
    else if (Array.isArray(v)) v = v[v.length - 1];
    else if (v && typeof v === 'object' && 'value' in (v as object)) v = (v as { value: unknown }).value;
    else break;
  }
  const current = target[key];
  if (typeof v === 'string') {
    const rel = /^([+\-*])=\s*(-?[\d.]+)/.exec(v);
    if (rel && typeof current === 'number') {
      const amount = Number(rel[2]);
      return rel[1] === '+' ? current + amount : rel[1] === '-' ? current - amount : current * amount;
    }
    if (typeof current === 'number' && /^-?[\d.]+(e-?\d+)?$/.test(v.trim())) return Number(v);
  }
  return v;
}

/**
 * A timeline with no real time that still lands every tween on its final
 * value: keyframes are applied in the order they would finish, each one's
 * properties set to where anime.js would leave them, then its `complete`
 * runs. The runtime's state after a step is therefore exactly the state the
 * animated engine reaches, which is what the execution trace records.
 *
 * Every `yieldEvery`-th play() hands control back to the event loop before
 * completing, so recording a long program never freezes the page.
 */
export class SnapTimelineEngine extends InstantTimelineEngine {
  private frames: Frame[] = [];
  private finish: (() => void) | null = null;
  private plays = 0;

  constructor(private readonly yieldEvery = 0) {
    super();
  }

  public init(onComplete?: () => void): void {
    this.frames = [];
    this.finish = onComplete || null;
  }

  public addKeyframe(params: any, offset: string | number = 0): void {
    this.frames.push({ params, offset: typeof offset === 'number' ? offset : 0, order: this.frames.length });
  }

  public play(): void {
    const end = (f: Frame) => f.offset + (Number(f.params.duration) || 0);
    const frames = this.frames.sort((a, b) => end(a) - end(b) || a.order - b.order);
    this.frames = [];
    for (const frame of frames) {
      const targets = toTargets(frame.params.targets);
      for (const key of Object.keys(frame.params)) {
        if (RESERVED_KEYS.has(key)) continue;
        targets.forEach((target, i) => {
          if (target[key] === undefined || target[key] === null) return;
          target[key] = endValue(frame.params[key], target, key, i, targets.length);
        });
      }
      (frame.params.complete as (() => void) | undefined)?.();
    }
    this.plays++;
    if (this.yieldEvery > 0 && this.plays % this.yieldEvery === 0) {
      setTimeout(() => this.triggerComplete(), 0);
    } else {
      this.triggerComplete();
    }
  }

  public playUntil(_timeMs: number, onPause?: () => void): void {
    this.play();
    onPause?.();
  }

  public triggerComplete(): void {
    const done = this.finish;
    this.finish = null;
    done?.();
  }
}
