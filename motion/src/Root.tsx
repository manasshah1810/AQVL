import React from 'react';
import {Composition} from 'remotion';
import {Hello, RigTest} from './tests/RigTest';
import {LogoSheet} from './brand/LogoSheet';

export const Root: React.FC = () => (
  <>
    <Composition id="Hello" component={Hello} width={960} height={540} fps={30} durationInFrames={30} />
    <Composition id="RigTest" component={RigTest} width={1920} height={1080} fps={30} durationInFrames={60} />
    <Composition id="LogoSheet" component={LogoSheet} width={1920} height={1080} fps={30} durationInFrames={1} />
  </>
);
