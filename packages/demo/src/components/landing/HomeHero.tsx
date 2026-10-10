import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SplitWords } from '../reactbits/SplitWords';
import { Magnet } from '../reactbits/Magnet';
import { WorldDome } from '../portal/WorldDome';
import { DOME_WORLDS, PORTAL } from '../portal/portalWorlds';
import { spring, usePrefersReducedMotion } from '../../lib/motion';

const AUTO_MS = 7000;
const PAUSE_MS = 16000;

const CHIPS = [
  { t: 'Narrated step by step', x: '0%', y: '16%', d: 0 },
  { t: 'Rewind any moment', x: '70%', y: '6%', d: 1.2 },
  { t: 'No install, no sign-up', x: '72%', y: '76%', d: 2.1 },
];

/**
 * The first screen: a glass dome that wanders between the four worlds by
 * itself (and obeys the moment a visitor touches it), with the page's
 * colours following whichever world it is in.
 */
export function HomeHero() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const pausedUntil = useRef(0);
  const n = DOME_WORLDS.length;

  const go = useCallback(
    (i: number) => {
      pausedUntil.current = Date.now() + PAUSE_MS;
      setIndex(((i % n) + n) % n);
    },
    [n],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() < pausedUntil.current || document.hidden) return;
      setIndex((i) => (i + 1) % n);
    }, reduced ? AUTO_MS + 3000 : AUTO_MS);
    return () => window.clearInterval(id);
  }, [n, reduced]);

  const w = PORTAL[DOME_WORLDS[index]];
  const vars = { ['--ws-a' as string]: w.a, ['--ws-b' as string]: w.b, ['--ws-accent' as string]: w.accent };

  return (
    <section aria-labelledby="hero-title" className="home-hero world-stage" style={vars}>
      <div className="page relative grid items-center gap-6 pt-4 pb-16 md:pt-16 md:pb-24 lg:grid-cols-12 lg:gap-4">
        <div className="relative z-10 lg:col-span-5">
          <motion.p
            className="ws-eyebrow mb-5 inline-flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.05 } }}
          >
            <span className="home-pulse" aria-hidden="true" />
            Learn how computers think
          </motion.p>
          <h1 id="hero-title" className="display !text-white">
            <SplitWords as="span" text="Algorithms," className="block" span={0.2} />
            <SplitWords as="span" text="brought to life." className="block italic" span={0.25} delay={0.2} />
          </h1>
          <motion.p
            className="mt-7 max-w-[34ch] text-[clamp(1.1rem,1.02rem+0.4vw,1.35rem)] leading-relaxed text-white/90"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.55 } }}
          >
            Pandas, penguins and rabbits act out every step of how a computer solves a problem, while a friendly voice explains. No experience needed. Just press play.
          </motion.p>
          <motion.div
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.7 } }}
          >
            <Magnet>
              <a href="#/playground" className="ws-cta">
                Start exploring <span aria-hidden="true">→</span>
              </a>
            </Magnet>
            <a href="#/settings" className="home-link">
              Pick your world
            </a>
          </motion.div>

          <div className="mt-10 min-h-[4.5rem]" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.45, delay: reduced ? 0 : 0.9 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              >
                <p className="ws-eyebrow m-0">Now visiting · {w.place}</p>
                <p className="m-0 mt-1 font-serif text-[1.5rem] text-white">{w.name}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="relative max-lg:order-first lg:col-span-7">
          <div className="home-planet" aria-hidden="true" />
          <motion.div initial={{ opacity: 0, scale: 0.86, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { ...spring.lively, delay: 0.25 } }}>
            <WorldDome index={index} onStep={(d) => go(index + d)} label={`A live miniature of the ${w.name}. Drag it sideways to visit another world.`} />
          </motion.div>
          {!reduced &&
            CHIPS.map((c) => (
              <span key={c.t} className="home-chip" style={{ left: c.x, top: c.y, animationDelay: `${c.d}s` }} aria-hidden="true">
                <i />
                {c.t}
              </span>
            ))}
          <div className="relative z-10 mt-1 flex items-center justify-center gap-3" role="group" aria-label="Visit a world">
            {DOME_WORLDS.map((id, i) => (
              <button key={id} type="button" className="home-dot" aria-label={PORTAL[id].name} aria-pressed={i === index} onClick={() => go(i)}>
                <span style={{ background: PORTAL[id].accent }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
