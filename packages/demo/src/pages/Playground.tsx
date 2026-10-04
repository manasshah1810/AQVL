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
              activeLine={activeLine}
            />
          </div>
        </section>

        <section className="pg-stage" aria-label="Visualization">
          <div className="pg-viewport">
            {run && !compileError ? (
              <Visualizer key="viz" trace={run.trace} playhead={run.playhead} source={run.source} theme={theme} reducedMotion={reducedMotion} />
            ) : (
              <div className="pg-viewport__ground" />
            )}

            {busy && !run && (
              <div className="pg-overlay pg-overlay--blur">
                <div className="pg-loading">
                  <AlgoLoader variant="inline" label={tracing !== null && tracing > 0 ? `Tracing your program · step ${tracing}` : 'Compiling your program'} />
                </div>
              </div>
            )}
            {busy && run && (
              <div className="pg-tracing" role="status">
                {tracing !== null && tracing > 0 ? `Tracing · step ${tracing}` : 'Compiling…'}
              </div>
            )}

            {compileError && !busy && (
              <div className="pg-overlay pg-overlay--blur" role="alert">
                <div className="pg-error">
                  <div className="pg-error__header">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pg-error__icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <p className="pg-error__title">Compilation Error</p>
                  </div>
                  <div className="pg-error__body">
                    {errorMarkers.length > 0 && (
                      <div className="pg-error__line-badge">
                        Line {errorMarkers[0].line}
                      </div>
                    )}
                    <pre className="pg-error__message">{compileError}</pre>
                  </div>
                  <div className="pg-error__footer">
                    <p className="mono muted">The editor marks the line. Fix it and run again.</p>
                  </div>
                </div>
              </div>
            )}

            {!busy && !compileError && !run && (
              <div className="pg-overlay">
                <div className="pg-empty">
                  <div className="pg-empty__icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  </div>
                  <p className="pg-empty__title">Nothing on stage yet.</p>
                  <p className="pg-empty__desc mt-2">
                    Write a program on the left, then press <span className="ic">Compile &amp; Run</span>.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Disabled Transport Controls when no program is loaded */}
          {(!run || compileError) && (
            <div className="vz-transport" aria-hidden="true">
              <div className="vz-transport__keys">
                <button type="button" className="vz-btn" disabled>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1.5" y="2" width="2" height="10" rx="0.5" fill="currentColor" /><path d="M12.5 2 L5 7 L12.5 12 Z" fill="currentColor" /></svg>
                </button>
                <button type="button" className="vz-play" disabled>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5 L12 7 L3 12.5 Z" fill="currentColor" /></svg>
                </button>
                <button type="button" className="vz-btn" disabled>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="10.5" y="2" width="2" height="10" rx="0.5" fill="currentColor" /><path d="M1.5 2 L9 7 L1.5 12 Z" fill="currentColor" /></svg>
                </button>
              </div>
              <div className="vz-scrub" style={{ opacity: 0.4 }} />
              <div className="vz-count" style={{ opacity: 0 }}><b>0</b><span>/ 0</span></div>
              <div className="vz-speed" style={{ opacity: 0.4 }}>
                <button type="button" className="vz-speed__opt is-on" disabled>1×</button>
              </div>
            </div>
          )}

          <PlaygroundOutputConsole logs={logs} onClear={() => setClearedThrough(snap.step)} />
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
