// 8.5–12.5 The wall of syntax; 12.5–15.5 the break (slide shatters, first code block becomes the editor).
import React from 'react';
import {PRESETS, spring, clamp, smooth, lerp, rng, stag, pulse} from '../lib/motion';
import {Paper, Chalk, Vignette, Grain, Dust, shake, W, H, HAND, type Pt} from '../lib/draw';
import {Face, Rows} from './Classroom';
import {MONO, PANEL} from '../lib/hud';
import {HEROES} from '../lib/heroes';

const FILL = [
  'FUNCTION merge(low, mid, high)', '  i = low', '  j = mid + 1', '  k = 0', '  WHILE i <= mid AND j <= high', '    COMPARE arr[i] arr[j]',
  '    IF arr[i] <= arr[j]', '      INSERT temp[k] arr[i]', '      i = i + 1', '    ELSE', '      INSERT temp[k] arr[j]', '      j = j + 1', '    END',
  '    k = k + 1', '  END', '  WHILE i <= mid', '    INSERT temp[k] arr[i]', '    i = i + 1', '    k = k + 1', '  END', '  t = 0', '  WHILE t < k',
  '    UPDATE arr[low + t] temp[t]', '    HIGHLIGHT arr[low + t] \'WINDOW\'', '    t = t + 1', '  END', 'LOOP k FROM 0 TO LENGTH(arrivals) - 1', '  value = arrivals[k]',
  '  INSERT h value', '  siftUp(LENGTH(h) - 1)', '  parent = (child - 1 - (child - 1) % 2) / 2', '  COMPARE h[child] h[parent]', '  IF h[child] < h[parent]',
  '    SWAP h[child] h[parent]', '    child = parent', '  ELSE', '    keepClimbing = 0', 'FUNCTION fib(n)', '  UPDATE calls[0] calls[0] + 1', '  IF n <= 1', '    RETURN n',
  '  RETURN fib(n - 1) + fib(n - 2)', 'p.visited = FALSE', 'p.parent = NULL', 'e = EDGE_AT(town, k)', 'IF a.dist != INFINITY AND a.dist + e.weight < b.dist',
];
const LH = 38, CODE_X = PANEL.x + 62, CODE_Y = PANEL.y + 74;

export const CodeSlide: React.FC<{t: number; t0?: number; reveal?: boolean; hideBlock?: boolean; chroma?: number; blockOnly?: boolean; blockColor?: string}> = ({t, t0 = 0, reveal = true, hideBlock = false, chroma = 0, blockOnly = false, blockColor}) => {
  const lines: React.ReactNode[] = [];
  const block = HEROES[0].code;
  const mk = (txt: string, x: number, y: number, i: number, key: string, col = '#1b2733', op = 1) => {
    const k = reveal ? spring(t - t0 - stag(i, 0.012), PRESETS.heavy) : 1;
    return (
      <div key={key} style={{position: 'absolute', left: x, top: y, height: LH, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 22, whiteSpace: 'pre', color: col, opacity: clamp(k * 1.4) * op, transform: `translateY(${(1 - k) * 46}px)`, textShadow: chroma ? `${chroma}px 0 rgba(255,60,60,0.55), ${-chroma}px 0 rgba(60,200,255,0.55)` : undefined}}>{txt}</div>
    );
  };
  if (!hideBlock) block.forEach((l, i) => lines.push(mk(l, CODE_X, CODE_Y + i * LH, i, 'b' + i, blockColor ?? '#1b2733')));
  if (!blockOnly) {
    for (let i = 0; i < 20; i++) lines.push(mk(FILL[(i + 20) % FILL.length], CODE_X, CODE_Y + (16 + i) * LH, 16 + i, 'c1' + i, '#2d3b4b'));
    for (let i = 0; i < 27; i++) lines.push(mk(FILL[i % FILL.length], 860, 30 + i * LH, 20 + i, 'c2' + i, '#25323f'));
    for (let i = 0; i < 27; i++) lines.push(mk(FILL[(i * 3 + 7) % FILL.length], 1400, 30 + i * LH, 30 + i, 'c3' + i, '#2d3b4b'));
    lines.push(<div key="title" style={{position: 'absolute', left: PANEL.x + 62, top: 70, fontFamily: MONO, fontWeight: 700, fontSize: 40, color: '#111c27', opacity: 0.95}}>Lecture 11 · Algorithms in code</div>);
  }
  return (
    <div style={{position: 'absolute', inset: 0, background: blockOnly ? 'transparent' : 'linear-gradient(160deg,#eef2f5,#d9e0e6)'}}>
      {lines}
    </div>
  );
};

