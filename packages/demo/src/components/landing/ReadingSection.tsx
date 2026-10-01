import React, { useLayoutEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';

const PROBLEM =
  'Algorithms are usually taught as a wall of pseudocode and a few still diagrams. You read that a pointer moves, that a node is rebalanced, that two values are compared. You rarely see it happen, in the order the code actually runs.';

const ANSWER = 'AQVL makes the picture part of the language. Writing the algorithm is writing the visualization.';

function Words({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {text.split(' ').map((w, i) => (
        <React.Fragment key={i}>
          <span className="rw inline-block">{w}</span>{' '}
        </React.Fragment>
      ))}
    </p>
  );
}

/**
 * Scroll-scrubbed reading: the paragraph is dim until the reader's scroll
 * position reaches each word, so the text is read at the pace it is lit.
 * Pinned on wide screens; plain text for reduced motion.
 */
export function ReadingSection() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const wide = window.matchMedia('(min-width: 900px)').matches;
        const words = gsap.utils.toArray<HTMLElement>('.rw', el);
        gsap.set(words, { opacity: 0.28 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: wide ? 'top top' : 'top 75%',
            end: wide ? '+=120%' : 'bottom 45%',
            scrub: 0.6,
            pin: wide,
            pinSpacing: true,
          },
        });
        tl.to(words, { opacity: 1, stagger: 0.08, ease: 'none', duration: 0.4 });
        tl.fromTo('.answer-rule', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: 1.2 }, '>-0.6');
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} aria-labelledby="problem-title" className="relative flex min-h-[100svh] items-center py-24">
      <div className="page grid gap-8 md:grid-cols-12">
        <div className="md:col-span-2">
          <span className="margin-num">01</span>
          <h2 id="problem-title" className="mono mt-2 text-peach">
            The problem
          </h2>
        </div>
        <div className="md:col-span-9 lg:col-span-8">
          <Words text={PROBLEM} className="font-serif text-[clamp(1.6rem,1.1rem+1.9vw,2.75rem)] leading-[1.28] tracking-[-0.012em] text-peach" />
          <span className="answer-rule mt-10 block h-px origin-left bg-[var(--line-strong)]" aria-hidden="true" />
          <Words text={ANSWER} className="mt-10 font-serif text-[clamp(1.6rem,1.1rem+1.9vw,2.75rem)] leading-[1.28] tracking-[-0.012em] italic text-cream" />
        </div>
      </div>
    </section>
  );
}
