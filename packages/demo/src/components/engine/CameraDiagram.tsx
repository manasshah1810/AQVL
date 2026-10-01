import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { C } from '../../brand/palette';
import { spring, usePrefersReducedMotion } from '../../lib/motion';
import { highlightLines } from '../../lib/aqvlSyntax';

type Mode = 'AUTO_FIT' | 'FOCUS' | 'ORBIT' | 'POSITION';

const MODES: { id: Mode; statement: string; text: string }[] = [
  {
    id: 'AUTO_FIT',
    statement: 'CAMERA AUTO_FIT',
    text: 'The default. The camera follows reactively and keeps the whole scene framed. Write it explicitly to hand control back after a focus or a fixed position.',
  },
  {
    id: 'FOCUS',
    statement: 'CAMERA FOCUS(myTree)',
    text: 'Soft-follows one structure, or one element such as arr[2], instead of the whole scene. The way to direct attention when several structures share a scene.',
  },
  {
    id: 'ORBIT',
    statement: 'CAMERA ORBIT(15)',
    text: 'Rotates continuously around the current target, here at 15 degrees per second. Reactive follow is suspended while orbiting.',
  },
  {
    id: 'POSITION',
    statement: 'CAMERA POSITION(0, 6, 14)',
    text: 'Pins the camera at an absolute world position and turns all automation off, until a later CAMERA statement turns it back on.',
  },
];

// Top-down plan of a scene: an array on the left, a BST on the right.
const ARRAY_X = [70, 98, 126, 154, 182];
const TREE = [
  { x: 350, y: 70 },
  { x: 310, y: 120 },
  { x: 390, y: 120 },
  { x: 290, y: 168 },
  { x: 330, y: 168 },
];
const CENTER = { x: 240, y: 118 };

/** Camera pose per mode: position, heading (deg, 0 = up), and frustum spread. */
const POSE: Record<Mode, { x: number; y: number; rotate: number; spread: number }> = {
  AUTO_FIT: { x: 240, y: 300, rotate: 0, spread: 1 },
  FOCUS: { x: 352, y: 268, rotate: -3, spread: 0.42 },
  ORBIT: { x: 240, y: 290, rotate: 0, spread: 0.86 },
  POSITION: { x: 60, y: 282, rotate: 40, spread: 0.62 },
};

function Frustum({ spread }: { spread: number }) {
  return (
    <motion.g initial={false} animate={{ scaleX: spread }} transition={spring.layout} style={{ originX: '0px', originY: '0px' }}>
      <path d="M 0 0 L -175 -230 L 175 -230 Z" fill={C.cream} opacity={0.07} />
      <path d="M -175 -230 L 0 0 L 175 -230" fill="none" stroke={C.cream} strokeWidth={1.2} strokeDasharray="4 5" />
    </motion.g>
  );
}

export function CameraDiagram() {
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<Mode>('AUTO_FIT');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const pose = POSE[mode];
  const current = MODES.find((m) => m.id === mode)!;

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + MODES.length) % MODES.length;
    setMode(MODES[n].id);
    tabs.current[n]?.focus();
  };

  const orbiting = mode === 'ORBIT' && !reduced;

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <figure className="panel m-0 overflow-hidden lg:col-span-7 lg:order-1">
        <svg viewBox="0 0 480 330" className="h-auto w-full" role="img" aria-label={`Top-down plan of a scene with the camera in ${mode} mode.`}>
          <defs>
            <clipPath id="cam-clip">
              <rect width="480" height="330" />
            </clipPath>
          </defs>
          <g clipPath="url(#cam-clip)">
            {/* scene */}
            {ARRAY_X.map((x) => (
              <rect key={x} x={x - 11} y={107} width={22} height={22} rx={2} fill={C.panelRaised} stroke={mode === 'FOCUS' ? C.line : C.lineStrong} />
            ))}
            <text x={126} y={152} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill={C.peachMuted}>
              nums
            </text>
            {[
              [0, 1],
              [0, 2],
              [1, 3],
              [1, 4],
            ].map(([a, b]) => (
              <line key={`${a}${b}`} x1={TREE[a].x} y1={TREE[a].y} x2={TREE[b].x} y2={TREE[b].y} stroke={C.lineStrong} />
            ))}
            {TREE.map((n, i) => (
              <circle key={i} cx={n.x} cy={n.y} r={11} fill={mode === 'FOCUS' ? C.dusk : C.panelRaised} stroke={C.peach} strokeWidth={mode === 'FOCUS' ? 1.5 : 1} />
            ))}
            <text x={350} y={200} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill={C.peachMuted}>
              myTree
            </text>

            {orbiting && (
              <circle cx={CENTER.x} cy={CENTER.y} r={172} fill="none" stroke={C.line} strokeDasharray="2 6" />
            )}

            {/* camera: an orbit wrapper rotating about the scene centre, then the pose */}
            <motion.g
              style={{ originX: `${CENTER.x}px`, originY: `${CENTER.y}px` }}
              animate={orbiting ? { rotate: [0, 360] } : { rotate: 0 }}
              transition={orbiting ? { duration: 24, ease: 'linear', repeat: Infinity } : spring.gentle}
            >
              <motion.g initial={false} animate={{ x: pose.x, y: pose.y, rotate: pose.rotate }} transition={spring.gentle} style={{ originX: '0px', originY: '0px' }}>
                <Frustum spread={pose.spread} />
                <rect x={-12} y={-6} width={24} height={16} rx={2} fill={C.cream} />
                <path d="M -6 -6 L 0 -14 L 6 -6 Z" fill={C.cream} />
                {mode === 'POSITION' && <circle cx={0} cy={18} r={3} fill={C.cream} />}
              </motion.g>
            </motion.g>
          </g>
        </svg>
      </figure>

      <div className="lg:col-span-5">
        <div role="tablist" aria-label="Camera mode" className="flex flex-wrap gap-1.5">
          {MODES.map((m, i) => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                role="tab"
                id={`cam-tab-${m.id}`}
                aria-selected={on}
                aria-controls="cam-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setMode(m.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={`relative rounded-ctl px-3 py-2 transition-colors duration-300 ${on ? 'text-cream' : 'text-peach hover:text-cream'}`}
              >
                {on && <motion.span layoutId="cam-tab" className="absolute inset-0 rounded-ctl bg-dusk-deep" transition={spring.layout} />}
                <span className="mono relative">{m.id}</span>
              </button>
            );
          })}
        </div>
        <div id="cam-panel" role="tabpanel" aria-labelledby={`cam-tab-${mode}`} className="mt-8">
          <div className="code">
            <pre className="code__pre">
              <span className="code__line">{highlightLines(current.statement)}</span>
            </pre>
          </div>
          <p className="prose mt-6">{current.text}</p>
          <p className="mono muted mt-6">Dragging in the viewport always wins: it cancels automatic follow until a later CAMERA AUTO_FIT.</p>
        </div>
      </div>
    </div>
  );
}
