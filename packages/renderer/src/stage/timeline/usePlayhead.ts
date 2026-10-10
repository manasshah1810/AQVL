import { useEffect, useSyncExternalStore } from 'react';
import type { Playhead, PlayheadSnapshot } from './Playhead';

const IDLE: PlayheadSnapshot = { step: 0, active: 0, totalSteps: 0, playing: false, speed: 1, atEnd: true, duration: 0 };
const noop = () => () => {};

/** The playhead's coarse state (step, playing, speed); re-renders a few times per step, never per frame. */
export function usePlayhead(playhead: Playhead | null): PlayheadSnapshot {
  return useSyncExternalStore(
    playhead ? playhead.subscribe : noop,
    playhead ? playhead.getSnapshot : () => IDLE,
    () => IDLE,
  );
}

/**
 * Calls `onTime` with the exact time on every frame the playhead moves,
 * for things that follow it smoothly (a scrubber thumb) without React renders.
 */
export function usePlayheadTime(playhead: Playhead | null, onTime: (t: number) => void): void {
  useEffect(() => {
    if (!playhead) return undefined;
    onTime(playhead.time);
    return playhead.onTick(onTime);
  }, [playhead, onTime]);
}
