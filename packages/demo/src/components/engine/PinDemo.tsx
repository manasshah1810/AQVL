import React, { useState } from 'react';
import { motion } from 'motion/react';
import { C } from '../../brand/palette';
import { spring } from '../../lib/motion';
import { highlightLines } from '../../lib/aqvlSyntax';

const VALUES = [5, 3, 8, 1, 9];

/** Docs example 5: lift one element out of the row with POSITION, then release it. */
export function PinDemo() {
  const [pinned, setPinned] = useState(false);
  const statement = pinned ? 'POSITION arr[2] AT (x=5, y=2, z=0)' : 'POSITION arr[2] AT ()';

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
      <div className="lg:col-span-5">
        <p className="prose">
          <span className="ic">POSITION</span> pins a single element to explicit coordinates, overriding its layout.
          Each axis is optional. A pin sticks through later re-layouts until it is released with an empty{' '}
          <span className="ic">AT ()</span>.
        </p>
        <div className="code mt-6">
          <pre className="code__pre">
            <span className="code__line">{highlightLines(statement)}</span>
          </pre>
        </div>
        <button type="button" className="btn mt-6" aria-pressed={pinned} onClick={() => setPinned((p) => !p)}>
          {pinned ? 'Release arr[2]' : 'Pin arr[2]'}
        </button>
      </div>
      <figure className="panel m-0 lg:col-span-7">
        <svg viewBox="0 0 480 240" className="h-auto w-full" role="img" aria-label={pinned ? 'The third element lifted up and to the right, out of its row.' : 'Five elements in a row.'}>
          <line x1={40} x2={440} y1={170} y2={170} stroke={C.line} />
          {VALUES.map((v, i) => {
            const isTarget = i === 2;
            const x = 80 + i * 64;
            return (
              <motion.g
                key={v}
                initial={false}
                animate={isTarget && pinned ? { x: x + 120, y: 60 } : { x, y: 130 }}
                transition={spring.lively}
              >
                <rect x={-22} y={0} width={44} height={40} rx={2} fill={isTarget && pinned ? C.cream : C.panelRaised} stroke={C.lineStrong} />
                <text y={25} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={14} fill={isTarget && pinned ? C.ink : C.peach}>
                  {v}
                </text>
              </motion.g>
            );
          })}
          <motion.path
            d="M 208 150 C 230 110, 290 90, 318 92"
            fill="none"
            stroke={C.cream}
            strokeDasharray="3 5"
            initial={false}
            animate={{ pathLength: pinned ? 1 : 0, opacity: pinned ? 0.8 : 0 }}
            transition={spring.gentle}
          />
        </svg>
      </figure>
    </div>
  );
}
