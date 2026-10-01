import React from 'react';
import { E, clamp, ip } from './core';
import { MONO, SANS } from '../fonts';

/** words rise out of a mask, staggered; exit lifts them away */
export const Words: React.FC<{ text: string; f: number; at: number; out?: number; x: number; y: number; size: number; align?: 'left' | 'center'; color?: string; weight?: number; stagger?: number }> = ({
  text,
  f,
  at,
  out = 1e9,
  x,
  y,
  size,
  align = 'left',
  color = '#F3F1EC',
  weight = 600,
  stagger = 3,
}) => {
  const words = text.split(' ');
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'center' ? 0 : x,
        right: align === 'center' ? 0 : undefined,
        top: y,
        display: 'flex',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: size * 0.26,
        fontFamily: SANS,
        fontWeight: weight,
        fontSize: size,
        letterSpacing: '-0.035em',
        lineHeight: 1.1,
        color,
      }}
    >
      {words.map((w, i) => {
        const tin = ip(f, at + i * stagger, at + i * stagger + 12, 1, 0, E.out);
        const tout = ip(f, out + i * 2, out + i * 2 + 9, 0, -1, E.in);
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: '0.06em 0.02em 0.12em' }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(tin + tout) * 110}%)` }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

export const Label: React.FC<{ f: number; idx: string; text: string; at?: number }> = ({ f, idx, text, at = 0 }) => {
  const a = ip(f, at, at + 6, 0, 1);
  return (
    <div style={{ position: 'absolute', left: 96, bottom: 84, display: 'flex', alignItems: 'center', gap: 18, fontFamily: MONO, fontSize: 28, letterSpacing: '0.16em', color: 'rgba(236,240,248,0.92)', opacity: a }}>
      <span style={{ color: '#FF5B2E' }}>{idx}</span>
      <span style={{ width: 40 * clamp(a), height: 2, background: 'rgba(236,240,248,0.5)' }} />
      <span>{text}</span>
    </div>
  );
};
