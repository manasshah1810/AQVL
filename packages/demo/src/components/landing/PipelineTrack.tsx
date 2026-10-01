import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';
import { anime } from '../../lib/anime';
import { CodeBlock } from '../code/CodeBlock';
import { C } from '../../brand/palette';
import { SCROLL_STAGE, prefersReducedMotion, useMedia } from '../../lib/motion';

const DECLARE_SRC = `DECLARE
  ARRAY nums = [10, 20, 30, 40, 50]
  STACK s
  GRAPH g = ["A->B", "B->C", "C->A"]`;

const SEQUENCE_SRC = `SEQUENCE
  HIGHLIGHT nums[0]
  COMPARE nums[0] nums[1]
  SWAP nums[0] nums[1]
  PUSH s 10
  WAIT
END`;

const STAGES = ['Lexer', 'Parser', 'Semantic validator', 'Optimizer', 'AQIR generator', 'Virtual machine', 'Renderer'];

/** The compiler pipeline as a single drawn line with stations, like a transit map. */
function PipelineDiagram() {
  const ref = useRef<SVGSVGElement>(null);
  const W = 560;
  const rowH = 46;
  const H = STAGES.length * rowH + 10;

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const line = svg.querySelector<SVGPathElement>('.pl-line');
    const stations = svg.querySelectorAll('.pl-station');
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined' || !line) return;
    line.style.strokeDasharray = `${line.getTotalLength?.() ?? 1000}`;
    line.style.strokeDashoffset = `${line.getTotalLength?.() ?? 1000}`;
    stations.forEach((s) => ((s as SVGGElement).style.opacity = '0'));
    let played = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (played || !entries.some((e) => e.isIntersecting)) return;
        played = true;
        anime({ targets: line, strokeDashoffset: [anime.setDashoffset, 0], easing: 'easeInOutSine', duration: 1700 });
        anime({
          targets: stations,
          opacity: [0, 1],
          translateX: [-10, 0],
          easing: 'spring(1, 90, 14, 0)',
          delay: anime.stagger(190, { start: 120 }),
        });
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(svg);
    return () => io.disconnect();
  }, []);

  const x = 22;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Compiler pipeline: ${STAGES.join(', then ')}.`}>
      <path className="pl-line" d={`M ${x} 18 L ${x} ${H - 18}`} stroke={C.peach} strokeWidth={2} fill="none" />
      {STAGES.map((s, i) => {
        const y = 18 + i * rowH;
        const last = i === STAGES.length - 1;
        return (
          <g key={s} className="pl-station">
            <circle cx={x} cy={y} r={last ? 9 : 7} fill={last ? C.cream : C.ink} stroke={C.peach} strokeWidth={2} />
            <text x={x + 26} y={y + 6} fontFamily="var(--font-serif)" fontSize={20} fill={last ? C.cream : C.peach}>
              {s}
            </text>
            <text x={W - 4} y={y + 5} textAnchor="end" fontFamily="var(--font-mono)" fontSize={12} fill={C.peachMuted}>
              {['tokens', 'syntax tree', 'diagnostics', 'optimized tree', 'AQIR', 'scene state', '3D frames'][i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Panel({ n, title, children, wide = false, stage }: { n: string; title: string; children: React.ReactNode; wide?: boolean; stage: boolean }) {
  return (
    <article
      className={`flex shrink-0 flex-col gap-6 ${stage ? `h-full justify-center ${wide ? 'w-[min(78vw,980px)]' : 'w-[min(64vw,760px)]'}` : ''}`}
    >
      <div className="flex items-baseline gap-4">
        <span className="margin-num">{n}</span>
        <h3 className="title">{title}</h3>
      </div>
      {children}
    </article>
  );
}

/**
 * Four steps from source to scene, on a horizontal track that is pinned and
 * scrubbed by vertical scroll on wide screens. Stacks vertically on narrow
 * screens and for reduced motion.
 */
export function PipelineTrack() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const stage = useMedia(SCROLL_STAGE);

  useLayoutEffect(() => {
    const el = root.current;
    const tr = track.current;
    if (!stage || !el || !tr) return;
    const ctx = gsap.context(() => {
      {
        const distance = () => Math.max(0, tr.scrollWidth - window.innerWidth + 64);
        gsap.to(tr, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: () => `+=${distance()}`,
            scrub: 0.8,
            pin: true,
            pinSpacing: true,
            invalidateOnRefresh: true,
          },
        });
        // A progress hairline under the track.
        gsap.fromTo('.pt-progress', { scaleX: 0 }, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top top', end: () => `+=${distance()}`, scrub: true },
        });
      }
    }, el);
    return () => ctx.revert();
  }, [stage]);

  return (
    <section ref={root} aria-labelledby="how-title" className={`relative py-20 ${stage ? 'flex h-[100svh] flex-col overflow-hidden py-0' : ''}`}>
      <div className={`page ${stage ? 'pt-[12vh]' : ''}`}>
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-2">
            <span className="margin-num">02</span>
            <h2 id="how-title" className="mono mt-2 text-peach">
              How it works
            </h2>
          </div>
          <p className="headline md:col-span-9">From a text file to a scene you can step through.</p>
        </div>
      </div>

      <div className={stage ? 'min-h-0 flex-1' : ''}>
        <div
          ref={track}
          className={
            stage
              ? 'page flex h-full max-w-none flex-row items-center gap-[8vw] pl-[max(var(--gutter),calc((100vw_-_var(--page-max))/2_+_var(--gutter)))] will-change-transform'
              : 'page flex flex-col gap-16 pt-14'
          }
        >
          <Panel n="a" title="Declare what exists" stage={stage}>
            <p className="prose">
              Name your data in a <span className="ic">DECLARE</span> block. Each structure is drawn the moment it is
              declared, before a single instruction runs.
            </p>
            <CodeBlock code={DECLARE_SRC} label="declare" copy={false} />
          </Panel>

          <Panel n="b" title="Sequence what happens" stage={stage}>
            <p className="prose">
              Commands in <span className="ic">SEQUENCE</span> map one-to-one onto animation beats. Loops, conditions,
              functions and recursion work the way they do in any language.
            </p>
            <CodeBlock code={SEQUENCE_SRC} label="sequence" copy={false} />
          </Panel>

          <Panel n="c" title="Compile to AQIR" wide stage={stage}>
            <div className={`grid gap-8 ${stage ? 'grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center' : ''}`}>
              <p className="prose">
                The compiler turns your source into AQIR, a compact bytecode-like instruction set. A virtual machine
                executes it and hands each new scene state to a React Three Fiber renderer, frame by frame.
              </p>
              <PipelineDiagram />
            </div>
          </Panel>

          <Panel n="d" title="Watch, step, rewind" stage={stage}>
            <p className="prose">
              Play the program or walk it one step at a time, forwards and backwards, at half to four times speed. The
              line being executed is lit in the editor, and the output console explains each step in words.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-[var(--line)] pt-5">
              <dt className="mono text-cream">Step back</dt>
              <dd className="muted">undo the last beat, console lines included</dd>
              <dt className="mono text-cream">Play</dt>
              <dd className="muted">runs to the end; press again to replay</dd>
              <dt className="mono text-cream">Step forward</dt>
              <dd className="muted">one animated statement</dd>
              <dt className="mono text-cream">0.5× – 4×</dt>
              <dd className="muted">playback rate</dd>
            </dl>
          </Panel>
          {stage && <span aria-hidden="true" className="block w-px shrink-0" />}
        </div>
      </div>

      {stage && (
        <div className="page pb-[8vh]" aria-hidden="true">
          <span className="pt-progress block h-px origin-left bg-[var(--line-strong)]" />
        </div>
      )}
    </section>
  );
}
