import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { WorldDome } from '../portal/WorldDome';
import { DOME_WORLDS, PORTAL } from '../portal/portalWorlds';
import { setWorld, type World } from '../../lib/world';
import { spring } from '../../lib/motion';

const FACTS: Record<string, { voice: string; weather: string; learn: string }> = {
  panda: { voice: 'A warm, unhurried narrator', weather: 'Drifting leaves, swaying bamboo', learn: 'Best for taking it slowly' },
  penguin: { voice: 'An energetic, playful narrator', weather: 'Falling snow, dancing aurora', learn: 'Best for staying curious' },
  rabbit: { voice: 'A cheerful, bright narrator', weather: 'Rainbows, petals, floating clouds', learn: 'Best for a good mood' },
  studio: { voice: 'A clear, neutral narrator', weather: 'Calm, with nothing to distract', learn: 'Best for focus' },
};

/**
 * Scroll through the four worlds: the dome stays put while the panels pass
 * beside it, and whichever panel is at the middle of the screen is the
 * world the dome travels to.
 */
export function WorldTour() {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    panels.current.forEach((p) => p && io.observe(p));
    return () => io.disconnect();
  }, []);

  const w = PORTAL[DOME_WORLDS[active]];
  const vars = { ['--ws-a' as string]: w.a, ['--ws-b' as string]: w.b, ['--ws-accent' as string]: w.accent };

  const moveIn = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setWorld(id as World, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  return (
    <section aria-labelledby="tour-title" className="home-tour world-stage" style={vars}>
      <div className="page py-20 md:py-28">
        <header className="mb-8 max-w-[44rem] md:mb-14">
          <p className="ws-eyebrow mb-3">The worlds</p>
          <h2 id="tour-title" className="headline !text-white">
            Four worlds. <span className="italic">One way of seeing.</span>
          </h2>
          <p className="mt-4 max-w-[46ch] text-[1.2rem] leading-relaxed text-white/85">Every world teaches the very same algorithms. Scroll, and pick the one that feels like home.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="home-tour__dome lg:col-span-6">
            <WorldDome index={active} onStep={(d) => setActive((active + d + 4) % 4)} label={`Live miniature of the ${w.name}`} />
            <p className="ws-eyebrow mt-1 text-center opacity-70 max-lg:hidden">Drag the globe, or keep scrolling</p>
          </div>

          <ol className="m-0 grid list-none gap-6 p-0 max-lg:-mt-4 lg:col-span-6 lg:gap-[22vh] lg:py-[12vh]">
            {DOME_WORLDS.map((id, i) => {
              const p = PORTAL[id];
              const f = FACTS[id];
              return (
                <li key={id} data-i={i} ref={(el) => void (panels.current[i] = el)}>
                  <motion.article
                    className={`tour-card${i === active ? ' is-on' : ''}`}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0, transition: spring.gentle }}
                    viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                  >
                    <span className="tour-card__num" aria-hidden="true">
                      0{i + 1}
                    </span>
                    <p className="ws-eyebrow m-0">{p.place}</p>
                    <h3 className="ws-name mt-2 !text-[clamp(1.8rem,3.4vw,2.6rem)]">{p.name}</h3>
                    <p className="mt-3 mb-0 font-serif text-[1.35rem] italic text-white/95">{p.tagline}</p>
                    <p className="mt-3 mb-0 text-[1.05rem] leading-relaxed text-white/85">{p.story}</p>
                    <dl className="tour-facts">
                      <div>
                        <dt>Voice</dt>
                        <dd>{f.voice}</dd>
                      </div>
                      <div>
                        <dt>Weather</dt>
                        <dd>{f.weather}</dd>
                      </div>
                      <div>
                        <dt>Meet</dt>
                        <dd>{p.crew}</dd>
                      </div>
                    </dl>
                    <button type="button" className="tour-card__cta" onClick={(e) => moveIn(id, e)}>
                      Make {p.name} my home <span aria-hidden="true">→</span>
                    </button>
                  </motion.article>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
