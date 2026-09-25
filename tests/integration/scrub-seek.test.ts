/**
 * Regression coverage for the scrub/seek UI feature: the landing page claims
 * users can "scrub backwards" through a visualization, backed by a real
 * ExecutionEngine.seek()/jumpToStep() (the old `seek()` was a no-op — see
 * ExecutionEngine.ts history). This proves that jumping to an arbitrary
 * earlier frame doesn't just move a slider — it reconstructs the *exact*
 * live scene graph (element values, ordering/slot assignment, count) from
 * the immutable snapshot StateManager recorded at that point during the
 * original forward playback, and that scrubbing forward again afterwards is
 * equally exact.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

// Same trick as migration-array.test.ts / bst-array-routing.test.ts: anime.js's
// timeline reaches for `window`, absent under the `node` test environment.
// Short-circuiting it to complete instantly lets execute() run the real
// production pipeline synchronously to completion.
function makeInstantEngine(): ExecutionEngine {
  const engine = new ExecutionEngine();
  let onComplete: (() => void) | null = null;
  const timelineEngine = engine.timelineEngine as any;
  timelineEngine.init = (cb?: () => void) => {
    onComplete = cb ?? null;
  };
  timelineEngine.play = () => {
    const cb = onComplete;
    onComplete = null;
    cb?.();
  };
  timelineEngine.triggerComplete = () => {
    const cb = onComplete;
    onComplete = null;
    cb?.();
  };
  return engine;
}

/**
 * id -> {value, logicalIndex} fingerprint, comparable regardless of source
 * (live scene graph or a stored snapshot's element map). Uses logicalIndex
 * rather than `position` because element position is applied by an animated
 * tween (anime.js `targets`) that this suite's synchronous test harness
 * short-circuits (see makeInstantEngine) — logicalIndex, by contrast, is
 * assigned by a direct, synchronous property write in AnimationController
 * (e.g. `leftEl.logicalIndex = rightIndex` on SWAP), so it's a faithful,
 * harness-independent signal of "which slot this element occupies" — i.e.
 * the rendered structure — at each recorded snapshot.
 */
function fingerprintElements(elements: Iterable<any>) {
  const byId: Record<string, { value: unknown; logicalIndex: unknown }> = {};
  for (const el of elements) {
    byId[el.id] = {
      value: el.value,
      logicalIndex: el.logicalIndex,
    };
  }
  return byId;
}

const fingerprintScene = (engine: ExecutionEngine) =>
  fingerprintElements(engine.sceneManager.getSceneGraph() as any[]);

/** Array values ordered by logicalIndex — BUBBLE_SORT reorders elements by
 * updating logicalIndex/position, not their position within the raw scene
 * graph array, so this (not raw iteration order) is what "the array reads
 * as X" actually means. */
function orderedValues(elements: Iterable<any>): number[] {
  return [...elements]
    .filter((el) => el.logicalParent === 'arr')
    .sort((a, b) => a.logicalIndex - b.logicalIndex)
    .map((el) => Number(el.value));
}

describe('Scrub/seek restores exact prior visual state', () => {
  const source = `SCENE BubbleSortScrub
DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  BUBBLE_SORT arr
END
`;

  it('jumping backward to an earlier frame reproduces the immutable snapshot StateManager recorded for it during forward playback', async () => {
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const timelineLength = engine.getTimelineLength();
    expect(timelineLength).toBeGreaterThan(1);

    // The live scene graph right after forward execution finishes == the
    // fully-sorted final frame.
    const finalFingerprint = fingerprintScene(engine);
    const finalValues = orderedValues(engine.sceneManager.getSceneGraph() as any[]);
    expect([...finalValues].sort((a, b) => a - b)).toEqual(finalValues); // fully sorted

    // Ground truth: StateManager.jumpTo(i) returns the literal immutable
    // snapshot object it deep-cloned and stored WHILE forward execution was
    // running (ExecutionEngine.execute() -> stateManager.saveState() per
    // instruction) — not a value recomputed now. This is "what it looked
    // like at that point in the original forward playback."
    // Find an earlier frame that is genuinely mid-sort (not coincidentally
    // already in sorted order), so the test actually exercises a distinct
    // earlier state rather than one that happens to match the final frame.
    let midIndex = -1;
    let expectedMidFingerprint: ReturnType<typeof fingerprintElements> | null = null;
    for (let i = 0; i < timelineLength - 1; i++) {
      const snapshot = engine.stateManager.jumpTo(i)!;
      const values = orderedValues(snapshot.elements.values());
      if (JSON.stringify(values) !== JSON.stringify(finalValues)) {
        midIndex = i;
        expectedMidFingerprint = fingerprintElements(snapshot.elements.values());
        break;
      }
    }
    expect(midIndex).toBeGreaterThanOrEqual(0);
    expect(expectedMidFingerprint).not.toBeNull();
    expect(expectedMidFingerprint).not.toEqual(finalFingerprint);

    // --- Scrub backward via the real API the UI slider calls ---
    engine.jumpToStep(midIndex);

    expect(engine.getCurrentStateIndex()).toBe(midIndex);
    const restoredMidFingerprint = fingerprintScene(engine);
    // Not just "the slider moved" — the reconstructed LIVE scene graph
    // exactly matches the snapshot recorded during original forward playback,
    // element-for-element (value AND slot/logicalIndex), including element count.
    expect(restoredMidFingerprint).toEqual(expectedMidFingerprint);
    expect(Object.keys(restoredMidFingerprint).length).toBe(
      Object.keys(expectedMidFingerprint!).length
    );

    // --- Scrub forward again, past the point we rewound from ---
    const finalIndex = timelineLength - 1;
    engine.jumpToStep(finalIndex);

    expect(engine.getCurrentStateIndex()).toBe(finalIndex);
    expect(fingerprintScene(engine)).toEqual(finalFingerprint);
  });

  it('seek(timeMs) — the API the landing page originally referenced — also performs a real, working seek instead of the old no-op', async () => {
    const aqir = compile(source);
    const engine = makeInstantEngine();
    engine.loadProgram(aqir);
    await engine.execute();

    const finalFingerprint = fingerprintScene(engine);

    // seek(0) resolves to the earliest snapshot whose recorded time is <= 0,
    // i.e. the initial (pre-sort) state.
    engine.seek(0);
    const seekedFingerprint = fingerprintScene(engine);
    expect(seekedFingerprint).not.toEqual(finalFingerprint);

    // Confirms seek() actually moved the engine (old implementation was a
    // documented no-op: `// Seeking is not compatible with sequential
    // execution yet`), and landed on a snapshot StateManager really recorded.
    const groundTruth = fingerprintElements(
      engine.stateManager.jumpTo(engine.getCurrentStateIndex())!.elements.values()
    );
    expect(seekedFingerprint).toEqual(groundTruth);

    // The very first recorded snapshot is the unsorted DECLARE order.
    const initialSnapshotValues = orderedValues(engine.stateManager.jumpTo(0)!.elements.values());
    expect(initialSnapshotValues).toEqual([5, 3, 8, 1, 9]);
  });
});
