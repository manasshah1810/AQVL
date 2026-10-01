import React from 'react';
import {Composition, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadHand} from '@remotion/google-fonts/Caveat';
import {loadFont as loadSerif} from '@remotion/google-fonts/Newsreader';
import {WorldScene} from './scenes/WorldScene';
import {Film, DURATION} from './Film';

loadMono('normal', {weights: ['400', '500', '600', '700'], subsets: ['latin']});
loadHand('normal', {weights: ['400', '700'], subsets: ['latin']});
loadSerif('normal', {weights: ['400', '700'], subsets: ['latin']});

const WorldTest: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <WorldScene t={14.5 + f / fps} panelT={13.5} />;
};
type P = {fps: number};
const meta = (secs: number) => ({props}: {props: P}) => ({fps: props.fps, durationInFrames: Math.round(secs * props.fps)});

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={Math.round(DURATION * 60)} fps={60} width={1920} height={1080} defaultProps={{fps: 60}} calculateMetadata={meta(DURATION)} />
    <Composition id="WorldTest" component={WorldTest} durationInFrames={26 * 60} fps={60} width={1920} height={1080} defaultProps={{fps: 4}} calculateMetadata={meta(26)} />
  </>
);