const SlideFrame: React.FC<{t: number; scale: number; children: React.ReactNode; fl?: number; ox?: number; oy?: number}> = ({t, scale, children, fl = 1, ox = 0, oy = 0}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b0f14'}}>
    <div style={{position: 'absolute', inset: 0, transform: `translate(${ox}px,${oy}px) scale(${scale})`, transformOrigin: '30% 40%', filter: `brightness(${0.92 + 0.08 * fl})`}}>{children}</div>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(210,225,255,0.18), rgba(0,0,0,0) 60%)', mixBlendMode: 'screen'}} />
    <Vignette k={0.55} />
  </div>
);

export const WallScene: React.FC<{t: number}> = ({t}) => {
  // t is global seconds in [8.5, 12.5]
  const lt = t - 8.5;
  const sk = shake(t, [{t: 8.5, a: 24}, {t: 9.85, a: 16}, {t: 10.25, a: 18}, {t: 10.6, a: 18}, {t: 11.0, a: 20}, {t: 11.5, a: 14}]);
  const wrap = (c: React.ReactNode, tilt = 0) => (
    <div style={{position: 'absolute', inset: 0, transform: `translate(${sk.x}px,${sk.y}px) rotate(${sk.r + tilt}rad)`}}>{c}<Grain t={t} amount={0.2} /></div>
  );
  const fl = 0.5 + 0.5 * Math.sin(t * 43) * Math.sin(t * 11);
  if (t < 9.85) {
    const k = lt / 1.35;
    return wrap(<SlideFrame t={t} scale={lerp(1.55, 1.2, smooth(k))} fl={fl}><CodeSlide t={t} t0={8.5} /></SlideFrame>);
  }
  if (t < 10.25) { // frozen pen over a notebook
    const q = t - 9.85;
    return wrap(
      <div style={{position: 'absolute', inset: 0, background: '#2a1d14', overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: -80, transform: `rotate(4deg) scale(${1.1 + q * 0.05})`}}>
          <Paper tone="#e9e1cf" />
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {Array.from({length: 18}, (_, i) => <line key={i} x1={0} x2={W} y1={200 + i * 56} y2={200 + i * 56} stroke="#7aa0c8" strokeWidth={2} opacity={0.55} />)}
            <line x1={300} x2={300} y1={0} y2={H} stroke="#d46a6a" strokeWidth={3} opacity={0.6} />
            <text x={340} y={366} fontFamily={HAND} fontSize={62} fill="#243a8c">dist[v] = min( dist[v], …</text>
            <circle cx={1080} cy={372} r={8 + Math.sin(q * 60) * 0.6} fill="#243a8c" opacity={0.8} />
            <g transform={`translate(${1090 + Math.sin(q * 90) * 1.3} ${350 + Math.cos(q * 77) * 1.3}) rotate(-58)`}>
              <rect x={0} y={-11} width={440} height={22} rx={11} fill="#1b2a4a" /><path d="M0 -11 L-42 0 L0 11Z" fill="#c9b79a" />
            </g>
          </svg>
        </div>
        <div style={{position: 'absolute', inset: 0, background: 'rgba(120,150,190,0.14)', mixBlendMode: 'multiply'}} />
        <Vignette k={0.8} />
      </div>, 0.05);
  }
  if (t < 10.6) { // tilted head close-up
    const q = t - 10.25;
    return wrap(
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#1c2733,#0e141b)', overflow: 'hidden'}}>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          <Face x={900 + q * 20} y={560} s={4.4} skin="#d9a982" hair="#2a1d16" shirt="#3d4a63" style={1} t={t} seed={4} mood="worry" light="rgba(170,200,255,0.12)" tilt={-10} />
        </svg>
        <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 90% 10%, rgba(190,215,255,0.28), rgba(0,0,0,0) 55%)', mixBlendMode: 'screen'}} />
        <Vignette k={0.85} />
      </div>, -0.1);
  }
  if (t < 11.0) { // scribbled-out page
    const q = t - 10.6;
    const r = rng(11);
    const strokes: Pt[][] = Array.from({length: 5}, (_, i) => Array.from({length: 14}, (_, j) => [340 + (j % 2 ? 1100 : 0) * 0.9 + (r() - 0.5) * 40, 280 + i * 120 + j * 6 + (r() - 0.5) * 20] as Pt));
    return wrap(
      <div style={{position: 'absolute', inset: 0, background: '#2a1d14', overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: -70, transform: `rotate(-3deg) scale(${1.15 + q * 0.05})`}}>
          <Paper tone="#e9e1cf" />
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {['d[u] + w(u,v) < d[v] ??', 'extract-min …?', 'why is d[v] final', 'heap?  queue?', 'O((V+E) log V) ???'].map((txt, i) => <text key={i} x={340} y={330 + i * 120} fontFamily={HAND} fontSize={66} fill="#243a8c" opacity={0.9}>{txt}</text>)}
            {strokes.map((s, i) => <path key={i} d={'M' + s.slice(0, Math.max(2, Math.floor(s.length * clamp((q - i * 0.04) * 6)))).map((p) => p.join(',')).join(' L')} fill="none" stroke="#1a1a1a" strokeWidth={7} strokeLinecap="round" opacity={0.85} filter="url(#ink)" />)}
          </svg>
        </div>
        <div style={{position: 'absolute', inset: 0, background: 'rgba(120,150,190,0.12)', mixBlendMode: 'multiply'}} />
        <Vignette k={0.8} />
      </div>, 0.04);
  }
  if (t < 11.5) { // question marks over the rows
    return wrap(
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: 0, transform: `scale(${1.06 + (t - 11) * 0.06})`}}><Rows t={t} cold={1} marks t0={11.0} mood="worry" /></div>
        <Vignette k={0.8} />
      </div>, -0.03);
  }
  // final: the wall, pulling back, cracking
  const q = t - 11.5;
  const scale = lerp(1.38, 1.0, smooth(q / 1.0));
  const crackP = (t - 12.12) / 0.34;
  const imp: Pt = [1000, 470];
  const cracks: Pt[][] = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const a = (i / 7) * Math.PI * 2 + 0.3, r = rng(i + 40);
    const pts: Pt[] = [imp];
    for (let s = 1; s <= 7; s++) pts.push([imp[0] + Math.cos(a + (r() - 0.5) * 0.5) * s * 150, imp[1] + Math.sin(a + (r() - 0.5) * 0.5) * s * 130]);
    return pts;
  });
  return wrap(
    <SlideFrame t={t} scale={scale} fl={fl}>
      <CodeSlide t={t} reveal={false} chroma={clamp(q / 1.0) * 3.2} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        {cracks.map((c, i) => {
          const k = clamp(crackP * 1.3 - i * 0.02);
          const n = Math.max(2, Math.floor(c.length * k));
          return crackP > 0 ? <path key={i} d={'M' + c.slice(0, n).map((p) => p.join(',')).join(' L')} stroke="#0a0f14" strokeWidth={4} fill="none" strokeLinejoin="bevel" opacity={0.95} /> : null;
        })}
      </svg>
    </SlideFrame>);
};

