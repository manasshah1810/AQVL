import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Playhead, usePlayhead } from '@aqvl/renderer';
import { Visualizer } from '../../../components/visualizer/Visualizer';
import { useTraceRun } from '../../../components/visualizer/useTraceRun';
import { spring, usePrefersReducedMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';
import { href } from '../../../lib/router';
import type { EditorErrorMarker } from '../../../components/IDEEditor';
import { CodeView } from './CodeView';
import { compareLine, grade, reference, runTest, starsFor, type GradeReport, type TestResult } from './grade';
import { BOSS_STAGES, CHALLENGES } from './modes';
import { buggyTemplate, fillSlots, solutionTemplate, splitCore } from './program';
import { recordAttempt, useProgress } from './progress';
import { Stars } from './Stars';
import { TestsPanel } from './TestsPanel';
import { Assemble, FillBlank, SpotBug, WriteCore } from './Workspaces';
import { MODES, type Challenge, type Input, type Mode } from './types';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

type StageMode = Exclude<Mode, 'boss'>;

/** What the stage is showing, for the line above it. */
interface OnStage {
  kind: 'test' | 'preview' | 'buggy';
  /** Test index (for a graded or buggy run). */
  index?: number;
  /** The program (slots in place) that made this run. */
  template: string;
  input: Input;
}

interface Verdict {
  stars: number;
  steps: number;
  par: number;
}

export function Runner({ challenge }: { challenge: Challenge }) {
  const { kernel } = challenge;
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const progress = useProgress()[challenge.id];
  const modeMeta = MODES.find((m) => m.id === challenge.mode)!;

  // A boss round walks through three stages; every other challenge is one.
  const [bossStage, setBossStage] = useState(0);
  const stageMode: StageMode = challenge.mode === 'boss' ? BOSS_STAGES[bossStage].mode : challenge.mode;
  const lastStage = challenge.mode !== 'boss' || bossStage === BOSS_STAGES.length - 1;

  const [resetKey, setResetKey] = useState(0);
  const [template, setTemplate] = useState<string | null>(null);
  const [report, setReport] = useState<GradeReport | null>(null);
  const [progressOf, setProgressOf] = useState<{ done: number; total: number } | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [stagePassed, setStagePassed] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [compare, setCompare] = useState(false);
  const [onStage, setOnStage] = useState<OnStage | null>(null);
  const [buggyNote, setBuggyNote] = useState<string | null>(null);
  const busy = progressOf !== null;

  const { run, adopt, clear } = useTraceRun();
  const snap = usePlayhead(run?.playhead ?? null);
  const playTimer = useRef(0);

  const play = useCallback(
    (result: TestResult, kind: OnStage['kind'], tpl: string) => {
      if (!result.trace) return;
      window.clearTimeout(playTimer.current);
      setCompare(false);
      const next = adopt(result.trace, result.source);
      setOnStage({ kind, index: result.test.index, template: tpl, input: result.test.input });
      // Let the previous scene clear and the new one build in before playing.
      playTimer.current = window.setTimeout(() => next.playhead.play(), 700);
    },
    [adopt],
  );
  useEffect(() => () => window.clearTimeout(playTimer.current), []);

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
          ? `On test ${shown.test.index + 1} the buggy program leaves ${o.checks.filter((c) => !c.ok).map((c) => `${c.expectation.name} = ${c.actual} (expected ${c.expected})`).join('; ')}.`
          : o.status === 'runtime-error'
            ? `On test ${shown.test.index + 1} the buggy program stops with an error: ${o.message}`
            : o.status === 'did-not-finish'
              ? `On test ${shown.test.index + 1} the buggy program never finishes.`
              : null,
      );
      play(shown, 'buggy', buggy);
    });
    return () => {
      live = false;
    };
  }, [stageMode, kernel, play, resetKey]);

  const resetStage = () => {
    window.clearTimeout(playTimer.current);
    setTemplate(null);
    setReport(null);
    setVerdict(null);
    setStagePassed(false);
    setCompare(false);
    setOnStage(null);
    setBuggyNote(null);
    clear();
    setResetKey((k) => k + 1);
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
        recordAttempt(challenge.id, { passed: false, stars: 0, steps: 0 });
        return;
      }
      const toPlay = r.results.find((x) => !x.test.hidden && x.outcome.status !== 'pass' && x.trace) ?? r.results.find((x) => !x.test.hidden && x.trace);
      if (toPlay) play(toPlay, 'test', tpl);
      if (!r.passed) {
        recordAttempt(challenge.id, { passed: false, stars: 0, steps: r.steps });
        return;
      }
      setStagePassed(true);
      if (lastStage) {
        const { par } = await reference(kernel);
        const stars = starsFor(true, hintsUsed, r.steps, par);
        setVerdict({ stars, steps: r.steps, par });
        recordAttempt(challenge.id, { passed: true, stars, steps: r.steps });
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
        return;
      }
      play(r, 'preview', tpl);
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
  const lineLabel =
    stageMode === 'write'
      ? (l: number) => (l > split.before.length && l <= split.before.length + coreLength ? `line ${l - split.before.length} of your code` : `line ${l}`)
      : undefined;
  const markers: EditorErrorMarker[] =
    report?.compileError && report.compileError.line !== null
      ? [{ line: report.compileError.line, column: report.compileError.column, length: report.compileError.length, message: report.compileError.message }]
      : [];

  const workspaceProps = { kernel, displayInput, activeLine, onTemplate: setTemplate };
  const nextChallenge = useMemo(() => {
    const same = CHALLENGES.filter((c) => c.mode === challenge.mode);
    return same[(same.findIndex((c) => c.id === challenge.id) + 1) % same.length];
  }, [challenge]);

  const stageLabel = (() => {
    if (compare) return 'Your run beside the reference solution';
    if (!onStage) return null;
    if (onStage.kind === 'buggy') return `The buggy program · test ${(onStage.index ?? 0) + 1}`;
    if (onStage.kind === 'preview') return 'Preview · your code on a tiny input';
    return `Your program · test ${(onStage.index ?? 0) + 1}`;
  })();

  return (
    <div className="ch-run">
      <section className="ch-run__side" aria-label="Challenge">
        <header className="ch-run__head">
          <a className="ch-back mono" href={href('/challenges/complete')}>
            ← All challenges
          </a>
          <p className="ch-run__meta mono">
            <span className="ch-mode-badge">{modeMeta.letter}</span> {modeMeta.label} · {kernel.topic} · {challenge.difficulty}
            {progress && progress.stars > 0 && (
              <span className="ch-run__best">
                {' '}
                · best <Stars count={progress.stars} small />
              </span>
            )}
          </p>
          <h1 className="ch-run__title">{kernel.title}</h1>
          <p className="ch-run__goal">{kernel.goal}</p>
          {kernel.inputNote && <p className="ch-run__note mono muted">{kernel.inputNote}</p>}
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
              <p className="ch-verdict__title">{challenge.mode === 'boss' ? 'Boss round cleared.' : 'All tests pass.'}</p>
              <p className="muted">
                {verdict.steps} steps on the visible tests · par {verdict.par}. {compareLine(verdict.steps, verdict.par)}
                {hintsUsed > 0 && ` ${hintsUsed} hint level${hintsUsed === 1 ? '' : 's'} used.`}
              </p>
              <div className="ch-verdict__actions">
                <button type="button" className={`btn btn--quiet btn--sm${compare ? ' is-on' : ''}`} aria-pressed={compare} onClick={() => setCompare((v) => !v)}>
                  {compare ? 'Back to your run' : 'Compare with the reference'}
                </button>
                <a className="btn btn--sm" href={href(`/challenges/complete/${nextChallenge.id}`)}>
                  Next challenge <span className="arrow">→</span>
                </a>
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

        {report && <TestsPanel report={report} playing={onStage?.kind === 'test' ? (onStage.index ?? null) : null} onReplay={(r) => play(r, 'test', template ?? onStage?.template ?? '')} lineLabel={lineLabel} />}

        <Hints kernelHints={kernel.hints} used={hintsUsed} onUse={() => setHintsUsed((h) => Math.min(3, h + 1))} solution={fillSlots(solutionTemplate(kernel), displayInput)} />
      </section>

      <section className="ch-run__stage" aria-label="Stage">
        {stageLabel && <p className="ch-stage-label mono">{stageLabel}</p>}
        <div className="ch-stage">
          {compare && report?.passed ? (
            <CompareStage challenge={challenge} mine={report.results.find((r) => !r.test.hidden && r.trace) ?? null} theme={theme} reducedMotion={reducedMotion} />
          ) : run ? (
            <Visualizer key="viz" trace={run.trace} playhead={run.playhead} source={run.source} theme={theme} reducedMotion={reducedMotion} world="studio" />
          ) : (
            <div className="ch-stage__empty">
              <p className="title">{busy ? 'Running your program…' : 'Nothing on stage yet.'}</p>
              <p className="muted mt-2">{stageMode === 'bug' ? 'The buggy program is getting ready to run.' : 'Complete the program and press Run: your version plays here, on the plain studio stage.'}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const HINT_TITLES = ['A nudge', 'One line', 'The full solution'];

function Hints({ kernelHints, used, onUse, solution }: { kernelHints: [string, string]; used: number; onUse: () => void; solution: string }) {
  return (
    <section className="ch-hints" aria-label="Hints">
      <div className="ch-hints__head">
        <h2 className="mono">Hints</h2>
        {used < 3 && (
          <button type="button" className="btn btn--quiet btn--sm" onClick={onUse}>
            Show {HINT_TITLES[used].toLowerCase()} <span className="muted">(costs a star)</span>
          </button>
        )}
      </div>
      {used === 0 && <p className="muted ch-hints__none">Three levels, each one costing a star: a nudge, a revealed line, then the full solution.</p>}
      <ol className="ch-hints__list">
        {kernelHints.slice(0, Math.min(used, 2)).map((h, i) => (
          <li key={i}>
            <span className="mono muted">{HINT_TITLES[i]}</span>
            <p>{h}</p>
          </li>
        ))}
        {used >= 3 && (
          <li>
            <span className="mono muted">{HINT_TITLES[2]}</span>
            <CodeView code={solution} label="Reference solution" />
          </li>
        )}
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
