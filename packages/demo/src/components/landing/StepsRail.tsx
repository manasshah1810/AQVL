import React, { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { SplitWords } from '../reactbits/SplitWords';
import { spring } from '../../lib/motion';

const STEPS = [
  { n: '1', t: 'Pick a world', d: 'Pandas, penguins, rabbits, or the quiet studio. Change your mind any time.' },
  { n: '2', t: 'Choose something to watch', d: 'Start from a ready-made example, or type your own. Either way it comes alive.' },
  { n: '3', t: 'Watch, listen, rewind', d: 'Follow the action step by step, hear it explained, and go back whenever you like.' },
];

/** Three steps on a line that draws itself as the section scrolls past. */
export function StepsRail() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 55%'] });
  const grow = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.6 });
  const fill = useTransform(grow, [0, 1], [0, 1]);

  return (
    <section aria-labelledby="steps-title" className="border-t border-[var(--line)] py-20 md:py-28">
      <div className="page">
        <header className="mb-12 max-w-[40rem]">
          <p className="margin-num mb-3">How it works</p>
          <SplitWords as="h2" inView text="From curious to clicked in three steps." className="headline" span={0.4} />
          <span id="steps-title" className="sr-only">
            From curious to clicked in three steps.
          </span>
        </header>
        <div ref={ref} className="steps">
          <div className="steps__line" aria-hidden="true">
            <motion.i style={{ scaleX: fill, scaleY: fill }} />
          </div>
          <ol className="steps__list">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: i * 0.08 } }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
              >
                <span className="steps__dot">{s.n}</span>
                <h3 className="title mt-4">{s.t}</h3>
                <p className="muted mt-2 mb-0 max-w-[30ch]">{s.d}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
