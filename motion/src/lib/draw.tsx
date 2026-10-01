// Handcrafted 2D toolkit: chalk, paper, dust, shake. Pure functions of time.
import React from 'react';
import {PRESETS, spring, rng, clamp, lerp, pulse} from './motion';

export const HAND = '"Caveat", cursive';
export const SERIF = '"Newsreader", Georgia, serif';
export const W = 1920, H = 1080;

/** Hidden SVG defs, mounted once at the film root. */
export const Defs: React.FC = () => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="10" result="d" />
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="8" result="grit" />
        <feColorMatrix in="grit" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.6 2.15" result="gritA" />
        <feComposite in="d" in2="gritA" operator="in" />
      </filter>
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.5" />
      </filter>
      <filter id="paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" seed="2" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.55 -0.18" />
      </filter>
      <filter id="fibers" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.35" numOctaves="3" seed="11" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 0.9 -0.35" />
      </filter>
      <filter id="boardgrain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" seed="6" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.9  0 0 0 0 1  0 0 0 0 0.95  0 0 0 0.35 -0.1" />
      </filter>
      <filter id="soft"><feGaussianBlur stdDeviation="14" /></filter>
    </defs>
  </svg>
);

/** Horizontal-only blur for whip pans. */
export const HBlur: React.FC<{amount: number; children: React.ReactNode; style?: React.CSSProperties}> = ({amount, children, style}) => {
  const id = 'hb' + Math.round(amount * 10);
  return (
    <div style={{position: 'absolute', inset: 0, filter: amount > 0.5 ? `url(#${id})` : undefined, ...style}}>
      {amount > 0.5 && (
        <svg width={0} height={0} style={{position: 'absolute'}}><defs><filter id={id} x="-20%" y="0" width="140%" height="100%"><feGaussianBlur stdDeviation={`${amount} 0`} /></filter></defs></svg>
      )}
      {children}
    </div>
  );
};

export const shake = (t: number, hits: {t: number; a: number}[]) => {
  let x = 0, y = 0, r = 0;
  for (const h of hits) {
    const d = t - h.t;
    if (d < 0 || d > 0.8) continue;
    const e = Math.exp(-d / 0.11) * h.a;
    x += Math.sin(d * 97 + h.t * 7) * e;
    y += Math.cos(d * 83 + h.t * 3) * e * 0.8;
    r += Math.sin(d * 61 + h.t) * e * 0.0016;
  }
  return {x, y, r};
};

