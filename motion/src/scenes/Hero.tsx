import React from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { C, E, ip, lerp } from '../lib/core';
import { Canvas2D, Grain, Vignette, bloom } from '../lib/fx';
import { Words } from '../lib/type';
import { drawStructure } from '../lib/structure';
import { structureCam } from './Hook';

export const HERO_DUR = 110;
// the hook's impossible structure returns — now alive. then it all collapses into one point.
export const Hero: React.FC = () => {
  const f = useCurrentFrame();
  const pull = ip(f, 0, 50, 0.25, 1, Easing.bezier(0.3, 0, 0.1, 1));
  const imp = ip(f, 84, 106, 0, 1, E.in);
  const yaw = ip(f, 0, HERO_DUR, 1.2, 2.3);
  const { cam } = structureCam(pull, yaw, ip(f, 0, HERO_DUR, 0.45, 0.2), 1500, 80, ip(f, 84, 104, 0, 1, E.inOut));
  return (
    <AbsoluteFill style={{ background: C.void }}>
      <Canvas2D
        draw={(ctx) => {
          drawStructure(ctx, cam, {
            t: f / 30 + 4,
            implode: imp,
            heroGlow: 1 - imp,
            pulses: 1 - imp,
            activity: 1 - imp,
            lineAlpha: 0.36,
            nodeR: 1.9,
            fogNear: 900,
            fogFar: 4200,
            pointPx: Math.exp(lerp(Math.log(8), Math.log(5), pull) + (Math.log(18) - Math.log(5)) * imp),
          });
          bloom(ctx, 0.95, 6);
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 40% 26% at 50% 50%, rgba(4,5,10,0.85), rgba(4,5,10,0))', opacity: ip(f, 14, 26, 0, 1) * ip(f, 80, 90, 1, 0) }} />
      <Words text="If you can write it," f={f} at={20} out={80} x={0} y={400} size={104} align="center" />
      <Words text="you can see it." f={f} at={40} out={82} x={0} y={530} size={104} align="center" color="#FF8A5C" />
      <Vignette strength={0.6} />
      <Grain opacity={0.1} blend="screen" />
    </AbsoluteFill>
  );
};
