import React from 'react';
import { rng } from '../../lib/core';

/** chalk + ink texture filters */
export const PaperFilters: React.FC = () => (
  <svg width={0} height={0} style={{ position: 'absolute' }}>
    <defs>
      <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -0.75" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" result="t" />
        <feDisplacementMap in="t" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="9" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>
);

/** a student seen from behind: head + shoulders silhouette, rim-lit from the front */
export const Student: React.FC<{ x: number; y: number; s: number; seed: number; tilt?: number; nod?: number; rim?: string; body?: string }> = ({
  x,
  y,
  s,
  seed,
  tilt = 0,
  nod = 0,
  rim = 'rgba(255,214,160,0.55)',
  body = '#0E0907',
}) => {
  const R = rng(seed);
  const hw = 46 + R() * 12, hh = 56 + R() * 10;
  const sw = 150 + R() * 40;
  const hair = Math.floor(R() * 4);
  const lean = (R() - 0.5) * 10;
  const id = `g${seed}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rim} />
          <stop offset="0.2" stopColor={body} />
          <stop offset="1" stopColor={body} />
        </linearGradient>
      </defs>
      <path
        d={`M${-sw} 260 C${-sw} 120 ${-sw * 0.8} 70 ${-40} 52 L40 52 C${sw * 0.8} 70 ${sw} 120 ${sw} 260 Z`}
        fill={`url(#${id})`}
      />
      <g transform={`rotate(${tilt + lean} 0 40) translate(0 ${nod})`}>
        <rect x={-20} y={0} width={40} height={60} fill={body} />
        <ellipse cx={0} cy={-hh * 0.55} rx={hw} ry={hh} fill={`url(#${id})`} />
        {hair === 0 && <ellipse cx={0} cy={-hh * 1.45} rx={22} ry={18} fill={`url(#${id})`} />}
        {hair === 1 && <path d={`M${-hw} ${-hh * 0.6} Q${-hw - 10} 40 ${-hw + 6} 70 L${hw - 6} 70 Q${hw + 10} 40 ${hw} ${-hh * 0.6} Z`} fill={body} />}
        {hair === 2 && <ellipse cx={0} cy={-hh * 0.75} rx={hw + 6} ry={hh * 0.9} fill={`url(#${id})`} />}
      </g>
    </g>
  );
};

/** fake text lines (texture, not reading material) */
export const TextLines: React.FC<{ x: number; y: number; w: number; lines: number; lh: number; seed: number; color: string; h?: number }> = ({
  x,
  y,
  w,
  lines,
  lh,
  seed,
  color,
  h = 5,
}) => {
  const R = rng(seed);
  const out: React.ReactNode[] = [];
  for (let l = 0; l < lines; l++) {
    let cx = x;
    const end = l % 7 === 6 ? x + w * (0.3 + R() * 0.4) : x + w;
    while (cx < end - 12) {
      const ww = Math.min(end - cx, 14 + R() * 60);
      out.push(<rect key={`${l}-${cx}`} x={cx} y={y + l * lh} width={ww} height={h} rx={h / 2} fill={color} />);
      cx += ww + 7 + R() * 4;
    }
  }
  return <g>{out}</g>;
};
