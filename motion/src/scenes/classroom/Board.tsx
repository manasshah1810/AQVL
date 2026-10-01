import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, E, ip, noise1, rng } from '../../lib/core';
import { Pt, Stroke, arrowHead, strokesAt, trim, wobblyCircle, wobblyLine } from '../../lib/draw';
import { Grain, Vignette } from '../../lib/fx';
import { HAND } from '../../fonts';
import { PaperFilters } from './shared';

// Graph on the board. A sits at frame centre so the hook's point match-cuts into the chalk dot.
const N: Record<string, Pt> = { A: [960, 540], B: [1250, 360], C: [1230, 730], D: [1540, 560], E: [690, 770] };
const E_: [string, string, string, Pt][] = [
  ['A', 'B', '4', [1090, 420]],
  ['A', 'C', '2', [1070, 670]],
  ['C', 'B', '1', [1270, 545]],
  ['B', 'D', '5', [1420, 430]],
  ['C', 'D', '8', [1410, 680]],
  ['A', 'E', '3', [800, 625]],
];
const R0 = 44;
const strokes: Stroke[] = (() => {
  const s: Stroke[] = [];
  let t = 3;
  const order = ['A', 'B', 'C', 'D', 'E'];
  const circ = (k: string, i: number) => {
    s.push({ pts: wobblyCircle(N[k][0], N[k][1], R0, 10 + i), a: t, b: t + 5 });
    t += 5;
  };
  circ('A', 0);
  E_.forEach(([a, b], i) => {
    const [p, q] = trim(N[a], N[b], R0 + 6, R0 + 8);
    s.push({ pts: wobblyLine(p[0], p[1], q[0], q[1], 30 + i), a: t, b: t + 3 });
    s.push({ pts: arrowHead(p, q, 20), a: t + 3, b: t + 4 });
    t += 4;
    if (order.includes(b) && !s.some((x) => (x as any).k === b)) {
      const st: any = { pts: wobblyCircle(N[b][0], N[b][1], R0, 50 + i), a: t, b: t + 4 };
      st.k = b;
      s.push(st);
      t += 4;
    }
  });
  return s;
})();
const LAST = strokes[strokes.length - 1].b;

export const Board: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { paths, tip } = strokesAt(strokes, f);
  const labelsT = (k: number) => ip(f, 6 + k * 5, 9 + k * 5, 0, 1);
  // camera: tight on the dot, then pull back to reveal the board (rhyme with the hook)
  const z = ip(f, 0, dur - 4, 2.4, 1.0, E.inOut);
  const hx = noise1(f / 18, 1) * 6, hy = noise1(f / 21, 2) * 5;
  const cx = ip(f, 0, dur, 0, -120, E.inOut);
  // heading writes on late
  const head = ip(f, LAST - 6, dur - 2, 0, 1);
  // chalk tip: follow strokes, then the heading
  const tipPt: Pt | null = f < LAST ? tip : head > 0 && head < 1 ? [250 + head * 640, 205] : null;
  // dust from the tip
  const dust: React.ReactNode[] = [];
  for (let s = Math.max(0, f - 24); s <= f; s++) {
    const tp = s < LAST ? strokesAt(strokes, s).tip : null;
    if (!tp) continue;
    const R = rng(s * 13 + 7);
    for (let k = 0; k < 3; k++) {
      const age = f - s + R() * 0.5;
      const x = tp[0] + (R() - 0.5) * 16 + age * (R() - 0.5) * 2;
      const y = tp[1] + age * age * 0.18 + age * R() * 1.2;
      dust.push(<circle key={`${s}-${k}`} cx={x} cy={y} r={0.8 + R() * 1.6} fill={C.chalk} opacity={Math.max(0, 0.7 - age / 24)} />);
    }
  }
  return (
    <AbsoluteFill style={{ background: '#101511', overflow: 'hidden' }}>
      <PaperFilters />
      <AbsoluteFill style={{ transform: `translate(${hx + cx * (z - 1) * 0}px, ${hy}px) scale(${z})`, transformOrigin: '50% 50%' }}>
        <Img src={staticFile('tex/board.png')} style={{ position: 'absolute', left: -200, top: -120, width: 2320, height: 1450 }} />
        <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          {/* ghost of erased lessons */}
          <g opacity={0.07} stroke={C.chalk} strokeWidth={30} fill="none" filter="url(#chalk)">
            <path d="M200 860 C500 820 700 900 1000 850" />
            <path d="M1300 150 C1500 190 1700 120 1820 170" />
          </g>
          <g filter="url(#chalk)" stroke={C.chalk} strokeWidth={6.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx={960} cy={540} r={8} fill={C.chalk} stroke="none" opacity={ip(f, 0, 1, 0, 1)} />
            {paths.map((p, i) => (
              <path key={i} d={p.d} />
            ))}
          </g>
          <g filter="url(#chalk)" fill={C.chalk} fontFamily={HAND} fontWeight={700}>
            {['B', 'C', 'D', 'E'].map((k, i) => (
              <text key={k} x={N[k][0]} y={N[k][1] + 17} fontSize={50} textAnchor="middle" opacity={ip(f, 12 + i * 6, 14 + i * 6, 0, 1)}>
                {k}
              </text>
            ))}
            {E_.map(([, , w, p], i) => (
              <text key={i} x={p[0]} y={p[1]} fontSize={44} textAnchor="middle" opacity={labelsT(i + 1)}>
                {w}
              </text>
            ))}
            <text x={250} y={230} fontSize={84} style={{ clipPath: `inset(-40px ${100 - head * 100}% -40px 0)` }}>
              Shortest paths
            </text>
            <text x={250} y={330} fontSize={50} opacity={0.85} style={{ clipPath: `inset(-40px ${100 - ip(f, LAST - 6, dur, 0, 1) * 100}% -40px 0)` }}>
              dist[A] = 0, rest = ∞
            </text>
          </g>
          <g filter="url(#chalk)" stroke={C.chalk} strokeWidth={5} fill="none">
            <path d={`M250 252 L${250 + 560 * ip(f, LAST + 2, dur, 0, 1)} 248`} />
          </g>
          {dust}
          {tipPt && (
            <g transform={`translate(${tipPt[0]} ${tipPt[1]}) rotate(-38)`}>
              <ellipse cx={210} cy={60} rx={240} ry={150} fill="#000" opacity={0.28} style={{ filter: 'blur(30px)' }} />
              <rect x={6} y={6} width={92} height={22} rx={10} fill="#000" opacity={0.25} style={{ filter: 'blur(4px)' }} />
              <rect x={0} y={-11} width={92} height={22} rx={9} fill="#F1ECE0" />
              <rect x={0} y={2} width={92} height={9} rx={4} fill="#CFC7B5" />
              <ellipse cx={2} cy={0} rx={4} ry={10} fill="#FFFFFF" />
            </g>
          )}
        </svg>
      </AbsoluteFill>
      {/* window light from upper left */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 70% 80% at 18% 8%, rgba(255,214,160,0.20), rgba(0,0,0,0) 60%)', mixBlendMode: 'screen' }} />
      <Vignette strength={0.7} color="8,6,4" />
      <Grain opacity={0.22} />
    </AbsoluteFill>
  );
};
