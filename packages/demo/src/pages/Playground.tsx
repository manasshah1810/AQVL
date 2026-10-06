import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator, analyzeFunctions } from '@aqvl/compiler';
import type { AQIRProgram } from '@aqvl/runtime';
import { usePlayhead } from '@aqvl/renderer';

import { IDEEditor, type EditorErrorMarker } from '../components/IDEEditor';
import { ExampleExplorer } from '../components/ExampleExplorer';
import { EXAMPLES, getExampleById } from '../examples/registry';
import { ArrayScripts } from '../examples/ArrayLibrary';
import { PlaygroundOutputConsole } from '../components/PlaygroundOutputConsole';
import type { RuntimeLogEntry } from '../components/RuntimeOutputPanel';
import { AlgoLoader } from '../components/loader/AlgoLoader';
import { Visualizer } from '../components/visualizer/Visualizer';
import { useTraceRun } from '../components/visualizer/useTraceRun';
import { parseHash, replaceHash } from '../lib/router';
import { spring, usePrefersReducedMotion } from '../lib/motion';
import { useTheme } from '../lib/theme';
import { updateSettings, useSettings } from '../lib/settings';
import { Mascot } from '../components/theme/WorldDecor';

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

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const LOG_KINDS = new Set<RuntimeLogEntry['kind']>(['traversal', 'search', 'info', 'relationship', 'operation', 'step', 'result', 'swap', 'compare']);

/** Lex → parse → validate → optimise → generate. Throws with editor markers attached. */
function compileProgram(source: string, onMarkers: (m: EditorErrorMarker[]) => void): AQIRProgram {
  const tokens = new Lexer(source).tokenize();
  const ast = new Parser(tokens).parse();
  const diagnostics = new SemanticValidator().validate(ast);
  if (diagnostics.length > 0) {
    onMarkers(diagnostics.map((d) => ({ line: d.line, column: d.column, message: d.message })));
    throw new Error(`Semantic Validation Failed:\n${diagnostics.map((d) => `[${d.level}] Line ${d.line}, Col ${d.column}: ${d.message}`).join('\n')}`);
  }
  // Calls to undeclared functions, wrong argument counts, RETURN outside a function.
  const functionErrors = analyzeFunctions(ast, source).getErrors();
  if (functionErrors.length > 0) {
    onMarkers(functionErrors.map((e) => ({ line: e.lineNumber ?? 1, column: e.column ?? 1, message: e.message })));
    throw functionErrors[0];
  }
  const optimized = new Optimizer().optimize(ast, {});
  const generator = new AQIRGenerator();
  const aqir = generator.generate(optimized) as unknown as AQIRProgram;
  // User FUNCTIONs: the VM resolves CALLs through this table.
  aqir.functionTable = {};
  for (const fn of generator.getFunctionTable().all()) {
    aqir.functionTable[fn.name] = { name: fn.name, params: fn.params, entryAddress: fn.startPC };
  }
  return aqir;
}

