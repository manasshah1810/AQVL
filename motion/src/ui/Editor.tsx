import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../lib/fonts';
import {clamp, SETTLE, SNAP, spring} from '../lib/motion';
import {PEACH, PURPLE} from '../lib/palette';
import {camAt} from '../film/camera';
import {Hero, HEROES} from '../film/script';
import {T} from '../film/timeline';

const LINE_H = 30;

// Which program is loaded, and which line is executing, at time t.
export const programAt = (t: number): {hero: Hero; index: number} => {
  let index = 0;
  for (let i = 0; i < HEROES.length; i++) if (t >= HEROES[i].t0 - 0.35) index = i;
  return {hero: HEROES[index], index};
};
export const activeLineAt = (hero: Hero, t: number) => {
  if (t < T.fire) return {line: 1, since: -10};
  let line = hero.events[0].line;
  let since = hero.events[0].t;
  for (const e of hero.events) if (t >= e.t) {
    line = e.line;
    since = e.t;
  }
  if (t < hero.events[0].t) return {line: 1, since: hero.t0 - 0.35};
  return {line, since};
};

// Highlight y follows the executing line on a spring.
const highlightY = (hero: Hero, t: number) => {
  const evs = [{t: -1, line: 1}, ...hero.events.map((e) => ({t: Math.max(e.t, T.fire), line: e.line}))];
  let y = (evs[0].line - 1) * LINE_H;
  for (let i = 1; i < evs.length; i++) {
    if (t < evs[i].t) break;
    y += ((evs[i].line - evs[i - 1].line) * LINE_H) * spring(t - evs[i].t, SNAP);
  }
  return y;
};

const kw = /^(SCENE|DECLARE|SEQUENCE|END|WHILE|IF|FUNCTION|RETURN|HEAP|ARRAY|GRAPH|STACK|HIGHLIGHT|COMPARE|INSERT|UPDATE|PUSH|POP|AND|TRUE|FALSE)$/;

const CodeLine: React.FC<{text: string; active: boolean}> = ({text, active}) => {
  const parts = text.split(/(\s+|[()[\],=+\-<>%*/]|'[^']*'|"[^"]*")/).filter((p) => p !== '');
  return (
    <span>
      {parts.map((p, i) => {
        let o = 0.78;
        let w = 400;
        if (kw.test(p)) {
          o = 1;
          w = 600;
        } else if (/^['"]/.test(p) || /^\d+$/.test(p)) o = 0.62;
        else if (/^[()[\],=+\-<>%*/]$/.test(p)) o = 0.5;
        return (
          <span key={i} style={{opacity: active ? 1 : o * 0.72, fontWeight: active ? Math.max(w, 600) : w}}>
            {p}
          </span>
        );
      })}
    </span>
  );
};

export const Editor: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const t = frame / fps;
  const s = width / 1920;
  const show = T.shatter + 0.45;
  const hide = T.tagline - 0.15;
  if (t < show - 0.01 || t > hide + 1) return null;
  const {hero, index} = programAt(t);
  const inS = spring(t - show, SETTLE);
  const outS = spring(t - hide, SNAP);
  const k = camAt(t);
  const rotY = 7 + Math.sin((k.az * Math.PI) / 180) * 3;
  const swapT = index > 0 ? hero.t0 - 0.35 : -10;
  const {line, since} = activeLineAt(hero, t);
  const hy = highlightY(hero, t);
  const fireFlash = clamp(1 - (t - since) / 0.35);
  const opacity = clamp(inS * 1.4) * (1 - clamp(outS));
  return (
    <div
      style={{
        position: 'absolute',
        left: 76 * s,
        top: 196 * s,
        width: 610 * s,
        transformOrigin: 'left center',
        transform: `perspective(${1900 * s}px) rotateY(${rotY}deg) translateY(${(1 - inS) * 40 * s - outS * 20 * s}px) scale(${0.96 + 0.04 * inS})`,
        opacity,
        fontFamily,
      }}
    >
      <div
        style={{
          background: `${PURPLE}38`,
          border: `${Math.max(1, s)}px solid ${PEACH}`,
          borderRadius: 10 * s,
          backdropFilter: `blur(${14 * s}px)`,
          boxShadow: `0 ${30 * s}px ${80 * s}px rgba(5,3,10,0.55), inset 0 0 ${40 * s}px rgba(102,99,121,0.18)`,
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{height: 46 * s, display: 'flex', alignItems: 'center', padding: `0 ${18 * s}px`, gap: 9 * s, borderBottom: `${Math.max(1, s)}px solid ${PEACH}88`}}>
          {[0.9, 0.65, 0.45].map((o, i) => (
            <div key={i} style={{width: 11 * s, height: 11 * s, borderRadius: 99, background: PURPLE, opacity: o}} />
          ))}
          <div style={{marginLeft: 14 * s, color: PEACH, fontSize: 17 * s, letterSpacing: '0.02em', opacity: 0.9}}>
            {HEROES.map((h, i) => {
              const a = clamp(spring(t - (h.t0 - 0.35), SNAP));
              const b = i < HEROES.length - 1 ? clamp(spring(t - (HEROES[i + 1].t0 - 0.35), SNAP)) : 0;
              const vis = i === index;
              return vis ? (
                <span key={i} style={{display: 'inline-block', transform: `translateY(${(1 - (i === 0 ? 1 : a)) * 14 * s - b * 14 * s}px)`, opacity: i === 0 ? 1 : a}}>
                  {h.file}
                </span>
              ) : null;
            })}
          </div>
          <div style={{marginLeft: 'auto', color: PEACH, opacity: 0.55, fontSize: 14 * s, letterSpacing: '0.08em'}}>
            {t < T.fire ? 'READY' : 'RUNNING'}
          </div>
        </div>
        {/* body */}
        <div style={{position: 'relative', padding: `${16 * s}px 0 ${18 * s}px`, height: 16 * LINE_H * s + 34 * s}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (16 + hy) * s,
              height: LINE_H * s,
              background: `${PEACH}${Math.round((0.1 + fireFlash * 0.12) * 255).toString(16).padStart(2, '0')}`,
              borderLeft: `${3 * s}px solid ${PEACH}`,
              opacity: clamp(inS * 2),
            }}
          />
          {hero.code.map((text, i) => {
            const d = i * 0.025;
            const ln = clamp(spring(t - (index === 0 ? show + 0.1 : swapT) - d, SNAP));
            return (
              <div
                key={`${hero.id}${i}`}
                style={{
                  position: 'absolute',
                  top: (16 + i * LINE_H) * s,
                  height: LINE_H * s,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 18 * s,
                  color: PEACH,
                  whiteSpace: 'pre',
                  transform: `translateX(${(1 - ln) * 26 * s}px)`,
                  opacity: ln,
                }}
              >
                <span style={{width: 52 * s, textAlign: 'right', paddingRight: 20 * s, opacity: line === i + 1 ? 0.9 : 0.36, fontSize: 15 * s}}>{i + 1}</span>
                <CodeLine text={text} active={line === i + 1} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
