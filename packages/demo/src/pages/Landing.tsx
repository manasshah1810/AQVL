import React from 'react';
import { motion } from 'motion/react';
import { SplitWords } from '../components/reactbits/SplitWords';
import { Magnet } from '../components/reactbits/Magnet';
import { HomeHero } from '../components/landing/HomeHero';
import { WorldTour } from '../components/landing/WorldTour';
import { FeatureBento } from '../components/landing/FeatureBento';
import { StepsRail } from '../components/landing/StepsRail';
import { HeroTrace } from '../components/landing/HeroTrace';
import { ReadingSection } from '../components/landing/ReadingSection';
import { PipelineTrack } from '../components/landing/PipelineTrack';
import { LayoutMorph } from '../components/landing/LayoutMorph';
import { StructureIndex } from '../components/landing/StructureIndex';
import { useSmoothScroll } from '../lib/smoothScroll';
import { spring } from '../lib/motion';
import './landing.css';

const TOPICS = ['Sorting', 'Searching', 'Stacks', 'Queues', 'Linked lists', 'Trees', 'Graphs', 'Recursion', 'Pointers', 'Loops'];

export default function Landing() {
  useSmoothScroll();

  return (
    <>
      <HomeHero />

      {/* A slow ribbon of what there is to explore. */}
      <div className="home-marquee" aria-label="Things to explore">
        <div className="home-marquee__track" aria-hidden="true">
          {[...TOPICS, ...TOPICS, ...TOPICS, ...TOPICS].map((t, i) => (
            <span key={i}>
              {t}
              <i />
            </span>
          ))}
        </div>
      </div>

      <WorldTour />
      <FeatureBento />
      <StepsRail />

      {/* ── For the curious ────────────────────────────────── */}
      <section aria-labelledby="hood-title" className="border-t border-[var(--line)] pt-20 pb-6 md:pt-28">
        <div className="page grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="margin-num mb-3">For the curious</p>
            <SplitWords as="h2" inView text="And under the hood, a real language." className="headline" span={0.4} />
            <span id="hood-title" className="sr-only">
              Under the hood, a real language.
            </span>
            <p className="lede mt-6">
              Everything you watch is written in AQVL, a small language for data structures and algorithms. Write a <span className="ic">.aqvl</span> program and it runs as an animated 3D scene, one step at a time, right in your browser.
            </p>
            <a href="#/docs" className="ulink mono mt-6 inline-block text-[0.875rem]">
              Read the language guide
            </a>
          </div>
          <div className="lg:col-span-7">
            <HeroTrace />
            <p className="mono muted mt-4">A flat preview of a real program, traced line by line. In the playground the same program runs as a 3D scene.</p>
          </div>
        </div>
      </section>

      <ReadingSection />
      <PipelineTrack />
      <LayoutMorph />
      <StructureIndex />

      {/* ── Close ──────────────────────────────────────────── */}
      <section aria-labelledby="start-title" className="home-close">
        <div className="page relative z-10 flex flex-col items-center gap-8 py-24 text-center md:py-36">
          <SplitWords as="h2" inView text="Pick a world. Press play." className="display !text-white" span={0.35} />
          <span id="start-title" className="sr-only">
            Pick a world. Press play.
          </span>
          <motion.p
            className="max-w-[36ch] text-[1.25rem] leading-relaxed text-white/85"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.3 } }}
            viewport={{ once: true }}
          >
            Your first algorithm is a few seconds away.
          </motion.p>
          <motion.div
            className="flex flex-wrap items-center justify-center gap-5"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.4 } }}
            viewport={{ once: true }}
          >
            <Magnet>
              <a href="#/playground" className="ws-cta">
                Open the playground <span aria-hidden="true">→</span>
              </a>
            </Magnet>
            <a href="#/examples" className="home-link">
              Browse examples
            </a>
          </motion.div>
        </div>
        <div className="home-close__orbs" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
    </>
  );
}
