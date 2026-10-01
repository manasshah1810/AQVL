// The old way: handcrafted, warm, analog.
import React from 'react';
import {PRESETS, spring, clamp, smooth, lerp, rng, stag, pulse} from '../lib/motion';
import {Board, Paper, Chalk, Motes, Vignette, Grain, Dust, W, H, HAND, SERIF, type Pt} from '../lib/draw';
import {ChalkTree} from './Hook';

export type FaceP = {x: number; y: number; s: number; skin: string; hair: string; shirt: string; style: number; t: number; seed: number; mood?: 'calm' | 'worry' | 'lost' | 'happy'; light?: string; tilt?: number; down?: number};
export const Face: React.FC<FaceP> = ({x, y, s, skin, hair, shirt, style, t, seed, mood = 'calm', light = 'rgba(255,200,130,0.0)', tilt = 0, down = 0}) => {
  const r = rng(seed);
  const ph = r() * 6, bt = 1.2 + r() * 2.5;
  const bob = Math.sin(t * 1.3 + ph) * 3;
  const blink = (t + ph) % bt;
  const lid = blink < 0.14 ? Math.sin((blink / 0.14) * Math.PI) : 0;
  const gx = Math.sin(t * 0.6 + ph) * 2 + (mood === 'lost' ? -5 : 0), gy = -3 + down * 12 + (mood === 'lost' ? -4 : 0);
  const brow = mood === 'worry' ? 8 : mood === 'lost' ? 5 : 0;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s}) rotate(${tilt})`}>
      {/* shoulders */}
      <path d="M-120 140 C-120 60 -70 40 0 40 C70 40 120 60 120 140 L120 220 L-120 220 Z" fill={shirt} />
      <rect x={-22} y={20} width={44} height={46} rx={14} fill={skin} />
      {/* hair back */}
      {style === 1 && <path d="M-72 -10 C-90 -90 -40 -120 0 -118 C50 -120 92 -85 74 -5 C70 40 80 70 60 90 L-60 90 C-82 70 -66 40 -72 -10Z" fill={hair} />}
      {/* head */}
      <ellipse cx={0} cy={-18} rx={62} ry={74} fill={skin} />
      {/* ears */}
      <ellipse cx={-62} cy={-12} rx={10} ry={16} fill={skin} /><ellipse cx={62} cy={-12} rx={10} ry={16} fill={skin} />
      {/* hair front */}
      {style === 0 && <path d="M-66 -34 C-72 -110 -20 -112 4 -108 C54 -112 78 -86 66 -34 C50 -62 20 -70 -4 -62 C-30 -58 -52 -52 -66 -34Z" fill={hair} />}
      {style === 1 && <path d="M-66 -30 C-70 -100 -10 -108 14 -104 C60 -102 74 -70 66 -30 C40 -66 4 -74 -66 -30Z" fill={hair} />}
      {style === 2 && <path d="M-64 -40 C-60 -108 60 -108 64 -40 C44 -70 -44 -70 -64 -40Z" fill={hair} />}
      {/* eyes */}
      {[-24, 24].map((ex, i) => (
        <g key={i}>
          <ellipse cx={ex} cy={-14} rx={9} ry={11 * (1 - lid)} fill="#1b1613" transform={`translate(${gx} ${gy})`} />
          <circle cx={ex + 3 + gx} cy={-18 + gy} r={2.4 * (1 - lid)} fill="#fff" opacity={0.85} />
          <path d={`M${ex - 15} ${-36 + (i ? -brow : brow) * 0.6} L${ex + 15} ${-36 + (i ? brow : -brow) * 0.6}`} stroke={hair} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
        </g>
      ))}
      <path d={mood === 'happy' ? 'M-24 26 Q0 56 24 26' : mood === 'calm' ? 'M-14 34 Q0 38 14 34' : 'M-14 38 Q0 30 14 38'} stroke="#7a3f33" strokeWidth={4} fill="none" strokeLinecap="round" />
      <ellipse cx={0} cy={-18} rx={62} ry={74} fill={light} />
    </g>
  );
};

const SKIN = ['#e8b894', '#c98f68', '#8d5a3c', '#f1c9a5', '#6f4630'];
const HAIR = ['#2a1d16', '#4b2f1c', '#171212', '#7a5230', '#b5793a'];
const SHIRT = ['#566f8c', '#8b5e4b', '#44594a', '#7a6a8f', '#9a7b3d', '#3d4a63'];

export const Rows: React.FC<{t: number; cold?: number; marks?: boolean; t0?: number; mood?: 'calm' | 'worry' | 'lost'}> = ({t, cold = 0, marks = false, t0 = 0, mood = 'calm'}) => {
  const rows = [{y: 470, s: 0.72, n: 6, off: 100}, {y: 640, s: 0.9, n: 5, off: 330}, {y: 860, s: 1.12, n: 4, off: 160}];
  const out: React.ReactNode[] = [];
  let id = 0;
  const flick = 0.5 + 0.5 * Math.sin(t * 31) * Math.sin(t * 7.3);
  rows.forEach((rw, ri) => {
    for (let i = 0; i < rw.n; i++) {
      const k = id++;
      const x = rw.off + i * (1920 / rw.n) * 0.98 + (ri % 2) * 20;
      const light = cold ? `rgba(170,200,255,${0.06 + 0.1 * flick * cold})` : `rgba(255,190,110,${0.08 + 0.04 * flick})`;
      out.push(
        <g key={k}>
          <Face x={x} y={rw.y} s={rw.s} skin={SKIN[k % 5]} hair={HAIR[(k * 3) % 5]} shirt={SHIRT[k % 6]} style={k % 3} t={t} seed={k + 5} mood={mood === 'calm' ? (k % 4 === 0 ? 'lost' : 'calm') : mood} light={light} tilt={mood !== 'calm' ? ((k % 3) - 1) * 6 : 0} down={ri === 2 ? 1 : 0.3} />
          {/* desk + notebook */}
          <g transform={`translate(${x} ${rw.y + 200 * rw.s}) scale(${rw.s})`}>
            <rect x={-150} y={0} width={300} height={34} rx={6} fill="#5b3e29" />
            <path d="M-100 -4 L100 -4 L120 -40 L-120 -40 Z" fill="#efe6d2" />
            <path d="M-90 -14 L90 -14" stroke="#4a6fa5" strokeWidth={3} opacity={0.6} />
          </g>
          {marks && (() => {
            const q = spring(t - t0 - stag(k, 0.07), PRESETS.pop);
            const rot = ((k * 37) % 30) - 15;
            return <text x={x + 40} y={rw.y - 120 * rw.s - 30 * q} fontFamily={HAND} fontWeight={700} fontSize={150 * rw.s * q} fill="#f4efe0" opacity={clamp(q) * 0.92} transform={`rotate(${rot} ${x} ${rw.y})`}>?</text>;
          })()}
        </g>,
      );
    }
  });
  return (
    <div style={{position: 'absolute', inset: 0, background: cold ? 'linear-gradient(180deg,#1b2430,#10161d)' : 'linear-gradient(180deg,#4a3828,#2a1d14)'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 360, background: cold ? 'linear-gradient(180deg,#2b3846,#1a232e)' : 'linear-gradient(180deg,#6b5036,#4a3828)'}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>{out}</svg>
    </div>
  );
};

// ───── S1 chalkboard
export const ShotBoard: React.FC<{t: number}> = ({t}) => {
  const p = clamp(t / 1.15);
  const sc = 1.0 + t * 0.07;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${sc}) translateX(${-t * 20}px)`}}>
        <Board />
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          <text x={150} y={190} fontFamily={HAND} fontWeight={700} fontSize={104} fill="#f2f0e6" opacity={0.9 * clamp(t * 6)} filter="url(#chalk)">Binary Search Tree</text>
          <Chalk pts={[[150, 232], [700, 226], [1000, 238]]} p={clamp((t - 0.15) * 3)} w={7} />
          <ChalkTree x={960} y={400} scale={1.35} p={p} />
        </svg>
        <Dust t={t} t0={0.1} x={960} y={420} n={26} seed={12} speed={160} life={1.4} size={6} />
        <Motes t={t} n={30} seed={2} color="#e8f0e8" op={0.35} />
      </div>
      {/* foreground chalk ledge, out of focus */}
      <div style={{position: 'absolute', left: -50, right: -50, bottom: -30, height: 150, background: 'linear-gradient(180deg,#5b3e29,#2e1d12)', filter: 'blur(5px)', transform: 'rotate(-1deg)'}} />
      <div style={{position: 'absolute', left: 260, bottom: 96, width: 150, height: 26, borderRadius: 9, background: '#f4f0e0', filter: 'blur(4px)', transform: 'rotate(8deg)'}} />
      <div style={{position: 'absolute', left: 1330, bottom: 90, width: 220, height: 56, borderRadius: 10, background: '#7c6a4a', filter: 'blur(5px)'}} />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 15% 0%, rgba(255,214,150,0.22), rgba(255,214,150,0) 55%)', mixBlendMode: 'screen'}} />
      <Vignette k={0.65} warm={0.25} />
    </div>
  );
};

