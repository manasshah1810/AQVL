import { describe, expect, it } from 'vitest';
import { RES_STEPS, ResolutionGovernor } from './perf';

/** Feeds `n` frames of `ms` each, returns the scales it asked for. */
function feed(g: ResolutionGovernor, n: number, ms: number, t0 = 0): { changes: number[]; t: number } {
  const changes: number[] = [];
  let t = t0;
  for (let i = 0; i < n; i++) {
    t += ms;
    const c = g.add(ms, t);
    if (c !== null) changes.push(c);
  }
  return { changes, t };
}

describe('ResolutionGovernor', () => {
  it('leaves a scene that holds its pace alone', () => {
    const g = new ResolutionGovernor();
    expect(feed(g, 600, 16.7).changes).toEqual([]);
    expect(g.scale).toBe(1);
  });

  it('steps down while frames run long, and keeps a step that helps', () => {
    const g = new ResolutionGovernor();
    // Slow at full resolution; each step down shortens frames in proportion to the pixels (a pixel-bound scene).
    let t = 0;
    const frame = () => 30 * RES_STEPS[g.index] ** 2 + 6;
    for (let i = 0; i < 1500; i++) {
      const f = frame();
      t += f;
      g.add(f, t);
    }
    expect(g.index).toBeGreaterThan(0);
    expect(frame()).toBeLessThan(21);
    expect(g.exhausted(t)).toBe(false);
  });

  it('undoes a step that did not make frames faster (the CPU is the limit) and stops trying for a while', () => {
    const g = new ResolutionGovernor();
    const { changes, t } = feed(g, 400, 30);
    expect(changes[0]).toBeLessThan(1);
    expect(changes).toContain(1);
    expect(g.scale).toBe(1);
    expect(g.exhausted(t)).toBe(true);
  });

  it('ignores stalls (a tab switch, a garbage collection)', () => {
    const g = new ResolutionGovernor();
    expect(feed(g, 100, 900).changes).toEqual([]);
  });

  it('climbs back after a long clean run, one step at a time', () => {
    const g = new ResolutionGovernor(19.5, 2);
    const { changes } = feed(g, 1000, 14, 100000);
    expect(changes[0]).toBe(RES_STEPS[1]);
  });

  it('does not flap: a drop soon after a climb bans climbing for longer', () => {
    const g = new ResolutionGovernor(19.5, 1);
    let r = feed(g, 1000, 14, 100000);
    expect(g.index).toBe(0);
    // Too slow again at full resolution, and the step down helps (frames shorten with the pixels).
    let t = r.t;
    for (let i = 0; i < 400; i++) {
      const f = 30 * RES_STEPS[g.index] ** 2 + 6;
      t += f;
      g.add(f, t);
    }
    const down = g.index;
    expect(down).toBeGreaterThan(0);
    r = feed(g, 1000, 14, t);
    expect(g.index).toBe(down);
  });
});
