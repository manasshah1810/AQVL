import React from 'react';
import {WM, WM_STROKE, symbolInner, wordmarkInner, svgLockup} from './lib/brandData.js';
void WM; void WM_STROKE;
const Html: React.FC<{html: string; w: number; bg: string}> = ({html, w, bg}) => (
  <div style={{background: bg, padding: 30, borderRadius: 12}} dangerouslySetInnerHTML={{__html: html.replace(/height="\d+"/, `width="${w}"`)}} />
);
export const LogoSheet: React.FC = () => {
  const dark = svgLockup('#9fd0ff', '#ffb02e'), light = svgLockup('#111111', '#e07a00'), one = svgLockup('#ffffff', '#ffffff');
  void symbolInner; void wordmarkInner;
  return (
    <div style={{width: 1920, height: 1080, background: '#05080f', display: 'flex', flexWrap: 'wrap', gap: 24, padding: 40, alignItems: 'center'}}>
      <Html html={dark} w={760} bg="#0b1220" />
      <Html html={light} w={760} bg="#f4f1ea" />
      <Html html={one} w={500} bg="#222" />
      <Html html={dark} w={96} bg="#0b1220" />
      <Html html={dark} w={64} bg="#0b1220" />
      <Html html={light} w={64} bg="#f4f1ea" />
      <Html html={dark.replace(/viewBox="0 0 350 100"/, 'viewBox="0 0 100 100"')} w={32} bg="#0b1220" />
    </div>
  );
};
