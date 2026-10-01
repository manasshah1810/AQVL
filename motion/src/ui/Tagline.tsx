import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../lib/fonts';
import {clamp, SNAP, spring} from '../lib/motion';
import {PEACH} from '../lib/palette';

// Text that snaps in with the same springs as the nodes: per-character
// cascade, slight overshoot, visible settle.
export const SnapText: React.FC<{
  text: string;
  t0: number;
  t1?: number;
  size: number;
  step?: number;
  weight?: number;
  opacity?: number;
  tracking?: string;
}> = ({text, t0, t1, size, step = 0.022, weight = 500, opacity = 1, tracking = '-0.01em'}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const t = frame / fps;
  const s = width / 1920;
  const chars = [...text];
  return (
    <div style={{fontFamily, fontSize: size * s, fontWeight: weight, color: PEACH, letterSpacing: tracking, whiteSpace: 'pre', display: 'flex', opacity}}>
      {chars.map((c, i) => {
        const a = spring(t - t0 - i * step, SNAP);
        const out = t1 !== undefined ? clamp(spring(t - t1 - i * step * 0.5, SNAP)) : 0;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - a) * size * 0.55 * s - out * size * 0.4 * s}px) scale(${0.7 + 0.3 * a})`,
              opacity: clamp(a * 1.6) * (1 - out),
              filter: `blur(${Math.max(0, (1 - clamp(a)) * 6 * s)}px)`,
            }}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
};

export const Tagline: React.FC<{t0: number; t1: number}> = ({t0, t1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  if (t < t0 - 0.05 || t > t1 + 1) return null;
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textShadow: `0 0 28px ${PEACH}55`}}>
      <SnapText text="Write the algorithm." t0={t0} t1={t1} size={68} />
      <SnapText text="Watch it think." t0={t0 + 0.42} t1={t1 + 0.05} size={68} weight={700} />
    </div>
  );
};