// ───── S2 handout + pen
const LINES = [
  'Definition 4.2. Let G = (V, E) be a directed graph with a weight function w: E → R≥0.',
  'The relaxation of an edge (u, v) replaces d[v] by d[u] + w(u, v) whenever the latter is smaller.',
  'Lemma 4.3. After the i-th extraction, d[u] = δ(s, u) for every u in the set S of finalised vertices.',
  'Proof. By induction on |S|. Suppose, for contradiction, that u is the first vertex added to S',
  'with d[u] ≠ δ(s, u). Let y be the first vertex on a shortest path from s to u not in S …',
  'Hence d[y] = δ(s, y) ≤ δ(s, u) ≤ d[u], and since both y and u were candidates, d[y] = d[u]. ∎',
  'Theorem 4.4. With a binary heap the running time is O((V + E) log V); see Exercise 4.17.',
];
export const ShotHandout: React.FC<{t: number}> = ({t}) => {
  const pen: Pt[] = [];
  const r = rng(5);
  for (let i = 0; i < 40; i++) pen.push([260 + (i % 2 ? 1 : 0) * 520 + (i * 6.4), 598 + Math.sin(i * 1.2) * 4 + (r() - 0.5) * 6] as Pt);
  const lineP = clamp((t - 0.1) / 0.9);
  const idx = Math.min(pen.length - 1, Math.floor(pen.length * lineP));
  const sweep: Pt[] = Array.from({length: 24}, (_, i) => [300 + ((i * 0.5) % 1) * 700 + (i % 2 ? 0 : 0), 0] as Pt);
  void sweep;
  const scratchX = 330 + lineP * 760 + Math.sin(t * 40) * 26;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#2a1d14'}}>
      <div style={{position: 'absolute', inset: -60, transform: `rotate(-3.5deg) scale(${1.12 + t * 0.05}) translateY(${-t * 14}px)`}}>
        <Paper />
        <div style={{position: 'absolute', left: 230, top: 230, width: 1320, fontFamily: SERIF, fontSize: 33, lineHeight: '58px', color: '#3a3128', fontWeight: 400, textAlign: 'justify'}}>
          {LINES.map((l, i) => (<div key={i} style={{opacity: 0.92}}>{i === 1 ? <span>The <span style={{background: 'rgba(255,224,60,0.5)'}}>relaxation of an edge (u, v)</span>{l.slice(31)}</span> : l}</div>))}
        </div>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          <path d={`M${290} ${598} L${290 + lineP * 1000} ${598 + Math.sin(lineP * 20) * 2}`} stroke="#243a8c" strokeWidth={4} fill="none" strokeLinecap="round" filter="url(#ink)" />
          {lineP > 0.05 && <path d={`M${290} ${606} L${290 + lineP * 1000} ${604}`} stroke="#243a8c" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} filter="url(#ink)" />}
          {/* pen */}
          <g transform={`translate(${scratchX} ${600 + Math.sin(t * 53) * 3}) rotate(-62)`}>
            <rect x={0} y={-11} width={420} height={22} rx={11} fill="#1b2a4a" />
            <rect x={0} y={-11} width={420} height={7} rx={3.5} fill="#2e4573" />
            <path d="M0 -11 L-42 0 L0 11Z" fill="#c9b79a" /><path d="M-34 -3 L-46 0 L-34 3Z" fill="#243a8c" />
          </g>
        </svg>
        <div style={{position: 'absolute', right: 0, top: 0, width: 360, height: 360, background: 'radial-gradient(circle at 100% 0%, rgba(0,0,0,0.0), rgba(0,0,0,0.25))'}} />
      </div>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 0%, rgba(255,230,170,0.25), rgba(255,230,170,0) 60%)', mixBlendMode: 'screen'}} />
      <Vignette k={0.6} warm={0.2} />
    </div>
  );
};

