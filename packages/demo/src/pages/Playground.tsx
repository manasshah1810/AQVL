import React, { useState, useEffect, useRef } from 'react';
import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator } from '@aqvl/compiler';
import { ExecutionEngine } from '@aqvl/runtime';
import { AQVECanvas } from '@aqvl/renderer';

import { IDEEditor } from '../components/IDEEditor';
import { SortingScripts } from '../examples/SortingLibrary';
import { PlaygroundOutputConsole } from '../components/PlaygroundOutputConsole';
import type { RuntimeLogEntry } from '../components/RuntimeOutputPanel';

import './playground.css';

const initialScript = SortingScripts.ArrayTest;

// ── SVG Icon Components ────────────────────────────────────────────────────────
const IconCode = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21"/>
  </svg>
);

const IconPause = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </svg>
);

const IconSkipBack = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="19,20 9,12 19,4"/>
    <line x1="5" y1="4" x2="5" y2="20"/>
  </svg>
);

const IconSkipForward = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5,4 15,12 5,20"/>
    <line x1="19" y1="4" x2="19" y2="20"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.18"/>
  </svg>
);

const IconZap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconBook = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconXCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const IconCube = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

// ── Logo SVG ────────────────────────────────────────────────────────────────────
const AQVLLogo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

export default function Playground() {
  const [sourceCode, setSourceCode] = useState(initialScript);

  // Pipeline State
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  // Runtime State
  const engineRef = useRef<ExecutionEngine | null>(null);
  const [sceneState, setSceneState] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [totalInstructions, setTotalInstructions] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  // Runtime Output Logs
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLogEntry[]>([]);
  const runtimeLogIdRef = useRef(0);

  // Speed
  const [speed, setSpeed] = useState<'0.5x' | '1x' | '2x' | '4x'>('1x');

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('aqvl-docs-theme') as 'dark' | 'light') || 'dark';
  });

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('aqvl-docs-theme', next);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handlePlay = () => {
    if (engineRef.current) {
      engineRef.current.play();
      setIsPlaying(true);
    }
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
    setSceneState(null);
    setCurrentInstructionIndex(0);
    setIsPlaying(false);
    setResetKey(prev => prev + 1);
    setRuntimeLogs([]);

    if (engineRef.current) {
      engineRef.current.pause();
      engineRef.current = null;
    }

    try {
      const lexer = new Lexer(sourceCode);
      const generatedTokens = lexer.tokenize();

      const parser = new Parser(generatedTokens);
      const generatedAst = parser.parse();

      const validator = new SemanticValidator();
      const diagnostics = validator.validate(generatedAst);
      if (diagnostics.length > 0) {
        const errors = diagnostics.map(d => `[${d.level}] Line ${d.line}, Col ${d.column}: ${d.message}`).join('\n');
        throw new Error(`Semantic Validation Failed:\n${errors}`);
      }

      const optimizer = new Optimizer();
      const optimizedAst = optimizer.optimize(generatedAst, {});

      const generator = new AQIRGenerator();
      const generatedAqir = generator.generate(optimizedAst);

      setTotalInstructions(generatedAqir.instructions?.length || 0);

      const engine = new ExecutionEngine();
      engine.eventDispatcher.on('SCENE_LOADED', () => {
        setSceneState({ ...engine.stateManager.getCurrentState() });
      });
      engine.eventDispatcher.on('STATE_UPDATED', (newState) => {
        setSceneState({ ...newState });
      });
      engine.eventDispatcher.on('RUNTIME_LOG', (entry: RuntimeLogEntry) => {
        setRuntimeLogs(prev => [...prev, { ...entry, id: ++runtimeLogIdRef.current }]);
      });
      engine.eventDispatcher.on('INSTRUCTION_START', (idx: any) => {
        setCurrentInstructionIndex(idx);
      });
      engine.eventDispatcher.on('EXECUTION_FINISHED', () => {
        setIsPlaying(false);
      });
      engine.loadProgram(generatedAqir);

      engineRef.current = engine;
      setIsCompiling(false);

      setTimeout(() => { handlePlay(); }, 100);

    } catch (e: any) {
      setCompileError(e.message || String(e));
      setIsCompiling(false);
    }
  };

  useEffect(() => {
    handleCompileAndRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleReset = () => {
    if (engineRef.current) {
      engineRef.current.restart();
      setIsPlaying(false);
      setCurrentInstructionIndex(0);
      setResetKey(prev => prev + 1);
      setSceneState({ ...engineRef.current.stateManager.getCurrentState() });
    }
  };

  const isRuntimeReady = !!sceneState && !isCompiling;

  // Progress percentage
  const progressPct = totalInstructions > 0
    ? Math.round(((currentInstructionIndex + 1) / totalInstructions) * 100)
    : 0;

  // Status chip data
  const getStatusChipProps = () => {
    if (isCompiling) return { cls: 'compiling', label: 'Compiling…' };
    if (compileError) return { cls: 'error', label: 'Compile Error' };
    if (isPlaying) return { cls: 'running', label: 'Running' };
    if (isRuntimeReady) return { cls: 'idle', label: 'Ready' };
    return { cls: 'idle', label: 'Idle' };
  };

  const statusChip = getStatusChipProps();

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="playground-root" data-theme={theme}>

      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="pg-topbar">
        {/* Brand */}
        <div className="pg-brand" onClick={() => window.location.hash = '#/'}>
          <div className="pg-brand-icon">
            <AQVLLogo />
          </div>
          <div className="pg-brand-text">
            <span className="pg-brand-name">AQVL</span>
            <span className="pg-brand-sub">Algorithm Visualiser</span>
          </div>
        </div>

        <div className="pg-topbar-sep" />

        {/* Mode Badge */}
        <div className="pg-mode-badge">
          <div className="pg-mode-badge-dot" />
          Playground
        </div>

        <div className="pg-topbar-spacer" />

        {/* Right Actions */}
        <div className="pg-topbar-actions">
          <button
            className="pg-docs-link"
            onClick={() => window.location.hash = '#/docs'}
          >
            <IconBook />
            Docs
          </button>

          <button
            className="pg-theme-btn"
            onClick={handleToggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            id="pg-compile-run-btn"
            className="pg-compile-btn"
            onClick={handleCompileAndRun}
            disabled={isCompiling}
          >
            {isCompiling ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Compiling…
              </>
            ) : (
              <>
                <IconZap />
                Compile & Run
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="pg-body">

        {/* ── Left Panel — Code Editor ─────────────────────────────────────── */}
        <aside className="pg-left-panel">
          <div className="pg-panel-header">
            <div className="pg-panel-title">
              <IconCode />
              AQVL Source
            </div>
            <div className="pg-panel-pills">
              <span className="pg-lang-pill">AQVL</span>
            </div>
          </div>

          <div className="pg-editor-container">
            <IDEEditor initialValue={sourceCode} onChange={setSourceCode} />
          </div>
        </aside>

        {/* ── Right Panel — Visualization ──────────────────────────────────── */}
        <section className="pg-right-panel">

          {/* Viz Header */}
          <div className="pg-viz-header">
            <div className="pg-panel-title">
              <IconEye />
              Algorithm Visualization
            </div>

            <div className={`pg-status-chip ${statusChip.cls}`}>
              <div className="pg-status-chip-dot" />
              {statusChip.label}
            </div>
          </div>

          {/* Canvas */}
          <div className="pg-canvas-container">
            {/* Grid background */}
            <div className="pg-canvas-empty-bg" />

            {/* Compiling overlay */}
            {isCompiling && (
              <div className="pg-overlay pg-overlay-compiling">
                <div className="pg-spinner" />
                <div className="pg-overlay-title">Building 3D Scene</div>
                <div className="pg-overlay-sub">Compiling your AQVL program…</div>
              </div>
            )}

            {/* Error overlay */}
            {compileError && !isCompiling && (
              <div className="pg-overlay pg-overlay-error">
                <div className="pg-error-box">
                  <div className="pg-error-header">
                    <IconXCircle />
                    Compilation Error
                  </div>
                  <div className="pg-error-body">{compileError}</div>
                </div>
              </div>
            )}

            {/* Empty / welcome state */}
            {!isCompiling && !compileError && !sceneState && (
              <div className="pg-overlay pg-overlay-empty">
                <div className="pg-empty-state">
                  <div className="pg-empty-icon">
                    <IconCube />
                  </div>
                  <div className="pg-empty-title">No visualization yet</div>
                  <div className="pg-empty-hint">
                    Write your AQVL code on the left and click <strong style={{ color: '#a5b4fc' }}>Compile & Run</strong> to see the 3D visualization here.
                  </div>
                </div>
              </div>
            )}

            {/* Scene */}
            {isRuntimeReady && (
              <AQVECanvas key={resetKey} sceneState={sceneState} />
            )}
          </div>

          {/* ── Playback Controls Bar ──────────────────────────────────────── */}
          <div className="pg-controls-bar">

            {/* Transport controls group */}
            <div className="pg-ctrl-group">
              <button
                id="pg-step-prev-btn"
                className="pg-ctrl-btn"
                onClick={handleStepPrev}
                disabled={!isRuntimeReady}
                data-tip="Step Back"
              >
                <IconSkipBack />
              </button>

              {!isPlaying ? (
                <button
                  id="pg-play-btn"
                  className="pg-ctrl-btn play"
                  onClick={handlePlay}
                  disabled={!isRuntimeReady}
                  data-tip="Play"
                >
                  <IconPlay />
                </button>
              ) : (
                <button
                  id="pg-pause-btn"
                  className="pg-ctrl-btn pause"
                  onClick={handlePause}
                  disabled={!isRuntimeReady}
                  data-tip="Pause"
                >
                  <IconPause />
                </button>
              )}

              <button
                id="pg-step-next-btn"
                className="pg-ctrl-btn"
                onClick={handleStepNext}
                disabled={!isRuntimeReady}
                data-tip="Step Forward"
              >
                <IconSkipForward />
              </button>
            </div>

            <div className="pg-ctrl-sep" />

            {/* Progress area */}
            <div className="pg-progress-area">
              <div className="pg-progress-track">
                <div
                  className="pg-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="pg-progress-labels">
                <span className="pg-step-label">
                  Step{' '}
                  <span className="pg-step-current">{currentInstructionIndex + 1}</span>
                  {' '}of{' '}
                  <span className="pg-step-current">
                    {totalInstructions > 0 ? totalInstructions : '—'}
                  </span>
                </span>
                <span className="pg-step-label">{progressPct}%</span>
              </div>
            </div>

            <div className="pg-ctrl-sep" />

            {/* Speed */}
            <div className="pg-speed-section">
              <span className="pg-speed-label">Speed</span>
              <div className="pg-speed-btns">
                {(['0.5x', '1x', '2x', '4x'] as const).map((s) => (
                  <button
                    key={s}
                    className={`pg-speed-opt${speed === s ? ' active' : ''}`}
                    onClick={() => setSpeed(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ── Output Console ─────────────────────────────────────────────── */}
          <PlaygroundOutputConsole
            logs={runtimeLogs}
            onClear={() => setRuntimeLogs([])}
          />

        </section>
      </div>
    </div>
  );
}
