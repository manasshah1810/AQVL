import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FACTS, nextFactIndex } from './facts';
import { VISUALIZATIONS, takeVizIndex } from './vizRegistry';
import { SplitWords } from '../reactbits/SplitWords';
import { Mark } from '../../brand/Logo';
import { spring, usePrefersReducedMotion } from '../../lib/motion';

interface AlgoLoaderProps {
  /** What is actually being waited on, e.g. "Loading the 3D engine". */
  label: string;
  /** Full-screen takeover vs. a block inside a page region. */
  variant?: 'screen' | 'inline';
}

const FACT_MS = 7200;

/**
 * Brand loader: a small, real algorithm trace on the left and a fact about
 * algorithms on the right. Picks a different trace and fact each time it
 * appears; while it stays up, facts rotate.
 */
export function AlgoLoader({ label, variant = 'screen' }: AlgoLoaderProps) {
  const reduced = usePrefersReducedMotion();
  const [vizIndex] = useState(takeVizIndex);
  const [factIndex, setFactIndex] = useState(nextFactIndex);
  const [caption, setCaption] = useState('');
  const viz = VISUALIZATIONS[vizIndex];
  const Viz = viz.Component;

  useEffect(() => {
    const id = window.setInterval(() => setFactIndex(nextFactIndex()), FACT_MS);
    return () => window.clearInterval(id);
  }, []);

  const onCaption = useCallback((c: string) => setCaption(c), []);

  const screen = variant === 'screen';

  return (
    <div
      aria-busy="true"
      className={
        screen
          ? 'fixed inset-0 z-[150] flex items-center bg-ink'
          : 'relative flex w-full items-center justify-center py-10'
      }
    >
      <div className={screen ? 'page' : 'w-full max-w-[880px] px-4'}>
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-14">
          <figure className="m-0">
            <div className="relative aspect-[240/128] w-full max-w-[420px] rounded-panel border border-[var(--line)] bg-ink-deep p-3">
              <Viz still={reduced} onCaption={onCaption} />
            </div>
            <figcaption className="mt-3 flex max-w-[420px] items-baseline justify-between gap-4">
              <span className="mono text-cream">{viz.name}</span>
              <span className="mono muted truncate text-right" aria-hidden="true">
                {caption}
              </span>
            </figcaption>
          </figure>

          <div className="min-h-[9.5rem]">
            <div className="mb-4 flex items-center gap-3 text-peach">
              <motion.span
                className="inline-flex"
                animate={reduced ? undefined : { rotate: [0, -8, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Mark size={18} />
              </motion.span>
              <span className="mono" role="status">
                {label}
              </span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={factIndex}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8, transition: spring.snappy }}
              >
                <SplitWords
                  as="p"
                  text={FACTS[factIndex]}
                  span={0.7}
                  className="max-w-[46ch] text-[1.2rem] leading-[1.5] italic text-peach md:text-[1.35rem]"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
