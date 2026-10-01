import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage} from './gl/Stage';
import {filmDirector} from './film/director';
import {T} from './film/timeline';
import {TWILIGHT} from './lib/palette';
import {Editor} from './ui/Editor';
import {Scrubber} from './ui/Scrubber';
import {Tagline} from './ui/Tagline';
import {Resolve} from './ui/Resolve';
import './lib/fonts';

export const Film: React.FC = () => (
  <AbsoluteFill style={{background: TWILIGHT}}>
    <Stage director={filmDirector} />
    <Editor />
    <Scrubber />
    <Tagline t0={T.tagline} t1={T.easy - 0.55} />
    <Resolve />
  </AbsoluteFill>
);
