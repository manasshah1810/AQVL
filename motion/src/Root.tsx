import React from 'react';
import { Composition } from 'remotion';
import { ensureFonts } from './fonts';
import { Film, FILM_FRAMES } from './Film';
import { WallLastFrame } from './scenes/Wall';
ensureFonts();
export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={FILM_FRAMES} fps={30} width={1920} height={1080} />
    <Composition id="WallFrame" component={WallLastFrame} durationInFrames={1} fps={30} width={1920} height={1080} />
  </>
);
