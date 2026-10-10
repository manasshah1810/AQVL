import React, { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ExecutionTrace } from '@aqvl/runtime';
import {
  StageCanvas,
  initialTier,
  usePlayhead,
  type Playhead,
  type QualityTier,
  type StageProjector,
  type StageStatus,
  type StageTheme,
} from '@aqvl/renderer';
import monoFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff?url';
import monoItalicFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-italic.woff?url';
import monoStrongFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff?url';
import { spring } from '../../lib/motion';
import { useWorld, type World } from '../../lib/world';
import { updateSettings, useSettings, type DockTab } from '../../lib/settings';
import { Scrubber } from './Scrubber';
import { VoiceControl } from './VoiceControl';
import { useVoiceover } from './useVoiceover';
import { useIssueTeaching } from './useIssue';
import { IssuePanel } from './IssuePanel';
import { voiceThemeOf } from '../../lib/voice';
import { StageDock } from './StageDock';
import { EVENT_META, toneChip } from './events';
import { ToneGlyph } from './ToneGlyph';
import './visualizer.css';

const FONTS = { mono: monoFont, monoStrong: monoStrongFont, monoItalic: monoItalicFont };
const SPEEDS = [0.5, 1, 2, 4] as const;

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
  /** Compact chrome (the compiler inspector's small viewport): no side panel. */
  compact?: boolean;
  /** What the run printed so far, for the panel's Output tab (the Playground supplies it). */
  output?: ReactNode;
  /** Number of lines in the output (shown on the Output tab). */
  outputCount?: number;
  /** The editor no longer holds the code this run came from, so what is explained is out of date. */
  stale?: boolean;
  /** "Try again": run the code as it is now. */
  onRetry?: () => void;
  /** "Edit code": put the cursor on the line that needs changing. */
  onEditLine?: (line: number | null) => void;
  /** Pin the stage to one world whatever the site's world is (challenges use the plain studio). */
  world?: World;
  /** Receives the live camera's projection (a layer drawn over the stage uses it to sit on the nodes). */
  projectorRef?: React.MutableRefObject<StageProjector | null>;
  /** Drawn over the canvas, inside the stage's frame. */
  overlay?: ReactNode;
}

/**
 * The visualizer: a clean 3D stage, a one-line account of what just
 * happened, and a transport whose timeline shows every step's kind. The
 * secondary things (variables and call stack, the colour key, the run's
 * output, the stage settings) live in one panel beside the stage that opens
 * when asked for and remembers its place; nothing else is drawn over the
 * scene. Keyboard: Space, arrows, Home / End, [ ], C calm, F follow, and
 * V / K / O / S for the panel's tabs.
 */
