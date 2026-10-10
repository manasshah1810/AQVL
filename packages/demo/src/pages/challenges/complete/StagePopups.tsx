import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayhead, type Playhead } from '@aqvl/renderer';
import { spring } from '../../../lib/motion';
import { divergenceValues, explainDivergence, type Divergence } from './diverge';
import type { TestResult } from './grade';
import { useStopAt } from './stopAt';

/** What is on the stage, as far as the popups need to know. */
export interface StageRun {
  kind: 'test' | 'preview' | 'buggy';
  result: TestResult;
  /** Where the run first goes wrong (null for a pass, or while it is being worked out). */
  divergence: Divergence | null;
  /** A line for the end card (e.g. a hidden test that fails while this one passes). */
  note?: string;
}

function testName(run: StageRun): string {
  if (run.kind === 'preview') return 'Preview';
  const n = `Test ${run.result.test.index + 1}`;
  return run.kind === 'buggy' ? `Buggy program · ${n}` : n;
}

/**
 * The popups drawn over the stage while a graded run plays: one that stops
 * the run where it first goes wrong and says what went wrong there, and one
 * at the end with the test's verdict. The run always plays as far as it
 * really got; the popups only pause it and explain.
 */
export function StagePopups({ playhead, run, lineLabel = (l) => `line ${l}` }: { playhead: Playhead; run: StageRun; lineLabel?: (line: number) => string }) {
  const snap = usePlayhead(playhead);
  const d = run.divergence;
  useStopAt(playhead, d ? d.frame : null);

  const [hideStop, setHideStop] = useState(false);
  const [hideEnd, setHideEnd] = useState(false);
  // Going back before the stop (or away from the end) brings each popup back for the next pass.
  if (hideStop && d && snap.step < d.frame) setHideStop(false);
  if (hideEnd && !snap.atEnd) setHideEnd(false);

  const o = run.result.outcome;
  const last = playhead.totalSteps;
  const stopShown = d !== null && !hideStop && !snap.playing && snap.step >= d.frame && snap.active >= d.frame;
  // A stop on the very last step is the end card too; otherwise the end card waits for its own turn.
  const endShown = !stopShown && snap.atEnd && !snap.playing && !hideEnd && !(d && d.frame >= last && !hideStop);

  const name = testName(run);

  return (
    <div className="cx-pops" aria-live="polite">
      <AnimatePresence>
        {stopShown && d && (
          <motion.section
            key="stop"
            className={`cx-pop ${d.kind === 'error' || d.kind === 'no-finish' ? 'is-error' : 'is-fail'}`}
            role="alert"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.14 } }}
          >
            <StopCard
              name={name}
              d={d}
              lineLabel={lineLabel}
              atEnd={d.frame >= last}
              result={run.result}
              onContinue={() => {
                setHideStop(true);
                playhead.play();
              }}
              onReplay={() => {
                setHideStop(true);
                playhead.restart();
                playhead.play();
              }}
              onClose={() => setHideStop(true)}
            />
          </motion.section>
        )}
        {endShown && (
          <motion.section
            key="end"
            className={`cx-pop ${o.status === 'pass' ? 'is-pass' : 'is-fail'}`}
            role="status"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.14 } }}
          >
            <EndCard
              name={name}
              note={run.note}
              result={run.result}
              d={d}
              onBack={
                d && d.frame < last
                  ? () => {
                      setHideStop(false);
                      playhead.jumpToStep(d.frame);
                    }
                  : undefined
              }
              onReplay={() => {
                setHideEnd(true);
                playhead.restart();
                playhead.play();
              }}
              onClose={() => setHideEnd(true)}
            />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Glyph({ tone }: { tone: 'pass' | 'fail' | 'error' }) {
  return (
    <span className="cx-pop__glyph" aria-hidden="true">
      {tone === 'pass' ? (
        <svg width="14" height="14" viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : tone === 'error' ? (
        <svg width="14" height="14" viewBox="0 0 24 24">
          <path d="M12 6v8M12 18v.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24">
          <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

function Close({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="cx-pop__close" onClick={onClick} aria-label="Hide this note">
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function StopCard({ name, d, lineLabel, atEnd, result, onContinue, onReplay, onClose }: { name: string; d: Divergence; lineLabel: (l: number) => string; atEnd: boolean; result: TestResult; onContinue: () => void; onReplay: () => void; onClose: () => void }) {
  const { title, body } = explainDivergence(d);
  const values = divergenceValues(d);
  const tone = d.kind === 'error' || d.kind === 'no-finish' ? 'error' : 'fail';
  return (
    <>
      <header className="cx-pop__head">
        <Glyph tone={tone} />
        <div className="cx-pop__titles">
          <p className="cx-pop__kicker mono">
            {name} · {d.kind === 'error' ? 'stopped' : atEnd ? 'ended' : 'paused'} at step {d.frame}
            {d.line !== null && ` · ${lineLabel(d.line)}`}
          </p>
          <h3 className="cx-pop__title">{d.kind === 'error' ? 'The run stops with an error' : title}</h3>
        </div>
        <Close onClick={onClose} />
      </header>
      {/* A runtime error has the stage's own teaching card beside it; this one only marks the test. */}
      <p className="cx-pop__body">{d.kind === 'error' ? 'The card beside the stage explains what failed and how to fix it.' : body}</p>
      {values.length > 0 && (
        <dl className="cx-pop__vals">
          {values.map((v) => (
            <div key={v.label} className={`is-${v.tone}`}>
              <dt>{v.label}</dt>
              <dd>
                <code>{v.value}</code>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {atEnd && result.outcome.status === 'fail' && <Checks result={result} />}
      <div className="cx-pop__actions">
        {!atEnd && (
          <button type="button" className="btn btn--sm" onClick={onContinue}>
            Continue the run
          </button>
        )}
        <button type="button" className="btn btn--quiet btn--sm" onClick={onReplay}>
          Replay from the start
        </button>
      </div>
    </>
  );
}

function Checks({ result }: { result: TestResult }) {
  const o = result.outcome;
  if (o.status !== 'pass' && o.status !== 'fail') return null;
  const shown = result.test.hidden ? [] : o.checks;
  if (shown.length === 0) return null;
  return (
    <dl className="cx-pop__vals">
      {shown.map((c) => (
        <div key={c.expectation.kind + c.expectation.name} className={c.ok ? 'is-want' : 'is-got'}>
          <dt>
            {c.expectation.name} {c.ok ? '✓' : ''}
          </dt>
          <dd>
            {c.ok ? (
              <code>{c.expected}</code>
            ) : (
              <>
                <span className="cx-pop__k">expected</span> <code>{c.expected}</code>
                <br />
                <span className="cx-pop__k">got</span> <code>{c.actual}</code>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EndCard({ name, note, result, d, onBack, onReplay, onClose }: { name: string; note?: string; result: TestResult; d: Divergence | null; onBack?: () => void; onReplay: () => void; onClose: () => void }) {
  const o = result.outcome;
  const pass = o.status === 'pass';
  const title = pass ? `${name} passes` : o.status === 'fail' ? `${name} fails` : o.status === 'did-not-finish' ? `${name} never finishes` : `${name} stops with an error`;
  return (
    <>
      <header className="cx-pop__head">
        <Glyph tone={pass ? 'pass' : 'fail'} />
        <div className="cx-pop__titles">
          <p className="cx-pop__kicker mono">End of the run · {result.steps} steps</p>
          <h3 className="cx-pop__title">{title}</h3>
        </div>
        <Close onClick={onClose} />
      </header>
      {pass && <p className="cx-pop__body">Everything it left behind matches the algorithm.</p>}
      {!pass && d && d.frame < result.steps && <p className="cx-pop__body">It first went wrong at step {d.frame}.</p>}
      <Checks result={result} />
      {note && <p className="cx-pop__note">{note}</p>}
      <div className="cx-pop__actions">
        {onBack && (
          <button type="button" className="btn btn--sm" onClick={onBack}>
            Show where it went wrong
          </button>
        )}
        <button type="button" className={`btn btn--sm${onBack ? ' btn--quiet' : ''}`} onClick={onReplay}>
          Replay
        </button>
      </div>
    </>
  );
}
