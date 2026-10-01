// 38.9–42 understanding lands in the classroom; 42–48.5 the scribble resolves into the AQVL mark.
import React from 'react';
import {PRESETS, spring, clamp, smooth, lerp, stag, pulse} from '../lib/motion';
import {Paper, Chalk, Board, Vignette, Grain, Dust, Motes, resample, SCRIBBLE, HAND, W, H, type Pt} from '../lib/draw';
import {Face} from './Classroom';
import {TREE} from './Hook';
import {SYM, WM, ICE, AMBER, SYM_STROKE, WM_STROKE, symbolInner} from '../lib/brandData.js';
import {MONO, AquaVignette} from '../lib/hud';
import {COL} from '../lib/rig';

export const UNDER_T0 = 38.9;
export const RES_T0 = 42.0;

const inkPath = (a: Pt, b: Pt, wob = 5): string => `M${a[0]},${a[1]} Q${(a[0] + b[0]) / 2 + wob},${(a[1] + b[1]) / 2 - wob} ${b[0]},${b[1]}`;

export const UnderstandScene: React.FC<{t: number}> = ({t}) => {
  const lt = t - UNDER_T0;
  const sc = 1.0 + lt * 0.035;
  const ox = 1010, oy = 330, S = 1.25;
  const nodeP = (i: number) => spring(lt - 0.25 - stag(i, 0.09), PRESETS.pop);
  const edges: [number, number][] = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  const path = [0, 2, 5]; // BST search for 9: 8 -> 10 -> 9
  const glowT = 1.25;
  const glow = spring(lt - glowT, PRESETS.float);
  const ring = lt - (glowT + 0.5);
  const wash = clamp(spring(lt - 0.7, PRESETS.float));
  const flash = pulse(lt - 0.0, 0.03, 0.35) * 0.9;
  const fadeOut = clamp((lt - 2.6) / 0.45);
  const P = (i: number): Pt => [ox + TREE[i].p[0] * S, oy + TREE[i].p[1] * S];
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#1b120b'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${sc})`, transformOrigin: '60% 50%'}}>
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#5a4430,#2a1d14)'}} />
        <div style={{position: 'absolute', left: 430, top: -60, width: 1620, height: 1240, transform: 'rotate(-3deg)'}}>
          <Paper tone="#f1e9d6" />
        </div>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, transform: 'rotate(-3deg) translate(0px, 30px)', transformOrigin: '1000px 500px'}}>
          {Array.from({length: 16}, (_, i) => <line key={i} x1={470} x2={1900} y1={120 + i * 62} y2={120 + i * 62} stroke="#7aa0c8" strokeWidth={2} opacity={0.4} />)}
          {edges.map(([a, b], i) => {
            const k = clamp(spring(lt - 0.45 - stag(i, 0.1), PRESETS.snap), 0, 1);
            const on = path.includes(a) && path.includes(b);
            const pa = P(a), pb = P(b);
            const sx = lerp(pa[0], pb[0], 0), ex = lerp(pa[0], pb[0], k), ey = lerp(pa[1], pb[1], k);
            return (
              <g key={i}>
                <path d={inkPath([sx, pa[1]], [ex, ey], 2)} stroke="#1f2f7a" strokeWidth={6} fill="none" strokeLinecap="round" filter="url(#ink)" />
                {on && glow > 0.01 && <path d={inkPath([pa[0], pa[1]], [pb[0], pb[1]], 2)} stroke={COL.amber} strokeWidth={10} fill="none" strokeLinecap="round" opacity={glow * 0.95} style={{filter: 'drop-shadow(0 0 14px rgba(255,176,46,0.95))'}} />}
              </g>
            );
          })}
          {TREE.map((n, i) => {
            const q = nodeP(i);
            const p = P(i);
            const on = path.includes(i);
            const g = on ? glow * clamp((glow * 3 - path.indexOf(i) * 0.6)) : 0;
            return (
              <g key={i} transform={`translate(${p[0]} ${p[1]}) scale(${q})`}>
                <circle r={46} fill={on && g > 0.05 ? `rgba(92,242,200,${0.25 * g})` : 'rgba(255,255,255,0.0)'} stroke={on && g > 0.4 ? COL.mint : '#1f2f7a'} strokeWidth={6} filter="url(#ink)" style={on && g > 0.2 ? {filter: `drop-shadow(0 0 ${18 * g}px rgba(92,242,200,0.9))`} : undefined} />
                <text y={16} textAnchor="middle" fontFamily={HAND} fontWeight={700} fontSize={54} fill="#1f2f7a">{n.v}</text>
              </g>
            );
          })}
          {ring > 0 && <circle cx={P(5)[0]} cy={P(5)[1]} r={46 + ring * 700} fill="none" stroke="rgba(255,225,160,0.75)" strokeWidth={Math.max(1, 14 * (1 - ring))} opacity={clamp(1 - ring * 1.1)} />}
        </svg>
      </div>
      {/* student, lit by the glow */}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <Face x={270} y={800 + Math.sin(t * 1.2) * 2} s={3.1} skin="#d9a982" hair="#2a1d16" shirt="#44594a" style={0} t={t} seed={4} mood={lt > 1.1 ? 'happy' : 'calm'} light={`rgba(150,220,255,${0.22 * wash})`} tilt={6} down={0.2} />
      </svg>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 55% at 62% 48%, rgba(120,210,255,${0.22 * wash}), rgba(255,176,46,${0.12 * wash}) 40%, rgba(0,0,0,0) 72%)`, mixBlendMode: 'screen'}} />
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 30% 40% at 12% 62%, rgba(110,200,255,${0.38 * wash}), rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen'}} />
      <Motes t={t} n={26} seed={31} color="#bfe6ff" op={0.4 * wash} />
      <Vignette k={0.6} warm={0.15} />
      <div style={{position: 'absolute', inset: 0, background: '#fff3d8', opacity: flash, mixBlendMode: 'screen'}} />
      <div style={{position: 'absolute', inset: 0, background: '#0a0f16', opacity: fadeOut}} />
      <Grain t={t} amount={0.1} />
    </div>
  );
};

// ───── Resolve
const S = 3.1, X0 = (W - 350 * S) / 2, Y0 = 318;
const toSym = (p: Pt): Pt => [(p[0] - X0) / S, (p[1] - Y0) / S];
const NPTS = 140;
const LAMBDA: Pt[] = [[14, 70], [50, 16], [86, 70]];
const VEE: Pt[] = [[14, 30], [50, 84], [86, 30]];
const SRC_A = resample(SCRIBBLE.slash, NPTS).map(toSym);
const SRC_B = resample(SCRIBBLE.frantic, NPTS).map(toSym);
const TGT_A = resample(LAMBDA, NPTS);
const TGT_B = resample(VEE, NPTS);

export const ResolveScene: React.FC<{t: number}> = ({t}) => {
  const lt = t - RES_T0;
  const tIn = 0.55, tm = 1.45, tLens = tm + 1.45, tWm = tLens + 0.35, tTag = tWm + 1.35;
  const drawP = smooth((lt - tIn) / 0.32);
  const morph = (i: number, n: number) => spring(lt - tm - (i / n) * 0.55, PRESETS.settle);
  const clean = smooth((lt - tm - 0.35) / 0.6);
  const mk = (src: Pt[], tgt: Pt[], clip: string, key: string) => {
    const pts: Pt[] = src.map((s, i) => {
      const k = morph(i, src.length);
      return [lerp(s[0], tgt[i][0], k), lerp(s[1], tgt[i][1], k)];
    });
    const n = Math.max(2, Math.floor(pts.length * clamp(drawP)));
    const d = 'M' + pts.slice(0, n).map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L');
    const w = lerp(key === 'a' ? 30 / S : 13 / S, SYM_STROKE, clean);
    return (
      <g key={key} clipPath={`url(#${clip})`}>
        <g opacity={1 - clean} filter="url(#chalk)"><path d={d} fill="none" stroke="#f2f0e6" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" /></g>
        <path d={d} fill="none" stroke={ICE} strokeWidth={w} strokeLinejoin="miter" opacity={clean} />
      </g>
    );
  };
  const exact = clamp((lt - (tm + 1.55)) * 8);
  const lens = spring(lt - tLens, PRESETS.pop);
  const boom = pulse(lt - tLens, 0.04, 0.5);
  const bg = smooth((lt - tm + 0.1) / 1.4); // chalkboard -> AQVL slate
  const sweep = clamp((lt - (tLens + 0.05)) / 0.7);
  // wordmark
  const letters = Object.keys(WM) as (keyof typeof WM)[];
  const wm = (L: keyof typeof WM, li: number) => {
    const k = clamp(spring(lt - tWm - li * 0.13, PRESETS.snap), 0, 1.02);
    const def = WM[L] as {x: number; circle?: number[]; paths: number[][][]};
    return (
      <g key={L} transform={`translate(${def.x},0)`} style={{opacity: clamp(k * 4)}}>
        {def.circle && <circle cx={def.circle[0]} cy={def.circle[1]} r={def.circle[2]} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.min(1, k)} />}
        {def.paths.map((p, i) => <polyline key={i} points={p.map((q) => q.join(',')).join(' ')} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.min(1, k * (i ? 1.0 : 1))} />)}
      </g>
    );
  };
  const tag = 'Algorithms, made visible.';
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: COL.fog}}>
      <div style={{position: 'absolute', inset: 0, opacity: 1 - bg}}><Board dark={0.62} /></div>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, #14202f, ${COL.fog})`, opacity: bg}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <defs>
          <clipPath id="rcl"><rect x={-50} y={-50} width={200} height={120} /></clipPath>
          <clipPath id="rcv"><rect x={-50} y={30} width={200} height={120} /></clipPath>
          <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.0" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <mask id="sweepMask"><rect x={-60 + sweep * 220} y={-20} width={50} height={140} fill="url(#rim)" transform="skewX(-20)" /></mask>
        </defs>
        <g style={{filter: exact > 0.5 ? `drop-shadow(0 0 ${22 * Math.min(1, lens)}px rgba(110,180,255,0.35))` : undefined}} transform={`translate(${X0} ${Y0}) scale(${S})`}>
          {/* morphing strokes */}
          <g opacity={1 - exact}>{mk(SRC_A, TGT_A, 'rcl', 'a')}{mk(SRC_B, TGT_B, 'rcv', 'b')}</g>
          <g opacity={exact} fill="none" stroke={ICE} strokeWidth={SYM_STROKE} strokeLinejoin="miter" strokeMiterlimit={10}>
            <polyline clipPath="url(#rcl)" points={SYM.lambda.map((q: number[]) => q.join(',')).join(' ')} />
            <polyline clipPath="url(#rcv)" points={SYM.vee.map((q: number[]) => q.join(',')).join(' ')} />
          </g>
          {/* lens: the light that was hidden in the mess */}
          <g transform={`translate(50 50) scale(${lens}) translate(-50 -50)`} opacity={clamp(lens * 2)} style={{filter: `drop-shadow(0 0 ${14 + boom * 30}px rgba(255,176,46,${0.55 + boom * 0.4}))`}}>
            <polygon points={SYM.lens.map((q: number[]) => q.join(',')).join(' ')} fill={AMBER} />
          </g>
          <g mask="url(#sweepMask)" opacity={sweep > 0 && sweep < 1 ? 0.8 : 0}>
            <polyline points={LAMBDA.map((q) => q.join(',')).join(' ')} clipPath="url(#rcl)" fill="none" stroke="#fff" strokeWidth={SYM_STROKE} />
            <polyline points={VEE.map((q) => q.join(',')).join(' ')} clipPath="url(#rcv)" fill="none" stroke="#fff" strokeWidth={SYM_STROKE} />
          </g>
        </g>
        {/* wordmark */}
        <g transform={`translate(${X0 + 124 * S} ${Y0 + 23 * S}) scale(${1.12 * S})`} fill="none" stroke={ICE} strokeWidth={WM_STROKE} strokeLinejoin="miter" strokeMiterlimit={10} style={{filter: 'drop-shadow(0 0 16px rgba(110,180,255,0.35))'}}>
          {letters.map((L, i) => wm(L, i))}
        </g>
      </svg>
      {/* dust as the strokes hit */}
      <Dust t={t} t0={RES_T0 + tIn} x={1000} y={520} n={30} seed={77} speed={420} life={1.2} size={7} />
      {/* tagline */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 772, display: 'flex', justifyContent: 'center', fontFamily: MONO, fontSize: 44, fontWeight: 500, color: '#a9bcd6', letterSpacing: 1.5}}>
        {[...tag].map((c, i) => {
          const k = spring(lt - tTag - stag(i, 0.03), PRESETS.snap);
          return <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', opacity: clamp(k * 1.6), transform: `translateY(${(1 - k) * 28}px)`, filter: `blur(${(1 - clamp(k)) * 5}px)`}}>{c}</span>;
        })}
      </div>
      <AquaVignette lift={bg} />
      <Grain t={t} amount={0.09} />
    </div>
  );
};
void symbolInner;
