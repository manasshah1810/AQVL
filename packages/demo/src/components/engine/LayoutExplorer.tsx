import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { C } from '../../brand/palette';
import { spring } from '../../lib/motion';
import { highlightLines } from '../../lib/aqvlSyntax';
import { SAMPLE, STRATEGIES, circularLayout, customLayout, forceLayout, hierarchyLayout, type Pt, type Strategy } from '../../lib/layouts';

/* Parameter surface per strategy, with the defaults the docs list. */
interface Param {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
}

const PARAMS: Record<Strategy, Param[]> = {
  LINE: [{ key: 'spacing', label: 'spacing', min: 0.6, max: 2.5, step: 0.1, def: 1.5 }],
  CIRCULAR: [
    { key: 'radius', label: 'radius', min: 1, max: 4, step: 0.1, def: 2 },
    { key: 'startAngle', label: 'startAngle', min: 0, max: 359, step: 1, def: 0 },
  ],
  HIERARCHY: [
    { key: 'levelGap', label: 'levelGap', min: 1, max: 3.2, step: 0.1, def: 2 },
    { key: 'siblingGap', label: 'siblingGap', min: 0.6, max: 2.5, step: 0.1, def: 1.5 },
  ],
  GRID: [
    { key: 'columns', label: 'columns', min: 1, max: 7, step: 1, def: 3 },
    { key: 'spacingX', label: 'spacingX', min: 0.8, max: 2.5, step: 0.1, def: 1.5 },
    { key: 'spacingY', label: 'spacingY', min: 0.8, max: 2.5, step: 0.1, def: 1.5 },
  ],
  FORCE_DIRECTED: [{ key: 'iterations', label: 'iterations', min: 0, max: 150, step: 1, def: 100 }],
  CUSTOM: [],
};

const SUMMARY: Record<Strategy, string> = {
  LINE: 'An evenly spaced row or column. The default for arrays, linked lists, stacks, queues and hash maps; stacks run vertically.',
  CIRCULAR: 'An evenly spaced ring. Nothing defaults to it. Use it for ring buffers, or to make a graph’s cycle obvious.',
  HIERARCHY: 'Depth-leveled: each level of the tree sits one levelGap below its parent, subtrees kept siblingGap apart. The default for trees, BSTs, heaps and tries.',
  GRID: 'Rows and columns. Turns a flat array into a matrix view.',
  FORCE_DIRECTED: 'A physics simulation: every vertex pushes the others away, every edge pulls its ends together, and the layout settles. The default for graphs. Drag iterations to watch it settle.',
  CUSTOM: 'Takes no parameters and turns automatic placement off. Every element needs its own POSITION statement; here they trace the AQVL mark.',
};

const UNIT = 22; // px per world unit in the diagram
const VB_W = 480;
const VB_H = 340;
const N = SAMPLE.labels.length;

function worldLayout(s: Strategy, v: Record<string, number>, axis: 'horizontal' | 'vertical'): Pt[] {
  switch (s) {
    case 'LINE':
      return Array.from({ length: N }, (_, i) => (axis === 'horizontal' ? [i * v.spacing * 1.35, 0] : [0, i * v.spacing * 0.95]) as Pt);
    case 'CIRCULAR':
      return circularLayout(N, v.startAngle, 1).map(([x, y]) => [x * v.radius * 1.75, y * v.radius * 1.75] as Pt);
    case 'HIERARCHY': {
      const unit = hierarchyLayout(N, SAMPLE.edges);
      // unit layout spans [-0.9, 0.9] across 4 leaves and [-0.8, 0.8] across 2 levels
      return unit.map(([x, y]) => [(x / 0.6) * (1 + v.siblingGap) * 0.9, ((y + 0.8) / 0.8) * v.levelGap * 1.5] as Pt);
    }
    case 'GRID':
      return Array.from({ length: N }, (_, i) => [(i % v.columns) * v.spacingX * 1.5, Math.floor(i / v.columns) * v.spacingY * 1.5] as Pt);
    case 'FORCE_DIRECTED':
      return forceLayout(N, SAMPLE.edges, Math.round(v.iterations)).map(([x, y]) => [x * 6, y * 5] as Pt);
    case 'CUSTOM':
      return customLayout(N).map(([x, y]) => [x * 6.2, y * 5.2] as Pt);
  }
}

