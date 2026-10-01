import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from '../../lib/gsap';
import { C } from '../../brand/palette';
import { SAMPLE, STATEMENT, STRATEGIES, layoutFor, type Pt, type Strategy } from '../../lib/layouts';
import { highlightLines } from '../../lib/aqvlSyntax';
import { SCROLL_STAGE, useMedia } from '../../lib/motion';

const VB_W = 400;
const VB_H = 300;
const toPx = ([x, y]: Pt): Pt => [VB_W / 2 + x * 170, VB_H / 2 + y * 118];

const NOTE: Record<Strategy, string> = {
  LINE: 'Evenly spaced row or column. The default for arrays, linked lists, stacks and queues.',
  CIRCULAR: 'An even ring. Nothing defaults to it; ideal for ring buffers and making a cycle obvious.',
  HIERARCHY: 'Depth-leveled tree. The default for trees, BSTs, heaps and tries.',
  GRID: 'Rows and columns. Turns a flat array into a matrix view.',
  FORCE_DIRECTED: 'A physics simulation: edges pull, vertices push apart. The default for graphs.',
  CUSTOM: 'No automatic placement. Every element gets its own POSITION; here they trace the AQVL mark.',
};

/** Static drawing of one layout (used for the narrow / reduced-motion strip). */
export function LayoutSketch({ strategy, className }: { strategy: Strategy; className?: string }) {
  const pts = useMemo(() => layoutFor(strategy).map(toPx), [strategy]);
  const showEdges = strategy !== 'LINE' && strategy !== 'GRID';
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={className} aria-hidden="true">
      {showEdges &&
        SAMPLE.edges.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke={C.lineStrong} strokeWidth={1.5} />
        ))}
      {pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r={15} fill={C.panel} stroke={C.peach} strokeWidth={1.5} />
          <text y={5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={13} fill={C.peach}>
            {SAMPLE.labels[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function LayoutMorph() {
  const root = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<Strategy>('LINE');
  const interactive = useMedia(SCROLL_STAGE);
  const layouts = useMemo(() => STRATEGIES.map((s) => layoutFor(s).map(toPx)), []);

  useLayoutEffect(() => {
    const el = root.current;
    const svg = svgRef.current;
    if (!interactive || !el || !svg) return;
    const ctx = gsap.context(() => {
      {
        const nodes = Array.from(svg.querySelectorAll<SVGGElement>('.lm-node'));
        const lines = Array.from(svg.querySelectorAll<SVGLineElement>('.lm-edge'));
        const proxy = { p: 0 };
        let shown = 0;
        const render = () => {
          const last = STRATEGIES.length - 1;
          const p = Math.min(last, Math.max(0, proxy.p));
          const k = Math.min(last - 1, Math.floor(p));
          const u = p - k;
          // hold at each layout, travel through the middle of the segment
          const e = smooth(Math.min(1, Math.max(0, (u - 0.3) / 0.4)));
          const from = layouts[k];
          const to = layouts[k + 1];
          const cur = from.map(([x, y], i) => [x + (to[i][0] - x) * e, y + (to[i][1] - y) * e]);
          nodes.forEach((n, i) => n.setAttribute('transform', `translate(${cur[i][0].toFixed(2)} ${cur[i][1].toFixed(2)})`));
          lines.forEach((l, i) => {
            const [a, b] = SAMPLE.edges[i];
            l.setAttribute('x1', cur[a][0].toFixed(2));
            l.setAttribute('y1', cur[a][1].toFixed(2));
            l.setAttribute('x2', cur[b][0].toFixed(2));
            l.setAttribute('y2', cur[b][1].toFixed(2));
          });
          // edges fade for the two layouts that ignore them visually
          const edgeOp = (s: number) => (STRATEGIES[s] === 'LINE' || STRATEGIES[s] === 'GRID' ? 0.25 : 1);
          const op = edgeOp(k) + (edgeOp(k + 1) - edgeOp(k)) * e;
          lines.forEach((l) => (l.style.opacity = String(op)));
          const idx = Math.round(p);
          if (idx !== shown) {
            shown = idx;
            setActive(STRATEGIES[idx]);
          }
        };
        render();
        gsap.to(proxy, {
          p: STRATEGIES.length - 1,
          ease: 'none',
          onUpdate: render,
          scrollTrigger: { trigger: el, start: 'top top', end: '+=360%', scrub: 0.9, pin: true, pinSpacing: true },
        });
      }
    }, el);
    return () => {
      ctx.revert();
      setActive('LINE');
    };
  }, [interactive, layouts]);

  const initial = layouts[0];

  return (
    <section ref={root} aria-labelledby="layout-title" className="relative py-24 md:min-h-[100svh] md:py-0">
      <div className="page grid gap-10 md:min-h-[100svh] md:grid-cols-12 md:items-center">
        <div className="md:col-span-5">
          <span className="margin-num">03</span>
          <h2 id="layout-title" className="headline mt-3">
            Arrangement is one line of the program.
          </h2>
          <p className="prose mt-6">
            Every structure already gets a sensible arrangement. When an explanation needs a different one,{' '}
            <span className="ic">LAYOUT</span> changes it, even halfway through a run: build a graph under physics,
            then freeze its cycle into a ring.
          </p>

          {interactive && (
            <div className="mt-10">
              <ol role="list" className="flex flex-wrap gap-2" aria-label="Layout strategies">
                {STRATEGIES.map((s) => (
                  <li
                    key={s}
                    className={`mono rounded-ctl px-2.5 py-1.5 transition-[background-color,color] duration-[var(--spring-soft-d)] ease-[var(--spring-soft)] ${s === active ? 'bg-dusk-deep text-cream' : 'text-peach-muted'}`}
                    aria-current={s === active ? 'step' : undefined}
                  >
                    {s}
                  </li>
                ))}
              </ol>
              <div className="code mt-5" aria-live="polite">
                <pre className="code__pre !py-4">
                  <span className="code__line">{highlightLines(STATEMENT[active])}</span>
                </pre>
              </div>
              <p className="muted mt-4 min-h-[3.2em] text-[1rem]">{NOTE[active]}</p>
            </div>
          )}
          <a href="#/engine" className="ulink mono mt-8 inline-block text-[0.875rem]">
            All six strategies, with their arguments
          </a>
        </div>

        <div className="md:col-span-7">
          {interactive ? (
            <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto w-full" role="img" aria-label={`Seven vertices arranged with the ${active} layout.`}>
              {SAMPLE.edges.map(([a, b]) => (
                <line
                  key={`${a}-${b}`}
                  className="lm-edge"
                  x1={initial[a][0]}
                  y1={initial[a][1]}
                  x2={initial[b][0]}
                  y2={initial[b][1]}
                  stroke={C.lineStrong}
                  strokeWidth={1.5}
                />
              ))}
              {initial.map(([x, y], i) => (
                <g key={i} className="lm-node" transform={`translate(${x} ${y})`}>
                  <circle r={16} fill={C.panel} stroke={C.peach} strokeWidth={1.5} />
                  <text y={5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={13} fill={C.peach}>
                    {SAMPLE.labels[i]}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <ul role="list" className="-mx-[var(--gutter)] flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--gutter)] pb-4">
              {STRATEGIES.map((s) => (
                <li key={s} className="w-[78%] max-w-[340px] shrink-0 snap-start">
                  <figure className="panel p-3">
                    <LayoutSketch strategy={s} className="h-auto w-full" />
                    <figcaption className="mono mt-2 text-cream">{s}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
