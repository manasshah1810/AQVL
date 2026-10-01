// Editor frame (header, line numbers, active line, scrubber) + overlays driven by the 3D scene.
import React from 'react';
import {PRESETS, spring, stag, clamp, pulse, lerp} from './motion';
import {HEROES, BREADTH_START, WORLD_START} from './heroes';
import {COL} from './rig';

export const MONO = '"JetBrains Mono", monospace';
const KW = /\b(SCENE|DECLARE|SEQUENCE|FUNCTION|WHILE|LOOP|FROM|TO|IF|ELSE|END|RETURN|GRAPH|HEAP|ARRAY|INSERT|SWAP|COMPARE|UPDATE)\b/g;

const tokenize = (s: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  const re = /("[^"]*")|(\b\d+\b)|(\/\/.*$)|\b(SCENE|DECLARE|SEQUENCE|FUNCTION|WHILE|LOOP|FROM|TO|IF|ELSE|END|RETURN|GRAPH|HEAP|ARRAY|INSERT|SWAP|COMPARE|UPDATE|TRUE|FALSE)\b|([A-Z_]{3,}(?=\())/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  void KW;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(<span key={i++} style={{color: '#d3e0f2'}}>{s.slice(last, m.index)}</span>);
    const color = m[1] ? '#7fe8c8' : m[2] ? '#ffb02e' : m[3] ? '#5a6b82' : m[4] ? '#8cc4ff' : '#c8a6ff';
    out.push(<span key={i++} style={{color, fontWeight: m[4] ? 700 : 400}}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(<span key={i++} style={{color: '#d3e0f2'}}>{s.slice(last)}</span>);
  return out;
};

const LINE_H = 38;
/** Highlight position in (fractional) line units: every change springs, so the bar snaps and settles. */
export const animLine = (sched: [number, number][], t: number) => {
  let y = sched[0][1];
  for (let i = 1; i < sched.length; i++) {
    const [ts, ln] = sched[i];
    if (t < ts - 0.5) break;
    y += (ln - sched[i - 1][1]) * spring(t - ts, PRESETS.snap);
  }
  return y;
};

export const PANEL = {x: 90, y: 150, w: 660};

const CodeBody: React.FC<{k: number; t: number; tIn: number; tOut: number | null; lit: boolean}> = ({k, t, tIn, tOut, lit}) => {
  const h = HEROES[k];
  const lines = h.code;
  const ay = animLine(h.lines, t - h.t0);
  const bodyVis = (i: number) => {
    const vin = spring(t - (tIn + stag(i, 0.035)), PRESETS.settle);
    const vout = tOut === null ? 0 : spring(t - (tOut + stag(i, 0.02)), PRESETS.snap);
    return clamp(vin) * (1 - clamp(vout));
  };
  if (t < tIn - 0.01 || (tOut !== null && t > tOut + 0.9)) return null;
  const tl = t - h.t0;
  return (
    <div style={{position: 'absolute', left: 0, top: 74, width: '100%'}}>
      {lit && (
        <div style={{position: 'absolute', left: 14, right: 14, top: ay * LINE_H, height: LINE_H, borderRadius: 8, background: 'linear-gradient(90deg, rgba(255,176,46,0.20), rgba(255,176,46,0.05))', borderLeft: `3px solid ${COL.amber}`, boxShadow: '0 0 28px rgba(255,176,46,0.18)', opacity: bodyVis(0)}} />
      )}
      {lines.map((ln, i) => {
        const v = bodyVis(i);
        const isActive = Math.abs(i - ay) < 0.5 && lit;
        const dx = (1 - v) * 26;
        return (
          <div key={i} style={{position: 'absolute', top: i * LINE_H, height: LINE_H, left: 0, right: 0, display: 'flex', alignItems: 'center', opacity: v, transform: `translateX(${dx}px)`, fontFamily: MONO, fontSize: 22, whiteSpace: 'pre'}}>
            <span style={{width: 62, textAlign: 'right', paddingRight: 22, color: isActive ? COL.amber : '#4a5c76', fontWeight: isActive ? 700 : 400}}>{i + 1}</span>
            <span>{tokenize(ln)}</span>
          </div>
        );
      })}
      {void tl}
    </div>
  );
};

export type PanelProps = {t: number; panelT: number; out?: number; lit?: boolean; firstOnly?: boolean};
/** The glass editor window. panelT = time the frame springs in. out = time it leaves (breadth). */
export const EditorPanel: React.FC<PanelProps> = ({t, panelT, out, lit = true}) => {
  const a = spring(t - panelT, PRESETS.settle);
  const leave = out === undefined ? 0 : spring(t - out, PRESETS.heavy);
  const op = clamp(a * 1.4) * (1 - clamp(leave * 1.1));
  if (op <= 0.001) return null;
  const hIdx = HEROES.reduce((acc, h, i) => (t >= h.t0 - 0.5 ? i : acc), 0);
  const H = 74 + 16 * LINE_H + 28;
  return (
    <div style={{position: 'absolute', left: PANEL.x - leave * 640, top: PANEL.y + (1 - a) * 30, width: PANEL.w, height: H, opacity: op, transform: `scale(${0.96 + 0.04 * a})`, transformOrigin: '0 50%', borderRadius: 16,
      background: 'linear-gradient(180deg, rgba(14,22,36,0.80), rgba(9,15,26,0.86))', border: '1px solid rgba(150,195,255,0.16)', boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 60px rgba(70,140,255,0.06)', backdropFilter: 'blur(14px)', overflow: 'hidden'}}>
      {/* header */}
      <div style={{height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(150,195,255,0.08)'}}>
        {[0, 1, 2].map((i) => (<div key={i} style={{width: 12, height: 12, borderRadius: 6, background: '#33425a', marginRight: 9, transform: `scale(${spring(t - panelT - 0.1 - stag(i, 0.07), PRESETS.pop)})`}} />))}
        <div style={{flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 17, color: '#7d90ab', letterSpacing: 0.4, marginRight: 60}}>
          {HEROES[hIdx].file}
        </div>
      </div>
      {HEROES.map((h, k) => (
        <CodeBody key={h.id} k={k} t={t} tIn={k === 0 ? panelT + 0.15 : h.t0 - 0.55} tOut={k < HEROES.length - 1 ? HEROES[k + 1].t0 - 0.55 : null} lit={lit} />
      ))}
    </div>
  );
};

/** One continuous playback bar for the four runs. */
export const Scrubber: React.FC<{t: number; panelT: number}> = ({t, panelT}) => {
  const x0 = 90, x1 = 1830, y = 1004;
  const T0 = WORLD_START, T1 = BREADTH_START;
  const appear = spring(t - panelT - 0.2, PRESETS.settle);
  const fade = 1 - clamp((t - T1 - 0.3) * 1.2);
  const op = clamp(appear) * fade;
  if (op <= 0.001) return null;
  const w = (x1 - x0) * clamp(appear, 0, 1.02);
  const prog = clamp((t - T0) / (T1 - T0));
  const px = x0 + (x1 - x0) * prog;
  const gap = 10;
  const total = HEROES.reduce((s, h) => s + h.dur, 0);
  let acc = 0;
  const secs = Math.max(0, t - T0);
  const mm = `0:${String(Math.floor(secs)).padStart(2, '0')}`;
  void total;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: op, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: x0, top: y - 40, fontFamily: MONO, fontSize: 17, color: '#8aa0bd', letterSpacing: 1}}>
        <span style={{color: COL.amber, marginRight: 12}}>{t >= T0 ? '▶' : '❚❚'}</span>{mm}
      </div>
      <div style={{position: 'absolute', left: x0, top: y, width: w, height: 6}}>
        {HEROES.map((h, i) => {
          const segStart = i === 0 ? 0 : HEROES[i].t0 - T0, segEnd = (i === HEROES.length - 1 ? T1 : HEROES[i + 1].t0) - T0;
          const sx = ((segStart) / (T1 - T0)) * (x1 - x0) + (i === 0 ? 0 : gap / 2);
          const sw = ((segEnd - segStart) / (T1 - T0)) * (x1 - x0) - (i === 0 || i === HEROES.length - 1 ? gap / 2 : gap);
          acc += h.dur;
          const localP = clamp((px - x0 - sx) / sw);
          return (
            <div key={h.id} style={{position: 'absolute', left: sx, width: sw, top: 0, height: 6, borderRadius: 3, background: 'rgba(160,200,255,0.14)', overflow: 'hidden'}}>
              <div style={{width: `${localP * 100}%`, height: '100%', background: `linear-gradient(90deg, #ff9a1f, ${COL.amber})`, boxShadow: '0 0 12px rgba(255,176,46,0.7)'}} />
              {h.ticks.map((tk, j) => {
                const tx = (tk / (segEnd - segStart)) * sw;
                const passed = t - T0 >= segStart + tk;
                return <div key={j} style={{position: 'absolute', left: tx - 1, top: 0, width: 2, height: 6, background: passed ? '#2a1c00' : 'rgba(200,225,255,0.55)'}} />;
              })}
            </div>
          );
        })}
        <div style={{position: 'absolute', left: px - x0 - 9, top: -6, width: 18, height: 18, borderRadius: 9, background: '#fff6e0', boxShadow: `0 0 0 4px rgba(255,176,46,0.35), 0 0 22px ${COL.amber}`}} />
      </div>
    </div>
  );
};

export type Proj = (p: [number, number, number]) => {x: number; y: number; depth: number; visible: boolean};

export const Labels: React.FC<{items: {id: string; p: [number, number, number]; text: string; size: number; color: string; opacity?: number; weight?: number}[]; proj: Proj}> = ({items, proj}) => (
  <>
    {items.map((l) => {
      const q = proj(l.p);
      if (!q.visible) return null;
      const fs = clamp(l.size * (16 / q.depth), 5, 60);
      const fog = 1 - clamp((q.depth - 22) / 26);
      const op = (l.opacity ?? 1) * fog;
      if (op < 0.02) return null;
      return (
        <div key={l.id} style={{position: 'absolute', left: q.x, top: q.y, transform: 'translate(-50%,-50%)', fontFamily: MONO, fontWeight: l.weight ?? 500, fontSize: fs, color: l.color, opacity: op, textShadow: '0 0 14px rgba(0,0,0,0.65)', whiteSpace: 'nowrap', letterSpacing: -0.3}}>
          {l.text}
        </div>
      );
    })}
  </>
);

/** Localized light burst on a key action. */
export const Burst: React.FC<{x: number; y: number; k: number; size?: number}> = ({x, y, k, size = 520}) => {
  if (k < 0.01) return null;
  return (
    <div style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, opacity: clamp(k), mixBlendMode: 'screen', pointerEvents: 'none',
      background: 'radial-gradient(circle, rgba(255,246,225,0.95) 0%, rgba(255,190,90,0.55) 12%, rgba(255,150,40,0.20) 35%, rgba(255,140,40,0) 65%)', transform: `scale(${0.55 + k * 0.6})`}} />
  );
};

/** Depth-of-field rack: soft blur everywhere except the focus point. */
export const Focus: React.FC<{x: number; y: number; amount: number; r?: number}> = ({x, y, amount, r = 340}) => (
  <div style={{position: 'absolute', inset: 0, backdropFilter: `blur(${2 + amount * 6}px)`, WebkitBackdropFilter: `blur(${2 + amount * 6}px)`,
    maskImage: `radial-gradient(circle at ${x}px ${y}px, transparent ${r * (1 - amount * 0.25)}px, black ${r * 2.3}px)`,
    WebkitMaskImage: `radial-gradient(circle at ${x}px ${y}px, transparent ${r * (1 - amount * 0.25)}px, black ${r * 2.3}px)`, pointerEvents: 'none'}} />
);

export const AquaVignette: React.FC<{lift?: number}> = ({lift = 1}) => (
  <>
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 55% at 62% 46%, rgba(70,120,190,${0.16 * lift}), rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen', pointerEvents: 'none'}} />
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 85% 80% at 50% 50%, rgba(0,0,0,0) 55%, rgba(2,5,10,0.62) 100%)', pointerEvents: 'none'}} />
  </>
);
void lerp; void pulse;