/** Centre the bounding box of world points in the viewBox. */
function toView(pts: Pt[]): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = (Math.max(...xs) - Math.min(...xs)) * UNIT;
  const h = (Math.max(...ys) - Math.min(...ys)) * UNIT;
  // Only shrink at the extremes of a slider, so changes stay visible.
  const k = Math.min(1, (VB_W - 60) / Math.max(w, 1), (VB_H - 56) / Math.max(h, 1));
  return pts.map(([x, y]) => [VB_W / 2 + (x - cx) * UNIT * k, VB_H / 2 + (y - cy) * UNIT * k]);
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function LayoutExplorer() {
  const [strategy, setStrategy] = useState<Strategy>('HIERARCHY');
  const [values, setValues] = useState<Record<Strategy, Record<string, number>>>(() =>
    Object.fromEntries(STRATEGIES.map((s) => [s, Object.fromEntries(PARAMS[s].map((p) => [p.key, p.def]))])) as Record<Strategy, Record<string, number>>,
  );
  const [axis, setAxis] = useState<'horizontal' | 'vertical'>('horizontal');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const v = values[strategy];
  const pts = useMemo(() => toView(worldLayout(strategy, v, axis)), [strategy, v, axis]);
  const showEdges = strategy !== 'LINE' && strategy !== 'GRID';

  const statement = useMemo(() => {
    const args = PARAMS[strategy].map((p) => `${p.key}=${fmt(v[p.key])}`);
    if (strategy === 'LINE') args.push(`axis=${axis}`);
    return `LAYOUT g AS ${strategy}(${args.join(', ')})`;
  }, [strategy, v, axis]);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? STRATEGIES.length - 1 : (i + dir + STRATEGIES.length) % STRATEGIES.length;
    setStrategy(STRATEGIES[next]);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <div role="tablist" aria-label="Layout strategy" className="flex flex-wrap gap-1.5">
          {STRATEGIES.map((s, i) => {
            const on = s === strategy;
            return (
              <button
                key={s}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`lx-tab-${s}`}
                aria-selected={on}
                aria-controls="lx-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setStrategy(s)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`relative rounded-ctl px-3 py-2 ${on ? 'text-cream' : 'text-peach hover:text-cream'} transition-colors duration-300`}
              >
                {on && <motion.span layoutId="lx-tab" className="absolute inset-0 rounded-ctl bg-dusk-deep" transition={spring.layout} />}
                <span className="mono relative">{s}</span>
              </button>
            );
          })}
        </div>

        <div id="lx-panel" role="tabpanel" aria-labelledby={`lx-tab-${strategy}`} className="mt-8">
          <p className="prose min-h-[5.5em]">{SUMMARY[strategy]}</p>

          <div className="mt-6 flex flex-col gap-5">
            {PARAMS[strategy].map((p) => (
              <label key={p.key} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-3">
                <span className="mono text-cream">{p.label}</span>
                <input
                  type="range"
                  className="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={v[p.key]}
                  onChange={(e) => setValues((all) => ({ ...all, [strategy]: { ...all[strategy], [p.key]: Number(e.target.value) } }))}
                />
                <output className="mono text-right text-cream">{fmt(v[p.key])}</output>
              </label>
            ))}
            {strategy === 'LINE' && (
              <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3">
                <span className="mono text-cream" id="axis-label">
                  axis
                </span>
                <div role="radiogroup" aria-labelledby="axis-label" className="flex gap-1.5">
                  {(['horizontal', 'vertical'] as const).map((a) => (
                    <button
                      key={a}
                      role="radio"
                      aria-checked={axis === a}
                      onClick={() => setAxis(a)}
                      className={`mono rounded-ctl px-3 py-1.5 transition-colors duration-300 ${axis === a ? 'bg-dusk-deep text-cream' : 'text-peach hover:bg-panel'}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {PARAMS[strategy].length > 0 && (
              <button
                type="button"
                className="ulink mono self-start text-[0.8125rem]"
                onClick={() =>
                  setValues((all) => ({ ...all, [strategy]: Object.fromEntries(PARAMS[strategy].map((p) => [p.key, p.def])) }))
                }
              >
                Reset to defaults
              </button>
            )}
          </div>

          <div className="code mt-8">
            <div className="code__head">
              <span className="mono code__label">statement</span>
            </div>
            <pre className="code__pre overflow-x-auto">
              <span className="code__line">{highlightLines(statement)}</span>
            </pre>
          </div>
        </div>
      </div>

      <figure className="panel relative m-0 overflow-hidden lg:col-span-7">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto w-full" role="img" aria-label={`Seven vertices arranged by ${strategy}.`}>
          {SAMPLE.edges.map(([a, b]) => (
            <motion.line
              key={`${a}-${b}`}
              stroke={C.lineStrong}
              strokeWidth={1.5}
              initial={false}
              animate={{ x1: pts[a][0], y1: pts[a][1], x2: pts[b][0], y2: pts[b][1], opacity: showEdges ? 1 : 0.2 }}
              transition={spring.layout}
            />
          ))}
          {pts.map(([x, y], i) => (
            <motion.g key={i} initial={false} animate={{ x, y }} transition={{ ...spring.layout, delay: i * 0.015 }}>
              <circle r={11} fill={C.ink} stroke={C.peach} strokeWidth={1.5} />
              <text y={4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill={C.peach}>
                {SAMPLE.labels[i]}
              </text>
            </motion.g>
          ))}
        </svg>
        <figcaption className="mono muted border-t border-[var(--line)] px-4 py-3">
          2D sketch of the idea; the engine applies it in 3D world units.
        </figcaption>
      </figure>
    </div>
  );
}