export const Grain: React.FC<{t: number; amount?: number}> = ({t, amount = 0.12}) => (
  <svg width={W} height={H} style={{position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: amount * 4, pointerEvents: 'none'}}>
    <filter id={`g${Math.floor(t * 24) % 6}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={Math.floor(t * 24) % 97} /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width={W} height={H} filter={`url(#g${Math.floor(t * 24) % 6})`} />
  </svg>
);

export const Vignette: React.FC<{k?: number; warm?: number}> = ({k = 0.7, warm = 0}) => (
  <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 80% 75% at 50% 48%, rgba(0,0,0,0) 45%, rgba(8,4,0,${k}) 100%)`, boxShadow: warm ? `inset 0 0 300px rgba(80,35,0,${warm})` : undefined}} />
);

export const Board: React.FC<{dark?: number}> = ({dark = 1}) => (
  <div style={{position: 'absolute', inset: 0, background: `linear-gradient(160deg, #26352f, #1a2622 60%, #141d1a)`, filter: `brightness(${dark})`}}>
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <rect width={W} height={H} filter="url(#boardgrain)" opacity={0.5} />
      {/* eraser ghosts */}
      {[[300, 300, 520, 90, -8], [1000, 620, 700, 120, 5], [1400, 220, 480, 80, -3], [600, 860, 600, 100, 4]].map(([x, y, w, h, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={w} ry={h} fill="#cfe0d6" opacity={0.045} transform={`rotate(${r} ${x} ${y})`} filter="url(#soft)" />
      ))}
    </svg>
  </div>
);

export const Paper: React.FC<{tone?: string}> = ({tone = '#efe6d2'}) => (
  <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 40% 30%, ${tone}, #dccfb4)`}}>
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply'}}>
      <rect width={W} height={H} filter="url(#paper)" opacity={0.7} />
      <rect width={W} height={H} filter="url(#fibers)" opacity={0.35} />
    </svg>
  </div>
);

export type Pt = [number, number];
export const sub = (pts: Pt[], p: number): Pt[] => {
  const n = Math.max(2, Math.floor(pts.length * clamp(p)));
  return pts.slice(0, n);
};
export const polyD = (pts: Pt[]) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');

export const Chalk: React.FC<{pts: Pt[]; p: number; w?: number; color?: string; opacity?: number; dx?: number; dy?: number}> = ({pts, p, w = 10, color = '#f2f0e6', opacity = 0.92, dx = 0, dy = 0}) => {
  if (p <= 0.001) return null;
  const s = sub(pts, p);
  return (
    <g filter="url(#chalk)" opacity={opacity} transform={`translate(${dx} ${dy})`}>
      <path d={polyD(s)} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d={polyD(s)} fill="none" stroke={color} strokeWidth={w * 0.35} strokeLinecap="round" strokeLinejoin="round" transform="translate(3 -2)" opacity={0.7} />
    </g>
  );
};

export const Dust: React.FC<{t: number; t0: number; x: number; y: number; n?: number; seed?: number; speed?: number; life?: number; color?: string; size?: number; spread?: number; dir?: number}> = ({t, t0, x, y, n = 40, seed = 1, speed = 520, life = 1.4, color = '#f2f0e6', size = 9, spread = Math.PI * 2, dir = 0}) => {
  const d = t - t0;
  if (d < 0 || d > life) return null;
  const r = rng(seed);
  const items = [];
  for (let i = 0; i < n; i++) {
    const a = dir + (r() - 0.5) * spread;
    const sp = speed * (0.2 + r() * 0.9);
    const drag = 2.2 + r() * 2;
    const dist = (sp / drag) * (1 - Math.exp(-drag * d));
    const px = x + Math.cos(a) * dist;
    const py = y + Math.sin(a) * dist + 40 * d * d * (0.5 + r());
    const s = size * (0.4 + r() * 1.2) * (1 + d * 1.5);
    const o = (1 - d / life) ** 1.6 * (0.25 + r() * 0.4);
    items.push(<circle key={i} cx={px} cy={py} r={s} fill={color} opacity={o} />);
  }
  return <svg width={W} height={H} style={{position: 'absolute', inset: 0, filter: 'blur(2.5px)', pointerEvents: 'none'}}>{items}</svg>;
};

/** Floating dust motes (projector beams, ambient). Looping, seeded. */
export const Motes: React.FC<{t: number; n?: number; seed?: number; x0?: number; x1?: number; y0?: number; y1?: number; color?: string; op?: number}> = ({t, n = 40, seed = 4, x0 = 0, x1 = W, y0 = 0, y1 = H, color = '#fff6dc', op = 0.5}) => {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const bx = lerp(x0, x1, r()), by = lerp(y0, y1, r()), ph = r() * 6.28, s = 2 + r() * 4.5, sp = 0.15 + r() * 0.4;
    out.push(<circle key={i} cx={bx + Math.sin(t * sp + ph) * 40} cy={by - ((t * 18 * sp + ph * 30) % 120)} r={s} fill={color} opacity={op * (0.3 + 0.7 * Math.abs(Math.sin(t * sp * 2 + ph)))} />);
  }
  return <svg width={W} height={H} style={{position: 'absolute', inset: 0, filter: 'blur(1.5px)'}}>{out}</svg>;
};

export const resample = (pts: Pt[], n: number): Pt[] => {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[len.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1);
    while (j < len.length - 2 && len[j + 1] < d) j++;
    const k = (d - len[j]) / Math.max(1e-6, len[j + 1] - len[j]);
    out.push([lerp(pts[j][0], pts[j + 1][0], k), lerp(pts[j][1], pts[j + 1][1], k)]);
  }
  return out;
};

// ───── The scribble: born in the hook, resolved into the logo at the end ─────
const mkScribble = (): {slash: Pt[]; frantic: Pt[]} => {
  const r = rng(2024);
  const slash: Pt[] = [];
  for (let i = 0; i <= 90; i++) {
    const k = i / 90;
    slash.push([120 + k * 1680 + (r() - 0.5) * 16, 960 - k * 800 + Math.sin(k * 14) * 18 + (r() - 0.5) * 14]);
  }
  const frantic: Pt[] = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const up = i % 2 === 0;
    const cx = 420 + k * 1080 + (r() - 0.5) * 70;
    frantic.push([cx + (r() - 0.5) * 60, up ? 260 + r() * 110 : 800 - r() * 110]);
  }
  return {slash, frantic};
};
export const SCRIBBLE = mkScribble();
void spring; void PRESETS; void pulse;
