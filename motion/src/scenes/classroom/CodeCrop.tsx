import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { hash, ip, noise1 } from '../../lib/core';
import { Grain, Vignette } from '../../lib/fx';
import { MONO } from '../../fonts';
import { CODE } from './Room';

/** projected code, cropped tight: ghosting, tilt, pressure. intensity 0..1 */
export const CodeCrop: React.FC<{ dur: number; zoom?: number; rot?: number; intensity?: number; focusLine?: number; layers?: number }> = ({
  dur,
  zoom = 2.2,
  rot = -6,
  intensity = 0.5,
  focusLine = 1,
  layers = 1,
}) => {
  const f = useCurrentFrame();
  const shake = intensity * 6;
  const sx = noise1(f * 0.8, 1) * shake, sy = noise1(f * 0.9, 2) * shake;
  const z = zoom * ip(f, 0, dur, 1, 1.08);
  const block = (k: number) => (
    <pre
      key={k}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        margin: 0,
        fontFamily: MONO,
        fontSize: 30,
        lineHeight: 1.32,
        color: '#2a2018',
        whiteSpace: 'pre',
        transform: k ? `translate(${(hash(k) - 0.5) * 900}px, ${(hash(k + 9) - 0.5) * 500}px) rotate(${(hash(k + 3) - 0.5) * 24}deg) scale(${0.6 + hash(k + 5) * 0.9})` : undefined,
        opacity: k ? 0.25 + hash(k + 1) * 0.3 : 1,
      }}
    >
      {CODE}
    </pre>
  );
  return (
    <AbsoluteFill style={{ background: '#F0E9D8', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${z}) translate(-${focusLine * 0}px, ${-focusLine * 39.6 + 200}px)`,
          transformOrigin: '50% 50%',
          left: 360,
          top: 160,
        }}
      >
        {Array.from({ length: layers }, (_, k) => block(k))}
        {/* chromatic ghost */}
        <pre style={{ position: 'absolute', left: 3 + intensity * 6, top: 0, margin: 0, fontFamily: MONO, fontSize: 30, lineHeight: 1.32, color: 'rgba(200,40,20,0.25)', whiteSpace: 'pre' }}>{CODE}</pre>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,220,160,0.25), rgba(60,30,10,0.5))', mixBlendMode: 'multiply' }} />
      <Vignette strength={0.8} color="30,15,5" />
      <Grain opacity={0.28} />
    </AbsoluteFill>
  );
};
