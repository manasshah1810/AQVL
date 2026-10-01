// 0–3s: pattern interrupt. A violent chalk slash, a snapped stick, a scribbled-out diagram, a page tearing.
import React from 'react';
import {PRESETS, spring, clamp, smooth, lerp, rng, pulse} from '../lib/motion';
import {Board, Chalk, Dust, Grain, Vignette, shake, SCRIBBLE, HAND, W, H, type Pt} from '../lib/draw';

export const TREE: {p: Pt; l?: number; r?: number; v: number}[] = [
  {p: [0, 0], l: 1, r: 2, v: 8}, {p: [-190, 150], l: 3, r: 4, v: 3}, {p: [190, 150], l: 5, r: 6, v: 10},
  {p: [-300, 300], v: 1}, {p: [-80, 300], v: 6}, {p: [80, 300], v: 9}, {p: [300, 300], v: 14},
];

/** Chalk binary tree, drawn progressively (p 0..1). */
export const ChalkTree: React.FC<{x: number; y: number; scale?: number; p: number; color?: string; opacity?: number}> = ({x, y, scale = 1, p, color = '#f2f0e6', opacity = 0.9}) => {
  const els: React.ReactNode[] = [];
  TREE.forEach((n, i) => {
    const kids = [n.l, n.r].filter((k) => k !== undefined) as number[];
    kids.forEach((k, j) => {
      const q = clamp((p - 0.1 * i - 0.05 * j) * 3);
      if (q > 0) els.push(<Chalk key={`e${i}-${k}`} pts={[[n.p[0], n.p[1] + 30], [lerp(n.p[0], TREE[k].p[0], 0.5) + 6, lerp(n.p[1] + 30, TREE[k].p[1] - 30, 0.5) - 4], [TREE[k].p[0], TREE[k].p[1] - 30]]} p={q} w={7} color={color} opacity={opacity} />);
    });
    const q = clamp((p - 0.08 * i) * 4);
    if (q > 0) {
      const a: Pt[] = Array.from({length: 24}, (_, s) => [n.p[0] + Math.cos((s / 23) * 6.6 + 0.5) * (34 + s * 0.12), n.p[1] + Math.sin((s / 23) * 6.6 + 0.5) * 34]);
      els.push(<Chalk key={`n${i}`} pts={a} p={q} w={7} color={color} opacity={opacity} />);
      if (q > 0.6) els.push(<text key={`t${i}`} x={n.p[0]} y={n.p[1] + 14} textAnchor="middle" fontFamily={HAND} fontSize={44} fill={color} opacity={opacity * clamp((q - 0.6) * 3)}>{n.v}</text>);
    }
  });
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>{els}</g>;
};

const tearEdge = (p: number): string => {
  // jagged vertical tear line travelling right->left; returns polygon of the part to the LEFT of the line
  const r = rng(77);
  const pts: string[] = ['0,0'];
  const x0 = W * (1 - p);
  for (let y = 0; y <= H; y += 36) pts.push(`${(x0 + (r() - 0.5) * 70).toFixed(1)},${y}`);
  pts.push(`0,${H}`);
  return `polygon(${pts.join(',')})`;
};
const tearEdgeRight = (p: number): string => {
  const r = rng(77);
  const pts: string[] = [];
  const x0 = W * (1 - p);
  for (let y = 0; y <= H; y += 36) pts.push(`${(x0 + (r() - 0.5) * 70).toFixed(1)},${y}`);
  pts.push(`${W + 200},${H}`, `${W + 200},0`);
  return `polygon(${pts.join(',')})`;
};

