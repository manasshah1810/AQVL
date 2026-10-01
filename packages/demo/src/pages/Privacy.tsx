import React from 'react';
import { motion } from 'motion/react';
import { riseChild, waveParent } from '../lib/motion';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'What this page covers',
    body: (
      <p>
        How AQVL handles data when you use this website, its documentation and the playground. The short version: your
        programs never leave your browser, and nothing about you is collected.
      </p>
    ),
  },
  {
    title: 'What is stored in your browser',
    body: (
      <>
        <p>
          AQVL keeps a few small values in your browser’s local storage, only to remember things between visits: for
          example, whether you have opened the playground before, so the example picker does not open every time.
        </p>
        <ul>
          <li>None of these values contain personal information.</li>
          <li>They are not used for advertising, analytics, profiling or tracking across sites.</li>
          <li>Clearing your browser’s site data removes them.</li>
        </ul>
        <p>
          Because this storage is strictly necessary for the features you use, no consent banner is shown for it.
        </p>
      </>
    ),
  },
  {
    title: 'Third parties',
    body: (
      <p>
        AQVL runs entirely on the client. There are no tracking networks, analytics providers or advertising services.
        The typefaces are bundled with the site rather than loaded from a font service. Your code and its
        visualizations are compiled and rendered inside your own browser.
      </p>
    ),
  },
  {
    title: 'Questions',
    body: (
      <p>
        Questions or requests about this policy can be raised on the project’s{' '}
        <a className="ulink" href="https://github.com/manasshah1810/AQVL/issues" target="_blank" rel="noreferrer">
          GitHub issue tracker
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        .
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <article aria-labelledby="privacy-title" className="page grid gap-12 py-20 md:grid-cols-12 md:py-28">
      <header className="md:col-span-4">
        <div className="md:sticky md:top-28">
          <h1 id="privacy-title" className="headline">
            Privacy
          </h1>
          <p className="mono muted mt-4">Last updated October 2026</p>
        </div>
      </header>

      <motion.div className="md:col-span-7 md:col-start-6" variants={waveParent} initial="hidden" animate="shown">
        {SECTIONS.map((s, i) => (
          <motion.section key={s.title} variants={riseChild} className="border-t border-[var(--line)] py-8 first:pt-0 first:border-t-0">
            <h2 className="title flex items-baseline gap-4">
              <span className="margin-num">{i + 1}</span>
              {s.title}
            </h2>
            <div className="flow prose mt-4">{s.body}</div>
          </motion.section>
        ))}
      </motion.div>
    </article>
  );
}