// ───── S3 projector slide
export const ShotProjector: React.FC<{t: number}> = ({t}) => {
  const fl = 0.86 + 0.14 * Math.sin(t * 47) * Math.sin(t * 13.1);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#0c0907'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1.06 + t * 0.06})`}}>
        {/* light cone */}
        <div style={{position: 'absolute', left: 560, top: -80, width: 1100, height: 700, clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)', background: `linear-gradient(180deg, rgba(255,240,205,${0.28 * fl}), rgba(255,240,205,0.06))`, filter: 'blur(14px)'}} />
        <div style={{position: 'absolute', left: 380, top: 240, width: 1160, height: 640, background: `rgb(${Math.round(244 * fl)},${Math.round(240 * fl)},${Math.round(226 * fl)})`, transform: 'perspective(1500px) rotateY(-9deg) rotateX(2deg)', boxShadow: '0 0 220px rgba(255,230,170,0.55)', padding: '54px 70px', fontFamily: SERIF, color: '#1c1a17'}}>
          <div style={{fontSize: 62, fontWeight: 700}}>Shortest Paths</div>
          <div style={{fontSize: 36, marginTop: 22, lineHeight: '58px'}}>
            <div>• Single-source, non-negative weights</div>
            <div>• Maintain d[v], relax edges (u, v)</div>
            <div>• Extract-Min from priority queue Q</div>
            <div>• Runtime: O((V + E) log V)</div>
          </div>
          <svg width={330} height={230} style={{position: 'absolute', right: 60, bottom: 40}}>
            {[[40, 60], [160, 30], [290, 80], [90, 180], [230, 190]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={20} fill="none" stroke="#222" strokeWidth={3} />)}
            {[[40, 60, 160, 30], [160, 30, 290, 80], [40, 60, 90, 180], [90, 180, 230, 190], [290, 80, 230, 190], [160, 30, 230, 190]].map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="#222" strokeWidth={3} />)}
          </svg>
        </div>
        <Motes t={t} n={46} seed={8} x0={540} x1={1400} y0={0} y1={800} op={0.55} />
        {/* heads in foreground silhouette */}
        <div style={{position: 'absolute', left: 90, bottom: -180, width: 380, height: 430, borderRadius: '50%', background: '#050403', filter: 'blur(3px)'}} />
        <div style={{position: 'absolute', left: 1500, bottom: -230, width: 420, height: 470, borderRadius: '50%', background: '#050403', filter: 'blur(3px)'}} />
      </div>
      <Vignette k={0.8} />
    </div>
  );
};

// ───── S4 rows of faces
export const ShotRows: React.FC<{t: number}> = ({t}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${-t * 40}px) scale(${1.06 + t * 0.03})`}}><Rows t={t} /></div>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 20%, rgba(255,200,130,0.22), rgba(255,200,130,0) 60%)', mixBlendMode: 'screen'}} />
    <Vignette k={0.7} warm={0.3} />
  </div>
);
void lerp; void smooth; void pulse;