export function Visualizer({ trace, playhead, source, theme, reducedMotion, compact = false, output, outputCount = 0, stale = false, onRetry, onEditLine, world: pinnedWorld, projectorRef, overlay }: VisualizerProps) {
  const snap = usePlayhead(playhead);
  const siteWorld = useWorld();
  const world = pinnedWorld ?? siteWorld;
  const settings = useSettings();

  // Calm follows the setting (auto: the OS preference).
  const calm = settings.calm === 'auto' ? reducedMotion : settings.calm === 'on';
  const toggleCalm = useCallback(() => updateSettings({ calm: calm ? 'off' : 'on' }), [calm]);

  // The camera follows the action until the viewer takes it by hand.
  const [follow, setFollow] = useState(settings.follow);
  const [seenFollow, setSeenFollow] = useState(settings.follow);
  if (seenFollow !== settings.follow) {
    // The setting changed (Settings page, stage panel): the camera follows again (or stays where it was put).
    setSeenFollow(settings.follow);
    setFollow(settings.follow);
  }

  // Quality: the chosen tier, or (auto) the device's, dropping by itself when frames run long.
  const [autoTier, setAutoTier] = useState<QualityTier>(initialTier);
  const tier: QualityTier = settings.quality === 'auto' ? autoTier : settings.quality;
  const onTierChange = useCallback(
    (t: QualityTier) => {
      if (settings.quality === 'auto') setAutoTier(t);
    },
    [settings.quality],
  );

  // The side panel (not in the compact inspector).
  const dock = compact ? null : settings.dock;
  const setDock = useCallback((tab: DockTab | null) => updateSettings({ dock: tab }), []);
  const toggleDock = useCallback((tab: DockTab) => updateSettings({ dock: settings.dock === tab ? null : tab }), [settings.dock]);
  const [status, setStatus] = useState<StageStatus>({ kind: 'ready' });
  const panelId = useId();

  // The mistake (if any) at the step on screen: one lesson for the card, the highlighted line and the voice.
  const voiceTheme = voiceThemeOf(world);
  const issue = useIssueTeaching(trace, playhead, snap.active, stale, voiceTheme, !compact);
  const issueKey = issue.lesson ? `${issue.lesson.type}:${issue.lesson.line}` : '';

  // The caption card covers a strip of the canvas; the stage centres the picture in the rest. In narrow
  // layouts the panel slides over the stage, and the picture moves aside for it.
  const vzRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const issueRef = useRef<HTMLElement>(null);
  const [insets, setInsets] = useState({ top: 0, right: 0 });
  useEffect(() => {
    const measure = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const top = (captionRef.current?.getBoundingClientRect().height ?? 0) + 14;
      let right = 0;
      const el = dockRef.current;
      if (el && getComputedStyle(el).position === 'absolute' && vp.clientWidth >= 760) right = el.getBoundingClientRect().width + 16;
      // The teaching card sits beside the picture, so the picture is centred in what is left.
      const card = issueRef.current;
      if (card && vp.clientWidth >= 760) right = Math.max(right, card.getBoundingClientRect().width + 28);
      setInsets((prev) => (Math.abs(prev.top - top) < 4 && Math.abs(prev.right - right) < 4 ? prev : { top, right }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of [vzRef.current, viewportRef.current, captionRef.current, dockRef.current, issueRef.current]) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [dock, trace, issueKey]);

  // Development only: lets automated checks pin playback to an exact moment.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    (window as unknown as { __aqvl?: unknown }).__aqvl = { playhead, trace };
    return () => {
      delete (window as unknown as { __aqvl?: unknown }).__aqvl;
    };
  }, [playhead, trace]);

  // The voice reads the same frame as the stage and the code highlight.
  const voice = useVoiceover(trace, playhead, snap.active, source, !compact, issue.issue !== null, pinnedWorld);
  const voiceOn = settings.voiceOn && !compact;

  const frame = trace.frames[snap.active] ?? trace.frames[0];
  const shownFrame = trace.frames[snap.step] ?? trace.frames[0];
  const meta = EVENT_META[frame.event.kind];
  const chip = toneChip(meta.tone, theme);
  const atEnd = snap.atEnd;
  // A run that ended in an error without a diagnosis (never produced now, kept so no error is ever hidden).
  const plainError = atEnd && trace.error !== null && !trace.error.info;

  const stepLabel = `Step ${snap.step} of ${snap.totalSteps}${frame.caption ? `: ${frame.caption}` : ''}`;
  const captionText =
    snap.active === 0
      ? `${snap.totalSteps} steps recorded. Press play, or step with the arrow keys.`
      : issue.lesson
        ? issue.lesson.what
        : voiceOn && snap.active > 0
          ? voice.explanation.text
          : frame.caption || meta.label;

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
          if (!compact) toggleDock('key');
          break;
        case 'v':
        case 'V':
          if (!compact) toggleDock('watch');
          break;
        case 'o':
        case 'O':
          if (!compact && output) toggleDock('output');
          break;
        case 's':
        case 'S':
          if (!compact) toggleDock('stage');
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playhead, snap.step, cycleSpeed, toggleCalm, toggleDock, compact, output]);

  return (
    <div className={`vz${compact ? ' vz--compact' : ''}${dock ? ' has-dock' : ''}`} data-theme-stage={theme} data-world={world} ref={vzRef}>
      <div className="vz-stage">
        <div className="vz-viewport" ref={viewportRef}>
          <StageCanvas
            trace={trace}
            playhead={playhead}
            source={source}
            theme={theme}
            world={world}
            calm={calm}
            follow={follow}
            onFollowChange={setFollow}
            tier={tier}
            onTierChange={onTierChange}
            fonts={FONTS}
            onStatus={setStatus}
            insets={insets}
            projectorRef={projectorRef}
          />
          {overlay}

          {/* What just happened: one quiet line (the whole sentence on hover or focus). */}
          <div className="vz-caption" ref={captionRef} aria-live={snap.playing ? 'off' : 'polite'}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={snap.active}
                className="vz-caption__card"
                tabIndex={0}
                initial={calm ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: spring.snappy }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <span className="vz-chip" style={chip}>
                  <ToneGlyph tone={meta.tone} />
                  {snap.active === 0 ? 'Ready' : meta.label}
                </span>
                <span className="vz-caption__text">{captionText}</span>
                <span className="vz-caption__step">
                  <b>{snap.active}</b>/{snap.totalSteps}
                  {frame.line !== null && <span className="vz-caption__line"> · line {frame.line}</span>}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* The one view control that belongs on the stage: getting the camera back. */}
          {!follow && (
            <button type="button" className="vz-recenter" onClick={() => setFollow(true)} title="Camera follows the action again (F)">
              Recenter
            </button>
          )}
          {compact && (
            <div className="vz-tools" role="toolbar" aria-label="View">
              <button type="button" className={`vz-tool${calm ? ' is-on' : ''}`} aria-pressed={calm} onClick={toggleCalm} title="Calm motion (C)">
                Calm
              </button>
            </div>
          )}

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
          {plainError && (
            <div className="vz-error" role="alert">
              <p className="vz-error__title">Runtime error{trace.error!.line !== null ? ` at line ${trace.error!.line}` : ''}</p>
              <p className="vz-error__body">{trace.error!.message}</p>
            </div>
          )}

          {/* Something went wrong (or looks wrong) at the step on screen: the teaching card. */}
          {issue.lesson && !compact && (
            <div className="vz-issue-slot">
              <IssuePanel
                key={issueKey}
                ref={issueRef}
                lesson={issue.lesson}
                speaking={issue.speaking}
                stale={stale}
                onExplain={issue.explain}
                onStop={issue.stop}
                onEdit={onEditLine ? () => onEditLine(issue.lesson!.line) : undefined}
                onRetry={onRetry}
                onContinue={
                  issue.lesson.canContinue
                    ? () => {
                        issue.dismiss();
                        playhead.play();
                      }
                    : undefined
                }
                onDismiss={issue.lesson.canContinue ? issue.dismiss : undefined}
              />
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
                {snap.speed === s && <motion.span layoutId={`vz-speed-${panelId}`} className="vz-speed__bg" transition={spring.layout} />}
                <span className="relative">{s}×</span>
              </button>
            ))}
          </div>

          {!compact && <VoiceControl theme={voice.theme} onExplain={voice.explainNow} />}

          {!compact && (
            <button
              type="button"
              className={`vz-panels${dock ? ' is-on' : ''}`}
              aria-expanded={dock !== null}
              aria-controls={panelId}
              onClick={() => setDock(dock ? null : 'watch')}
              title="Variables, key, output and stage settings (V K O S)"
            >
              <GlyphPanel />
              <span className="vz-panels__label">Panels</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {dock && (
          <StageDock
            key="dock"
            id={panelId}
            ref={dockRef}
            tab={dock}
            onTab={setDock}
            onClose={() => setDock(null)}
            theme={theme}
            world={world}
            calm={calm}
            onCalm={toggleCalm}
            follow={follow}
            onFollow={(v) => {
              setFollow(v);
              updateSettings({ follow: v });
            }}
            tier={tier}
            quality={settings.quality}
            frame={shownFrame}
            previous={trace.frames[snap.step - 1]}
            output={output}
            outputCount={outputCount}
            worldLocked={pinnedWorld !== undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const GlyphPanel = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
    <path d="M10 2.75v10.5" />
  </svg>
);
