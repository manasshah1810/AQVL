import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator, analyzeFunctions } from '@aqvl/compiler';
import { diagnoseCompileError, teachError, type AQIRProgram, type ErrorInfo, type RawCompileError } from '@aqvl/runtime';
import { usePlayhead } from '@aqvl/renderer';

import { IDEEditor, type EditorErrorMarker } from '../components/IDEEditor';
import { ExampleExplorer } from '../components/ExampleExplorer';
import { EXAMPLES, getExampleById } from '../examples/registry';
import { ArrayScripts } from '../examples/ArrayLibrary';
import { PlaygroundOutputConsole } from '../components/PlaygroundOutputConsole';
import type { RuntimeLogEntry } from '../components/RuntimeOutputPanel';
import { AlgoLoader } from '../components/loader/AlgoLoader';
import { Visualizer } from '../components/visualizer/Visualizer';
import { IssuePanel } from '../components/visualizer/IssuePanel';
import { issueAt, useLessonNarration } from '../components/visualizer/useIssue';
import { voiceThemeOf } from '../lib/voice';
import { useWorld } from '../lib/world';
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

/** A compile failure, already described: where it is, what kind it is, and what to tell the learner. */
class CompileIssue extends Error {
  constructor(
    readonly info: ErrorInfo,
    readonly markers: EditorErrorMarker[],
  ) {
    super(info.message);
  }
}

function rawOf(e: unknown, stage: string): RawCompileError {
  const at = e as { name?: string; message?: string; lineNumber?: number; column?: number; suggestion?: string };
  return { name: at.name ?? 'Error', message: at.message ?? String(e), line: typeof at.lineNumber === 'number' ? at.lineNumber : null, column: at.column, suggestion: at.suggestion, stage };
}

function markerFor(info: ErrorInfo): EditorErrorMarker {
  return { line: info.line ?? 1, column: info.column, length: info.length, message: info.message };
}

