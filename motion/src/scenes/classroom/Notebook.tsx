import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, clamp, hash, ip, lerp, noise1 } from '../../lib/core';
import { Pt, Stroke, arrowHead, partial, questionMark, resample, scribble, strokesAt, toD, trim, wobblyCircle, wobblyLine } from '../../lib/draw';
import { Grain, Vignette } from '../../lib/fx';
import { symbol } from '../../lib/brand';
import { HAND } from '../../fonts';
import { PaperFilters } from './shared';

const N: Record<string, Pt> = { A: [600, 600], B: [860, 450], C: [840, 760], D: [1120, 600] };
const EDGES: [string, string, string][] = [
  ['A', 'B', '4'],
  ['A', 'C', '2'],
  ['C', 'B', '1'],
  ['B', 'D', '5'],
  ['C', 'D', '8'],
];
const r0 = 34;
export const COPY: Stroke[] = (() => {
  const s: Stroke[] = [];
  let t = 0;
  const seen = new Set<string>();
  const circ = (k: string, i: number) => {
    if (seen.has(k)) return;
    seen.add(k);
    s.push({ pts: wobblyCircle(N[k][0], N[k][1], r0, 200 + i, 0.1), a: t, b: t + 6 });
    t += 7;
  };
  circ('A', 0);
  EDGES.forEach(([a, b], i) => {
    const [p, q] = trim(N[a], N[b], r0 + 6, r0 + 8);
    s.push({ pts: wobblyLine(p[0], p[1], q[0], q[1], 300 + i, 0.03), a: t, b: t + 4 });
    s.push({ pts: arrowHead(p, q, 16), a: t + 4, b: t + 6 });
    t += 7;
    circ(b, i + 1);
  });
  return s;
})();
export const COPY_END = COPY[COPY.length - 1].b;
const SCRIB = scribble(540, 400, 640, 400, 77, 18);
const QS: [number, number, number, number][] = [
  [1390, 420, 90, 1],
  [1580, 700, 120, 2],
  [330, 880, 110, 3],
  [1300, 880, 150, 4],
  [1660, 300, 140, 5],
  [380, 420, 130, 6],
];
export const BIGQ = questionMark(960, 600, 560, 11);
const QR = resample(BIGQ.pts, 140);

export type NotebookState = {
  copyF?: number;
  hover?: number; // frames hovering (tremble + blot)
  scribble?: number;
  questions?: number; // 0..QS.length
  bigQ?: number;
  orange?: number;
  morph?: number; // ? -> AQVL symbol
  dimOthers?: number;
  cam?: { x: number; y: number; z: number; r?: number };
  pen?: boolean;
};

const Pen: React.FC<{ tip: Pt; lift?: number }> = ({ tip, lift = 0 }) => (
  <g transform={`translate(${tip[0]} ${tip[1]})`}>
    <g transform={`translate(${30 + lift * 30} ${40 + lift * 30}) rotate(-52)`} opacity={0.28} style={{ filter: 'blur(9px)' }}>
      <rect x={0} y={-12} width={560} height={24} rx={12} fill="#000" />
    </g>
    <g transform={`translate(0 ${-lift * 20}) rotate(-52)`}>
      <path d="M0 0 L34 -8 L34 8 Z" fill="#b9b4aa" />
      <rect x={32} y={-10} width={90} height={20} rx={6} fill="#20222a" />
      <rect x={120} y={-12} width={440} height={24} rx={10} fill="#1d2f6e" />
      <rect x={120} y={-12} width={440} height={7} rx={3} fill="#4a63b8" opacity={0.6} />
      <rect x={470} y={-17} width={110} height={8} rx={3} fill="#c9ccd6" />
    </g>
  </g>
);

