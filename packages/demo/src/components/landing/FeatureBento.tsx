import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { SplitWords } from '../reactbits/SplitWords';
import { spring } from '../../lib/motion';

const SAY = ['Now', 'we', 'compare', '34', 'and', '25.', '34', 'is', 'bigger,', 'so', 'they', 'swap!'];

function Spotlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <motion.div
      className={`bento ${className}`}
      onPointerMove={onMove}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0, transition: spring.gentle }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
    >
      {children}
    </motion.div>
  );
}

function Wave() {
  const bars = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ d: (0.7 + ((i * 37) % 10) / 12).toFixed(2), o: ((i * 13) % 10) / -10 })), []);
  return (
    <div className="wave" aria-hidden="true">
      {bars.map((b, i) => (
        <i key={i} style={{ animationDuration: `${b.d}s`, animationDelay: `${b.o}s` }} />
      ))}
    </div>
  );
}

/** What makes AQVL different, as a grid of small live demonstrations. */
export function FeatureBento() {
  return (
    <section aria-labelledby="feat-title" className="py-20 md:py-28">
      <div className="page">
        <header className="mb-10 max-w-[40rem] md:mb-14">
          <p className="margin-num mb-3">Why it clicks</p>
          <SplitWords as="h2" inView text="Made to be understood, not memorised." className="headline" span={0.4} />
          <span id="feat-title" className="sr-only">
            Made to be understood, not memorised.
          </span>
        </header>

        <div className="bento-grid">
          <Spotlight className="bento--voice">
            <p className="bento__kicker">A voice that explains</p>
            <h3 className="bento__title">Hear every step, in the voice of your world.</h3>
            <p className="bento__text">Pandas are warm and slow, penguins are bouncy, rabbits are bright. The narrator says what is happening and why, as it happens.</p>
            <Wave />
            <p className="karaoke" aria-label={SAY.join(' ')}>
              {SAY.map((s, i) => (
                <span key={i} aria-hidden="true" style={{ animationDelay: `${i * 0.38}s` }}>
                  {s}{' '}
                </span>
              ))}
            </p>
            <ul className="voices" aria-label="The four narrators">
              {[['Panda', '#8cc152', 'warm and slow'], ['Penguin', '#8fd3ff', 'quick and playful'], ['Rabbit', '#ff8fa3', 'light and cheerful'], ['Studio', '#e9a03b', 'clear and calm']].map(([n, c, d]) => (
                <li key={n} style={{ ['--v' as string]: c }}>
                  <i aria-hidden="true" />
                  <b>{n}</b>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </Spotlight>

          <Spotlight className="bento--rewind">
            <p className="bento__kicker">Time travel</p>
            <h3 className="bento__title">Rewind anything.</h3>
            <p className="bento__text">Missed a swap? Step backwards as easily as forwards.</p>
            <div className="scrub" aria-hidden="true">
              <div className="scrub__track">
                <div className="scrub__fill" />
                <div className="scrub__thumb" />
              </div>
              <div className="scrub__ticks">
                {Array.from({ length: 9 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
            </div>
          </Spotlight>

          <Spotlight className="bento--oops">
            <p className="bento__kicker">Kind to beginners</p>
            <h3 className="bento__title">Mistakes that teach.</h3>
            <div className="oops" aria-hidden="true">
              <span className="oops__face">!</span>
              <p>Oops! We tried to access index 7, but the list only goes up to index 6.</p>
            </div>
            <p className="bento__text">No scary red walls of text. Just a friendly nudge that shows you exactly where things went sideways.</p>
          </Spotlight>

          <Spotlight className="bento--any">
            <p className="bento__kicker">Right here, right now</p>
            <h3 className="bento__title">Nothing to install.</h3>
            <p className="bento__text">Open the page and it runs: on your laptop, tablet or phone, with nothing to set up and no account to make.</p>
            <div className="orbit" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </Spotlight>
        </div>
      </div>
    </section>
  );
}
