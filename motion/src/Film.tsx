import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Hook } from './scenes/Hook';
import { Board } from './scenes/classroom/Board';
import { Room } from './scenes/classroom/Room';
import { Notebook, COPY_END } from './scenes/classroom/Notebook';
import { Textbook } from './scenes/classroom/Textbook';
import { Wall, WALL_DUR } from './scenes/Wall';
import { Break, BREAK_DUR } from './scenes/Break';
import { CodeToStructure, C2S_DUR } from './scenes/CodeToStructure';
import { Montage, MONTAGE_DUR } from './scenes/Montage';
import { Hero, HERO_DUR } from './scenes/Hero';
import { Payoff, PAYOFF_DUR } from './scenes/Payoff';
import { Resolve, RESOLVE_DUR } from './scenes/Resolve';
import { useCurrentFrame } from 'remotion';
import { ip, E } from './lib/core';

const NotebookCopy: React.FC = () => {
  const f = useCurrentFrame();
  const cf = ip(f, 0, 58, 0, COPY_END * 0.72);
  return <Notebook dur={60} copyF={cf} cam={{ x: ip(f, 0, 60, 140, 40, E.soft), y: ip(f, 0, 60, 30, -10), z: ip(f, 0, 60, 1.55, 1.35, E.soft) }} />;
};

const PLAN: [string, number, React.ReactNode][] = [
  ['hook', 105, <Hook />],
  ['board', 60, <Board dur={60} />],
  ['room', 60, <Room slide="lecture" dur={60} />],
  ['notebook', 60, <NotebookCopy />],
  ['textbook', 60, <Textbook dur={60} />],
  ['wall', WALL_DUR, <Wall />],
  ['break', BREAK_DUR, <Break />],
  ['c2s', C2S_DUR, <CodeToStructure />],
  ['montage', MONTAGE_DUR, <Montage />],
  ['hero', HERO_DUR, <Hero />],
  ['payoff', PAYOFF_DUR, <Payoff />],
  ['resolve', RESOLVE_DUR, <Resolve />],
];
export const STARTS: Record<string, number> = {};
let acc = 0;
for (const [k, d] of PLAN) {
  STARTS[k] = acc;
  acc += d;
}
export const FILM_FRAMES = acc;

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {PLAN.map(([k, d, el]) => (
      <Sequence key={k} name={k} from={STARTS[k]} durationInFrames={d}>
        {el}
      </Sequence>
    ))}
  </AbsoluteFill>
);