/** Lex → parse → validate → optimise → generate. Throws a CompileIssue (the described failure, with editor markers). */
function compileProgram(source: string): AQIRProgram {
  let ast;
  try {
    const tokens = new Lexer(source).tokenize();
    ast = new Parser(tokens).parse();
  } catch (e) {
    const info = diagnoseCompileError(rawOf(e, 'Parser'), source);
    throw new CompileIssue(info, info.line === null ? [] : [markerFor(info)]);
  }
  const diagnostics = new SemanticValidator().validate(ast);
  if (diagnostics.length > 0) {
    const infos = diagnostics.map((d) => diagnoseCompileError({ name: 'SemanticError', message: d.message, line: d.line, column: d.column, stage: 'Semantic' }, source));
    throw new CompileIssue(infos[0], infos.map(markerFor));
  }
  // Calls to undeclared functions, wrong argument counts, RETURN outside a function.
  const functionErrors = analyzeFunctions(ast, source).getErrors();
  if (functionErrors.length > 0) {
    const infos = functionErrors.map((e) => diagnoseCompileError({ ...rawOf(e, 'Semantic'), line: e.lineNumber ?? null }, source));
    throw new CompileIssue(infos[0], infos.map(markerFor));
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
  // A program that did not compile: the described failure, and the exact text it was found in.
  const [compileFailure, setCompileFailure] = useState<{ info: ErrorInfo; source: string } | null>(null);
  const compileError = compileFailure?.info.message ?? null;
  const [errorMarkers, setErrorMarkers] = useState<EditorErrorMarker[]>([]);
  const [focusRequest, setFocusRequest] = useState<{ line: number; column?: number; nonce: number } | null>(null);
  const world = useWorld();
  const voiceTheme = voiceThemeOf(world);
  const [clearedThrough, setClearedThrough] = useState(0);

  const { run, tracing, start, clear } = useTraceRun();
  const snap = usePlayhead(run?.playhead ?? null);
  const playTimer = useRef(0);

  const handleCompileAndRun = () => {
    window.clearTimeout(playTimer.current);
    setIsCompiling(true);
    setCompileFailure(null);
    setErrorMarkers([]);
    setClearedThrough(0);
    run?.playhead.pause();

    let program: AQIRProgram;
    try {
      program = compileProgram(sourceCode);
    } catch (e) {
      // Anything that is not an already-described failure is still described, never shown as a bare stack message.
      const issue =
        e instanceof CompileIssue
          ? e
          : (() => {
              const info = diagnoseCompileError(rawOf(e, 'Compiler'), sourceCode);
              return new CompileIssue(info, info.line === null ? [] : [markerFor(info)]);
            })();
      setCompileFailure({ info: issue.info, source: sourceCode });
      setErrorMarkers(issue.markers);
      setIsCompiling(false);
      clear();
      return;
    }

    const source = sourceCode;
    void start(program, source).then((next) => {
      if (!next) return;
      setIsCompiling(false);
      if (next.trace.error?.line != null) {
        const info = next.trace.error.info;
        setErrorMarkers([{ line: next.trace.error.line, column: info?.column ?? 1, length: info?.length, message: next.trace.error.message }]);
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

  // The one source of truth for the executing line: the recorded frame on screen.
  // It is only meaningful for the exact text that was compiled, so once the
  // editor has diverged from that text no line is highlighted (never a stale one).
  const sourceInSync = run?.source === sourceCode;
  const sourceLineCount = sourceCode.split('\n').length;
  const frameLine = isRuntimeReady && sourceInSync && snap.active > 0 ? run!.trace.frames[snap.active]?.line ?? null : null;
  const activeLine = frameLine !== null && frameLine >= 1 && frameLine <= sourceLineCount ? frameLine : null;

  // The mistake on screen, if any: a compile failure, or the error / logic problem of the step being shown.
  // The editor's band and the panel both come from it, so they always agree.
  const compileStale = !!compileFailure && compileFailure.source !== sourceCode;
  const compileLesson = useMemo(() => (compileFailure ? teachError(compileFailure.info) : null), [compileFailure]);
  const compileNarration = useLessonNarration(compileLesson, voiceTheme, compileStale);
  const runIssue = isRuntimeReady && sourceInSync && run ? issueAt(run.trace, snap.active) : null;
  const issueLine = (() => {
    if (compileFailure && !compileStale && compileFailure.info.line !== null) return { line: compileFailure.info.line, severity: 'error' as const, label: 'Error here' };
    if (runIssue && runIssue.line !== null) return { line: runIssue.line, severity: runIssue.severity, label: runIssue.severity === 'warning' ? 'Look here' : 'Error here' };
    return null;
  })();
  const editLine = (line: number | null, column?: number) => {
    if (line !== null) setFocusRequest((prev) => ({ line, column, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  const statusChip = (() => {
    if (isCompiling && tracing === null) return { cls: 'compiling', label: 'Compiling…' };
    if (tracing !== null) return { cls: 'compiling', label: 'Tracing…' };
    if (compileError) return { cls: 'error', label: 'Compile Error' };
    if (run?.trace.error && snap.atEnd) return { cls: 'error', label: 'Runtime Error' };
    if (snap.playing) return { cls: 'running', label: 'Running' };
    if (isRuntimeReady && !sourceInSync) return { cls: 'idle', label: 'Edited' };
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
              issueLine={issueLine}
              focusRequest={focusRequest}
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
                stale={!sourceInSync}
                onRetry={handleCompileAndRun}
                onEditLine={(line) => editLine(line)}
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

            {compileLesson && !busy && (
              <div className="pg-overlay pg-overlay--issue">
                <IssuePanel
                  lesson={compileLesson}
                  speaking={compileNarration.speaking}
                  stale={compileStale}
                  onExplain={compileNarration.explain}
                  onStop={compileNarration.stop}
                  onEdit={() => editLine(compileLesson.line, compileFailure?.info.column)}
                  onRetry={handleCompileAndRun}
                  className="pg-issue"
                />
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
