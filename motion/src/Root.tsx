import React from 'react';
import {Composition, useCurrentFrame, useVideoConfig, continueRender, delayRender} from 'remotion';
import {loadFont} from '@remotion/google-fonts/JetBrainsMono';
import {WorldScene} from './scenes/WorldScene';

const {fontFamily} = loadFont('normal', {weights: ['400', '500', '600', '700'], subsets: ['latin']});

const useT = (offset: number) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return offset + f / fps;
};
const WorldTest: React.FC = () => {
  const t = useT(14.5);
  void fontFamily;
  return <WorldScene t={t} panelT={14.7} />;
};

export const Root: React.FC = () => (
  <>
    <Composition id="WorldTest" component={WorldTest} durationInFrames={26 * 60} fps={60} width={1920} height={1080}
      defaultProps={{fps: 6}}
      calculateMetadata={({props}) => ({fps: (props as {fps: number}).fps, durationInFrames: Math.round(26 * (props as {fps: number}).fps)})} />
  </>
);
void continueRender; void delayRender;
