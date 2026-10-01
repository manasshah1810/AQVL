import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {Defs, HBlur, W, H} from './lib/draw';
import {smooth} from './lib/motion';
import {Hook} from './scenes/Hook';
import {ShotBoard, ShotHandout, ShotProjector, ShotRows} from './scenes/Classroom';
import {WallScene, BreakScene, PANEL_T, BREAK_T0} from './scenes/Wall';
import {WorldScene} from './scenes/WorldScene';
import {UnderstandScene, ResolveScene, UNDER_T0, RES_T0} from './scenes/Finale';

export const DURATION = 48.5;

const SHOTS: {from: number; render: (lt: number) => React.ReactNode}[] = [
  {from: 3.0, render: (lt) => <ShotBoard t={lt} />},
  {from: 4.4, render: (lt) => <ShotHandout t={lt} />},
  {from: 5.6, render: (lt) => <ShotProjector t={lt} />},
  {from: 6.9, render: (lt) => <ShotRows t={lt} />},
];
const SHOT_END = 8.5, WHIP = 0.2;

const Classroom: React.FC<{t: number}> = ({t}) => {
  const out: React.ReactNode[] = [];
  SHOTS.forEach((s, i) => {
    const end = i + 1 < SHOTS.length ? SHOTS[i + 1].from : SHOT_END;
    const enterStart = i === 0 ? s.from : s.from - WHIP;
    if (t < enterStart || t > end + WHIP * 0.1) return;
    const e = i === 0 ? 1 : smooth((t - enterStart) / WHIP);
    const nextE = i + 1 < SHOTS.length ? smooth((t - (SHOTS[i + 1].from - WHIP)) / WHIP) : 0;
    const x = (1 - e) * W - nextE * W * 0.55;
    const blur = 70 * Math.sin(Math.PI * e) * (e < 1 ? 1 : 0) + 70 * Math.sin(Math.PI * nextE) * (nextE > 0 && nextE < 1 ? 1 : 0);
    out.push(
      <div key={i} style={{position: 'absolute', inset: 0, transform: `translateX(${x}px)`}}>
        <HBlur amount={blur}>{s.render(t - s.from)}</HBlur>
      </div>,
    );
  });
  return <>{out}</>;
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <div style={{position: 'absolute', width: W, height: H, background: '#000', overflow: 'hidden'}}>
      <Defs />
      {t >= 2.3 && t < 8.6 && <Classroom t={t} />}
      {t < 3.0 && <Hook t={t} below={<ShotBoard t={t - 3.0} />} />}
      {t >= 8.5 && t < 12.5 && <WallScene t={t} />}
      {t >= BREAK_T0 && t < UNDER_T0 + 0.05 && <WorldScene t={t} panelT={PANEL_T} />}
      {t >= BREAK_T0 && t < 14.3 && <BreakScene t={t} />}
      {t >= UNDER_T0 && t < RES_T0 && <UnderstandScene t={t} />}
      {t >= RES_T0 && <ResolveScene t={t} />}
    </div>
  );
};
