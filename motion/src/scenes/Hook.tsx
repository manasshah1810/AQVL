import React from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { C, E, V3, add, clamp, ip, lerp, lerp3, lookAt, mul, norm } from '../lib/core';
import { Canvas2D, Grain, Vignette, bloom } from '../lib/fx';
import { CENTROID, HERO_LEAF, S, drawStructure } from '../lib/structure';

const hero = S.nodes[HERO_LEAF].p;
const heroDir = norm(hero);
const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];

/** camera for the structure: k=0 at the hero point, k=1 framing the whole thing */
export const structureCam = (pull: number, yaw: number, pitch: number, endDist = 5600, startDist = 34, reaim = 0) => {
  const dist = Math.exp(Math.log(startDist) + (Math.log(endDist) - Math.log(startDist)) * pull);
  const target = lerp3(lerp3(hero, CENTROID, clamp(Math.pow(pull, 1.4))), hero, reaim);
  let away = rotY(heroDir, yaw);
  away = norm(add(away, [0, pitch, 0]));
  return { cam: lookAt(add(target, mul(away, dist)), target, 50), dist };
};

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  // macro: a lone point. whoosh back through the branches to the colossal whole, then collapse into the point
  const pull = ip(f, 8, 54, 0, 1, Easing.bezier(0.55, 0, 0.12, 1));
  const imp = ip(f, 80, 100, 0, 1, E.in);
  const yaw = ip(f, 0, 105, -0.35, 0.75);
  const pitch = ip(f, 0, 105, 0.02, 0.3);
  const { cam } = structureCam(pull, yaw, pitch, 1650, 80 - ip(f, 0, 8, 0, 8), ip(f, 80, 99, 0, 1, E.inOut));
  const lines = ip(f, 8, 30, 0, 1, E.soft);
  return (
    <AbsoluteFill style={{ background: C.void }}>
      <Canvas2D
        draw={(ctx) => {
          drawStructure(ctx, cam, {
            t,
            implode: imp,
            heroGlow: ip(f, 34, 60, 0, 1) * (1 - imp),
            pulses: ip(f, 30, 56, 0, 1) * (1 - imp),
            activity: ip(f, 46, 76, 0, 0.7) * (1 - imp),
            lineAlpha: 0.34 * lines,
            nodeR: 1.9,
            nodeAlpha: lines,
            fogNear: 900,
            fogFar: 4200,
            pointPx: Math.exp(lerp(Math.log(30), Math.log(4.5), pull) + (Math.log(18) - Math.log(4.5)) * imp) * ip(f, 0, 2, 0.4, 1, E.out),
          });
          bloom(ctx, 0.85, 5);
        }}
      />
      <Vignette strength={0.6} />
      <Grain opacity={0.1} blend="screen" />
    </AbsoluteFill>
  );
};
