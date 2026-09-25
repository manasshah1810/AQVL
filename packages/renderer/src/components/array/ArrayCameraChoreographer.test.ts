import { describe, it, expect } from 'vitest';
import {
  ArrayCameraChoreographer,
  requiredVisibilityDistance,
  EMPHASIS_LEVELS,
  type ArrayBounds,
  type CameraFrame,
} from './ArrayCameraChoreographer';

const BASELINE_BOUNDS: ArrayBounds = { center: { x: 0, y: 0, z: 0 }, halfSpanX: 10 };
// distance chosen with slack above requiredVisibilityDistance(10) (~27.8 at the default 45deg FOV)
// so zoom-in tests below have room to actually observe a pull-in, not just clamp to zero.
const BASELINE_FRAME: CameraFrame = { target: { x: 0, y: 0, z: 0 }, distance: 40 };

function tick(choreographer: ArrayCameraChoreographer, ms: number, steps = 1) {
  for (let i = 0; i < steps; i++) choreographer.update(ms / steps);
}

describe('ArrayCameraChoreographer', () => {
  it('returns the baseline frame unchanged before any instruction is registered', () => {
    const c = new ArrayCameraChoreographer();
    const frame = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    expect(frame).toEqual(BASELINE_FRAME);
    expect(c.getEmphasisLevel()).toBe(0);
    expect(c.isSettled()).toBe(true);
  });

  it('routine operations (a plain comparison) produce minimal camera movement', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({ type: 'COMPARE', significance: 'routine', participants: [{ x: 8, y: 0, z: 0 }, { x: 9, y: 0, z: 0 }] });
    tick(c, 200);

    const frame = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    const panMagnitude = Math.abs(frame.target.x - BASELINE_FRAME.target.x);
    const zoomMagnitude = BASELINE_FRAME.distance - frame.distance;

    // Should move toward the pair (not zero), but only a small fraction of what's structurally allowed.
    expect(panMagnitude).toBeGreaterThan(0);
    expect(panMagnitude).toBeLessThan(BASELINE_BOUNDS.halfSpanX * 0.15);
    expect(zoomMagnitude).toBeLessThan(BASELINE_FRAME.distance * 0.1);
  });

  it('notable operations produce moderate, correctly-targeted camera emphasis', () => {
    const c = new ArrayCameraChoreographer();
    const participants = [{ x: 6, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
    c.registerInstruction({ type: 'SWAP', significance: 'notable', participants });
    tick(c, 400);

    const frame = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    // Targeted toward the pair's midpoint (x=7), on the correct side of center.
    expect(frame.target.x).toBeGreaterThan(0);
    expect(frame.target.x).toBeLessThan(7);

    const routine = new ArrayCameraChoreographer();
    routine.registerInstruction({ type: 'COMPARE', significance: 'routine', participants });
    tick(routine, 400);
    const routineFrame = routine.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);

    // Notable should pull noticeably harder than routine toward the same participants.
    expect(frame.target.x).toBeGreaterThan(routineFrame.target.x);
  });

  it('pivotal operations produce pronounced, correctly-targeted camera emphasis (strongest of the three tiers)', () => {
    const participants = [{ x: 6, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];

    const pivotal = new ArrayCameraChoreographer();
    pivotal.registerInstruction({ type: 'FINALIZE', significance: 'pivotal', participants });
    tick(pivotal, 400);
    const pivotalFrame = pivotal.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);

    const notable = new ArrayCameraChoreographer();
    notable.registerInstruction({ type: 'SWAP', significance: 'notable', participants });
    tick(notable, 400);
    const notableFrame = notable.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);

    const routine = new ArrayCameraChoreographer();
    routine.registerInstruction({ type: 'COMPARE', significance: 'routine', participants });
    tick(routine, 400);
    const routineFrame = routine.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);

    const pivotalPan = pivotalFrame.target.x - BASELINE_FRAME.target.x;
    const notablePan = notableFrame.target.x - BASELINE_FRAME.target.x;
    const routinePan = routineFrame.target.x - BASELINE_FRAME.target.x;

    // Strictly increasing emphasis: pivotal > notable > routine, all pulling toward the same pair.
    expect(pivotalPan).toBeGreaterThan(notablePan);
    expect(notablePan).toBeGreaterThan(routinePan);

    // Pivotal should also dolly in (tighter framing), unlike a routine comparison.
    expect(pivotalFrame.distance).toBeLessThan(routineFrame.distance);
  });

  it('settles back to the exact baseline framing once enough time passes with no new instruction', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({
      type: 'FINALIZE',
      significance: 'pivotal',
      participants: [{ x: 6, y: 0, z: 0 }],
      durationMs: 200,
    });
    tick(c, 200); // hold window
    const during = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    expect(during.target.x).not.toBeCloseTo(BASELINE_FRAME.target.x, 3);

    tick(c, 10000, 200); // well past the settle window (exponential decay via lerp needs several time-constants), no new instruction registered
    const after = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);

    expect(after.target).toEqual(BASELINE_FRAME.target);
    expect(after.distance).toBe(BASELINE_FRAME.distance);
    expect(c.getEmphasisLevel()).toBe(0);
    expect(c.isSettled()).toBe(true);
  });

  it('a later instruction re-targets the camera toward the new participants rather than staying on the old ones', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({ type: 'COMPARE', significance: 'pivotal', participants: [{ x: -9, y: 0, z: 0 }] });
    tick(c, 300);
    const first = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    expect(first.target.x).toBeLessThan(0);

    c.registerInstruction({ type: 'COMPARE', significance: 'pivotal', participants: [{ x: 9, y: 0, z: 0 }] });
    tick(c, 300);
    const second = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    expect(second.target.x).toBeGreaterThan(0);
  });

  it('never pans beyond MAX_PAN_FRACTION of the array half-span, even for a pivotal operation at an extreme edge', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({
      type: 'FINALIZE',
      significance: 'pivotal',
      participants: [{ x: 1000, y: 0, z: 0 }], // absurdly far outside the array, to probe the clamp
    });
    tick(c, 5000, 100); // let emphasis fully rise

    const frame = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    const maxAllowedPan = BASELINE_BOUNDS.halfSpanX * 0.35; // MAX_PAN_FRACTION
    expect(Math.abs(frame.target.x - BASELINE_FRAME.target.x)).toBeLessThanOrEqual(maxAllowedPan + 1e-6);
  });

  it('never dollies in past the computed whole-array visibility floor, even for a pivotal operation', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({ type: 'FINALIZE', significance: 'pivotal', participants: [{ x: 5, y: 0, z: 0 }] });
    tick(c, 5000, 100);

    const frame = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    const floor = requiredVisibilityDistance(BASELINE_BOUNDS.halfSpanX);
    expect(frame.distance).toBeGreaterThanOrEqual(Math.min(floor, BASELINE_FRAME.distance) - 1e-6);
  });

  it('never dollies out past the AUTO_FIT baseline distance, regardless of significance', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({ type: 'FINALIZE', significance: 'pivotal', participants: [{ x: 5, y: 0, z: 0 }] });
    tick(c, 5000, 100);

    const frame = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    expect(frame.distance).toBeLessThanOrEqual(BASELINE_FRAME.distance + 1e-6);
  });

  it('does not zoom in at all when the baseline distance is already at or below the visibility floor (never makes an already-tight framing worse)', () => {
    const tightBounds: ArrayBounds = { center: { x: 0, y: 0, z: 0 }, halfSpanX: 40 }; // very wide array
    const tightFrame: CameraFrame = { target: { x: 0, y: 0, z: 0 }, distance: 25 }; // baseline already short of ideal
    const floor = requiredVisibilityDistance(tightBounds.halfSpanX);
    expect(floor).toBeGreaterThan(tightFrame.distance); // sanity: this scenario is genuinely "baseline underserves visibility"

    const c = new ArrayCameraChoreographer();
    c.registerInstruction({ type: 'FINALIZE', significance: 'pivotal', participants: [{ x: 5, y: 0, z: 0 }] });
    tick(c, 5000, 100);

    const frame = c.getCameraFrame(tightFrame, tightBounds);
    expect(frame.distance).toBe(tightFrame.distance);
  });

  it('ignores an instruction with no participants (no-op, does not crash or move the camera)', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({ type: 'COMPARE', significance: 'pivotal', participants: [] });
    tick(c, 500);
    const frame = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);
    expect(frame).toEqual(BASELINE_FRAME);
  });

  it('treats an unrecognized significance tag as the safest (routine) tier rather than crashing or over-emphasizing', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({
      type: 'COMPARE',
      significance: 'not-a-real-tier' as any,
      participants: [{ x: 8, y: 0, z: 0 }],
    });
    tick(c, 400);
    const frame = c.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);

    const routine = new ArrayCameraChoreographer();
    routine.registerInstruction({ type: 'COMPARE', significance: 'routine', participants: [{ x: 8, y: 0, z: 0 }] });
    tick(routine, 400);
    const routineFrame = routine.getCameraFrame(BASELINE_FRAME, BASELINE_BOUNDS);

    expect(frame.target.x).toBeCloseTo(routineFrame.target.x, 5);
  });

  it('emphasis level rises smoothly (not instantly to 1) over the first frame', () => {
    const c = new ArrayCameraChoreographer();
    c.registerInstruction({ type: 'FINALIZE', significance: 'pivotal', participants: [{ x: 5, y: 0, z: 0 }] });
    c.update(16); // a single ~60fps frame
    expect(c.getEmphasisLevel()).toBeGreaterThan(0);
    expect(c.getEmphasisLevel()).toBeLessThan(EMPHASIS_LEVELS.pivotal);
  });

  it('whole-array visibility: the array bounds stay inside the frustum at the returned distance across a full sweep of participant positions', () => {
    // Simulates a bubble-sort-style sweep: every adjacent pair across a 20-wide array.
    const bounds: ArrayBounds = { center: { x: 0, y: 0, z: 0 }, halfSpanX: 10 };
    const baseline: CameraFrame = { target: { x: 0, y: 0, z: 0 }, distance: 22 };
    const floor = requiredVisibilityDistance(bounds.halfSpanX);

    for (let x = -10; x < 10; x += 1) {
      const c = new ArrayCameraChoreographer();
      c.registerInstruction({
        type: 'COMPARE',
        significance: 'notable',
        participants: [{ x, y: 0, z: 0 }, { x: x + 1, y: 0, z: 0 }],
      });
      tick(c, 5000, 50);
      const frame = c.getCameraFrame(baseline, bounds);

      // Distance never drops below the whole-array visibility floor (nor exceeds baseline).
      expect(frame.distance).toBeGreaterThanOrEqual(Math.min(floor, baseline.distance) - 1e-6);
      expect(frame.distance).toBeLessThanOrEqual(baseline.distance + 1e-6);
      // Pan never exceeds the structural cap either.
      expect(Math.abs(frame.target.x - baseline.target.x)).toBeLessThanOrEqual(bounds.halfSpanX * 0.35 + 1e-6);
    }
  });
});
