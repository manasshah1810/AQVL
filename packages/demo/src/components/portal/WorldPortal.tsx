import React, { useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WorldArt } from '../theme/WorldArt';
import { DOME_WORLDS, PORTAL } from './portalWorlds';
import { WorldDome } from './WorldDome';
import { usePrefersReducedMotion } from '../../lib/motion';

interface Props {
  index: number;
  onIndex: (i: number) => void;
  /** Rendered under the story (the "move in" button). */
  footer?: React.ReactNode;
  heading?: React.ReactNode;
}

/** The name, letter by letter, rising out of the portal once the new world has opened. */
function Name({ text, reduced }: { text: string; reduced: boolean }) {
  return (
    <span className="ws-name inline-flex flex-wrap" aria-label={text}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 36, rotateX: -70, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 220, damping: 18, delay: (reduced ? 0 : 0.85) + i * 0.028 } }}
          exit={{ opacity: 0, y: -18, filter: 'blur(6px)', transition: { duration: 0.2, delay: i * 0.008 } }}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

/**
 * The world traveller: a stage whose colours follow the world in the dome,
 * with arrows, swipe, arrow keys and four little orbs to jump straight to
 * one of the others.
 */
export function WorldPortal({ index, onIndex, footer, heading }: Props) {
  const reduced = usePrefersReducedMotion();
  const n = DOME_WORLDS.length;
  const w = PORTAL[DOME_WORLDS[index]];
  const step = useCallback((d: 1 | -1) => onIndex((index + d + n) % n), [index, n, onIndex]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <section
      className="world-stage"
      style={{ ['--ws-a' as string]: w.a, ['--ws-b' as string]: w.b, ['--ws-accent' as string]: w.accent }}
      aria-roledescription="carousel"
      aria-label="Worlds"
      tabIndex={0}
      onKeyDown={onKey}
    >
      <div className="grid items-center gap-2 px-5 py-8 md:grid-cols-12 md:gap-6 md:px-10 md:py-12">
        <div className="order-2 flex flex-col gap-5 md:order-1 md:col-span-5">
          {heading}
          <p className="ws-eyebrow" aria-live="polite">
            World {index + 1} of {n} · {w.place}
          </p>
          <div style={{ minHeight: '3.4rem' }}>
            <AnimatePresence mode="wait">
              <motion.h2 key={w.id} initial={false} exit={{}} className="m-0">
                <Name text={w.name} reduced={reduced} />
              </motion.h2>
            </AnimatePresence>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={w.id}
              className="grid gap-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: reduced ? 0 : 1.05 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <p className="ws-line m-0 !text-[1.35rem] !leading-snug font-serif italic">{w.tagline}</p>
              <p className="ws-line m-0">{w.story}</p>
              <p className="ws-eyebrow m-0">Meet · {w.crew}</p>
            </motion.div>
          </AnimatePresence>
          {footer}
        </div>

        <div className="relative order-1 md:order-2 md:col-span-7">
          <WorldDome index={index} onStep={step} label={`Live preview of ${w.name}. Drag sideways, or use the arrows, to travel to another world.`} />
          <button type="button" className="ws-arrow absolute top-[44%] left-0 -translate-y-1/2" aria-label="Previous world" onClick={() => step(-1)}>
            ←
          </button>
          <button type="button" className="ws-arrow absolute top-[44%] right-0 -translate-y-1/2" aria-label="Next world" onClick={() => step(1)}>
            →
          </button>
          <div className="mt-2 flex items-center justify-center gap-4" role="radiogroup" aria-label="Choose a world to visit">
            {DOME_WORLDS.map((id, i) => (
              <button key={id} type="button" role="radio" aria-checked={i === index} aria-label={PORTAL[id].name} title={PORTAL[id].name} className="ws-orb" onClick={() => onIndex(i)}>
                <WorldArt world={id} />
              </button>
            ))}
          </div>
          <p className="ws-eyebrow mt-4 text-center opacity-70">Drag the globe · ← → keys</p>
        </div>
      </div>
    </section>
  );
}
