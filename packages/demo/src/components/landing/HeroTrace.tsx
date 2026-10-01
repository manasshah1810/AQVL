import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CodeBlock } from '../code/CodeBlock';
import { C } from '../../brand/palette';
import { spring, usePrefersReducedMotion } from '../../lib/motion';

/** The bubble sort program from the README, verbatim. */
export const BUBBLE_SORT = `SCENE BubbleSort

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    LOOP j FROM 0 TO LENGTH(arr) - i - 2
      COMPARE arr[j] arr[j+1]
      IF arr[j] > arr[j+1]
        SWAP arr[j] arr[j+1]
      END
    END
    HIGHLIGHT arr[LENGTH(arr) - i - 1]
  END
  HIGHLIGHT arr[0]
END`;

interface Frame {
  line: number;
  order: number[]; // element ids in position order
  pair: [number, number] | null;
  swapped: boolean;
  done: number[]; // positions highlighted as final
  note: string;
}

/** Executes the program above step by step, one frame per animated statement. */
function traceBubbleSort(): { values: number[]; frames: Frame[] } {
  const values = [64, 34, 25, 12, 22, 11, 90];
  const order = values.map((_, i) => i);
  const n = values.length;
  const done: number[] = [];
  const frames: Frame[] = [{ line: 4, order: [...order], pair: null, swapped: false, done: [], note: 'declare arr' }];
  for (let i = 0; i <= n - 2; i++) {
    for (let j = 0; j <= n - i - 2; j++) {
      const a = values[order[j]];
      const b = values[order[j + 1]];
      frames.push({ line: 9, order: [...order], pair: [j, j + 1], swapped: false, done: [...done], note: `compare ${a} and ${b}` });
      if (a > b) {
        [order[j], order[j + 1]] = [order[j + 1], order[j]];
        frames.push({ line: 11, order: [...order], pair: [j, j + 1], swapped: true, done: [...done], note: `${a} > ${b}, swap` });
      }
    }
    done.push(n - i - 1);
    frames.push({ line: 14, order: [...order], pair: null, swapped: false, done: [...done], note: `${values[order[n - i - 1]]} is in place` });
  }
  done.push(0);
  frames.push({ line: 16, order: [...order], pair: null, swapped: false, done: [...done], note: 'sorted' });
  return { values, frames };
}

export function HeroTrace() {
  const reduced = usePrefersReducedMotion();
  const { values, frames } = useMemo(() => traceBubbleSort(), []);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (reduced || !playing) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % (frames.length + 4)), 640);
    return () => window.clearInterval(id);
  }, [reduced, playing, frames.length]);

  const f = reduced ? frames[frames.length - 1] : frames[Math.min(step, frames.length - 1)];
  const max = Math.max(...values);
  const slot = 100 / values.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-5">
      <CodeBlock code={BUBBLE_SORT} label="bubble-sort.aqvl" lineNumbers activeLine={f.line} className="text-[0.95em]" />

      <figure className="panel flex flex-col p-4 md:p-5" aria-label="Flat preview of the bubble sort trace">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono text-cream">arr</span>
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => setPlaying((p) => !p)}
            disabled={reduced}
            aria-label={playing ? 'Pause the trace' : 'Play the trace'}
          >
            {playing && !reduced ? 'Pause' : 'Play'}
          </button>
        </div>

        <div className="relative mt-4 flex-1" style={{ minHeight: 200 }}>
          <svg viewBox="0 0 100 64" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <line x1="0" x2="100" y1="63.6" y2="63.6" stroke={C.lineStrong} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          </svg>
          {f.order.map((id, pos) => {
            const v = values[id];
            const inPair = f.pair !== null && (pos === f.pair[0] || pos === f.pair[1]);
            const isDone = f.done.includes(pos);
            return (
              <motion.div
                key={id}
                className="absolute bottom-0 flex flex-col items-center justify-end"
                style={{ width: `${slot}%`, height: '100%', left: 0 }}
                initial={false}
                animate={{ x: `${pos * 100}%` }}
                transition={spring.lively}
              >
                <span className={`mono mb-1 text-[0.75rem] ${inPair ? 'text-cream' : 'text-peach-muted'}`}>{v}</span>
                <span className="relative block w-[62%] rounded-ctl" style={{ height: `${(v / max) * 78}%` }}>
                  <span className="absolute inset-0 rounded-ctl" style={{ background: isDone ? C.dusk : C.panelRaised, boxShadow: `inset 0 0 0 1px ${C.lineStrong}` }} />
                  <motion.span
                    className="absolute inset-0 rounded-ctl"
                    style={{ background: C.cream }}
                    initial={false}
                    animate={{ opacity: inPair ? 1 : 0 }}
                    transition={spring.snappy}
                  />
                </span>
              </motion.div>
            );
          })}
        </div>

        <figcaption className="mt-4 flex items-baseline justify-between gap-3 border-t border-[var(--line)] pt-3">
          <span className="mono text-cream" aria-live="off">
            {f.note}
          </span>
          <span className="mono muted">
            line {f.line}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
