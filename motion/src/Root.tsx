import React from 'react';
import { Composition, AbsoluteFill, useCurrentFrame } from 'remotion';
import { ensureFonts, SANS as fontFamily } from './fonts';
ensureFonts();
const Test: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#05060A', color: 'white', fontFamily, fontSize: 80, alignItems: 'center', justifyContent: 'center' }}>
      AQVL test {f}
    </AbsoluteFill>
  );
};
export const Root: React.FC = () => (
  <Composition id="Test" component={Test} durationInFrames={30} fps={30} width={960} height={540} />
);
