import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { LayoutExplorer } from '../components/engine/LayoutExplorer';
import { DefaultsMap } from '../components/engine/DefaultsMap';
import { CameraDiagram } from '../components/engine/CameraDiagram';
import { PinDemo } from '../components/engine/PinDemo';
import { CodeBlock } from '../components/code/CodeBlock';
import { SplitWords } from '../components/reactbits/SplitWords';
import { useSmoothScroll } from '../lib/smoothScroll';
import { spring, usePrefersReducedMotion } from '../lib/motion';
import { C } from '../brand/palette';
import { circularLayout, forceLayout, type Pt } from '../lib/layouts';

const RELAYOUT_SRC = `SCENE RelayoutDemo

DECLARE
  GRAPH g = ["A->B", "B->C", "C->A"]

SEQUENCE
  LAYOUT g AS FORCE_DIRECTED(iterations=60)
  WAIT

  // Freeze the now-visible cycle into a clean ring
  LAYOUT g AS CIRCULAR(radius=3)
  WAIT
END`;

function Section({ n, title, intro, children, id }: { n: string; title: string; intro?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-[var(--line)] py-20 md:py-28">
      <div className="page">
        <div className="mb-12 grid gap-6 md:mb-16 md:grid-cols-12">
          <motion.div
            className="md:col-span-7"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '0px 0px -15% 0px' }}
            transition={spring.gentle}
          >
            <span className="margin-num">{n}</span>
            <h2 id={id} className="headline mt-3">
              {title}
            </h2>
          </motion.div>
          {intro && (
            <motion.div
              className="prose md:col-span-4 md:col-start-9 md:self-end"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '0px 0px -15% 0px' }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              {intro}
            </motion.div>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

/** A three-vertex cycle: settles under physics, then is frozen into a ring. */
function RelayoutDemo() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -25% 0px' });
  const [phase, setPhase] = useState<'force' | 'ring'>('force');
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];
  const force = useMemo(() => forceLayout(3, edges, 60), []); // eslint-disable-line react-hooks/exhaustive-deps
  const ring = useMemo(() => circularLayout(3, -90, 0.7), []);
  const pts: Pt[] = (phase === 'ring' ? ring : force).map(([x, y]) => [200 + x * 120, 120 + y * 100]);

  useEffect(() => {
    if (!inView || reduced) return;
    const t = window.setTimeout(() => setPhase('ring'), 1300);
    return () => window.clearTimeout(t);
  }, [inView, reduced]);

  return (
    <div ref={ref} className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
      <CodeBlock code={RELAYOUT_SRC} label="relayout.aqvl" lineNumbers activeLine={phase === 'ring' ? 11 : 7} className="lg:col-span-6" />
      <figure className="panel m-0 lg:col-span-6">
        <svg viewBox="0 0 400 240" className="h-auto w-full" role="img" aria-label={phase === 'ring' ? 'Three vertices on a ring.' : 'Three vertices after a force simulation.'}>
          {edges.map(([a, b]) => (
            <motion.line
              key={`${a}${b}`}
              stroke={C.lineStrong}
              strokeWidth={1.5}
              initial={false}
              animate={{ x1: pts[a][0], y1: pts[a][1], x2: pts[b][0], y2: pts[b][1] }}
              transition={spring.gentle}
            />
          ))}
          {pts.map(([x, y], i) => (
            <motion.g key={i} initial={false} animate={{ x, y }} transition={spring.gentle}>
              <circle r={16} fill={C.panelRaised} stroke={C.peach} strokeWidth={1.5} />
              <text y={5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={13} fill={C.peach}>
                {'ABC'[i]}
              </text>
            </motion.g>
          ))}
        </svg>
        <figcaption className="flex items-center justify-between gap-4 border-t border-[var(--line)] px-4 py-3">
          <span className="mono text-cream">{phase === 'ring' ? 'CIRCULAR(radius=3)' : 'FORCE_DIRECTED(iterations=60)'}</span>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setPhase((p) => (p === 'ring' ? 'force' : 'ring'))}>
            {phase === 'ring' ? 'Back to physics' : 'Freeze into a ring'}
          </button>
        </figcaption>
      </figure>
    </div>
  );
}

const NOTES = [
  { k: 'Defaults first', v: 'A program that never mentions layout still looks right. These statements are overrides.' },
  { k: 'Size-aware', v: 'Default spacing tightens and tree levels open up as a structure grows, so large inputs still fit.' },
  { k: 'Additive', v: 'Leaving LAYOUT, CAMERA and POSITION out reproduces the default behaviour exactly.' },
];

export default function Engine() {
  useSmoothScroll();

  return (
    <>
      <section aria-labelledby="engine-title" className="pt-14 pb-20 md:pt-24 md:pb-24">
        <div className="page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h1 id="engine-title" className="display">
              <SplitWords as="span" text="Where things go," className="block" span={0.2} />
              <SplitWords as="span" text="where the camera looks." className="block italic text-cream" span={0.25} delay={0.18} />
            </h1>
            <motion.p
              className="lede mt-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.45 } }}
            >
              Arrangement and camera are part of the language. Three statements, <span className="ic">LAYOUT</span>,{' '}
              <span className="ic">CAMERA</span> and <span className="ic">POSITION</span>, can be issued up front or at
              any beat of a run.
            </motion.p>
          </div>
          <dl className="self-end border-t border-[var(--line)] lg:col-span-4 lg:col-start-9">
            {NOTES.map((n, i) => (
              <motion.div
                key={n.k}
                className="border-b border-[var(--line)] py-5"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.55 + i * 0.08 } }}
              >
                <dt className="mono text-cream">{n.k}</dt>
                <dd className="mt-1.5 text-[1.02rem] leading-snug">{n.v}</dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </section>

      <Section
        n="01"
        id="strategies"
        title="Six layout strategies"
        intro={
          <>
            <span className="ic">LAYOUT target AS STRATEGY(name=value, …)</span>. Arguments are named and optional;
            anything left out keeps the strategy’s default. Pick one and move its arguments.
          </>
        }
      >
        <LayoutExplorer />
      </Section>

      <Section
        n="02"
        id="defaults"
        title="What you get without asking"
        intro="Every declared structure has a default strategy. Hover a structure to trace it. Three strategies are never a default; you reach them only by writing LAYOUT."
      >
        <div className="mx-auto max-w-[900px]">
          <DefaultsMap />
        </div>
      </Section>

      <Section
        n="03"
        id="camera"
        title="Four ways to hold the camera"
        intro="By default the camera follows the action and keeps everything in frame. CAMERA changes that, at any point in the sequence."
      >
        <CameraDiagram />
      </Section>

      <Section n="04" id="pins" title="Pin one element, leave the rest">
        <PinDemo />
      </Section>

      <Section
        n="05"
        id="relayout"
        title="Change the arrangement mid-run"
        intro="LAYOUT is an ordinary SEQUENCE statement. Existing elements animate to their new places when it runs."
      >
        <RelayoutDemo />
        <p className="mt-10">
          <a href="#/docs/layout-camera" className="ulink mono text-[0.875rem]">
            Full reference: Layout &amp; Camera in the docs
          </a>
        </p>
      </Section>
    </>
  );
}
