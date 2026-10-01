import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { E, ip } from '../lib/core';
import { Notebook } from './classroom/Notebook';
import { Room } from './classroom/Room';

export const PAYOFF_DUR = 126;
const Note: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Notebook
      dur={66}
      copyF={9999}
      scribble={0}
      questions={0}
      bigQ={1}
      morph={ip(f, 8, 44, 0, 1, E.inOut)}
      dimOthers={ip(f, 0, 40, 0.3, 1)}
      orange={ip(f, 44, 54, 0, 1)}
      pen={false}
      cam={{ x: 0, y: ip(f, 0, 66, 60, 150, E.soft), z: ip(f, 0, 66, 1.0, 1.12, E.soft), r: ip(f, 0, 66, -3, 0, E.soft) }}
    />
  );
};
export const Payoff: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={60}>
      <Room slide="aqvl" dur={60} lit={1} push={[1.02, 1.14]} />
    </Sequence>
    <Sequence from={60} durationInFrames={66}>
      <Note />
    </Sequence>
  </AbsoluteFill>
);
