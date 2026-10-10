import React from 'react';
import type { GradeReport, TestResult } from './grade';
import { literal } from './program';
import type { Input } from './types';

function describeInput(input: Input): string {
  return Object.entries(input)
    .map(([k, v]) => `${k} = ${literal(v)}`)
    .join(', ');
}

const STATUS: Record<TestResult['outcome']['status'], string> = {
  pass: 'Pass',
  fail: 'Wrong result',
  'compile-error': 'Does not compile',
  'runtime-error': 'Runtime error',
  'did-not-finish': 'Did not finish',
};

interface TestsPanelProps {
  report: GradeReport;
  /** Test index currently on the stage. */
  playing: number | null;
  onReplay: (result: TestResult) => void;
  /** Turns a program line into the line the learner sees (Write the Core shows its own numbering). */
  lineLabel?: (line: number) => string;
}

/**
 * The verdict, test by test: a visible test shows its input, what was
 * expected and what the run left behind, with a button to watch it in 3D; a
 * hidden test says only what kind of case it is.
 */
export function TestsPanel({ report, playing, onReplay, lineLabel = (l) => `line ${l}` }: TestsPanelProps) {
  if (report.compileError) {
    const e = report.compileError;
    return (
      <div className="ch-tests" role="status">
        <div className="ch-test is-bad">
          <div className="ch-test__head">
            <span className="ch-test__chip">Does not compile</span>
            {e.line !== null && <span className="mono muted">{lineLabel(e.line)}</span>}
          </div>
          <p className="ch-test__msg">{e.message}</p>
          {e.suggestion && <p className="ch-test__hint">{e.suggestion}</p>}
        </div>
      </div>
    );
  }
  const passed = report.results.filter((r) => r.outcome.status === 'pass').length;
  return (
    <div className="ch-tests">
      <p className="ch-tests__sum mono" role="status">
        {passed} of {report.results.length} tests pass
      </p>
      <ol className="ch-tests__list">
        {report.results.map((r) => {
          const o = r.outcome;
          const ok = o.status === 'pass';
          const label = r.test.hidden ? `Hidden test · ${r.test.category}` : `Test ${r.test.index + 1}`;
          return (
            <li key={r.test.index} className={`ch-test${ok ? ' is-ok' : ' is-bad'}${playing === r.test.index ? ' is-playing' : ''}`}>
              <div className="ch-test__head">
                <span className="ch-test__chip">{STATUS[o.status]}</span>
                <span className="ch-test__name">{label}</span>
                {!r.test.hidden && r.trace && (
                  <button type="button" className="btn btn--quiet btn--sm ch-test__replay" onClick={() => onReplay(r)} aria-label={`Replay ${label} in 3D`}>
                    {playing === r.test.index ? 'On stage' : 'Replay in 3D'}
                  </button>
                )}
              </div>
              {!r.test.hidden && <p className="ch-test__input mono">{describeInput(r.test.input)}</p>}
              {!r.test.hidden && (o.status === 'pass' || o.status === 'fail') && (
                <dl className="ch-test__checks">
                  {o.checks.map((c) => (
                    <div key={c.expectation.name + c.expectation.kind} className={c.ok ? 'is-ok' : 'is-bad'}>
                      <dt className="mono">{c.expectation.name}</dt>
                      <dd>
                        <span className="ch-test__k">expected</span> <code>{c.expected}</code>
                        {!c.ok && (
                          <>
                            <br />
                            <span className="ch-test__k">got</span> <code>{c.actual}</code>
                          </>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {o.status === 'runtime-error' && (
                <p className="ch-test__msg">
                  {r.test.hidden ? 'The program stopped with an error on this case.' : o.message}
                  {!r.test.hidden && o.line !== null && <span className="mono muted"> ({lineLabel(o.line)})</span>}
                </p>
              )}
              {o.status === 'did-not-finish' && <p className="ch-test__msg">The run hit the step limit without finishing: a loop or a recursion that never stops.</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
