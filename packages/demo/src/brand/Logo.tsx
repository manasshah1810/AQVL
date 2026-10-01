import React from 'react';
import { motion } from 'motion/react';
import { MARK, STROKE, WM, markPath, wordmark } from './geometry';

const MARK_D = markPath(MARK);
const WORD = wordmark();

interface MarkProps {
  size?: number;
  className?: string;
  /** Draw the stroke on when it mounts (once). */
  draw?: boolean;
  title?: string;
}

/** The launch-loop mark: a single stroke that loops and leaves on its baseline. */
export function Mark({ size = 28, className, draw = false, title }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {draw ? (
        <motion.path
          d={MARK_D}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="butt"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
        />
      ) : (
        <path d={MARK_D} fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="butt" />
      )}
    </svg>
  );
}

/** Monoline "AQVL" wordmark; the Q is the mark at cap height. */
export function Wordmark({ height = 16, className }: { height?: number; className?: string }) {
  const pad = WM.stroke;
  return (
    <svg
      height={height}
      viewBox={`${-pad} ${-pad} ${WORD.width + pad * 2} ${WM.cap + pad * 2}`}
      className={className}
      aria-hidden="true"
      style={{ width: 'auto' }}
    >
      {WORD.parts.map((p, i) => (
        <path
          key={i}
          d={p.d}
          transform={`translate(${p.x} 0)`}
          fill="none"
          stroke="currentColor"
          strokeWidth={WM.stroke}
          strokeLinejoin="miter"
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

/** Mark + wordmark. The accessible name is plain text so screen readers say "AQVL". */
export function Lockup({ markSize = 26, wordHeight = 15, className }: { markSize?: number; wordHeight?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
      <Mark size={markSize} />
      <Wordmark height={wordHeight} />
      <span className="sr-only">AQVL</span>
    </span>
  );
}
