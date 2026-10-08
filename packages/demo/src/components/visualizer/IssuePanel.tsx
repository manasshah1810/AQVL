import React, { forwardRef, useId, useState } from 'react';
import type { ErrorLesson, LessonStrip } from '@aqvl/runtime';
import type { ScriptPart } from '../../lib/voice';
import { Mascot } from '../theme/WorldDecor';
import './issue.css';

const GlyphWarn = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2.2 16.2 15H1.8z" />
    <path d="M9 7v3.6" />
    <circle cx="9" cy="12.7" r="0.5" fill="currentColor" />
  </svg>
);
const GlyphSound = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 6.2h2.2L8 3.4v9.2L4.7 9.8H2.5z" fill="currentColor" fillOpacity="0.9" />
    <path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8M12.2 3.8a6 6 0 0 1 0 8.4" />
  </svg>
);
const GlyphStop = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
  </svg>
);
const GlyphPlay = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 1.5 L12 7 L3 12.5 Z" fill="currentColor" />
  </svg>
);

/** Valid cells and the one that was asked for: `0 1 2` and a crossed `3`. */
function Strip({ strip }: { strip: LessonStrip }) {
  return (
    <figure className="vz-issue__strip" aria-label={strip.caption}>
      <div className="vz-issue__cells" role="img" aria-label={strip.caption}>
        {strip.hiddenBefore > 0 && <span className="vz-issue__gap">+{strip.hiddenBefore}</span>}
        {strip.cells.map((c) => (
          <span key={c.index} className={`vz-issue__cell is-${c.kind}`}>
            <span className="vz-issue__cellbox">{c.kind === 'attempted' ? <b aria-hidden="true">✕</b> : (c.value ?? '')}</span>
            <span className="vz-issue__cellindex">{c.index}</span>
          </span>
        ))}
        {strip.hiddenAfter > 0 && <span className="vz-issue__gap">+{strip.hiddenAfter}</span>}
      </div>
      <figcaption>{strip.caption}</figcaption>
    </figure>
  );
}

/** The offending line with a caret under the culprit: "ERROR HERE" in text, so it reads without colour. */
function Pointer({ lesson }: { lesson: ErrorLesson }) {
  const p = lesson.pointer;
  if (!p || lesson.line === null) return null;
  const lead = p.text.length - p.text.trimStart().length;
  const shown = p.text.trimStart();
  const col = Math.max(0, p.column - 1 - lead);
  const len = Math.max(1, Math.min(p.length, Math.max(1, shown.length - col)));
  const word = lesson.severity === 'warning' ? 'LOOK HERE' : 'ERROR HERE';
  return (
    <pre className="vz-issue__pointer" aria-label={`Line ${lesson.line}: ${shown}`}>
      <span className="vz-issue__ln">{lesson.line}</span>
      <code>{shown}</code>
      {'\n'}
      <span className="vz-issue__ln" aria-hidden="true">{' '.repeat(String(lesson.line).length)}</span>
      <span className="vz-issue__caret" aria-hidden="true">
        {' '.repeat(col)}
        {'^'.repeat(Math.min(len, 40))} {word}
      </span>
    </pre>
  );
}

