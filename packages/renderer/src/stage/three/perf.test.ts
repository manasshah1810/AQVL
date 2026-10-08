import { describe, expect, it } from 'vitest';
import { FrameGovernor, HeadroomProbe, SleepGate } from './perf';

describe('FrameGovernor', () => {
  it('paces at 60 fps and steps down only after sustained slow frames', () => {
    const g = new FrameGovernor();
    expect(g.targetFps).toBe(60);
    for (let i = 0; i < 200; i++) g.sample(16);
    expect(g.pace).toBe(0);
    for (let i = 0; i < 400; i++) g.sample(30);
    expect(g.pace).toBeGreaterThan(0);
  });

  it('ignores stalls (tab switches) and recovers after a long steady stretch', () => {
    const g = new FrameGovernor();
    for (let i = 0; i < 100; i++) g.sample(5000);
    expect(g.pace).toBe(0);
    for (let i = 0; i < 400; i++) g.sample(30);
    const slowed = g.pace;
    expect(slowed).toBeGreaterThan(0);
    for (let i = 0; i < 2000; i++) g.sample(8);
    expect(g.pace).toBeLessThan(slowed);
  });
});

describe('SleepGate', () => {
  it('passes every frame through while visible and carries banked time', () => {
    const g = new SleepGate(0.1);
    expect(g.step(0.016, false)).toBe(0);
    expect(g.step(0.016, true)).toBeCloseTo(0.032);
  });

  it('wakes a hidden animal ten times a second with the time that passed', () => {
    const g = new SleepGate(0.1);
    let total = 0;
    let wakes = 0;
    for (let i = 0; i < 100; i++) {
      const dt = g.step(0.016, false);
      if (dt > 0) wakes++;
      total += dt;
    }
    expect(wakes).toBeGreaterThanOrEqual(14);
    expect(wakes).toBeLessThanOrEqual(17);
    expect(total).toBeCloseTo(1.6, 0);
  });
});

describe('HeadroomProbe', () => {
  it('offers a higher tier after steady frames, then waits out the cooldown', () => {
    const p = new HeadroomProbe(10, 1000);
    let offered = 0;
    for (let i = 0; i < 10; i++) if (p.add(16, 17, 100000)) offered++;
    expect(offered).toBe(1);
    p.changed(true, 100000);
    for (let i = 0; i < 20; i++) expect(p.add(16, 17, 100500)).toBe(false);
  });

  it('stops raising after a raise is followed quickly by a drop', () => {
    const p = new HeadroomProbe(5, 1000);
    p.changed(true, 100000);
    p.changed(false, 105000);
    let offered = 0;
    for (let i = 0; i < 50; i++) if (p.add(16, 17, 200000)) offered++;
    expect(offered).toBe(0);
  });
});
