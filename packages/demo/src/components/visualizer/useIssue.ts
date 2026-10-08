import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { teachError, type ErrorInfo, type ErrorLesson, type ExecutionTrace } from '@aqvl/runtime';
import type { Playhead } from '@aqvl/renderer';
import { useSettings } from '../../lib/settings';
import { VoiceEngine, errorScript, type ScriptPart, type ScriptSection, type VoiceTheme } from '../../lib/voice';

/** Let the picture of the failed access arrive before the explanation starts. */
const LEAD_IN_MS = 520;

/** The mistake the frame shows: the run's error on its error frame, or a logic problem on its step. */
export function issueAt(trace: ExecutionTrace, index: number): ErrorInfo | null {
  const frame = trace.frames[index];
  if (frame?.error) return frame.error.info;
  return trace.diagnostics.find((d) => d.frameIndex === index) ?? null;
}

/** Speaks the parts in order, telling `onPart` which one is being said; stops quietly when `live()` goes false. */
async function speakParts(parts: ScriptSection[], theme: VoiceTheme, live: () => boolean, onPart: (id: ScriptPart | null) => void) {
  for (const part of parts) {
    if (!live()) return;
    onPart(part.id);
    const result = await VoiceEngine.speak({ text: part.text, theme });
    if (!live() || result === 'cancelled') return;
    if (result === 'failed') break;
  }
  if (live()) onPart(null);
}

export interface LessonNarration {
  /** Which part of the lesson is being spoken right now. */
  speaking: ScriptPart | null;
  /** Say the whole lesson (the Explain button). */
  explain: () => void;
  stop: () => void;
}

/**
 * Speaks a lesson in the current theme's voice, part by part, when it
 * appears (unless the voice is off or on manual), and on request. Edited code
 * (`stale`) silences it: the lesson describes a run that no longer matches
 * the editor.
 */
export function useLessonNarration(lesson: ErrorLesson | null, theme: VoiceTheme, stale: boolean): LessonNarration {
  const settings = useSettings();
  const sections = useMemo(() => (lesson ? errorScript(lesson, theme) : []), [lesson, theme]);
  const [speaking, setSpeaking] = useState<ScriptPart | null>(null);
  const token = useRef(0);
  /** Ends whatever is being said: the loop in `speakParts` stops at its next check. */
  const invalidate = useCallback(() => {
    token.current += 1;
  }, []);

  const run = useCallback(
    (parts: ScriptSection[]) => {
      const mine = ++token.current;
      void speakParts(parts, theme, () => token.current === mine, setSpeaking);
    },
    [theme],
  );

  const autoSpeak = settings.voiceOn && settings.voiceMode !== 'manual' && !stale;
  useEffect(() => {
    if (!lesson || !autoSpeak || sections.length === 0) return undefined;
    const timer = window.setTimeout(() => run(sections), LEAD_IN_MS);
    return () => {
      window.clearTimeout(timer);
      invalidate();
      VoiceEngine.cancel();
    };
  }, [lesson, autoSpeak, sections, run, invalidate]);

  const stop = useCallback(() => {
    invalidate();
    VoiceEngine.cancel();
    setSpeaking(null);
  }, [invalidate]);
  // Leaving the page ends the voice with it.
  useEffect(() => invalidate, [invalidate]);
  const explain = useCallback(() => run(sections), [run, sections]);

  return { speaking: lesson ? speaking : null, explain, stop };
}

export interface IssueTeaching extends LessonNarration {
  /** The diagnosed mistake on the frame on screen, if any (and not dismissed). */
  issue: ErrorInfo | null;
  lesson: ErrorLesson | null;
  /** Hide a logic warning and keep going. */
  dismiss: () => void;
}

/**
 * The teaching sequence for the frame on screen. The error, the highlighted
 * line, the cell on the stage, the panel and the voice all read the same
 * frame, so they cannot disagree about where the problem is. A logic problem
 * stops playback on its own step and waits for the learner; an ordinary step
 * is never paused.
 */
export function useIssueTeaching(trace: ExecutionTrace, playhead: Playhead, active: number, stale: boolean, theme: VoiceTheme, enabled = true): IssueTeaching {
  const [dismissed, setDismissed] = useState<{ trace: ExecutionTrace; frames: number[] }>({ trace, frames: [] });
  const dismissedFrames = useMemo(() => (dismissed.trace === trace ? dismissed.frames : []), [dismissed, trace]);
  const found = enabled ? issueAt(trace, active) : null;
  const issue = found && !dismissedFrames.includes(found.frameIndex ?? -1) ? found : null;
  const lesson = useMemo(() => (issue ? teachError(issue, trace.frames[issue.frameIndex ?? active]) : null), [issue, trace, active]);
  const narration = useLessonNarration(lesson, theme, stale);

  useEffect(() => {
    if (issue?.phase === 'logic' && playhead.getSnapshot().playing) playhead.pause();
  }, [issue, playhead]);

  const { stop } = narration;
  const dismiss = useCallback(() => {
    stop();
    if (issue?.frameIndex != null) setDismissed({ trace, frames: [...dismissedFrames, issue.frameIndex] });
  }, [stop, issue, trace, dismissedFrames]);

  return { ...narration, issue, lesson, dismiss };
}
