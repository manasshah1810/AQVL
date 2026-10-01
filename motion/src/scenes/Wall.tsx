import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { E, ip } from '../lib/core';
import { CodeCrop } from './classroom/CodeCrop';
import { BIGQ, COPY_END, Notebook } from './classroom/Notebook';
import { Room } from './classroom/Room';

// the moment the lesson turns to code: rhythmic, cramped, accelerating
const NB = (p: Parameters<typeof Notebook>[0]) => <Notebook {...p} />;
const Lf: React.FC<{ render: (f: number) => React.ReactNode }> = ({ render }) => {
  const f = useCurrentFrame();
  return <>{render(f)}</>;
};
export const WALL_DUR = 210;
const FINAL_CAM = { x: 0, y: -262, z: 1.25, r: 0 };
const STOP = Math.round(COPY_END * 0.72);
const shots: [number, number, React.ReactNode][] = [
  [0, 45, <Lf key="a" render={(f) => <Room slide="code" dur={45} switchAt={4} confusion={ip(f, 12, 45, 0, 0.8)} push={[1.0, 1.12]} />} />],
  [45, 15, <Lf key="b" render={(f) => <NB dur={15} copyF={STOP} hover={f + 1} cam={{ x: 120, y: -40, z: 2.2 }} />} />],
  [60, 15, <CodeCrop key="c" dur={15} zoom={2.6} rot={-8} intensity={0.5} focusLine={2} />],
  [75, 15, <Lf key="d" render={(f) => <NB dur={15} copyF={STOP} scribble={ip(f, 0, 13, 0, 1)} cam={{ x: 60, y: 0, z: 1.5, r: -6 }} />} />],
  [90, 10, <Lf key="e" render={() => <Room slide="code" dur={10} confusion={1} push={[1.25, 1.3]} dutch={4} />} />],
  [100, 10, <CodeCrop key="f" dur={10} zoom={3.6} rot={5} intensity={0.8} focusLine={6} layers={3} />],
  [110, 8, <Lf key="g" render={(f) => <NB dur={8} copyF={STOP} scribble={1} questions={ip(f, 0, 8, 0, 1.6)} cam={{ x: 0, y: 0, z: 1.15 }} />} />],
  [118, 4, <CodeCrop key="h" dur={4} zoom={4.5} rot={-12} intensity={1} focusLine={9} layers={5} />],
  [122, 8, <Lf key="i" render={(f) => <NB dur={8} copyF={STOP} scribble={1} questions={ip(f, 0, 8, 1.6, 3.2)} cam={{ x: 0, y: 0, z: 1.1 }} />} />],
  [130, 3, <CodeCrop key="j" dur={3} zoom={5} rot={10} intensity={1} focusLine={4} layers={6} />],
  [133, 8, <Lf key="k" render={(f) => <NB dur={8} copyF={STOP} scribble={1} questions={ip(f, 0, 8, 3.2, 4.6)} cam={{ x: 0, y: 0, z: 1.05 }} />} />],
  [141, 3, <Lf key="l" render={() => <Room slide="code" dur={3} confusion={1} push={[1.5, 1.5]} dutch={-6} />} />],
  [144, 6, <Lf key="m" render={(f) => <NB dur={6} copyF={STOP} scribble={1} questions={ip(f, 0, 6, 4.6, 6)} cam={{ x: 0, y: 0, z: 1.0 }} />} />],
  [150, 2, <CodeCrop key="n" dur={2} zoom={6} rot={-14} intensity={1} focusLine={1} layers={8} />],
  // the big question, drawn over everything — then stillness, and the dot turns
  [152, 58, <Lf key="o" render={(f) => <NB dur={58} copyF={STOP} scribble={1} questions={6} bigQ={ip(f, 0, 16, 0, 1, E.soft)} dimOthers={ip(f, 18, 40, 0, 0.6)} orange={ip(f, 30, 40, 0, 1)} cam={{ x: 0, y: ip(f, 0, 58, 0, FINAL_CAM.y, E.inOut), z: ip(f, 0, 58, 1.0, FINAL_CAM.z, E.inOut), r: ip(f, 0, 58, -3, 0, E.inOut) }} pen={f < 17} />} />],
];
export const Wall: React.FC = () => (
  <AbsoluteFill>
    {shots.map(([from, dur, el], i) => (
      <Sequence key={i} from={from} durationInFrames={dur}>
        {el}
      </Sequence>
    ))}
  </AbsoluteFill>
);
export const WallLastFrame: React.FC = () => (
  <Notebook dur={58} copyF={STOP} scribble={1} questions={6} bigQ={1} dimOthers={0.6} orange={1} cam={FINAL_CAM} pen={false} />
);
export { BIGQ };
