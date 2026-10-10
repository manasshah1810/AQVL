import React, { type ReactNode } from 'react';
import { highlightLines } from '../../../lib/aqvlSyntax';
import { GAP } from './program';

export interface CodeViewProps {
  /** The program text to show (one line per row). */
  code: string;
  /** Line number of the first row (a fragment of a longer program starts later). */
  firstLine?: number;
  /** 1-based program line drawn with the playhead band. */
  activeLine?: number | null;
  /** Rows the learner can pick (Spot the Bug): called with the program line number. */
  onPickLine?: (line: number) => void;
  /** Program lines to mark: the picked one, a wrong pick, the bug once found. */
  marks?: Record<number, 'picked' | 'wrong' | 'found'>;
  /** Replaces each `___` gap, in order of appearance across the whole view (Fill the Blank). */
  renderGap?: (index: number) => ReactNode;
  /** Rows shown dimmed (context the learner does not change). */
  dim?: boolean;
  label?: string;
  className?: string;
}

/** One line of code, highlighted, with each gap swapped for what `renderGap` draws. */
function lineContent(text: string, gapStart: number, renderGap?: (index: number) => ReactNode): ReactNode {
  if (!renderGap || !text.includes(GAP)) return highlightLines(text)[0];
  const parts = text.split(GAP);
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part && highlightLines(part)[0]}
      {i < parts.length - 1 && renderGap(gapStart + i)}
    </React.Fragment>
  ));
}

/**
 * A read-only AQVL listing in the site's code style, with real program line
 * numbers so it lines up with the stage's "line N" and the executing band.
 */
export function CodeView({ code, firstLine = 1, activeLine = null, onPickLine, marks, renderGap, dim = false, label, className }: CodeViewProps) {
  const lines = code.split('\n');
  // Where each line's gaps start in the whole view's numbering.
  const gapStarts: number[] = [];
  lines.forEach((line, i) => gapStarts.push(i === 0 ? 0 : gapStarts[i - 1] + lines[i - 1].split(GAP).length - 1));
  return (
    <div className={`ch-code${dim ? ' is-dim' : ''}${className ? ` ${className}` : ''}`} aria-label={label}>
      <pre className="ch-code__pre">
        {lines.map((text, i) => {
          const n = firstLine + i;
          const node = lineContent(text, gapStarts[i], renderGap);
          const mark = marks?.[n];
          const cls = `ch-code__line${activeLine === n ? ' is-active' : ''}${mark ? ` is-${mark}` : ''}${onPickLine ? ' is-pickable' : ''}`;
          const body = (
            <>
              <span className="ch-code__ln" aria-hidden="true">
                {n}
              </span>
              <span className="ch-code__src">{node}</span>
            </>
          );
          return onPickLine && text.trim() ? (
            <button key={i} type="button" className={cls} onClick={() => onPickLine(n)} aria-label={`Line ${n}: ${text.trim()}`} aria-pressed={mark === 'picked' || mark === 'found'}>
              {body}
            </button>
          ) : (
            <span key={i} className={cls}>
              {body}
              {'\n'}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
