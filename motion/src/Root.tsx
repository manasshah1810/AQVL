import React from 'react';
import {Composition} from 'remotion';
import {LogoSheet} from './LogoSheet';
export const Root: React.FC = () => <Composition id="LogoSheet" component={LogoSheet} durationInFrames={1} fps={30} width={1920} height={1080} />;
