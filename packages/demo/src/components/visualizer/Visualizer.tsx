import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ExecutionTrace } from '@aqvl/runtime';
import {
  StageCanvas,
  initialTier,
  usePlayhead,
  type Playhead,
  type QualityTier,
  type StageStatus,
  type StageTheme,
} from '@aqvl/renderer';
import monoFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff?url';
import monoItalicFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-italic.woff?url';
import monoStrongFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff?url';
import { spring } from '../../lib/motion';
import { Scrubber } from './Scrubber';
import { WatchPanel } from './WatchPanel';
import { Legend } from './Legend';
import { EVENT_META, toneChip } from './events';
import { ToneGlyph } from './ToneGlyph';
import './visualizer.css';

const FONTS = { mono: monoFont, monoStrong: monoStrongFont, monoItalic: monoItalicFont };
const SPEEDS = [0.5, 1, 2, 4] as const;
const TIER_LABEL: Record<QualityTier, string> = { high: 'High', medium: 'Balanced', low: 'Light' };

const GlyphPlay = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 1.5 L12 7 L3 12.5 Z" fill="currentColor" />
  </svg>
);
const GlyphPause = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="2.5" y="1.5" width="3" height="11" rx="0.5" fill="currentColor" />
    <rect x="8.5" y="1.5" width="3" height="11" rx="0.5" fill="currentColor" />
  </svg>
);
const GlyphBack = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="1.5" y="2" width="2" height="10" rx="0.5" fill="currentColor" />
    <path d="M12.5 2 L5 7 L12.5 12 Z" fill="currentColor" />
  </svg>
);
const GlyphForward = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="10.5" y="2" width="2" height="10" rx="0.5" fill="currentColor" />
    <path d="M1.5 2 L9 7 L1.5 12 Z" fill="currentColor" />
  </svg>
);
const GlyphReplay = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2.5 7 A4.5 4.5 0 1 0 4 3.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M1.6 1.8 L4.4 3.4 L2.6 5.9 Z" fill="currentColor" />
  </svg>
);

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || el.isContentEditable;
}

export interface VisualizerProps {
  trace: ExecutionTrace;
  playhead: Playhead;
  source: string;
  theme: StageTheme;
  reducedMotion: boolean;
  /** Compact chrome (the compiler inspector's small viewport). */
  compact?: boolean;
}

/**
 * The visualizer: the 3D stage with what-just-happened, the program's
 * variables and call stack, a key, and a transport whose timeline shows
 * every step's kind. Keyboard: Space, arrows, Home / End, [ ], C, F, K.
 */
