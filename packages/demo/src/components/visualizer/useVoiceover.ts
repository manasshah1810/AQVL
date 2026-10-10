import { useCallback, useEffect, useMemo } from 'react';
import { explainError, explainFrame, type Explanation, type ExecutionTrace } from '@aqvl/runtime';
import type { Playhead } from '@aqvl/renderer';
import { useSettings } from '../../lib/settings';
import { useWorld } from '../../lib/world';
import { VoiceEngine, voiceThemeOf } from '../../lib/voice';

/** Wait for the viewer to settle on a step before synthesising it, so scrubbing past 200 steps speaks none of them. */
const SETTLE_MS = 140;

/**
 * What to say about frame `index`: the step's own explanation, or, on the
 * last frame of a run that ended in an error, the error's.
 */
export function explanationAt(trace: ExecutionTrace, index: number, source: string): Explanation {
  if (trace.error && index >= trace.frames.length - 1) {
    const err = explainError(trace, { source });
    if (err) return err;
  }
  return explainFrame(trace, index, { source });
}

/**
 * The voiceover. It reads the same frame the stage is drawing and the editor
 * is highlighting (`active`), turns it into words with the explainer, and
 * speaks them in the current world's voice. Nothing about a program is known
 * here: new code gives new frames, which give new sentences.
 *
 * While playing, a step that is going to be spoken finishes its animation
 * and then holds until the sentence is done, so the picture, the highlighted
 * line and the voice never drift onto different steps.
 */
export function useVoiceover(trace: ExecutionTrace, playhead: Playhead, active: number, source: string, enabled = true, suppress = false) {
  const settings = useSettings();
  const world = useWorld();
  const theme = voiceThemeOf(world);
  const { voiceMode, voiceEngine } = settings;
  const voiceOn = settings.voiceOn && enabled;

  const explanation = useMemo(() => explanationAt(trace, active, source), [trace, active, source]);

  useEffect(() => {
    VoiceEngine.setEngine(voiceEngine);
  }, [voiceEngine]);

  // Fetch the neural model as soon as the voice is switched on (or the world changes), not on the first sentence.
  useEffect(() => {
    if (voiceOn) void VoiceEngine.warm(theme);
  }, [voiceOn, theme, voiceEngine]);

  // Narrate the step that just began.
  useEffect(() => {
    // A frame that carries a mistake is taught by the issue narration (its own parts, its own pacing); this stays quiet there.
    if (suppress) return undefined;
    if (!voiceOn || voiceMode === 'manual' || active === 0) {
      VoiceEngine.cancel();
      return undefined;
    }
    if (voiceMode === 'key' && explanation.importance !== 'key') {
      VoiceEngine.cancel();
      return undefined;
    }
    let live = true;
    // Let this step's animation play out in full, then hold at its end while the sentence is spoken.
    const gated = playhead.getSnapshot().playing;
    // We hold playback only while the sentence is spoken, and always hand it back: whether the speech ends, fails, hangs,
    // or this effect is torn down mid-sentence (a setting or step changed), a run must never be left paused by the narration.
    let held = false;
    const release = () => {
      if (!held) return;
      held = false;
      if (!playhead.getSnapshot().atEnd) playhead.play();
    };
    if (gated) {
      playhead.stepForward();
      held = true;
    }
    let watchdog = 0;
    const timer = window.setTimeout(() => {
      if (held) watchdog = window.setTimeout(() => live && release(), Math.min(20000, 6000 + explanation.text.length * 90));
      void VoiceEngine.speak({ text: explanation.text, theme }).then(
        () => live && release(),
        () => live && release(),
      );
    }, gated ? 0 : SETTLE_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
      window.clearTimeout(watchdog);
      VoiceEngine.cancel();
      release();
    };
  }, [voiceOn, voiceMode, explanation, active, theme, playhead, suppress]);

  // Leaving the page (or switching run) silences it.
  useEffect(() => () => VoiceEngine.cancel(), [playhead]);

  /** Manual mode: say the current step on request (also works with the voice on). */
  const explainNow = useCallback(() => {
    void VoiceEngine.speak({ text: explanation.text, theme });
  }, [explanation, theme]);

  return { explanation, explainNow, theme };
}
