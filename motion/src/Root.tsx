import React from 'react';
import {Composition} from 'remotion';
import {Hello, RigTest} from './tests/RigTest';
import {LogoSheet} from './brand/LogoSheet';
import {Film} from './Film';
import {DURATION} from './film/timeline';

// All timing is authored in seconds; the same film renders at 30 or 60fps.
export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} width={1920} height={1080} fps={30} durationInFrames={Math.round(DURATION * 30)} />
    <Composition id="Draft" component={Film} width={960} height={540} fps={30} durationInFrames={Math.round(DURATION * 30)} />
    <Composition id="Film60" component={Film} width={1920} height={1080} fps={60} durationInFrames={Math.round(DURATION * 60)} />
    <Composition id="Hello" component={Hello} width={960} height={540} fps={30} durationInFrames={30} />
    <Composition id="RigTest" component={RigTest} width={1920} height={1080} fps={30} durationInFrames={60} />
    <Composition id="LogoSheet" component={LogoSheet} width={1920} height={1080} fps={30} durationInFrames={1} />
  </>
);