export function Visualizer({ trace, playhead, source, theme, reducedMotion, compact = false }: VisualizerProps) {
  const snap = usePlayhead(playhead);
  // Calm follows the OS preference until the viewer flips it.
  const [calmOverride, setCalmOverride] = useState<boolean | null>(null);
  const calm = calmOverride ?? reducedMotion;
  const toggleCalm = useCallback(() => setCalmOverride((v) => !(v ?? reducedMotion)), [reducedMotion]);
  const [follow, setFollow] = useState(true);
  const [tier, setTier] = useState<QualityTier>(initialTier);
  const [showKey, setShowKey] = useState(false);
  const [showWatch, setShowWatch] = useState(() => !compact && (typeof window === 'undefined' || window.innerWidth >= 900));
  const [status, setStatus] = useState<StageStatus>({ kind: 'ready' });
  const legendId = useId();

  // The caption card and side panel cover part of the canvas: the stage centres the picture in the rest.
  const viewportRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const [insets, setInsets] = useState({ top: 0, right: 0 });
  useEffect(() => {
    const measure = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const narrow = vp.clientWidth < 760;
      const top = (captionRef.current?.getBoundingClientRect().height ?? 0) + 18;
      const side = sideRef.current && sideRef.current.childElementCount > 0 ? sideRef.current.getBoundingClientRect().width : 0;
      const right = narrow || side < 1 ? 0 : side + 18;
      setInsets((prev) => (Math.abs(prev.top - top) < 4 && Math.abs(prev.right - right) < 4 ? prev : { top, right }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of [viewportRef.current, captionRef.current, sideRef.current]) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [showKey, showWatch, trace]);

  // Development only: lets automated checks pin playback to an exact moment.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    (window as unknown as { __aqvl?: unknown }).__aqvl = { playhead, trace };
    return () => {
      delete (window as unknown as { __aqvl?: unknown }).__aqvl;
    };
  }, [playhead, trace]);

  const frame = trace.frames[snap.active] ?? trace.frames[0];
  const shownFrame = trace.frames[snap.step] ?? trace.frames[0];
  const meta = EVENT_META[frame.event.kind];
  const chip = toneChip(meta.tone, theme);
  const atEnd = snap.atEnd;
  const errorVisible = atEnd && trace.error !== null;

  const stepLabel = `Step ${snap.step} of ${snap.totalSteps}${frame.caption ? `: ${frame.caption}` : ''}`;

  const cycleSpeed = useCallback(
    (dir: 1 | -1) => {
      const i = SPEEDS.indexOf(snap.speed as (typeof SPEEDS)[number]);
      const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 1 : i) + dir))];
      playhead.setSpeed(next);
    },
    [playhead, snap.speed],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          playhead.toggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) playhead.jumpToStep(snap.step + 10);
          else playhead.stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) playhead.jumpToStep(snap.step - 10);
          else playhead.stepBack();
          break;
        case 'Home':
          e.preventDefault();
          playhead.restart();
          break;
        case 'End':
          e.preventDefault();
          playhead.jumpToStep(playhead.totalSteps);
          break;
        case '[':
          cycleSpeed(-1);
          break;
        case ']':
          cycleSpeed(1);
          break;
        case 'c':
        case 'C':
          toggleCalm();
          break;
        case 'f':
        case 'F':
          setFollow(true);
          break;
        case 'k':
        case 'K':
          setShowKey((v) => !v);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playhead, snap.step, cycleSpeed, toggleCalm]);

  return (
    <div className={`vz${compact ? ' vz--compact' : ''}`} data-theme-stage={theme}>
      <div className="vz-viewport" ref={viewportRef}>
        <StageCanvas
          trace={trace}
          playhead={playhead}
          source={source}
          theme={theme}
          calm={calm}
          follow={follow}
          onFollowChange={setFollow}
          tier={tier}
          onTierChange={setTier}
          fonts={FONTS}
          onStatus={setStatus}
          insets={insets}
        />

        {/* What just happened */}
        <div className="vz-caption" ref={captionRef} aria-live={snap.playing ? 'off' : 'polite'}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={snap.active}
              className="vz-caption__card"
              initial={calm ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: spring.snappy }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <div className="vz-caption__meta">
                <span className="vz-chip" style={chip}>
                  <ToneGlyph tone={meta.tone} />
                  {snap.active === 0 ? 'Ready' : meta.label}
                </span>
                <span className="vz-caption__step">
                  step <b>{snap.active}</b> / {snap.totalSteps}
                  {frame.line !== null && <> · line {frame.line}</>}
                </span>
              </div>
              <p className="vz-caption__text">
                {snap.active === 0
                  ? `${snap.totalSteps} steps recorded. Press play, or step through with the arrow keys.`
                  : frame.caption || meta.label}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* View controls */}
        <div className="vz-tools" role="toolbar" aria-label="View">
          {!follow && (
            <button type="button" className="vz-tool is-accent" onClick={() => setFollow(true)} title="Camera follows the action again (F)">
              Recenter
            </button>
          )}
          <button type="button" className={`vz-tool${calm ? ' is-on' : ''}`} aria-pressed={calm} onClick={toggleCalm} title="Calm motion: no arcs, ripples or travelling dots (C)">
            Calm
          </button>
          <label className="vz-tool vz-tool--select" title="Rendering quality (drops automatically when frames run long)">
            <span className="sr-only">Quality</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as QualityTier)}>
              {(Object.keys(TIER_LABEL) as QualityTier[]).map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          {!compact && (
            <button type="button" className={`vz-tool${showWatch ? ' is-on' : ''}`} aria-pressed={showWatch} onClick={() => setShowWatch((v) => !v)}>
              Watch
            </button>
          )}
          <button type="button" className={`vz-tool${showKey ? ' is-on' : ''}`} aria-expanded={showKey} aria-controls={legendId} onClick={() => setShowKey((v) => !v)} title="What the colours mean (K)">
            Key
          </button>
        </div>

        <div className="vz-side" ref={sideRef}>
          {showKey && <Legend theme={theme} id={legendId} />}
          {showWatch && !showKey && <WatchPanel frame={shownFrame} previous={trace.frames[snap.step - 1]} />}
        </div>

        {/* Notices */}
        <div className="vz-notices">
          {trace.truncated && <p className="vz-notice">Showing the first {snap.totalSteps} steps; the program keeps going after that.</p>}
          {status.kind === 'font-error' && <p className="vz-notice">{status.message}</p>}
        </div>

        {status.kind === 'context-lost' && (
          <div className="vz-overlay" role="status">
            <p className="vz-overlay__title">Restoring the 3D view…</p>
            <p className="vz-overlay__body">The graphics context was lost (the GPU was reset or reclaimed). It comes back on its own; your place in the run is kept.</p>
          </div>
        )}
        {status.kind === 'no-webgl' && (
          <div className="vz-overlay" role="alert">
            <p className="vz-overlay__title">3D isn’t available here</p>
            <p className="vz-overlay__body">This browser couldn’t start WebGL ({status.message}). The timeline, captions, code highlight and variables still step through the run.</p>
          </div>
        )}
        {errorVisible && (
          <div className="vz-error" role="alert">
            <p className="vz-error__title">Runtime error{trace.error!.line !== null ? ` at line ${trace.error!.line}` : ''}</p>
            <p className="vz-error__body">{trace.error!.message}</p>
          </div>
        )}
      </div>

      <div className="vz-transport">
        <div className="vz-transport__keys" role="group" aria-label="Playback">
          <button type="button" className="vz-btn" onClick={() => playhead.stepBack()} disabled={snap.step === 0 && snap.active === 0} aria-label="Step back" title="Step back (←)">
            <GlyphBack />
          </button>
          <button
            type="button"
            className={`vz-play${snap.playing ? ' is-playing' : ''}`}
            onClick={() => playhead.toggle()}
            disabled={snap.totalSteps === 0}
            aria-label={snap.playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
            title={snap.playing ? 'Pause (Space)' : atEnd ? 'Replay (Space)' : 'Play (Space)'}
          >
            {snap.playing ? <GlyphPause /> : atEnd ? <GlyphReplay /> : <GlyphPlay />}
          </button>
          <button type="button" className="vz-btn" onClick={() => playhead.stepForward()} disabled={atEnd} aria-label="Step forward" title="Step forward (→)">
            <GlyphForward />
          </button>
        </div>

        <Scrubber trace={trace} playhead={playhead} theme={theme} step={snap.step} label={stepLabel} />

        <div className="vz-count" aria-hidden="true">
          <b>{snap.step}</b>
          <span>/ {snap.totalSteps}</span>
        </div>

        <div className="vz-speed" role="radiogroup" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={snap.speed === s} className={`vz-speed__opt${snap.speed === s ? ' is-on' : ''}`} onClick={() => playhead.setSpeed(s)}>
              {snap.speed === s && <motion.span layoutId={`vz-speed-${legendId}`} className="vz-speed__bg" transition={spring.layout} />}
              <span className="relative">{s}×</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
