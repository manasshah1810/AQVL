import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../lib/fonts';
import {clamp, SETTLE, SNAP, spring} from '../lib/motion';
import {PEACH} from '../lib/palette';
import {HEROES} from '../film/script';
import {T} from '../film/timeline';
import {programAt} from './Editor';

// Bottom timeline scrubber: the playhead advances with execution, ticks mark
// the program's events and light as they fire.
export const Scrubber: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const t = frame / fps;
  const s = width / 1920;
  const show = T.shatter + 0.6;
  const hide = T.tagline - 0.15;
  if (t < show - 0.01 || t > hide + 1) return null;
  const {hero, index} = programAt(t);
  const inS = spring(t - show, SETTLE);
  const outS = clamp(spring(t - hide, SNAP));
  const dur = hero.t1 - hero.t0;
  // playhead: springs back to zero when a new program loads
  const raw = t < T.fire ? 0 : clamp((t - hero.t0) / dur);
  let ph = raw;
  if (index > 0) {
    const back = clamp(spring(t - (hero.t0 - 0.35), SNAP));
    ph = t < hero.t0 ? 1 - back : raw;
  }
  const L = 76 * s;
  const R = 76 * s;
  const W = width - L - R;
  const secs = Math.max(0, t < T.fire ? 0 : t - hero.t0);
  const fmt = (x: number) => `00:${x.toFixed(2).padStart(5, '0')}`;
  return (
    <div style={{position: 'absolute', left: L, bottom: 58 * s, width: W, height: 40 * s, opacity: clamp(inS * 1.5) * (1 - outS), fontFamily, color: PEACH}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 20 * s, height: Math.max(1, s), background: PEACH, opacity: 0.32, transformOrigin: 'left', transform: `scaleX(${clamp(inS)})`}} />
      <div style={{position: 'absolute', left: 0, top: 20 * s, height: Math.max(1, s), width: ph * W, background: PEACH}} />
      {hero.events.map((e, i) => {
        const x = ((e.t - hero.t0) / dur) * W;
        const lit = t >= e.t && t >= T.fire;
        const pop = lit ? spring(t - e.t, SNAP) : 0;
        const appear = clamp(spring(t - (index === 0 ? show : hero.t0 - 0.35) - i * 0.012, SNAP));
        return (
          <div
            key={`${hero.id}${i}`}
            style={{
              position: 'absolute',
              left: x,
              top: (20 - 5 - pop * 2) * s,
              width: Math.max(1, s),
              height: (10 + pop * 4) * s,
              background: PEACH,
              opacity: (lit ? 0.95 : 0.35) * appear,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: ph * W - 5 * s,
          top: 15 * s,
          width: 11 * s,
          height: 11 * s,
          borderRadius: 99,
          background: PEACH,
          boxShadow: `0 0 ${12 * s}px ${PEACH}88`,
        }}
      />
      <div style={{position: 'absolute', left: 0, top: -14 * s, fontSize: 14 * s, letterSpacing: '0.06em', opacity: 0.75}}>{fmt(secs)}</div>
      <div style={{position: 'absolute', right: 0, top: -14 * s, fontSize: 14 * s, letterSpacing: '0.06em', opacity: 0.6}}>
        {hero.file} · {index + 1}/{HEROES.length}
      </div>
    </div>
  );
};
