import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { C } from '../../brand/palette';
import { spring } from '../../lib/motion';
import {
  DJ_EDGES,
  DJ_NODES,
  GRID,
  GRID_WALLS,
  SEARCH_TARGET,
  SEARCH_VALUES,
  binarySearchFrames,
  bfsFrames,
  dijkstraFrames,
  edgeKey,
  hanoiFrames,
  insertionSortFrames,
  stackFrames,
} from './frames';

/* Six tiny, looping, deterministic algorithm traces for loaders.
   Movement is spring-driven transforms; colour changes are opacity
   cross-fades between two layers, so nothing animates layout. */

const W = 240;
const H = 128;

/** Steps through a frame tape, holding the last frame before looping. */
function useTape(length: number, ms: number, still: boolean) {
  const hold = 3;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => setTick((t) => (t + 1) % (length + hold)), ms);
    return () => window.clearInterval(id);
  }, [length, ms, still]);
  return still ? length - 1 : Math.min(tick, length - 1);
}

export interface VizProps {
  still?: boolean;
  onCaption?: (caption: string) => void;
}

function useCaption(caption: string, onCaption?: (c: string) => void) {
  useEffect(() => {
    onCaption?.(caption);
  }, [caption, onCaption]);
}

/* ── Insertion sort ───────────────────────────────────────────── */
export function InsertionSortViz({ still = false, onCaption }: VizProps) {
  const frames = useMemo(() => insertionSortFrames(), []);
  const f = frames[useTape(frames.length, 520, still)];
  useCaption(f.caption, onCaption);
  const n = f.order.length;
  const slot = 22;
  const gap = 6;
  const x0 = (W - (n * slot + (n - 1) * gap)) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-hidden="true">
      <line x1={x0 - 6} x2={W - x0 + 6} y1={112} y2={112} stroke={C.lineStrong} strokeWidth={1} />
      {f.order.map((value, pos) => {
        const h = 14 + value * 10;
        const active = f.pair !== null && (pos === f.pair[0] || pos === f.pair[1]);
        const sorted = pos < f.sorted;
        return (
          <motion.g key={value} initial={false} animate={{ x: x0 + pos * (slot + gap) }} transition={spring.lively}>
            <rect x={0} y={112 - h} width={slot} height={h} rx={2} fill={sorted ? C.dusk : C.panel} stroke={C.lineStrong} strokeWidth={1} />
            <motion.rect
              x={0}
              y={112 - h}
              width={slot}
              height={h}
              rx={2}
              fill={C.cream}
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
              transition={spring.snappy}
            />
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ── Breadth-first search ─────────────────────────────────────── */
export function BfsViz({ still = false, onCaption }: VizProps) {
  const frames = useMemo(() => bfsFrames(), []);
  const f = frames[useTape(frames.length, 300, still)];
  useCaption(f.caption, onCaption);
  const cell = 17;
  const gap = 3;
  const gw = GRID.cols * cell + (GRID.cols - 1) * gap;
  const gh = GRID.rows * cell + (GRID.rows - 1) * gap;
  const ox = (W - gw) / 2;
  const oy = (H - gh) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-hidden="true">
      {GRID_WALLS.map((wall, i) => {
        const x = ox + (i % GRID.cols) * (cell + gap);
        const y = oy + Math.floor(i / GRID.cols) * (cell + gap);
        const d = f.dist[i];
        const reached = d >= 0;
        const frontier = d === f.layer && reached;
        if (wall) return <rect key={i} x={x} y={y} width={cell} height={cell} rx={2} fill="rgba(196,162,144,0.28)" />;
        return (
          <g key={i}>
            <rect x={x + 0.5} y={y + 0.5} width={cell - 1} height={cell - 1} rx={2} fill="none" stroke={C.line} />
            <motion.rect
              x={x}
              y={y}
              width={cell}
              height={cell}
              rx={2}
              fill={frontier ? C.cream : C.dusk}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              initial={false}
              animate={{ scale: reached ? 1 : 0.2, opacity: reached ? 1 : 0 }}
              transition={spring.lively}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ── Binary search ────────────────────────────────────────────── */
export function BinarySearchViz({ still = false, onCaption }: VizProps) {
  const frames = useMemo(() => binarySearchFrames(), []);
  const f = frames[useTape(frames.length, 760, still)];
  useCaption(f.caption, onCaption);
  const n = SEARCH_VALUES.length;
  const cell = 14;
  const gap = 1;
  const span = n * cell + (n - 1) * gap;
  const ox = (W - span) / 2;
  const y = 54;
  const xAt = (i: number) => ox + i * (cell + gap);
  const loX = xAt(f.lo);
  const hiX = xAt(Math.max(f.lo, f.hi)) + cell;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-hidden="true">
      <text x={W / 2} y={28} textAnchor="middle" fill={C.peachMuted} fontFamily="var(--font-mono)" fontSize={10}>
        target {SEARCH_TARGET}
      </text>
      {SEARCH_VALUES.map((v, i) => {
        const inRange = i >= f.lo && i <= f.hi;
        const isMid = f.mid === i;
        return (
          <g key={v}>
            <rect x={xAt(i)} y={y} width={cell} height={cell + 6} rx={2} fill={C.panel} />
            <motion.rect
              x={xAt(i)}
              y={y}
              width={cell}
              height={cell + 6}
              rx={2}
              fill={isMid ? C.cream : C.dusk}
              initial={false}
              animate={{ opacity: isMid ? 1 : inRange ? 0.85 : 0 }}
              transition={spring.snappy}
            />
            <text
              x={xAt(i) + cell / 2}
              y={y + 13.5}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={6.5}
              fill={isMid ? C.ink : C.peach}
            >
              {v}
            </text>
          </g>
        );
      })}
      {/* lo / hi brackets slide on springs */}
      <motion.path
        d={`M 4 0 L 0 0 L 0 34 L 4 34`}
        fill="none"
        stroke={C.peach}
        strokeWidth={1.4}
        initial={false}
        animate={{ x: loX - 3, y: y - 7 }}
        transition={spring.layout}
      />
      <motion.path
        d={`M -4 0 L 0 0 L 0 34 L -4 34`}
        fill="none"
        stroke={C.peach}
        strokeWidth={1.4}
        initial={false}
        animate={{ x: hiX + 3, y: y - 7 }}
        transition={spring.layout}
      />
      <motion.text
        y={y + 46}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={8}
        fill={C.peachMuted}
        initial={false}
        animate={{ x: loX }}
        transition={spring.layout}
      >
        lo
      </motion.text>
      <motion.text
        y={y + 46}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={8}
        fill={C.peachMuted}
        initial={false}
        animate={{ x: hiX }}
        transition={spring.layout}
      >
        hi
      </motion.text>
    </svg>
  );
}

/* ── Stack ────────────────────────────────────────────────────── */
export function StackViz({ still = false, onCaption }: VizProps) {
  const frames = useMemo(() => stackFrames(), []);
  const f = frames[useTape(frames.length, 620, still)];
  useCaption(f.caption, onCaption);
  const bw = 66;
  const bh = 18;
  const bx = (W - bw) / 2;
  const floor = 116;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-hidden="true">
      <path d={`M ${bx - 8} 18 L ${bx - 8} ${floor + 2} L ${bx + bw + 8} ${floor + 2} L ${bx + bw + 8} 18`} fill="none" stroke={C.lineStrong} />
      <AnimatePresence initial={false}>
        {f.items.map((item, i) => {
          const top = i === f.items.length - 1;
          return (
            <motion.g
              key={item.id}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: floor - (i + 1) * (bh + 3), opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={spring.lively}
            >
              <rect x={bx} y={0} width={bw} height={bh} rx={2} fill={top ? C.cream : C.dusk} />
              <text x={W / 2} y={12.5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill={top ? C.ink : C.cream}>
                {item.value}
              </text>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}

/* ── Dijkstra ─────────────────────────────────────────────────── */
export function DijkstraViz({ still = false, onCaption }: VizProps) {
  const frames = useMemo(() => dijkstraFrames(), []);
  const f = frames[useTape(frames.length, 820, still)];
  useCaption(f.caption, onCaption);
  const pos = Object.fromEntries(DJ_NODES.map((n) => [n.id, n]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-hidden="true">
      {DJ_EDGES.map(([a, b, w]) => {
        const k = edgeKey(a, b);
        const inTree = f.tree.includes(k);
        const pa = pos[a];
        const pb = pos[b];
        return (
          <g key={k}>
            <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={C.line} strokeWidth={1} />
            <motion.line
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={C.cream}
              strokeWidth={2}
              initial={false}
              animate={{ pathLength: inTree ? 1 : 0, opacity: inTree ? 1 : 0 }}
              transition={spring.gentle}
            />
            <text
              x={(pa.x + pb.x) / 2 + 4}
              y={(pa.y + pb.y) / 2 - 3}
              fontFamily="var(--font-mono)"
              fontSize={7.5}
              fill={C.peachMuted}
            >
              {w}
            </text>
          </g>
        );
      })}
      {DJ_NODES.map((n) => {
        const settled = f.settled.includes(n.id);
        const current = f.current === n.id;
        const d = f.dist[n.id];
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={11} fill={C.ink} stroke={C.lineStrong} />
            <motion.circle
              cx={n.x}
              cy={n.y}
              r={11}
              fill={current ? C.cream : C.dusk}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              initial={false}
              animate={{ scale: settled ? 1 : 0.3, opacity: settled ? 1 : 0 }}
              transition={spring.lively}
            />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={8.5} fontWeight={600} fill={current ? C.ink : C.peach}>
              {n.id}
            </text>
            <text x={n.x} y={n.y + 22} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={7.5} fill={C.peachMuted}>
              {d === Infinity ? '∞' : d}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Tower of Hanoi ───────────────────────────────────────────── */
export function HanoiViz({ still = false, onCaption }: VizProps) {
  const frames = useMemo(() => hanoiFrames(3), []);
  const f = frames[useTape(frames.length, 700, still)];
  useCaption(f.caption, onCaption);
  const pegX = [56, 120, 184];
  const base = 108;
  const dh = 13;
  // locate every disk
  const where: Record<number, { peg: number; level: number }> = {};
  f.pegs.forEach((stack, p) => stack.forEach((size, level) => (where[size] = { peg: p, level })));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-hidden="true">
      <line x1={22} x2={218} y1={base + 1} y2={base + 1} stroke={C.lineStrong} />
      {pegX.map((x) => (
        <line key={x} x1={x} x2={x} y1={46} y2={base} stroke={C.line} strokeWidth={2} />
      ))}
      {[3, 2, 1].map((size) => {
        const at = where[size];
        const w = 18 + size * 14;
        return (
          <motion.g
            key={size}
            initial={false}
            animate={{ x: pegX[at.peg] - w / 2, y: base - (at.level + 1) * (dh + 1) }}
            transition={spring.lively}
          >
            <rect width={w} height={dh} rx={2} fill={size === 1 ? C.cream : size === 2 ? C.peach : C.dusk} />
          </motion.g>
        );
      })}
    </svg>
  );
}