export default function Playground() {
  const [initialExample] = useState(exampleFromHash);
  const [handoff] = useState(docsHandoff);
  const [sourceCode, setSourceCode] = useState(() => handoff ?? initialExample?.source ?? ArrayScripts.ArrayFoundation);
  const [showExplorer, setShowExplorer] = useState(() => {
    if (initialExample || handoff) return false;
    return localStorage.getItem('aqvl-visited') !== 'true';
  });
  const explorerBtnRef = useRef<HTMLButtonElement>(null);
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const settings = useSettings();

  useEffect(() => {
    localStorage.setItem('aqvl-visited', 'true');
  }, []);

  const activeExample = useMemo(() => EXAMPLES.find((e) => e.source === sourceCode), [sourceCode]);

  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [errorMarkers, setErrorMarkers] = useState<EditorErrorMarker[]>([]);
  const [clearedThrough, setClearedThrough] = useState(0);

  const { run, tracing, start, clear } = useTraceRun();
  const snap = usePlayhead(run?.playhead ?? null);
  const playTimer = useRef(0);

  const handleCompileAndRun = () => {
    window.clearTimeout(playTimer.current);
    setIsCompiling(true);
    setCompileError(null);
    setErrorMarkers([]);
    setClearedThrough(0);
    run?.playhead.pause();

    let program: AQIRProgram;
    try {
      program = compileProgram(sourceCode, setErrorMarkers);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setCompileError(message);
      // Lexer/Parser errors are AQVLError instances carrying a source line/column (see @aqvl/shared).
      const at = e as { lineNumber?: unknown; column?: number };
      if (typeof at.lineNumber === 'number') setErrorMarkers([{ line: at.lineNumber, column: at.column, message }]);
      setIsCompiling(false);
      clear();
      return;
    }

    const source = sourceCode;
    void start(program, source).then((next) => {
      if (!next) return;
      setIsCompiling(false);
      if (next.trace.error?.line != null) {
        setErrorMarkers([{ line: next.trace.error.line, column: 1, message: next.trace.error.message }]);
      }
      // Let the previous scene clear the floor and the new one build in before playing.
      playTimer.current = window.setTimeout(() => next.playhead.play(), run ? 900 : 650);
    });
  };

  useEffect(() => {
    // Compile the starting example on the first frame after mount. Cancelled on
    // unmount, so StrictMode's mount -> unmount -> mount compiles only once.
    const frame = requestAnimationFrame(() => handleCompileAndRun());
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(playTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const busy = isCompiling || tracing !== null;
  const isRuntimeReady = !!run && !busy && !compileError;

  // The console shows what the steps up to the one on screen printed.
  const logs = useMemo<RuntimeLogEntry[]>(() => {
    if (!run) return [];
    const out: RuntimeLogEntry[] = [];
    const last = Math.min(snap.step, run.trace.frames.length - 1);
    for (let k = Math.max(1, clearedThrough + 1); k <= last; k++) {
      run.trace.frames[k].logs.forEach((l, i) => {
        out.push({
          id: k * 1000 + i,
          timestamp: 0,
          keyword: l.keyword,
          message: l.message,
          kind: LOG_KINDS.has(l.kind as RuntimeLogEntry['kind']) ? (l.kind as RuntimeLogEntry['kind']) : 'info',
          step: k,
        });
      });
    }
    return out;
  }, [run, snap.step, clearedThrough]);

  const activeLine = isRuntimeReady && snap.active > 0 ? run!.trace.frames[snap.active]?.line ?? null : null;

  const statusChip = (() => {
    if (isCompiling && tracing === null) return { cls: 'compiling', label: 'Compiling…' };
    if (tracing !== null) return { cls: 'compiling', label: 'Tracing…' };
    if (compileError) return { cls: 'error', label: 'Compile Error' };
    if (run?.trace.error && snap.atEnd) return { cls: 'error', label: 'Runtime Error' };
    if (snap.playing) return { cls: 'running', label: 'Running' };
    if (isRuntimeReady) return { cls: 'idle', label: 'Ready' };
    return { cls: 'idle', label: 'Idle' };
  })();

  return (
    <div className="pg">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="pg-toolbar">
        <button
          ref={explorerBtnRef}
          type="button"
          className={`btn btn--quiet btn--sm${showExplorer ? ' is-on' : ''}`}
          onClick={() => setShowExplorer((v) => !v)}
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
          <button
            type="button"
            className={`btn btn--quiet btn--sm pg-focus${settings.focusStage ? ' is-on' : ''}`}
            aria-pressed={settings.focusStage}
            onClick={() => updateSettings({ focusStage: !settings.focusStage })}
            title={settings.focusStage ? 'Show the code again' : 'Give the stage the whole width'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
              <path d="M5.5 2.75v10.5" />
            </svg>
            <span className="hidden sm:inline">{settings.focusStage ? 'Show code' : 'Focus stage'}</span>
          </button>
          <div className={`pg-status-chip ${statusChip.cls}`} role="status">
            <span className="pg-status-chip__mark" aria-hidden="true" />
            {statusChip.label}
          </div>
          <button
            id="pg-compile-run-btn"
            type="button"
            className="btn btn--sm"
            onClick={handleCompileAndRun}
            disabled={busy}
            aria-keyshortcuts="Control+Enter Meta+Enter"
          >
            {busy ? 'Compiling…' : 'Compile & Run'}
            <kbd className="pg-kbd" aria-hidden="true">
              {IS_MAC ? '⌘↵' : 'Ctrl ↵'}
            </kbd>
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="pg-body" data-focus={settings.focusStage}>
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
              activeLine={activeLine}
            />
          </div>
        </section>

        <section className="pg-stage" aria-label="Visualization">
          <div className="pg-viewport">
            {run && !compileError ? (
              <Visualizer
                key="viz"
                trace={run.trace}
                playhead={run.playhead}
                source={run.source}
                theme={theme}
                reducedMotion={reducedMotion}
                outputCount={logs.length}
                output={<PlaygroundOutputConsole embedded logs={logs} onClear={() => setClearedThrough(snap.step)} />}
              />
            ) : (
              <div className="pg-viewport__ground" />
            )}

            {busy && !run && (
              <div className="pg-overlay">
                <AlgoLoader variant="inline" label={tracing !== null && tracing > 0 ? `Tracing your program · step ${tracing}` : 'Compiling your program'} />
              </div>
            )}
            {busy && run && (
              <div className="pg-tracing" role="status">
                {tracing !== null && tracing > 0 ? `Tracing · step ${tracing}` : 'Compiling…'}
              </div>
            )}

            {compileError && !busy && (
              <div className="pg-overlay" role="alert">
                <div className="pg-error">
                  <p className="pg-error__title">Compilation Error</p>
                  <pre className="pg-error__body">{compileError}</pre>
                  <p className="mono muted">The editor marks the line. Fix it and run again.</p>
                </div>
              </div>
            )}

            {!busy && !compileError && !run && (
              <div className="pg-overlay">
                <div className="pg-empty">
                  <div className="pg-empty__art">
                    <Mascot pose="peek" size={72} />
                  </div>
                  <p className="title">Nothing on stage yet.</p>
                  <p className="muted mt-2">
                    Write a program on the left, then press <span className="ic">Compile &amp; Run</span>.
                  </p>
                </div>
              </div>
            )}
          </div>

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