export const Notebook: React.FC<NotebookState & { dur: number }> = (st) => {
  const f = useCurrentFrame();
  const cam = st.cam ?? { x: 0, y: 0, z: 1 };
  const copyF = st.copyF ?? COPY_END;
  const { paths, tip } = strokesAt(COPY, copyF);
  let penTip: Pt | null = st.pen === false ? null : tip;
  const hov = st.hover ?? 0;
  if (hov > 0 && penTip) penTip = [penTip[0] + noise1(f * 1.7, 3) * 2.5, penTip[1] - 10 + noise1(f * 1.3, 4) * 2.5];
  const qn = st.questions ?? 0;
  const ink = C.pen;
  const morph = st.morph ?? 0;
  const S = symbol(960, 450, 460);
  // morph polyline: ? -> ring arc
  const qPts = QR;
  const mPts: Pt[] = qPts.map((p, i) => {
    const a = lerp(S.a0, S.a1, i / (qPts.length - 1));
    const q = S.at(a);
    const e = clamp(morph * 1.25 - (i / qPts.length) * 0.25);
    const ee = e * e * (3 - 2 * e);
    return [lerp(p[0], q[0], ee), lerp(p[1], q[1], ee)];
  });
  const mDot: Pt = [lerp(BIGQ.dot[0], S.dot[0], morph), lerp(BIGQ.dot[1], S.dot[1], morph)];
  const sw = lerp(15, S.W, morph);
  const dim = st.dimOthers ?? 0;
  // scribble tip
  if ((st.scribble ?? 0) > 0 && (st.scribble ?? 0) < 1) penTip = partial(SCRIB, st.scribble!).tip;
  if (qn > 0 && qn < QS.length) {
    const i = Math.floor(qn);
    const q = QS[i];
    const qm = questionMark(q[0], q[1], q[2], q[3]);
    penTip = partial(qm.pts, (qn - i) * 1.2).tip ?? penTip;
  }
  if ((st.bigQ ?? 0) > 0 && (st.bigQ ?? 0) < 1) penTip = partial(BIGQ.pts, st.bigQ! * 1.15).tip ?? BIGQ.dot;
  return (
    <AbsoluteFill style={{ background: '#2a2018', overflow: 'hidden' }}>
      <PaperFilters />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <AbsoluteFill
          style={{
            transform: `rotateX(10deg) translate(${cam.x}px, ${cam.y}px) scale(${cam.z}) rotate(${cam.r ?? -3}deg)`,
            transformOrigin: '50% 50%',
          }}
        >
          <Img src={staticFile('tex/paper.png')} style={{ position: 'absolute', left: -300, top: -260, width: 2520, height: 1600 }} />
          <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {Array.from({ length: 26 }, (_, i) => (
              <line key={i} x1={-300} x2={2220} y1={-140 + i * 54} y2={-140 + i * 54} stroke="#8FA9C9" strokeWidth={2} opacity={0.5} />
            ))}
            <line x1={250} x2={250} y1={-300} y2={1400} stroke="#D2726A" strokeWidth={2.5} opacity={0.7} />
            <g opacity={1 - dim * 0.85}>
              <g filter="url(#ink)" fill={ink} fontFamily={HAND} fontWeight={500}>
                <text x={300} y={128} fontSize={58}>Lecture 7 — Graphs</text>
                <text x={300} y={236} fontSize={46}>Dijkstra: shortest path from s</text>
                <text x={300} y={290} fontSize={46} opacity={0.9}>dist[s] = 0 · relax (u,v)</text>
              </g>
              <g filter="url(#ink)" stroke={ink} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                {paths.map((p, i) => (
                  <path key={i} d={p.d} />
                ))}
                {(st.scribble ?? 0) > 0 && <path d={partial(SCRIB, st.scribble!).d} strokeWidth={7} />}
                {QS.slice(0, Math.ceil(qn)).map((q, i) => {
                  const qm = questionMark(q[0], q[1], q[2], q[3]);
                  const t = clamp((qn - i) * 1.2);
                  return (
                    <g key={i}>
                      <path d={partial(qm.pts, t).d} strokeWidth={4 + q[2] / 40} />
                      {t >= 1 && <circle cx={qm.dot[0]} cy={qm.dot[1]} r={3 + q[2] / 30} fill={ink} stroke="none" />}
                    </g>
                  );
                })}
              </g>
              <g filter="url(#ink)" fill={ink} fontFamily={HAND} fontWeight={700} fontSize={42} textAnchor="middle">
                {Object.entries(N).map(([k, p], i) => (
                  <text key={k} x={p[0]} y={p[1] + 14} opacity={copyF > i * 14 + 6 ? 1 : 0}>
                    {k}
                  </text>
                ))}
              </g>
            </g>
            {hov > 0 && tip && <circle cx={tip[0]} cy={tip[1]} r={Math.min(16, 2 + hov * 0.5)} fill={ink} filter="url(#ink)" opacity={0.9} />}
            {/* the big question, and its resolution */}
            {(st.bigQ ?? 0) > 0 && (
              <g filter={morph < 1 ? 'url(#ink)' : undefined}>
                <path
                  d={morph > 0 ? toD(mPts) : partial(BIGQ.pts, st.bigQ! * 1.15).d}
                  stroke={morph > 0.98 ? '#15131a' : ink}
                  strokeWidth={sw}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {st.bigQ! * 1.15 >= 1 && (
                  <circle cx={mDot[0]} cy={mDot[1]} r={lerp(15, S.dotR, morph)} fill={(st.orange ?? 0) > 0 ? C.hot : ink} style={{ transform: `scale(${1 + 0.25 * Math.sin(clamp(st.orange ?? 0) * Math.PI)})`, transformOrigin: `${mDot[0]}px ${mDot[1]}px`, transformBox: 'view-box' }} />
                )}
              </g>
            )}
            {penTip && <Pen tip={penTip} lift={hov > 0 ? 0.4 : 0} />}
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 70% at 30% 20%, rgba(255,220,170,0.18), rgba(0,0,0,0) 65%)', mixBlendMode: 'screen' }} />
      <Vignette strength={0.6} color="20,12,6" />
      <Grain opacity={0.2} />
    </AbsoluteFill>
  );
};
