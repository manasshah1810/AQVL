import React, { useCallback, useEffect, useRef } from 'react';
import type { ExecutionTrace } from '@aqvl/runtime';
import { usePlayheadTime, type Playhead, type StageTheme } from '@aqvl/renderer';
import { EVENT_META, toneColor } from './events';

const TICK_HEIGHT: Record<string, number> = { error: 1, mutate: 1, compare: 0.72, visit: 0.5, settle: 0.6, mark: 0.45, discard: 0.4, neutral: 0.3 };

/**
 * The timeline: one tick per step, coloured and sized by what the step
 * does, so you can see where the swaps cluster before you get there.
 * Drag or click to scrub; arrows step, Page Up/Down jump ten, Home/End.
 */
export function Scrubber({
  trace,
  playhead,
  theme,
  step,
  label,
}: {
  trace: ExecutionTrace;
  playhead: Playhead;
  theme: StageTheme;
  step: number;
  label: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const total = playhead.table.total;

  const setPosition = useCallback(
    (t: number) => {
      const el = trackRef.current;
      if (el) el.style.setProperty('--pos', String(total > 0 ? t / total : 0));
    },
    [total],
  );
  usePlayheadTime(playhead, setPosition);

  // Draw the event ticks.
  useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return undefined;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = track.clientWidth;
      const h = 18;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx || total <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const ends = playhead.table.ends;
      const durations = playhead.table.durations;
      const tickW = Math.max(1, Math.min(3, (w / Math.max(1, trace.frames.length)) * 0.7));
      for (let k = 1; k < trace.frames.length; k++) {
        const tone = EVENT_META[trace.frames[k].event.kind].tone;
        const mid = (ends[k] - durations[k] / 2) / total;
        const th = Math.max(3, h * TICK_HEIGHT[tone]);
        ctx.fillStyle = toneColor(tone, theme);
        ctx.globalAlpha = tone === 'neutral' ? 0.45 : 0.9;
        ctx.fillRect(mid * w - tickW / 2, h - th, tickW, th);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(track);
    return () => ro.disconnect();
  }, [trace, playhead, theme, total]);

  const timeAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * total;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    playhead.scrubTo(timeAt(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) playhead.scrubTo(timeAt(e.clientX));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = playhead.totalSteps;
    let target: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') target = step + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') target = step - 1;
    else if (e.key === 'PageUp') target = step + 10;
    else if (e.key === 'PageDown') target = step - 10;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = n;
    if (target === null) return;
    e.preventDefault();
    e.stopPropagation();
    playhead.jumpToStep(Math.max(0, Math.min(n, target)));
  };

  return (
    <div
      ref={trackRef}
      className="vz-scrub"
      role="slider"
      tabIndex={0}
      aria-label="Timeline"
      aria-valuemin={0}
      aria-valuemax={playhead.totalSteps}
      aria-valuenow={step}
      aria-valuetext={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} className="vz-scrub__ticks" aria-hidden="true" />
      <span className="vz-scrub__rail" aria-hidden="true">
        <span className="vz-scrub__fill" />
      </span>
      <span className="vz-scrub__thumb" aria-hidden="true" />
    </div>
  );
}
