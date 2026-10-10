import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Playhead, usePlayhead } from '@aqvl/renderer';
import { Visualizer } from '../../../components/visualizer/Visualizer';
import { useTraceRun } from '../../../components/visualizer/useTraceRun';
import { spring, usePrefersReducedMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';
import { href } from '../../../lib/router';
import type { EditorErrorMarker } from '../../../components/IDEEditor';
import type { ErrorInfo } from '@aqvl/runtime';
import { CodeView } from './CodeView';
import { findDivergence, type Divergence } from './diverge';
import { compareLine, grade, reference, referenceRun, runTest, starsFor, type GradeReport, type TestResult } from './grade';
import { HINT_LEVELS, hintsFor, runNote, type WorkState } from './hints';
import { bestPoints, BOSS_STAGES, neighboursOf, nextUnsolved, siblingsOf } from './modes';
import { lastHubPath } from './nav';
import { fillSlots, solutionTemplate, buggyTemplate, splitCore } from './program';
import { markOpened, pointsFor, recordAttempt, recordHints, useProgress } from './progress';
import { relatedExample, type RelatedExample } from './related';
import { StagePopups, type StageRun } from './StagePopups';
import { Stars } from './Stars';
import { TestsPanel } from './TestsPanel';
import { Assemble, FillBlank, SpotBug, WriteCore } from './Workspaces';
import { MODES, type Challenge, type Input, type Mode } from './types';
import './complete.css';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

type StageMode = Exclude<Mode, 'boss'>;

/** What the stage is showing, for the line above it and the popups over it. */
interface OnStage extends StageRun {
  /** The program (slots in place) that made this run. */
  template: string;
  input: Input;
}

interface Verdict {
  stars: number;
  steps: number;
  par: number;
  points: number;
  /** Points added to the visitor's total by this run (a better result than before). */
  gained: number;
}

/** Let the previous scene clear and the new one build in before playing. */
const BUILD_IN_MS = 700;

export function Runner({ challenge }: { challenge: Challenge }) {
  const { kernel } = challenge;
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const allProgress = useProgress();
  const progress = allProgress[challenge.id];
  const modeMeta = MODES.find((m) => m.id === challenge.mode)!;

  useEffect(() => markOpened(challenge.id), [challenge.id]);

  // The closest worked example in the Examples library, to study the algorithm narrated.
  const [related, setRelated] = useState<RelatedExample | null>(null);
  useEffect(() => {
    let live = true;
    void relatedExample(kernel).then((r) => live && setRelated(r));
    return () => {
      live = false;
    };
  }, [kernel]);

  // A boss round walks through three stages; every other challenge is one.
  const [bossStage, setBossStage] = useState(0);
  const stageMode: StageMode = challenge.mode === 'boss' ? BOSS_STAGES[bossStage].mode : challenge.mode;
  const lastStage = challenge.mode !== 'boss' || bossStage === BOSS_STAGES.length - 1;

  const [resetKey, setResetKey] = useState(0);
  const [template, setTemplate] = useState<string | null>(null);
  const [work, setWork] = useState<WorkState | null>(null);
  const [report, setReport] = useState<GradeReport | null>(null);
  const [progressOf, setProgressOf] = useState<{ done: number; total: number } | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [stagePassed, setStagePassed] = useState(false);
  // Hints opened stay counted when the page is left and opened again (until the challenge is passed).
  const [hintsUsed, setHintsUsed] = useState(() => progress?.hints ?? 0);
  const [compare, setCompare] = useState(false);
  const [onStage, setOnStage] = useState<OnStage | null>(null);
  const [compileError, setCompileError] = useState<ErrorInfo | null>(null);
  const [buggyNote, setBuggyNote] = useState<string | null>(null);
  const busy = progressOf !== null;

  const { run, adopt, clear } = useTraceRun();
  const snap = usePlayhead(run?.playhead ?? null);
  const playTimer = useRef(0);
  const playToken = useRef(0);

  /**
   * Puts a run on the stage and plays it. A failing run is first compared
   * with the reference on the same input, so the stage can stop where it
   * first goes wrong.
   */
  const play = useCallback(
    async (result: TestResult, kind: OnStage['kind'], tpl: string) => {
      if (!result.trace) return;
      const token = ++playToken.current;
      window.clearTimeout(playTimer.current);
      setCompare(false);
      setCompileError(null);
      const started = performance.now();
      let divergence: Divergence | null = null;
      if (result.outcome.status !== 'pass') {
        try {
          divergence = findDivergence(result, await referenceRun(kernel, result.test));
        } catch {
          divergence = findDivergence(result, null);
        }
      }
      if (token !== playToken.current) return;
      const next = adopt(result.trace, result.source);
      setOnStage({ kind, result, divergence, template: tpl, input: result.test.input });
      playTimer.current = window.setTimeout(() => next.playhead.play(), Math.max(0, BUILD_IN_MS - (performance.now() - started)));
    },
    [adopt, kernel],
  );
  useEffect(
    () => () => {
      window.clearTimeout(playTimer.current);
      playToken.current++;
    },
    [],
  );

  // Spot the Bug starts by running the buggy program, so the symptom is on stage before anything is picked.
  useEffect(() => {
    if (stageMode !== 'bug') return undefined;
    let live = true;
    const buggy = buggyTemplate(kernel);
    void grade(buggy, kernel).then((r) => {
      if (!live) return;
      const shown = r.results.find((x) => !x.test.hidden && x.outcome.status !== 'pass' && x.trace) ?? r.results.find((x) => x.trace);
      if (!shown) return;
      const o = shown.outcome;
      setBuggyNote(
        o.status === 'fail'
          ? `On test ${shown.test.index + 1} the buggy program leaves ${o.checks
              .filter((c) => !c.ok)
              .map((c) => `${c.expectation.name} = ${c.actual} (expected ${c.expected})`)
              .join('; ')}. The stage stops where it first goes wrong.`
          : o.status === 'runtime-error'
            ? `On test ${shown.test.index + 1} the buggy program stops with an error: ${o.message}`
            : o.status === 'did-not-finish'
              ? `On test ${shown.test.index + 1} the buggy program never finishes.`
              : null,
      );
      void play(shown, 'buggy', buggy);
    });
    return () => {
      live = false;
    };
  }, [stageMode, kernel, play, resetKey]);

  const resetStage = () => {
    window.clearTimeout(playTimer.current);
    playToken.current++;
    setTemplate(null);
    setReport(null);
    setVerdict(null);
    setStagePassed(false);
    setCompare(false);
    setOnStage(null);
    setCompileError(null);
    setBuggyNote(null);
    clear();
    setResetKey((k) => k + 1);
  };

  const openHint = () => {
    const next = Math.min(3, hintsUsed + 1);
    setHintsUsed(next);
    recordHints(challenge.id, next);
  };

  const runNow = async () => {
    if (!template || busy) return;
    const tpl = template;
    setVerdict(null);
    setCompare(false);
    setProgressOf({ done: 0, total: kernel.visible.length + kernel.hidden.length });
    try {
      const r = await grade(tpl, kernel, (done, total) => setProgressOf({ done, total }));
      setReport(r);
      if (r.compileError) {
        // Nothing can run: the stage says why instead of showing an old run.
        playToken.current++;
        window.clearTimeout(playTimer.current);
        clear();
        setOnStage(null);
        setCompileError(r.compileError);
        recordAttempt(challenge.id, { passed: false, stars: 0, steps: 0 });
        return;
      }
      const toPlay = r.results.find((x) => !x.test.hidden && x.outcome.status !== 'pass' && x.trace) ?? r.results.find((x) => !x.test.hidden && x.trace);
      if (toPlay) void play(toPlay, 'test', tpl);
      if (!r.passed) {
        recordAttempt(challenge.id, { passed: false, stars: 0, steps: r.steps });
        return;
      }
      setStagePassed(true);
      if (lastStage) {
        const { par } = await reference(kernel);
        const stars = starsFor(true, hintsUsed, r.steps, par);
        const points = pointsFor(challenge.difficulty, stars);
        const before = bestPoints(challenge, progress);
        setVerdict({ stars, steps: r.steps, par, points, gained: Math.max(0, points - before) });
        recordAttempt(challenge.id, { passed: true, stars, steps: r.steps, points });
      }
    } finally {
      setProgressOf(null);
    }
  };

  const preview = async () => {
    if (!template || busy) return;
    const tpl = template;
    setProgressOf({ done: 0, total: 1 });
    try {
      const r = await runTest(tpl, kernel, { index: -1, input: kernel.preview, hidden: false });
      if (r.outcome.status === 'compile-error') {
        setReport({ results: [r], passed: false, compileError: r.outcome.info, steps: 0 });
        clear();
        setOnStage(null);
        setCompileError(r.outcome.info);
        return;
      }
      await play(r, 'preview', tpl);
    } finally {
      setProgressOf(null);
    }
  };

  // Ctrl / Cmd + Enter runs from anywhere on the page.
  const runRef = useRef(runNow);
  useEffect(() => {
    runRef.current = runNow;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void runRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The executing line, only while the code on screen is the code that ran.
  const frameLine = run && snap.active > 0 ? (run.trace.frames[snap.active]?.line ?? null) : null;
  const sameProgram = onStage !== null && (onStage.template === template || (onStage.kind === 'buggy' && template === null));
  const activeLine = sameProgram ? frameLine : null;
  const displayInput = onStage?.input ?? kernel.visible[0];

  // Write the Core numbers its editor from 1: errors there are named by the editor's line.
  const split = useMemo(() => splitCore(kernel), [kernel]);
  const coreLength = template ? template.split('\n').length - split.before.length - split.after.length : split.core.length;
  const lineLabel = useMemo(
    () =>
      stageMode === 'write'
        ? (l: number) => (l > split.before.length && l <= split.before.length + coreLength ? `line ${l - split.before.length} of your code` : `line ${l}`)
        : undefined,
    [stageMode, split, coreLength],
  );
  const markers: EditorErrorMarker[] =
    report?.compileError && report.compileError.line !== null
      ? [{ line: report.compileError.line, column: report.compileError.column, length: report.compileError.length, message: report.compileError.message }]
      : [];

  const workspaceProps = { kernel, displayInput, activeLine, onTemplate: setTemplate, onState: setWork };
  const siblings = useMemo(() => siblingsOf(challenge), [challenge]);
  const { prev, next } = useMemo(() => neighboursOf(challenge), [challenge]);
  const upNext = useMemo(() => nextUnsolved(challenge, allProgress) ?? next, [challenge, allProgress, next]);
  const solution = useMemo(() => fillSlots(solutionTemplate(kernel), displayInput), [kernel, displayInput]);
  const hints = hintsFor(kernel, stageMode, work, solution);
  const lastDivergence = onStage && onStage.kind === 'test' ? onStage.divergence : null;
  const note = runNote(report, lastDivergence, lineLabel);
  const maxPoints = pointsFor(challenge.difficulty, 3);

  const stageLabel = (() => {
    if (compare) return 'Your run beside the reference solution';
    if (compileError) return 'Your program does not compile';
    if (!onStage) return null;
    if (onStage.kind === 'buggy') return `The buggy program · test ${onStage.result.test.index + 1}`;
    if (onStage.kind === 'preview') return 'Preview · your code on a tiny input';
    return `Your program · test ${onStage.result.test.index + 1}`;
  })();

  const hiddenFails = report && !report.compileError ? report.results.filter((r) => r.test.hidden && r.outcome.status !== 'pass') : [];

  return (
    <div className="ch-run">
      <section className="ch-run__side" aria-label="Challenge">
        <header className="ch-run__head">
          <nav className="cx-crumbs mono" aria-label="Where you are">
            <a href={href(lastHubPath())}>← All challenges</a>
            <span aria-hidden="true">/</span>
            <a href={href(`/challenges/complete?topic=${encodeURIComponent(kernel.topic)}`)}>{kernel.topic}</a>
            <span className="cx-crumbs__step">
              <a className={`icon-btn cx-crumbs__arrow${prev ? '' : ' is-off'}`} href={prev ? href(`/challenges/complete/${prev.id}`) : undefined} aria-label={prev ? `Previous: ${prev.kernel.title}, ${MODES.find((m) => m.id === prev.mode)!.label}` : 'No previous challenge'} title="Previous challenge">
                ‹
              </a>
              <a className={`icon-btn cx-crumbs__arrow${next ? '' : ' is-off'}`} href={next ? href(`/challenges/complete/${next.id}`) : undefined} aria-label={next ? `Next: ${next.kernel.title}, ${MODES.find((m) => m.id === next.mode)!.label}` : 'No next challenge'} title="Next challenge">
                ›
              </a>
            </span>
          </nav>

          <h1 className="ch-run__title">{kernel.title}</h1>
          <p className="ch-run__meta mono">
            <span className={`cx-level is-${challenge.difficulty.toLowerCase()}`}>{challenge.difficulty}</span>
            <span>
              Worth up to {maxPoints} points
              {progress && progress.stars > 0 && (
                <>
                  {' '}
                  · best <Stars count={progress.stars} small /> {bestPoints(challenge, progress)} pts
                </>
              )}
            </span>
          </p>

          <div className="cx-modetabs" role="tablist" aria-label={`${kernel.title} in each mode`}>
            {siblings.map((c) => {
              const m = MODES.find((x) => x.id === c.mode)!;
              const p = allProgress[c.id];
              const on = c.id === challenge.id;
              return (
                <a key={c.id} role="tab" aria-selected={on} className={`cx-modetab${on ? ' is-on' : ''}${p && p.stars > 0 ? ' is-solved' : ''}`} href={href(`/challenges/complete/${c.id}`)} title={`${m.label} · ${c.difficulty}`}>
                  <span className="ch-mode-badge">{m.letter}</span>
                  <span className="cx-modetab__name">{m.label}</span>
                  {p && p.stars > 0 && <Stars count={p.stars} small />}
                </a>
              );
            })}
          </div>

          <p className="ch-run__goal">{kernel.goal}</p>
          <p className="cx-modehow muted">{modeMeta.blurb}</p>
          {kernel.inputNote && <p className="ch-run__note mono muted">{kernel.inputNote}</p>}
          {related && (
            <a className="cx-related" href={href(`/playground?example=${encodeURIComponent(related.id)}`)}>
              <span className="mono muted">Worked example</span> {related.title} <span className="arrow">→</span>
            </a>
          )}
        </header>

        {challenge.mode === 'boss' && (
          <ol className="ch-boss" aria-label="Boss round stages">
            {BOSS_STAGES.map((s, i) => (
              <li key={s.mode} className={`ch-boss__step${i === bossStage ? ' is-on' : ''}${i < bossStage || (i === bossStage && stagePassed) ? ' is-done' : ''}`} aria-current={i === bossStage ? 'step' : undefined}>
                <span className="ch-boss__n mono">{i + 1}</span>
                {s.title}
              </li>
            ))}
          </ol>
        )}

        <div className="ch-run__work" key={`${bossStage}:${resetKey}`}>
          {stageMode === 'blank' && <FillBlank {...workspaceProps} />}
          {stageMode === 'order' && <Assemble {...workspaceProps} />}
          {stageMode === 'bug' && <SpotBug {...workspaceProps} />}
          {stageMode === 'write' && <WriteCore {...workspaceProps} errorMarkers={markers} />}
        </div>

        <div className="ch-actions">
          <button type="button" className="btn btn--sm" onClick={() => void runNow()} disabled={!template || busy} aria-keyshortcuts="Control+Enter Meta+Enter">
            {busy && progressOf!.total > 1 ? `Running test ${Math.min(progressOf!.done + 1, progressOf!.total)} of ${progressOf!.total}…` : 'Run'}
            <kbd className="ch-kbd" aria-hidden="true">
              {IS_MAC ? '⌘↵' : 'Ctrl ↵'}
            </kbd>
          </button>
          {(stageMode === 'write' || stageMode === 'order') && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => void preview()} disabled={!template || busy} title="Run your code on a tiny input without grading it">
              Preview
            </button>
          )}
          <button type="button" className="btn btn--quiet btn--sm" onClick={resetStage} disabled={busy}>
            Start over
          </button>
          {!template && !busy && <span className="mono muted ch-actions__why">{stageMode === 'bug' ? 'Find the line and pick a fix first.' : 'Fill every gap first.'}</span>}
        </div>

        {buggyNote && stageMode === 'bug' && !report && <p className="ch-note">{buggyNote}</p>}

        <AnimatePresence initial={false}>
          {stagePassed && stageMode === 'bug' && (
            <motion.p className="ch-note" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: spring.gentle }}>
              {kernel.bug.why}
            </motion.p>
          )}
        </AnimatePresence>

        {verdict && (
          <motion.div className="ch-verdict" role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: spring.gentle }}>
            <Stars count={verdict.stars} />
            <div>
              <p className="ch-verdict__title">
                {challenge.mode === 'boss' ? 'Boss round cleared.' : 'All tests pass.'}{' '}
                <span className="cx-gain">{verdict.gained > 0 ? `+${verdict.gained} points` : `${verdict.points} points`}</span>
              </p>
              <p className="muted">
                {verdict.steps} steps on the visible tests · par {verdict.par}. {compareLine(verdict.steps, verdict.par)}
                {leftOnTable(verdict, maxPoints)}
                {verdict.gained === 0 && verdict.points > 0 && ' Your best result here was already as good.'}
              </p>
              <div className="ch-verdict__actions">
                <button type="button" className={`btn btn--quiet btn--sm${compare ? ' is-on' : ''}`} aria-pressed={compare} onClick={() => setCompare((v) => !v)}>
                  {compare ? 'Back to your run' : 'Compare with the reference'}
                </button>
                {upNext && (
                  <a className="btn btn--sm" href={href(`/challenges/complete/${upNext.id}`)}>
                    Next: {upNext.kernel.title} · {MODES.find((m) => m.id === upNext.mode)!.label} <span className="arrow">→</span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {stagePassed && !lastStage && (
          <div className="ch-verdict" role="status">
            <div>
              <p className="ch-verdict__title">Stage {bossStage + 1} cleared.</p>
              <button
                type="button"
                className="btn btn--sm mt-3"
                onClick={() => {
                  resetStage();
                  setBossStage((s) => s + 1);
                }}
              >
                On to stage {bossStage + 2}: {BOSS_STAGES[bossStage + 1].title} <span className="arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {report && <TestsPanel report={report} playing={onStage?.kind === 'test' ? onStage.result.test.index : null} onReplay={(r) => void play(r, 'test', template ?? onStage?.template ?? '')} lineLabel={lineLabel} />}

        <Hints hints={hints} used={hintsUsed} onUse={openHint} note={note} />
      </section>

      <section className="ch-run__stage" aria-label="Stage">
        {stageLabel && <p className="ch-stage-label mono">{stageLabel}</p>}
        <div className="ch-stage">
          {compare && report?.passed ? (
            <CompareStage challenge={challenge} mine={report.results.find((r) => !r.test.hidden && r.trace) ?? null} theme={theme} reducedMotion={reducedMotion} />
          ) : compileError ? (
            <div className="ch-stage__empty cx-compile" role="alert">
              <p className="cx-compile__kicker mono">Does not compile{compileError.line !== null ? ` · ${(lineLabel ?? ((l: number) => `line ${l}`))(compileError.line)}` : ''}</p>
              <p className="title mt-2">Nothing can run until the program compiles.</p>
              <p className="cx-compile__msg mt-3">{compileError.message}</p>
              {compileError.suggestion && <p className="muted mt-2">{compileError.suggestion}</p>}
              <p className="muted mt-3">Fix it and press Run again; the stage comes back with your run.</p>
            </div>
          ) : run ? (
            <Visualizer
              key="viz"
              trace={run.trace}
              playhead={run.playhead}
              source={run.source}
              theme={theme}
              reducedMotion={reducedMotion}
              world="studio"
              overlay={onStage && onStage.result.trace === run.trace ? <StagePopups key={run.id} playhead={run.playhead} run={{ ...onStage, note: onStage.kind === 'test' && hiddenFails.length > 0 && onStage.result.outcome.status === 'pass' ? `This test passes, but ${hiddenFails.length === 1 ? `the hidden ${hiddenFails[0].test.category} test fails` : `${hiddenFails.length} hidden tests fail`}.` : undefined }} lineLabel={lineLabel} /> : null}
            />
          ) : (
            <div className="ch-stage__empty">
              <p className="title">{busy ? 'Running your program…' : stageMode === 'bug' ? 'Loading the buggy program…' : 'Nothing on stage yet.'}</p>
              <p className="muted mt-2">{stageMode === 'bug' ? 'It plays here first, so you can watch it misbehave.' : 'Complete the program and press Run: your version plays here, on the plain studio stage. If it goes wrong, the run stops where it first goes wrong and says why.'}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function leftOnTable(verdict: Verdict, maxPoints: number): string {
  return verdict.points < maxPoints ? ` ${maxPoints - verdict.points} points left on the table: replay it with fewer hints or fewer steps for all three stars.` : '';
}

function Hints({ hints, used, onUse, note }: { hints: ReturnType<typeof hintsFor>; used: number; onUse: () => void; note: string | null }) {
  return (
    <section className="ch-hints" aria-label="Hints">
      <div className="ch-hints__head">
        <h2 className="mono">Hints</h2>
        {used < 3 && (
          <button type="button" className="btn btn--quiet btn--sm" onClick={onUse}>
            Show {HINT_LEVELS[used].toLowerCase()} <span className="muted">(costs a star)</span>
          </button>
        )}
      </div>
      {note && (
        <div className="cx-runnote" role="note">
          <span className="mono muted">What your last run says · free</span>
          <p>{note}</p>
        </div>
      )}
      {used === 0 && <p className="muted ch-hints__none">Three levels, each costing a star: a nudge, a pinpoint that reads what you have on screen, then the answer. Opened hints stay counted until you pass.</p>}
      <ol className="ch-hints__list">
        {hints.slice(0, used).map((h) => (
          <li key={h.title}>
            <span className="mono muted">{h.title}</span>
            <p>{h.text}</p>
            {h.code && <CodeView code={h.code} label={h.title} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Your run and the reference's, side by side on the first visible test, with one control to play both. */
function CompareStage({ challenge, mine, theme, reducedMotion }: { challenge: Challenge; mine: TestResult | null; theme: 'dark' | 'light'; reducedMotion: boolean }) {
  const [ref, setRef] = useState<TestResult | null>(null);
  const [par, setPar] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void reference(challenge.kernel).then((r) => {
      if (!live) return;
      setRef(r.runs.find((x) => x.test.index === mine?.test.index) ?? r.runs[0] ?? null);
      setPar(r.runs.find((x) => x.test.index === mine?.test.index)?.steps ?? null);
    });
    return () => {
      live = false;
    };
  }, [challenge, mine]);

  const mineHead = useMemo(() => (mine?.trace ? new Playhead(mine.trace) : null), [mine]);
  const refHead = useMemo(() => (ref?.trace ? new Playhead(ref.trace) : null), [ref]);
  useEffect(() => () => mineHead?.dispose(), [mineHead]);
  useEffect(() => () => refHead?.dispose(), [refHead]);

  const playBoth = () => {
    for (const h of [mineHead, refHead]) {
      if (!h) continue;
      h.restart();
      h.play();
    }
  };

  return (
    <div className="ch-compare">
      <div className="ch-compare__bar">
        <p className="mono">{mine && par !== null ? compareLine(mine.steps, par) : 'Loading the reference…'}</p>
        <button type="button" className="btn btn--sm" onClick={playBoth} disabled={!mineHead || !refHead}>
          Play both
        </button>
      </div>
      <div className="ch-compare__panes">
        <div className="ch-compare__pane">
          <p className="ch-compare__label mono">Your run · {mine?.steps ?? 0} steps</p>
          {mine?.trace && mineHead && <Visualizer trace={mine.trace} playhead={mineHead} source={mine.source} theme={theme} reducedMotion={reducedMotion} compact world="studio" />}
        </div>
        <div className="ch-compare__pane">
          <p className="ch-compare__label mono">Reference · {ref?.steps ?? 0} steps</p>
          {ref?.trace && refHead && <Visualizer trace={ref.trace} playhead={refHead} source={ref.source} theme={theme} reducedMotion={reducedMotion} compact world="studio" />}
        </div>
      </div>
    </div>
  );
}