export interface IssuePanelProps {
  lesson: ErrorLesson;
  /** The part being spoken, if any. */
  speaking: ScriptPart | null;
  /** The editor no longer matches the run this explains. */
  stale: boolean;
  onExplain: () => void;
  onStop: () => void;
  onEdit?: () => void;
  onRetry?: () => void;
  /** Logic problems only: keep going from here. */
  onContinue?: () => void;
  /** Logic problems only: hide this note. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * The compact teaching card shown with a mistake: where it is, what
 * happened, why, how to fix it, the right logic to compare against, and the
 * ways forward. It reads one lesson (the same one the voice speaks), never
 * edits the learner's code, and sits beside the stage rather than over it.
 */
export const IssuePanel = forwardRef<HTMLElement, IssuePanelProps>(function IssuePanel(
  { lesson, speaking, stale, onExplain, onStop, onEdit, onRetry, onContinue, onDismiss, className = '' },
  ref,
) {
  const id = useId();
  const [open, setOpen] = useState(true);
  const warn = lesson.severity === 'warning';
  const part = (key: ScriptPart) => (speaking === key ? ' is-speaking' : '');

  if (!open) {
    return (
      <section ref={ref} className={`vz-issue vz-issue--pill ${className}`} data-severity={lesson.severity} data-phase={lesson.phase} aria-label={lesson.title}>
        <button type="button" className="vz-issue__pill" onClick={() => setOpen(true)} aria-expanded="false">
          <GlyphWarn />
          <span>
            {lesson.where} · {lesson.name}
          </span>
          <span className="vz-issue__more">Show</span>
        </button>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className={`vz-issue ${stale ? 'is-stale' : ''} ${className}`}
      data-severity={lesson.severity}
      data-phase={lesson.phase}
      role={warn ? 'status' : 'alert'}
      aria-labelledby={`${id}-t`}
    >
      <header className="vz-issue__head">
        <span className="vz-issue__badge">
          <GlyphWarn />
        </span>
        <div className="vz-issue__titles">
          <h3 id={`${id}-t`}>{lesson.title}</h3>
          <p>
            <b>{lesson.where}</b>
            <span aria-hidden="true"> · </span>
            {lesson.name}
          </p>
        </div>
        <Mascot size={34} pose="stand" className="vz-issue__mascot" />
        <button type="button" className="vz-issue__min" onClick={() => setOpen(false)} aria-label="Collapse" title="Collapse">
          –
        </button>
      </header>

      <div className="vz-issue__body">
        <Pointer lesson={lesson} />

        <div className={`vz-issue__part${part('what')}`}>
          <h4>What happened?</h4>
          <p>{lesson.what}</p>
        </div>
        {lesson.strip && <Strip strip={lesson.strip} />}
        <div className={`vz-issue__part${part('why')}`}>
          <h4>Why?</h4>
          <p>{lesson.why}</p>
        </div>
        <div className={`vz-issue__part${part('fix')}`}>
          <h4>How to fix it</h4>
          <p>{lesson.fix}</p>
        </div>
        {lesson.correct && (
          <div className={`vz-issue__part vz-issue__right${part('correct')}`}>
            <h4>{lesson.correct.caption}</h4>
            <pre>
              <code>{lesson.correct.lines.join('\n')}</code>
            </pre>
            <p className="vz-issue__note">A guide to compare with your code. Nothing was changed for you.</p>
          </div>
        )}
        <details className="vz-issue__idea">
          <summary>The idea behind it</summary>
          <p>{lesson.concept}</p>
        </details>
      </div>

      {stale && (
        <p className="vz-issue__stale" role="status">
          You have edited the code since this ran. Run it again to see how this version behaves.
        </p>
      )}

      <footer className="vz-issue__actions">
        {speaking ? (
          <button type="button" className="vz-issue__btn" onClick={onStop}>
            <GlyphStop />
            Stop
          </button>
        ) : (
          <button type="button" className="vz-issue__btn" onClick={onExplain} disabled={stale}>
            <GlyphSound />
            Explain
          </button>
        )}
        {onEdit && (
          <button type="button" className="vz-issue__btn" onClick={onEdit}>
            Edit code
          </button>
        )}
        {warn && onContinue && !stale && (
          <button type="button" className="vz-issue__btn" onClick={onContinue}>
            <GlyphPlay />
            Continue
          </button>
        )}
        {warn && onDismiss && !stale && (
          <button type="button" className="vz-issue__btn vz-issue__btn--quiet" onClick={onDismiss}>
            Dismiss
          </button>
        )}
        {onRetry && (
          <button type="button" className="vz-issue__btn vz-issue__btn--primary" onClick={onRetry}>
            <GlyphPlay />
            Try again
          </button>
        )}
      </footer>
    </section>
  );
});