// ───────────── The break ─────────────
const mkShards = () => {
  const r = rng(99);
  const cols = 6, rows = 4;
  const gx: number[][] = [], gy: number[][] = [];
  for (let j = 0; j <= rows; j++) { gx.push([]); gy.push([]); for (let i = 0; i <= cols; i++) { const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows; gx[j].push((i / cols) * W + (edgeX ? 0 : (r() - 0.5) * 150)); gy[j].push((j / rows) * H + (edgeY ? 0 : (r() - 0.5) * 110)); } }
  const shards: {poly: Pt[]; c: Pt; seed: number}[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a: Pt = [gx[j][i], gy[j][i]], b: Pt = [gx[j][i + 1], gy[j][i + 1]], c: Pt = [gx[j + 1][i + 1], gy[j + 1][i + 1]], d: Pt = [gx[j + 1][i], gy[j + 1][i]];
    const tris: Pt[][] = r() > 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const t of tris) shards.push({poly: t, c: [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3], seed: shards.length + 1});
  }
  return shards;
};
const SHARDS = mkShards();
export const BREAK_T0 = 12.5;
export const PANEL_T = 13.5;

export const BreakScene: React.FC<{t: number}> = ({t}) => {
  const dt = t - BREAK_T0;
  const imp: Pt = [1000, 470];
  const flash = pulse(dt - 0.02, 0.012, 0.12);
  const sk = shake(t, [{t: BREAK_T0, a: 36}, {t: BREAK_T0 + 0.06, a: 20}]);
  if (dt > 1.6) return null;
  const lt = Math.max(0, dt - 0.02) * 0.62; // slow-mo after impact
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', perspective: 1800, pointerEvents: 'none', transform: `translate(${sk.x}px,${sk.y}px)`}}>
      {SHARDS.map((s, i) => {
        const r = rng(s.seed * 13);
        const dx = s.c[0] - imp[0], dy = s.c[1] - imp[1];
        const d = Math.hypot(dx, dy) + 1;
        const ease = 1 - Math.exp(-lt / 0.55);
        const sp = 900 + r() * 700 + 400000 / (d + 300);
        const px = (dx / d) * sp * ease, py = (dy / d) * sp * ease + 520 * lt * lt;
        const pz = (r() - 0.3) * 900 * ease;
        const rot = (r() - 0.5) * 220 * lt;
        const ax = r() - 0.5, ay = r() - 0.5;
        const fade = 1 - clamp((dt - 0.75) / 0.8);
        const clip = `polygon(${s.poly.map((p) => `${p[0]}px ${p[1]}px`).join(',')})`;
        return (
          <div key={i} style={{position: 'absolute', inset: 0, transformOrigin: `${s.c[0]}px ${s.c[1]}px`, transform: `translate3d(${px}px,${py}px,${pz}px) rotate3d(${ax},${ay},0.4,${rot}deg)`, opacity: fade}}>
            <div style={{position: 'absolute', inset: 0, clipPath: clip, filter: `brightness(${1 + 0.12 * Math.sin(i)})`}}>
              <CodeSlide t={t} reveal={false} hideBlock />
            </div>
          </div>
        );
      })}
      <Dust t={t} t0={BREAK_T0} x={imp[0]} y={imp[1]} n={46} seed={61} speed={1500} life={1.3} size={4.5} color="#c9d6e6" />
      {/* the first code block survives: it is the seed of the editor */}
      {dt < 1.2 && <div style={{position: 'absolute', inset: 0, opacity: 1 - clamp((dt - (PANEL_T + 0.1 - BREAK_T0)) * 4)}}><CodeSlide t={t} reveal={false} blockOnly blockColor={dt < 0.12 ? '#1b2733' : '#dbe9fb'} /></div>}
      <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash * 0.9, mixBlendMode: 'screen'}} />
    </div>
  );
};
void stag;
