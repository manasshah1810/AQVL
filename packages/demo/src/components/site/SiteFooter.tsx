import React from 'react';
import { motion } from 'motion/react';
import { MARK, STROKE, markPath } from '../../brand/geometry';
import { Wordmark } from '../../brand/Logo';
import { usePrefersReducedMotion } from '../../lib/motion';

const SOURCE_URL = 'https://github.com/manasshah1810/AQVL';

const LINKS = [
  { label: 'Engine', href: '#/engine' },
  { label: 'Docs', href: '#/docs' },
  { label: 'Examples', href: '#/examples' },
  { label: 'Playground', href: '#/playground' },
  { label: 'Privacy', href: '#/privacy' },
];

/**
 * One closing line, one row of links, and the mark's baseline running the
 * full width of the page: the loop resolves into a straight line.
 */
export function SiteFooter() {
  const reduced = usePrefersReducedMotion();
  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-ink pt-16 md:pt-24">
      <div className="page">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <p className="headline md:col-span-7">
            Write the algorithm. <span className="italic text-cream">Watch it think.</span>
          </p>
          <nav aria-label="Footer" className="md:col-span-5 md:justify-self-end">
            <ul role="list" className="flex flex-wrap gap-x-6 gap-y-3">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a className="ulink mono text-[0.875rem]" href={l.href}>
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a className="ulink mono text-[0.875rem]" href={SOURCE_URL} target="_blank" rel="noreferrer">
                  Source on GitHub
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* The launch loop, then its baseline carried across the page. */}
        <div className="relative mt-16 flex items-end gap-0 text-dusk md:mt-24" aria-hidden="true">
          <svg viewBox="0 0 100 100" className="h-[72px] w-[72px] shrink-0 md:h-[120px] md:w-[120px]">
            <motion.path
              d={markPath({ ...MARK, tailEnd: 100 })}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              initial={reduced ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
            />
          </svg>
          <motion.span
            className="mb-[calc(72px*0.205)] block h-[8px] flex-1 origin-left bg-current md:mb-[calc(120px*0.205)] md:h-[13px]"
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, delay: 0.9, ease: [0.65, 0, 0.35, 1] }}
          />
        </div>

        <div className="flex flex-col gap-3 py-8 text-peach-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-3">
            <Wordmark height={11} />
            <span className="mono">turns .aqvl programs into 3D scenes</span>
          </span>
          <span className="mono">Runs entirely in your browser</span>
        </div>
      </div>
    </footer>
  );
}
