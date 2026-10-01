import React, { useState } from 'react';
import { motion } from 'motion/react';
import { C } from '../../brand/palette';
import { spring } from '../../lib/motion';

/**
 * Which strategy each declared structure gets when the program says nothing.
 * Mirrors STRATEGY_BY_KIND in packages/compiler/src/codegen/defaultLayoutParams.ts.
 */
const DEFAULTS: { kind: string; strategy: 'LINE' | 'HIERARCHY' | 'FORCE_DIRECTED' }[] = [
  { kind: 'ARRAY', strategy: 'LINE' },
  { kind: 'LINKEDLIST', strategy: 'LINE' },
  { kind: 'STACK', strategy: 'LINE' },
  { kind: 'QUEUE', strategy: 'LINE' },
  { kind: 'HASH_MAP', strategy: 'LINE' },
  { kind: 'TREE', strategy: 'HIERARCHY' },
  { kind: 'BINARY_TREE', strategy: 'HIERARCHY' },
  { kind: 'BST', strategy: 'HIERARCHY' },
  { kind: 'HEAP', strategy: 'HIERARCHY' },
  { kind: 'TRIE', strategy: 'HIERARCHY' },
  { kind: 'GRAPH', strategy: 'FORCE_DIRECTED' },
];

const TARGETS = [
  { id: 'LINE', y: 0, optIn: false },
  { id: 'HIERARCHY', y: 0, optIn: false },
  { id: 'FORCE_DIRECTED', y: 0, optIn: false },
  { id: 'CIRCULAR', y: 0, optIn: true },
  { id: 'GRID', y: 0, optIn: true },
  { id: 'CUSTOM', y: 0, optIn: true },
];

const ROW = 30;
const W = 620;
const LEFT_X = 130;
const RIGHT_X = 430;

export function DefaultsMap() {
  const [hover, setHover] = useState<string | null>(null);
  const H = DEFAULTS.length * ROW + 20;
  const leftY = (i: number) => 22 + i * ROW;
  // spread the targets over the same height
  const tY = (i: number) => 40 + i * ((H - 60) / (TARGETS.length - 1));
  const targetIndex = (id: string) => TARGETS.findIndex((t) => t.id === id);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Default layout per structure: arrays, linked lists, stacks, queues and hash maps use LINE; trees, binary trees, BSTs, heaps and tries use HIERARCHY; graphs use FORCE_DIRECTED. CIRCULAR, GRID and CUSTOM are opt-in only.">
        {DEFAULTS.map((d, i) => {
          const ti = targetIndex(d.strategy);
          const y1 = leftY(i);
          const y2 = tY(ti);
          const lit = hover === null || hover === d.kind || hover === d.strategy;
          const path = `M ${LEFT_X + 8} ${y1} C ${LEFT_X + 140} ${y1}, ${RIGHT_X - 140} ${y2}, ${RIGHT_X - 10} ${y2}`;
          return (
            <motion.path
              key={d.kind}
              d={path}
              fill="none"
              stroke={hover && lit ? C.cream : C.peach}
              strokeWidth={hover && lit ? 1.8 : 1}
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: lit ? 0.9 : 0.15 }}
              animate={{ opacity: lit ? 0.9 : 0.15 }}
              viewport={{ once: true, margin: '0px 0px -10% 0px' }}
              transition={{ pathLength: { duration: 0.9, delay: 0.1 + i * 0.06, ease: [0.65, 0, 0.35, 1] }, opacity: spring.snappy }}
            />
          );
        })}
        {DEFAULTS.map((d, i) => (
          <g
            key={d.kind}
            onMouseEnter={() => setHover(d.kind)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: 'default' }}
          >
            <rect x={0} y={leftY(i) - 12} width={LEFT_X + 10} height={24} fill="transparent" />
            <text x={LEFT_X} y={leftY(i) + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize={12.5} fill={hover === d.kind ? C.cream : C.peach}>
              {d.kind}
            </text>
            <circle cx={LEFT_X + 8} cy={leftY(i)} r={3} fill={C.peach} />
          </g>
        ))}
        {TARGETS.map((t, i) => (
          <g key={t.id} onMouseEnter={() => !t.optIn && setHover(t.id)} onMouseLeave={() => setHover(null)}>
            <rect x={RIGHT_X - 10} y={tY(i) - 14} width={W - RIGHT_X} height={28} fill="transparent" />
            <circle cx={RIGHT_X - 10} cy={tY(i)} r={t.optIn ? 3.5 : 5} fill={t.optIn ? 'none' : C.cream} stroke={C.cream} strokeWidth={1.2} />
            <text x={RIGHT_X + 6} y={tY(i) + 4.5} fontFamily="var(--font-mono)" fontSize={13} fontWeight={600} fill={t.optIn ? C.peachMuted : C.cream}>
              {t.id}
            </text>
            {t.optIn && (
              <text x={RIGHT_X + 6} y={tY(i) + 19} fontFamily="var(--font-mono)" fontSize={10} fill={C.peachMuted}>
                opt-in only
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
