import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator, analyzeFunctions } from '@aqvl/compiler';
import { ExecutionEngine, type SceneState } from '@aqvl/runtime';
import {
  AQVECanvas,
  ArrayCameraChoreographer,
  Character,
  CharacterAnchorBridge,
  CharacterController,
  IterationDirector,
  LinearCameraChoreographer,
  LinearDirector,
  useLinearOverlay,
  useActiveLine,
  useIterationOverlay,
  type IterationTopic,
} from '@aqvl/renderer';

import { IDEEditor, type EditorErrorMarker } from '../components/IDEEditor';
import { ExampleExplorer } from '../components/ExampleExplorer';
import { EXAMPLES, getExampleById } from '../examples/registry';
import { ArrayScripts } from '../examples/ArrayLibrary';
import { PlaygroundOutputConsole } from '../components/PlaygroundOutputConsole';
import type { RuntimeLogEntry } from '../components/RuntimeOutputPanel';
import { AlgoLoader } from '../components/loader/AlgoLoader';
import { parseHash, replaceHash } from '../lib/router';
import { spring } from '../lib/motion';
import { VIEWPORT_NEON } from '../brand/palette';

import '../styles/aqve-host.css';
import './playground.css';

function exampleFromHash() {
  const id = typeof window === 'undefined' ? null : parseHash(window.location.hash).params.get('example');
  return id ? getExampleById(id) : undefined;
}

/** A program handed over by a docs code block's "Run" action (read once). */
function docsHandoff(): string | null {
  if (typeof window === 'undefined' || parseHash(window.location.hash).params.get('from') !== 'docs') return null;
  try {
    const code = sessionStorage.getItem('aqvl-handoff');
    sessionStorage.removeItem('aqvl-handoff');
    return code;
  } catch {
    return null;
  }
}

// ── Transport glyphs (filled, drawn for this UI) ─────────────────────────────
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
const GlyphStepBack = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="1.5" y="2" width="2" height="10" rx="0.5" fill="currentColor" />
    <path d="M12.5 2 L5 7 L12.5 12 Z" fill="currentColor" />
  </svg>
);
const GlyphStepForward = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="10.5" y="2" width="2" height="10" rx="0.5" fill="currentColor" />
    <path d="M1.5 2 L9 7 L1.5 12 Z" fill="currentColor" />
  </svg>
);

/** Neon corner ticks on the viewport frame: the one place the neon accent appears. */
function ViewportFrame() {
  const t = 14;
  const corners = [
    { style: { top: 6, left: 6 }, d: `M 0 ${t} L 0 0 L ${t} 0` },
    { style: { top: 6, right: 6 }, d: `M 0 0 L ${t} 0 L ${t} ${t}` },
    { style: { bottom: 6, left: 6 }, d: `M 0 0 L 0 ${t} L ${t} ${t}` },
    { style: { bottom: 6, right: 6 }, d: `M 0 ${t} L ${t} ${t} L ${t} 0` },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <svg key={i} width={t + 2} height={t + 2} viewBox={`-1 -1 ${t + 2} ${t + 2}`} className="pg-corner" style={c.style} aria-hidden="true">
          <path d={c.d} fill="none" stroke={VIEWPORT_NEON} strokeWidth={1.5} />
        </svg>
      ))}
    </>
  );
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const SPEEDS = ['0.5x', '1x', '2x', '4x'] as const;
type Speed = (typeof SPEEDS)[number];

