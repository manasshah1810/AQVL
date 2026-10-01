import React from 'react';
import { motion } from 'motion/react';
import { SplitWords } from '../components/reactbits/SplitWords';
import { Magnet } from '../components/reactbits/Magnet';
import { HeroTrace } from '../components/landing/HeroTrace';
import { ReadingSection } from '../components/landing/ReadingSection';
import { PipelineTrack } from '../components/landing/PipelineTrack';
import { LayoutMorph } from '../components/landing/LayoutMorph';
import { StructureIndex } from '../components/landing/StructureIndex';
import { useSmoothScroll } from '../lib/smoothScroll';
import { spring } from '../lib/motion';

const NOTES = [
  { k: 'Nothing to install', v: 'The compiler, the virtual machine and the 3D renderer all run in this page.' },
  { k: 'Real code', v: 'Pointer walks, loops, functions and recursion, written the way you would write them anywhere.' },
  { k: 'Both directions', v: 'Step backwards through a run as easily as forwards.' },
];

export default function Landing() {
  useSmoothScroll();

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section aria-labelledby="hero-title" className="relative pt-14 pb-20 md:pt-24 md:pb-28">
        <div className="page grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8">
            <h1 id="hero-title" className="display">
              <SplitWords as="span" text="Write a sort." className="block" span={0.18} />
              <SplitWords as="span" text="Watch it sort." className="block italic text-cream" span={0.18} delay={0.22} />
            </h1>
            <motion.p
              className="lede mt-8 md:mt-10"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.5 } }}
            >
              AQVL is a small language for data structures and algorithms. Write a <span className="ic">.aqvl</span>{' '}
              program and it runs as an animated 3D scene, one step at a time, in your browser.
            </motion.p>
            <motion.div
              className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.62 } }}
            >
              <Magnet>
                <a href="#/playground" className="btn">
                  Open the playground
                  <span className="arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              </Magnet>
              <a href="#/docs" className="ulink mono text-[0.875rem]">
                or read the language guide
              </a>
            </motion.div>
          </div>

          <aside aria-label="At a glance" className="lg:col-span-4 lg:pt-4">
            <dl className="border-t border-[var(--line)]">
              {NOTES.map((n, i) => (
                <motion.div
                  key={n.k}
                  className="border-b border-[var(--line)] py-5"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0, transition: { ...spring.gentle, delay: 0.7 + i * 0.09 } }}
                >
                  <dt className="mono text-cream">{n.k}</dt>
                  <dd className="mt-1.5 text-[1.02rem] leading-snug">{n.v}</dd>
                </motion.div>
              ))}
            </dl>
          </aside>
        </div>

        <motion.div
          className="page mt-16 md:mt-20"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.85 } }}
        >
          <HeroTrace />
          <p className="mono muted mt-4">
            A flat preview of the program above, traced line by line. In the playground the same program runs as a 3D
            scene.
          </p>
        </motion.div>
      </section>

      <ReadingSection />
      <PipelineTrack />
      <LayoutMorph />
      <StructureIndex />

      {/* ── Close ──────────────────────────────────────────── */}
      <section aria-labelledby="start-title" className="border-t border-[var(--line)] py-24 md:py-32">
        <div className="page grid gap-12 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <span className="margin-num">05</span>
            <SplitWords
              as="h2"
              inView
              text="Start from a working program, or from a blank page."
              className="headline mt-3"
              span={0.4}
            />
          </div>
          <div className="flex flex-col gap-6 md:col-span-4 md:col-start-9">
            <a href="#/examples" className="index-row group block border-t border-[var(--line)] px-3 pt-5 pb-4">
              <span className="flex items-baseline justify-between gap-4">
                <span className="font-serif text-[1.6rem]">Browse examples</span>
                <span className="index-arrow mono" aria-hidden="true">
                  →
                </span>
              </span>
              <span className="mono muted mt-1 block">Sorted by topic, each with a short description</span>
            </a>
            <a href="#/playground" className="index-row group block border-t border-[var(--line)] px-3 pt-5 pb-4">
              <span className="flex items-baseline justify-between gap-4">
                <span className="font-serif text-[1.6rem]">Open the playground</span>
                <span className="index-arrow mono" aria-hidden="true">
                  →
                </span>
              </span>
              <span className="mono muted mt-1 block">Editor, compiler and 3D viewport side by side</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
