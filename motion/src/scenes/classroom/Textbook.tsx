import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { E, ip } from '../../lib/core';
import { Grain, MotionBlurDefs, Vignette } from '../../lib/fx';
import { SERIF } from '../../fonts';
import { TextLines } from './shared';

const Page: React.FC<{ side: 'L' | 'R'; seed: number }> = ({ side, seed }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#EEE6D3' }}>
    <Img src={staticFile('tex/paper.png')} style={{ position: 'absolute', left: side === 'L' ? 0 : -800, top: 0, width: 1600, height: 1000, opacity: 0.9 }} />
    <svg viewBox="0 0 800 1000" width={800} height={1000} style={{ position: 'absolute', inset: 0 }}>
      <text x={70} y={90} fontFamily={SERIF} fontSize={30} fill="#2a2520">
        {side === 'L' ? '24.3  Dijkstra’s algorithm' : 'Correctness of Dijkstra’s algorithm'}
      </text>
      <TextLines x={70} y={130} w={660} lines={side === 'L' ? 14 : 30} lh={24} seed={seed} color="#4a4339" h={6} />
      {side === 'L' && (
        <g transform="translate(110 480)" stroke="#2a2520" strokeWidth={2} fill="#EEE6D3">
          {[
            [0, 110, 140, 20],
            [0, 110, 140, 200],
            [140, 20, 300, 20],
            [140, 200, 300, 200],
            [140, 20, 140, 200],
            [300, 20, 440, 110],
            [300, 200, 440, 110],
            [140, 20, 300, 200],
          ].map(([a, b, c, d], i) => (
            <line key={i} x1={a} y1={b} x2={c} y2={d} />
          ))}
          {[
            [0, 110],
            [140, 20],
            [140, 200],
            [300, 20],
            [300, 200],
            [440, 110],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={20} />
          ))}
          <text x={0} y={280} fontFamily={SERIF} fontSize={20} fill="#2a2520" stroke="none">
            Figure 24.6 The execution of Dijkstra’s algorithm.
          </text>
        </g>
      )}
      {side === 'L' && <TextLines x={70} y={800} w={660} lines={7} lh={24} seed={seed + 3} color="#4a4339" h={6} />}
      <text x={side === 'L' ? 70 : 720} y={970} fontFamily={SERIF} fontSize={18} fill="#2a2520" opacity={0.6}>
        {side === 'L' ? '658' : '659'}
      </text>
    </svg>
  </div>
);

export const Textbook: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const panX = ip(f, 0, dur - 12, 260, -260, E.soft) + ip(f, dur - 12, dur, 0, -900, E.in);
  const blur = ip(f, dur - 12, dur, 0, 40, E.in);
  const flip = ip(f, 14, 34, 0, 1, E.inOut);
  return (
    <AbsoluteFill style={{ background: '#1b130d', overflow: 'hidden' }}>
      <MotionBlurDefs id="tbBlur" x={blur} />
      <AbsoluteFill style={{ filter: blur > 0.5 ? 'url(#tbBlur)' : undefined }}>
        <AbsoluteFill style={{ perspective: 2400 }}>
          <div
            style={{
              position: 'absolute',
              left: 160,
              top: 40,
              width: 1600,
              height: 1000,
              transform: `translateX(${panX}px) rotateX(24deg) rotateZ(-5deg) scale(1.35)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, width: 800, height: 1000 }}>
              <Page side="L" seed={21} />
            </div>
            <div style={{ position: 'absolute', left: 800, top: 0, width: 800, height: 1000 }}>
              <Page side="R" seed={22} />
            </div>
            {/* gutter shading */}
            <div style={{ position: 'absolute', left: 700, top: 0, width: 200, height: 1000, background: 'linear-gradient(90deg, rgba(0,0,0,0), rgba(40,25,10,0.35) 50%, rgba(0,0,0,0))' }} />
            {/* turning page */}
            {flip > 0 && flip < 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: 800,
                  top: 0,
                  width: 800,
                  height: 1000,
                  transformOrigin: '0 50%',
                  transform: `rotateY(${-flip * 180}deg)`,
                  backfaceVisibility: 'hidden',
                }}
              >
                <Page side="R" seed={40} />
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(0,0,0,${0.35 * Math.sin(flip * Math.PI)}), rgba(0,0,0,0))` }} />
              </div>
            )}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 60% 70% at 35% 25%, rgba(255,215,160,0.2), rgba(0,0,0,0) 70%)', mixBlendMode: 'screen' }} />
      <Vignette strength={0.7} color="15,8,3" />
      <Grain opacity={0.22} />
    </AbsoluteFill>
  );
};