export default function Playground() {
  const [initialExample] = useState(exampleFromHash);
  const [handoff] = useState(docsHandoff);
  const [sourceCode, setSourceCode] = useState(() => handoff ?? initialExample?.source ?? ArrayScripts.ArrayFoundation);
  const [showExplorer, setShowExplorer] = useState(() => {
    if (initialExample || handoff) return false;
    return localStorage.getItem('aqvl-visited') !== 'true';
  });
  const explorerBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    localStorage.setItem('aqvl-visited', 'true');
  }, []);

  // Compute active example for the info strip
  const activeExample = useMemo(() => EXAMPLES.find(e => e.source === sourceCode), [sourceCode]);

  // Pipeline State
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [errorMarkers, setErrorMarkers] = useState<EditorErrorMarker[]>([]);

  // Runtime State
  const engineRef = useRef<ExecutionEngine | null>(null);
  const [sceneState, setSceneState] = useState<SceneState | null>(null);
  const [activeEngine, setActiveEngine] = useState<ExecutionEngine | null>(null);
  const activeLine = useActiveLine(activeEngine);
  const characterController = useMemo(() => new CharacterController(), []);
  // Loops & Searching: cursors the camera follows, a live search window, and narration (see IterationDirector).
  const iterationCamera = useMemo(() => new ArrayCameraChoreographer(), []);
  const [iterationDirector, setIterationDirector] = useState<IterationDirector | null>(null);
  const iterationOverlay = useIterationOverlay(iterationDirector);
  // Sticky across edits: tweaking a Loops example's numbers keeps it a Loops run.
  const iterationTopicRef = useRef<IterationTopic | null>(null);
  // Stacks, Queues & Linked Lists: roles, active-end markers, drawn pointers, a camera that follows the active end (see LinearDirector).
  const linearCamera = useMemo(() => new LinearCameraChoreographer(), []);
  const [linearDirector, setLinearDirector] = useState<LinearDirector | null>(null);
  const linearOverlay = useLinearOverlay(linearDirector);
  const linearTopicRef = useRef(false);
  // Lets the character reach for the element its line is about.
  const characterAnchor = useMemo(() => new CharacterAnchorBridge(), []);
  const narratorAnchor = useMemo(() => ({ controller: characterController, bridge: characterAnchor }), [characterController, characterAnchor]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animatedStepCurrent, setAnimatedStepCurrent] = useState(0);
  const [animatedStepTotal, setAnimatedStepTotal] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  // Runtime Output Logs
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLogEntry[]>([]);
  const runtimeLogIdRef = useRef(0);
  // Incremented on every compile. A superseded engine may still be finishing
  // its current animation after pause(); its events must not reach the UI.
  const runIdRef = useRef(0);

  // Speed
  const [speed, setSpeed] = useState<Speed>('1x');

  // Apply speed to engine whenever it changes
  const speedMultiplier = { '0.5x': 0.5, '1x': 1, '2x': 2, '4x': 4 } as const;
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setPlaybackRate(speedMultiplier[speed]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handlePlay = () => {
    const engine = engineRef.current;
    if (!engine) return;
    // Finished: Play replays the program from the beginning.
    if (engine.isAtEnd()) {
      engine.restart();
    }
    engine.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleCompileAndRun = () => {
    setIsCompiling(true);
    setCompileError(null);
    setRuntimeError(null);
    setErrorMarkers([]);
    runIdRef.current++; // silence the previous engine from here on
    setSceneState(null);
    setAnimatedStepCurrent(0);
    setAnimatedStepTotal(0);
    setIsPlaying(false);
    setResetKey(prev => prev + 1);
    setRuntimeLogs([]);

    if (engineRef.current) {
      engineRef.current.pause();
      engineRef.current = null;
    }
    characterController.detach();
    characterController.clear();
    setActiveEngine(null);
    setIterationDirector(null);
    setLinearDirector(null);

    try {
      const lexer = new Lexer(sourceCode);
      const generatedTokens = lexer.tokenize();

      const parser = new Parser(generatedTokens);
      const generatedAst = parser.parse();

      const validator = new SemanticValidator();
      const diagnostics = validator.validate(generatedAst);
      if (diagnostics.length > 0) {
        setErrorMarkers(diagnostics.map(d => ({ line: d.line, column: d.column, message: d.message })));
        const errors = diagnostics.map(d => `[${d.level}] Line ${d.line}, Col ${d.column}: ${d.message}`).join('\n');
        throw new Error(`Semantic Validation Failed:\n${errors}`);
      }

      // Calls to undeclared functions, wrong argument counts, RETURN outside a function.
      const functionErrors = analyzeFunctions(generatedAst, sourceCode).getErrors();
      if (functionErrors.length > 0) {
        setErrorMarkers(functionErrors.map((e) => ({ line: e.lineNumber ?? 1, column: e.column ?? 1, message: e.message })));
        throw functionErrors[0];
      }

      const optimizer = new Optimizer();
      const optimizedAst = optimizer.optimize(generatedAst, {});

      const generator = new AQIRGenerator();
      const generatedAqir = generator.generate(optimizedAst);
      // User FUNCTIONs: the VM resolves CALLs through this table.
      generatedAqir.functionTable = {};
      for (const fn of generator.getFunctionTable().all()) {
        generatedAqir.functionTable[fn.name] = { name: fn.name, params: fn.params, entryAddress: fn.startPC };
      }

      const engine = new ExecutionEngine();
      if (activeExample) {
        iterationTopicRef.current =
          activeExample.category === 'Loops & Control' ? 'loops' : activeExample.category === 'Searching' ? 'searching' : null;
      }
      if (activeExample) {
        linearTopicRef.current = ['Stacks', 'Queues', 'Linked Lists'].includes(activeExample.category);
      }
      if (linearTopicRef.current) {
        setLinearDirector(new LinearDirector(engine, characterController, linearCamera));
      }
      const iterationTopic = iterationTopicRef.current;
      if (iterationTopic) {
        setIterationDirector(new IterationDirector(engine, sourceCode, iterationTopic, characterController, iterationCamera));
      }
      const runId = runIdRef.current;
      const isCurrentRun = () => runIdRef.current === runId;
      engine.eventDispatcher.on('SCENE_LOADED', () => {
        if (!isCurrentRun()) return;
        const current = engine.stateManager.getCurrentState();
        if (current) setSceneState({ ...current });
      });
      engine.eventDispatcher.on('STATE_UPDATED', (newState) => {
        if (!isCurrentRun()) return;
        setSceneState({ ...newState });
      });
      engine.eventDispatcher.on('RUNTIME_LOG', (entry: RuntimeLogEntry) => {
        if (!isCurrentRun()) return;
        // Tag each line with the step that produced it (the step being
        // executed = the one after the step currently shown), so stepping
        // back can drop the lines of the steps that were undone.
        const step = engine.getCurrentStep() + 1;
        setRuntimeLogs(prev => [...prev, { ...entry, id: ++runtimeLogIdRef.current, step }]);
      });
      let shownStep = 0;
      engine.eventDispatcher.on('ANIMATED_STEP', (payload: { current: number; total: number }) => {
        if (!isCurrentRun()) return;
        if (payload.current < shownStep) {
          setRuntimeLogs(prev => prev.filter(log => (log.step ?? 0) <= payload.current));
        }
        shownStep = payload.current;
        setAnimatedStepCurrent(payload.current);
        setAnimatedStepTotal(payload.total);
      });
      engine.eventDispatcher.on('EXECUTION_FINISHED', () => {
        if (!isCurrentRun()) return;
        setIsPlaying(false);
      });
      engine.eventDispatcher.on('EXECUTION_ERROR', (payload: { error: unknown; message: string }) => {
        if (!isCurrentRun()) return;
        setIsPlaying(false);
        setRuntimeError(payload.message);
      });
      engine.loadProgram(generatedAqir);
      // Seed the denominator immediately so the step counter shows "0 of N"
      // before any animated instruction plays, rather than "0 of —".
      setAnimatedStepTotal(engine.getTotalAnimatedSteps());

      engineRef.current = engine;
      // Apply current speed immediately to the fresh engine
      engine.setPlaybackRate(speedMultiplier[speed]);
      characterController.attach(engine.eventDispatcher);
      setActiveEngine(engine);
      setIsCompiling(false);

      setTimeout(() => { handlePlay(); }, 100);

    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setCompileError(message);
      // Lexer/Parser errors are AQVLError instances carrying a source line/column
      // (see @aqvl/shared). SemanticValidator diagnostics already set markers above.
      const at = e as { lineNumber?: unknown; column?: number };
      if (typeof at.lineNumber === 'number') {
        setErrorMarkers([{ line: at.lineNumber, column: at.column, message }]);
      }
      setIsCompiling(false);
    }
  };

  useEffect(() => {
    // Compile the starting example on the first frame after mount. Cancelled on
    // unmount, so StrictMode's mount -> unmount -> mount compiles only once.
    const frame = requestAnimationFrame(() => handleCompileAndRun());
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => characterController.detach(), [characterController]);
  useEffect(() => () => iterationDirector?.dispose(), [iterationDirector]);
  useEffect(() => () => linearDirector?.dispose(), [linearDirector]);

  // Ctrl/Cmd + Enter compiles and runs from anywhere on the page.
  const compileRef = useRef(handleCompileAndRun);
  useEffect(() => {
    compileRef.current = handleCompileAndRun;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compileRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleStepPrev = () => {
    if (engineRef.current) {
      engineRef.current.stepBackward();
      setIsPlaying(false);
    }
  };

  const handleStepNext = () => {
    if (engineRef.current) {
      engineRef.current.stepAnimateForward(() => {
        setIsPlaying(false);
      });
    }
  };

  const isRuntimeReady = !!sceneState && !isCompiling;

  // Progress percentage — uses visible step counts so the bar advances in
  // sync with each animation beat, not the raw VM instruction PC. The total
  // comes from a dry run of the program, so current never exceeds it.
  const progressPct = animatedStepTotal > 0
    ? Math.min(100, Math.round((animatedStepCurrent / animatedStepTotal) * 100))
    : 0;

  // Status chip data
  const getStatusChipProps = () => {
    if (isCompiling) return { cls: 'compiling', label: 'Compiling…' };
    if (compileError) return { cls: 'error', label: 'Compile Error' };
    if (runtimeError) return { cls: 'error', label: 'Runtime Error' };
    if (isPlaying) return { cls: 'running', label: 'Running' };
    if (isRuntimeReady) return { cls: 'idle', label: 'Ready' };
    return { cls: 'idle', label: 'Idle' };
  };

  const statusChip = getStatusChipProps();

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="pg">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="pg-toolbar">
        <button
          ref={explorerBtnRef}
          type="button"
          className={`btn btn--quiet btn--sm${showExplorer ? ' is-on' : ''}`}
          onClick={() => setShowExplorer(v => !v)}
          aria-expanded={showExplorer}
          aria-haspopup="dialog"
        >
          Examples
        </button>

        <div className="pg-toolbar__title" aria-live="polite">
          {activeExample ? (
            <>
              <span className="pg-toolbar__name">{activeExample.title}</span>
              <span className="mono muted hidden md:inline">
                {activeExample.category} · {activeExample.difficulty}
              </span>
            </>
          ) : (
            <span className="pg-toolbar__name">Untitled program</span>
          )}
        </div>

        <div className="pg-toolbar__end">
          <div className={`pg-status-chip ${statusChip.cls}`} role="status">
            <span className="pg-status-chip__mark" aria-hidden="true" />
            {statusChip.label}
          </div>
          <button
            id="pg-compile-run-btn"
            type="button"
            className="btn btn--sm"
            onClick={handleCompileAndRun}
            disabled={isCompiling}
            aria-keyshortcuts="Control+Enter Meta+Enter"
          >
            {isCompiling ? 'Compiling…' : 'Compile & Run'}
            <kbd className="pg-kbd" aria-hidden="true">
              {IS_MAC ? '⌘↵' : 'Ctrl ↵'}
            </kbd>
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="pg-body">
        <section className="pg-editor" aria-label="Source">
          <AnimatePresence initial={false}>
            {activeExample && (
              <motion.p
                key={activeExample.id}
                className="pg-editor__desc"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: spring.gentle }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
              >
                {activeExample.description}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="pg-editor__surface">
            <IDEEditor
              initialValue={sourceCode}
              onChange={(value) => {
                setSourceCode(value);
                // Marker positions go stale the moment source shifts under them.
                if (errorMarkers.length > 0) setErrorMarkers([]);
              }}
              errorMarkers={errorMarkers}
              activeLine={isRuntimeReady ? activeLine : null}
            />
          </div>
        </section>

        <section className="pg-stage" aria-label="Visualization">
          <div className="pg-viewport">
            <ViewportFrame />
            {/* The 3D area: AQVECanvas draws its own scene and background. */}
            <div className="pg-canvas-container aqve-host">
              {isRuntimeReady && (
                <AQVECanvas
                  key={resetKey}
                  sceneState={sceneState}
                  arrayCameraChoreographer={iterationOverlay ? iterationCamera : linearOverlay ? linearCamera : undefined}
                  iterationOverlay={iterationOverlay}
                  linearOverlay={linearOverlay}
                  narratorAnchor={linearOverlay ? narratorAnchor : undefined}
                />
              )}

              {/* Teaching character — speaks ArrayNarrativeGenerator's real narration */}
              {isRuntimeReady && (
                <Character controller={characterController} anchorSource={linearOverlay ? characterAnchor : undefined} dockPosition={{ x: 48, y: 48 }} />
              )}
            </div>

            {/* Run states, drawn over the viewport (outside the 3D area). */}
            {isCompiling && (
              <div className="pg-overlay">
                <AlgoLoader variant="inline" label="Compiling your program" />
              </div>
            )}

            {compileError && !isCompiling && (
              <div className="pg-overlay" role="alert">
                <div className="pg-error">
                  <p className="pg-error__title">Compilation Error</p>
                  <pre className="pg-error__body">{compileError}</pre>
                  <p className="mono muted">The editor marks the line. Fix it and run again.</p>
                </div>
              </div>
            )}

            {runtimeError && !isCompiling && !compileError && (
              <div className="pg-overlay" role="alert">
                <div className="pg-error">
                  <p className="pg-error__title">Runtime Error</p>
                  <pre className="pg-error__body">{runtimeError}</pre>
                </div>
              </div>
            )}

            {!isCompiling && !compileError && !runtimeError && !sceneState && (
              <div className="pg-overlay">
                <div className="pg-empty">
                  <p className="title">Nothing on stage yet.</p>
                  <p className="muted mt-2">
                    Write a program on the left, then press <span className="ic">Compile &amp; Run</span>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Transport ─────────────────────────────────────────────── */}
          <div className="pg-transport">
            <div className="pg-transport__keys" role="group" aria-label="Playback">
              <button id="pg-step-prev-btn" type="button" className="icon-btn" onClick={handleStepPrev} disabled={!isRuntimeReady} aria-label="Step back" title="Step back">
                <GlyphStepBack />
              </button>
              {!isPlaying ? (
                <button id="pg-play-btn" type="button" className="pg-play" onClick={handlePlay} disabled={!isRuntimeReady} aria-label="Play" title="Play">
                  <GlyphPlay />
                </button>
              ) : (
                <button id="pg-pause-btn" type="button" className="pg-play is-playing" onClick={handlePause} disabled={!isRuntimeReady} aria-label="Pause" title="Pause">
                  <GlyphPause />
                </button>
              )}
              <button id="pg-step-next-btn" type="button" className="icon-btn" onClick={handleStepNext} disabled={!isRuntimeReady} aria-label="Step forward" title="Step forward">
                <GlyphStepForward />
              </button>
            </div>

            <div className="pg-progress">
              <div
                className="pg-progress__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={animatedStepTotal}
                aria-valuenow={animatedStepCurrent}
                aria-label="Visualization progress"
              >
                <motion.span
                  className="pg-progress__fill"
                  initial={false}
                  animate={{ scaleX: progressPct / 100 }}
                  transition={spring.layout}
                />
              </div>
              <div className="pg-progress__labels mono">
                <span>
                  Step <span className="text-cream">{animatedStepCurrent}</span>
                  {animatedStepTotal > 0 && (
                    <>
                      {' '}of <span className="text-cream">{animatedStepTotal}</span>
                    </>
                  )}
                </span>
                <span className="muted">{progressPct}%</span>
              </div>
            </div>

            <div className="pg-speed" role="radiogroup" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={speed === s}
                  className={`pg-speed__opt${speed === s ? ' is-on' : ''}`}
                  onClick={() => setSpeed(s)}
                >
                  {speed === s && <motion.span layoutId="pg-speed-on" className="pg-speed__bg" transition={spring.layout} />}
                  <span className="relative">{s.replace('x', '×')}</span>
                </button>
              ))}
            </div>
          </div>

          <PlaygroundOutputConsole logs={runtimeLogs} onClear={() => setRuntimeLogs([])} />
        </section>
      </div>

      <AnimatePresence>
        {showExplorer && (
          <ExampleExplorer
            activeSource={sourceCode}
            onSelect={(code, id) => {
              setSourceCode(code);
              setShowExplorer(false);
              replaceHash(`/playground?example=${encodeURIComponent(id)}`);
            }}
            onClose={() => {
              setShowExplorer(false);
              explorerBtnRef.current?.focus();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