export const HookContent: React.FC<{t: number}> = ({t}) => {
  const sk = shake(t, [{t: 0, a: 26}, {t: 0.18, a: 20}, {t: 0.32, a: 34}, {t: 0.95, a: 10}, {t: 1.25, a: 12}, {t: 1.85, a: 24}]);
  const punch = 1 + 0.07 * Math.exp(-t / 0.2) + 0.05 * pulse(t - 0.32, 0.02, 0.15);
  const slashP = smooth((t + 0.2) / 0.3);
  const franticP = smooth((t - 0.5) / 1.15);
  const sl = SCRIBBLE.slash, fr = SCRIBBLE.frantic;
  const headIdx = Math.min(sl.length - 1, Math.floor(sl.length * slashP));
  const head = sl[headIdx];
  const fHead = fr[Math.min(fr.length - 1, Math.floor(fr.length * franticP))];
  // snapped stick
  const ang = Math.atan2(sl[sl.length - 1][1] - sl[0][1], sl[sl.length - 1][0] - sl[0][0]);
  const snapT = 0.3;
  const sd = t - snapT;
  const flash = pulse(t + 0.0, 0.02, 0.09) * 0.9 + pulse(t - 0.32, 0.01, 0.07) * 0.7 + pulse(t - 1.85, 0.01, 0.08) * 0.5;
  const treeP = 1; // already on the board
  const qMark = spring(t - 1.9, PRESETS.pop);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#141d1a'}}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${sk.x}px,${sk.y}px) rotate(${sk.r}rad) scale(${punch * 1.18})`, transformOrigin: '50% 50%'}}>
        <Board />
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          <ChalkTree x={760} y={230} scale={1.15} p={treeP} opacity={0.5} color="#dfe9df" />
          <text x={170} y={300} fontFamily={HAND} fontSize={70} fill="#dfe9df" opacity={0.45} transform="rotate(-5 170 300)">O(n log n) ?</text>
          <text x={1330} y={930} fontFamily={HAND} fontSize={64} fill="#dfe9df" opacity={0.4} transform="rotate(3 1330 930)">why does it …</text>
          <Chalk pts={sl} p={slashP} w={30} />
          <Chalk pts={fr} p={franticP} w={13} />
          {/* second pass scribble for density */}
          <Chalk pts={fr.map(([x, y], i) => [x + 22 + (i % 3) * 5, y + (i % 2 ? 14 : -14)] as Pt)} p={clamp(franticP * 1.0 - 0.25)} w={9} opacity={0.7} />
          {qMark > 0.01 && <text x={1580} y={760} fontFamily={HAND} fontWeight={700} fontSize={420 * qMark} fill="#f2f0e6" opacity={0.9} transform="rotate(8 1580 760)" filter="url(#chalk)">?</text>}
          {/* chalk stick */}
          {sd < 0 && slashP > 0.02 && (
            <g transform={`translate(${head[0]} ${head[1]}) rotate(${(ang * 180) / Math.PI + 180})`}><rect x={0} y={-15} width={170} height={30} rx={9} fill="#f6f2e4" /></g>
          )}
          {sd >= 0 && sd < 1.1 && [0, 1].map((i) => {
            const e = sl[sl.length - 1];
            const vx = i ? 520 : -260, vy = i ? -380 : -520;
            const x = e[0] + vx * sd * 0.9, y = e[1] + vy * sd + 1500 * sd * sd * 0.5;
            return <g key={i} transform={`translate(${x} ${y}) rotate(${(i ? 540 : -720) * sd + (i ? 30 : 160)})`} opacity={1 - clamp((sd - 0.8) * 4)}><rect x={-60} y={-14} width={i ? 120 : 70} height={28} rx={8} fill="#f6f2e4" /></g>;
          })}
        </svg>
        <Dust t={t} t0={-0.1} x={sl[Math.floor(sl.length * 0.4)][0]} y={sl[Math.floor(sl.length * 0.4)][1]} n={34} seed={3} speed={620} life={1.3} />
        <Dust t={t} t0={0.02} x={head[0]} y={head[1]} n={22} seed={9} speed={500} life={0.9} />
        <Dust t={t} t0={0.0} x={sl[sl.length - 1][0] - 40} y={sl[sl.length - 1][1] + 20} n={60} seed={5} speed={900} life={1.6} size={11} />
        <Dust t={t} t0={snapT} x={sl[sl.length - 1][0] - 40} y={sl[sl.length - 1][1] + 20} n={50} seed={21} speed={760} life={1.4} />
        {t > 0.5 && <Dust t={t} t0={t - ((t - 0.5) % 0.14)} x={fHead[0]} y={fHead[1]} n={9} seed={Math.floor(t * 20)} speed={260} life={0.6} size={7} />}
        <Dust t={t} t0={1.85} x={1580} y={640} n={44} seed={33} speed={700} life={1.3} />
      </div>
      <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash * 0.55, mixBlendMode: 'screen'}} />
      <Vignette k={0.8} />
      <Grain t={t} amount={0.16} />
    </div>
  );
};

export const Hook: React.FC<{t: number; below?: React.ReactNode}> = ({t, below}) => {
  const tp = clamp((t - 2.35) / 0.55);
  const p = smooth(tp);
  if (t < 2.35) return <HookContent t={t} />;
  const pieceRot = spring(t - 2.35, PRESETS.heavy);
  return (
    <div style={{position: 'absolute', inset: 0, background: '#000', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0}}>{below}</div>
      {/* remaining board */}
      <div style={{position: 'absolute', inset: 0, clipPath: tearEdge(p), transform: `translateX(${-p * 60}px)`}}><HookContent t={t} /></div>
      {/* torn piece */}
      <div style={{position: 'absolute', inset: 0, clipPath: tearEdgeRight(p), transform: `translate(${pieceRot * 520}px, ${pieceRot * 260}px) rotate(${pieceRot * 16}deg)`, transformOrigin: '100% 0%', opacity: 1 - clamp((t - 2.75) * 3)}}>
        <HookContent t={t} />
      </div>
      {/* paper-fibre edge */}
      <div style={{position: 'absolute', top: 0, bottom: 0, left: W * (1 - p) - 30, width: 26, background: 'linear-gradient(90deg, rgba(240,230,205,0), rgba(240,230,205,0.9))', opacity: p < 0.98 ? 0.8 : 0, filter: 'blur(2px)'}} />
    </div>
  );
};
