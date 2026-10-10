import { useCallback, useEffect, useRef, useState } from 'react';
import { recordTrace, type AQIRProgram, type ExecutionTrace } from '@aqvl/runtime';
import { Playhead } from '@aqvl/renderer';

export interface TraceRun {
  id: number;
  trace: ExecutionTrace;
  playhead: Playhead;
  source: string;
}

/**
 * Records a compiled program into an execution trace (yielding to the page
 * while it runs) and wraps it in a Playhead. A newer start() supersedes an
 * older one still recording; replaced playheads are disposed once the
 * stage has finished its exit.
 */
export function useTraceRun() {
  const [run, setRun] = useState<TraceRun | null>(null);
  const [tracing, setTracing] = useState<number | null>(null);
  const latest = useRef(0);

  const start = useCallback(async (program: AQIRProgram, source: string): Promise<TraceRun | null> => {
    const id = ++latest.current;
    setTracing(0);
    const trace = await recordTrace(program, {
      source,
      onProgress: (steps) => {
        if (latest.current === id) setTracing(steps);
      },
    });
    if (latest.current !== id) return null;
    const next: TraceRun = { id, trace, playhead: new Playhead(trace), source };
    setRun(next);
    setTracing(null);
    return next;
  }, []);

  /** Plays a trace that was already recorded (a graded challenge run), superseding anything still recording. */
  const adopt = useCallback((trace: ExecutionTrace, source: string): TraceRun => {
    const id = ++latest.current;
    const next: TraceRun = { id, trace, playhead: new Playhead(trace), source };
    setRun(next);
    setTracing(null);
    return next;
  }, []);

  const clear = useCallback(() => {
    latest.current++;
    setTracing(null);
    setRun(null);
  }, []);

  // Dispose a run's playhead after the stage has played its exit.
  const previous = useRef<TraceRun | null>(null);
  useEffect(() => {
    const old = previous.current;
    previous.current = run;
    if (!old || old === run) return undefined;
    old.playhead.pause();
    const t = window.setTimeout(() => old.playhead.dispose(), 1500);
    return () => window.clearTimeout(t);
  }, [run]);

  useEffect(() => () => previous.current?.playhead.dispose(), []);

  return { run, tracing, start, adopt, clear };
}
