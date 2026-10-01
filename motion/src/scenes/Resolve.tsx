import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, E, clamp, ip, lerp } from '../lib/core';
import { Grain, Vignette } from '../lib/fx';
import { symbol } from '../lib/brand';
import { SANS } from '../fonts';
import geo from '../../public/brand/geometry.json';

export const RESOLVE_DUR = 180;
const WM = geo.wordmark as { width: number; height: number; A: string; V: string; L: string; q: { ring: string; dot: { cx: number; cy: number; r: number } } };

export const Resolve: React.FC = () => {
  const f = useCurrentFrame();
  // stillness: the mark alone, then it takes its place as the Q of AQVL
  const scaleWM = 1.6; // wordmark height 160px
  const wmW = WM.width * scaleWM, wmH = WM.height * scaleWM;
  const left = 960 - wmW / 2, top = 470 - wmH / 2;
  const qCx = left + (89 + 50) * scaleWM, qCy = top + 50 * scaleWM;
  const move = ip(f, 30, 58, 0, 1, E.inOut);
  const size = lerp(500, 100 * scaleWM, move);
  const cx = lerp(960, qCx, move), cy = lerp(575, qCy, move);
  const S = symbol(cx, cy, size);
  const settle = ip(f, 0, 26, 1.04, 1, E.out);
  const glow = 0.5 + 0.5 * ip(f, 0, 10, 1, 0) + 0.3 * Math.exp(-Math.max(0, f - 58) / 6) * (f > 58 ? 1 : 0);
  const rev = (d: number) => ip(f, 46 + d, 66 + d, 0, 1, E.out);
  const tag = ip(f, 74, 96, 0, 1, E.out);
  return (
    <AbsoluteFill style={{ background: C.void }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 45% 40% at 50% 46%, rgba(40,48,72,0.35), rgba(0,0,0,0) 70%)' }} />
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: 'absolute', inset: 0, transform: `scale(${settle * ip(f, 60, RESOLVE_DUR, 1, 1.025)})`, transformOrigin: '50% 45%' }}>
        <defs>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        {/* glow pass */}
        <g filter="url(#soft)" opacity={0.35 * glow}>
          <path d={S.arcD()} stroke="#F3F1EC" strokeWidth={S.W} fill="none" strokeLinecap="round" />
          <circle cx={S.dot[0]} cy={S.dot[1]} r={S.dotR * 1.4} fill={C.hot} />
        </g>
        <path d={S.arcD()} stroke="#F3F1EC" strokeWidth={S.W} fill="none" strokeLinecap="round" />
        <circle cx={S.dot[0]} cy={S.dot[1]} r={S.dotR} fill={C.hot} />
        {/* the rest of the wordmark, revealed from its own geometry */}
        <g transform={`translate(${left} ${top}) scale(${scaleWM})`} fill="#F3F1EC">
          <g style={{ clipPath: `inset(${(1 - rev(0)) * 100}% 0 0 0)` }}>
            <path d={WM.A} transform={`translate(0 ${(1 - rev(0)) * 30})`} />
          </g>
          <g style={{ clipPath: `inset(0 0 ${(1 - rev(5)) * 100}% 0)` }}>
            <path d={WM.V} transform={`translate(0 ${-(1 - rev(5)) * 30})`} />
          </g>
          <g style={{ clipPath: `inset(0 ${(1 - rev(10)) * 100}% 0 0)` }}>
            <path d={WM.L} transform={`translate(${-(1 - rev(10)) * 30} 0)`} />
          </g>
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 640,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 40,
          letterSpacing: '-0.01em',
          color: 'rgba(243,241,236,0.78)',
          opacity: tag,
          transform: `translateY(${(1 - tag) * 16}px)`,
        }}
      >
        Write the algorithm. <span style={{ color: '#F3F1EC' }}>Watch it think.</span>
      </div>
      <Vignette strength={0.55} />
      <Grain opacity={0.08} blend="screen" />
    </AbsoluteFill>
  );
};
export { clamp };
