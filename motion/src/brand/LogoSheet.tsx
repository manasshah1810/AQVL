import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PEACH, PURPLE, TWILIGHT} from '../lib/palette';
import {MARK, markPath, STROKE, wordmark, WM} from './geometry';
import {fontFamily} from '../lib/fonts';

// One contact sheet: four concepts, then the winner tested large/tiny,
// dark/light and one-color.

const Cell: React.FC<{label: string; children: React.ReactNode; bg?: string; fg?: string}> = ({label, children, bg = TWILIGHT, fg = PEACH}) => (
  <div style={{background: bg, border: `1px solid ${PURPLE}55`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20}}>
    {children}
    <div style={{fontFamily, fontSize: 18, color: fg, opacity: 0.7}}>{label}</div>
  </div>
);

const Mark: React.FC<{size: number; color?: string; dot?: string}> = ({size, color = PEACH}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d={markPath()} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="butt" />
  </svg>
);

export const Wordmark: React.FC<{height: number; color?: string}> = ({height, color = PEACH}) => {
  const wm = wordmark();
  const pad = WM.stroke;
  return (
    <svg height={height} viewBox={`${-pad} ${-pad} ${wm.width + pad * 2} ${WM.cap + pad * 2}`}>
      {wm.parts.map((p, i) => (
        <path key={i} d={p.d} transform={`translate(${p.x} 0)`} fill="none" stroke={color} strokeWidth={WM.stroke} strokeLinejoin="miter" strokeLinecap="butt" />
      ))}
    </svg>
  );
};

const ConceptAperture = () => (
  <svg width={220} height={220} viewBox="0 0 100 100">
    <path d="M 74.2 21.5 A 33 33 0 1 0 82 44" fill="none" stroke={PEACH} strokeWidth={11} />
    <circle cx={60} cy={38} r={8} fill={PURPLE} />
  </svg>
);
const ConceptLambda = () => (
  <svg width={220} height={220} viewBox="0 0 100 100">
    <path d="M 14 88 L 46 12 L 54 12 L 86 88" fill="none" stroke={PEACH} strokeWidth={11} />
    <circle cx={50} cy={62} r={8} fill={PURPLE} />
  </svg>
);
const ConceptFold = () => (
  <svg width={220} height={220} viewBox="0 0 100 100">
    <path d="M 10 30 L 50 50 L 50 92 L 10 72 Z" fill={PURPLE} />
    <path d="M 50 50 L 90 30 L 90 72 L 50 92 Z" fill={PEACH} />
    <path d="M 10 30 L 50 10 L 90 30 L 50 50 Z" fill="none" stroke={PEACH} strokeWidth={4} />
  </svg>
);

export const LogoSheet: React.FC = () => (
  <AbsoluteFill style={{background: '#08070c', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr 1fr 1fr', gap: 12, padding: 12}}>
    <Cell label="A · aperture + focus">
      <ConceptAperture />
    </Cell>
    <Cell label="B · launch loop (Q)">
      <Mark size={220} />
    </Cell>
    <Cell label="C · lambda + focus">
      <ConceptLambda />
    </Cell>
    <Cell label="D · page fold">
      <ConceptFold />
    </Cell>
    <Cell label="B · lockup dark">
      <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
        <Mark size={120} />
        <Wordmark height={64} />
      </div>
    </Cell>
    <Cell label="B · lockup light" bg="#f3ece6" fg="#2a2433">
      <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
        <Mark size={120} color="#2a2433" />
        <Wordmark height={64} color="#2a2433" />
      </div>
    </Cell>
    <Cell label="B · 32px / 16px">
      <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
        <Mark size={32} />
        <Mark size={16} />
        <div style={{background: '#f3ece6', padding: 6, display: 'flex', gap: 10}}>
          <Mark size={32} color="#2a2433" />
          <Mark size={16} color="#2a2433" />
        </div>
      </div>
    </Cell>
    <Cell label="B · wordmark large">
      <Wordmark height={110} />
    </Cell>
    <Cell label={`B · geometry r=${MARK.r} gap=${MARK.gapDeg}`}>
      <svg width={300} height={300} viewBox="-5 -5 110 110">
        <circle cx={MARK.cx} cy={MARK.cy} r={MARK.r} fill="none" stroke={PURPLE} strokeWidth={0.4} strokeDasharray="2 2" />
        <line x1={0} y1={MARK.cy + MARK.r} x2={100} y2={MARK.cy + MARK.r} stroke={PURPLE} strokeWidth={0.4} strokeDasharray="2 2" />
        <path d={markPath()} fill="none" stroke={PEACH} strokeWidth={STROKE} opacity={0.85} />
      </svg>
    </Cell>
    <Cell label="B · one color purple">
      <Mark size={200} color={PURPLE} />
    </Cell>
    <Cell label="B · stacked">
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
        <Mark size={130} />
        <Wordmark height={44} />
      </div>
    </Cell>
    <Cell label="type: JetBrains Mono">
      <div style={{fontFamily, color: PEACH, fontSize: 30, letterSpacing: '-0.01em'}}>Write the algorithm. Watch it think.</div>
    </Cell>
  </AbsoluteFill>
);
