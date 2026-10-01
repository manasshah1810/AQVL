import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { spring } from '../lib/motion';
import { C } from '../brand/palette';

/** A binary search over the site's real routes that comes up empty. */
const ROUTES = ['docs', 'engine', 'examples', 'playground', 'privacy'];

export default function NotFound() {
  const asked = useMemo(() => {
    const h = window.location.hash.replace(/^#\/?/, '').split(/[?#]/)[0];
    return h || '/';
  }, []);

  // Where the missing route would sit in sorted order: the search window closes on nothing.
  const sorted = [...ROUTES].sort();
  let lo = 0;
  let hi = sorted.length - 1;
  const probes: number[] = [];
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    probes.push(mid);
    if (sorted[mid] < asked) lo = mid + 1;
    else hi = mid - 1;
  }

  return (
    <section aria-labelledby="nf-title" className="page grid flex-1 gap-14 py-20 md:grid-cols-12 md:items-center md:py-28">
      <div className="md:col-span-6">
        <span className="margin-num">404</span>
        <h1 id="nf-title" className="headline mt-3">
          Searched every route. <span className="italic text-cream">Nothing at this address.</span>
        </h1>
        <p className="prose mt-6">
          There is no page at <span className="ic">#/{asked}</span>. The link may be old, or mistyped.
        </p>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
          <a className="btn" href="#/">
            Back to the start
          </a>
          <a className="ulink mono self-center text-[0.875rem]" href="#/examples">
            Browse the examples
          </a>
        </div>
      </div>

      <figure className="md:col-span-5 md:col-start-8" aria-label="A binary search over the site's routes that finds nothing">
        <svg viewBox="0 0 320 170" className="h-auto w-full" aria-hidden="true">
          {sorted.map((r, i) => {
            const x = 10 + i * 62;
            const probed = probes.indexOf(i);
            return (
              <g key={r}>
                <rect x={x} y={60} width={52} height={40} rx={2} fill={C.panel} stroke={C.line} />
                <motion.rect
                  x={x}
                  y={60}
                  width={52}
                  height={40}
                  rx={2}
                  fill={C.dusk}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: probed >= 0 ? [0, 1, 0.35] : 0 }}
                  transition={{ delay: 0.5 + Math.max(0, probed) * 0.7, duration: 0.9, times: [0, 0.3, 1] }}
                />
                <text x={x + 26} y={85} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9.5} fill={C.peach}>
                  {r}
                </text>
              </g>
            );
          })}
          <motion.line
            y1={124}
            y2={124}
            stroke={C.cream}
            strokeWidth={2}
            initial={{ x1: 10, x2: 310 }}
            animate={{ x1: 10 + lo * 62 - 6, x2: 10 + lo * 62 - 6 }}
            transition={{ ...spring.gentle, delay: 0.5 + probes.length * 0.7 }}
          />
          <text x={160} y={156} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill={C.peachMuted}>
            lo &gt; hi · not found
          </text>
        </svg>
      </figure>
    </section>
  );
}
