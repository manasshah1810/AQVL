import { useEffect } from 'react';
import type { Playhead } from '@aqvl/renderer';

/**
 * Stops playback the first time it reaches step `frame` while playing, and
 * again on any later play-through that starts before it. Scrubbing past it
 * does not stop.
 */
export function useStopAt(playhead: Playhead | null, frame: number | null) {
  useEffect(() => {
    if (!playhead || frame === null) return undefined;
    const at = playhead.timeOfStep(frame);
    let armed = playhead.time < at - 1e-6;
    return playhead.onTick((t) => {
      if (t < at - 1e-6) {
        armed = true;
        return;
      }
      if (!armed) return;
      // Disarm first: scrubTo ticks again (before its snapshot says paused).
      armed = false;
      if (playhead.getSnapshot().playing) playhead.scrubTo(at);
    });
  }, [playhead, frame]);
}
