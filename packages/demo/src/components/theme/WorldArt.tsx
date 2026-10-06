import React from 'react';
import type { World } from '../../lib/world';

/**
 * A small picture of each world for the picker: the same blocks, standing
 * in three different places. Flat colour, no filters: they draw instantly
 * and stay sharp at any size.
 */
export function WorldArt({ world }: { world: World }) {
  if (world === 'penguin') return <PenguinArt />;
  if (world === 'panda') return <PandaArt />;
  return <StudioArt />;
}

const BLOCKS = [
  { x: 52, h: 28 },
  { x: 86, h: 44 },
  { x: 120, h: 36 },
  { x: 154, h: 58 },
  { x: 188, h: 32 },
];

function StudioArt() {
  return (
    <svg className="world-card__art" viewBox="0 0 240 150" aria-hidden="true">
      <rect width="240" height="150" fill="#2a2837" />
      <ellipse cx="120" cy="116" rx="104" ry="20" fill="#1f1d29" />
      {BLOCKS.map((b, i) => (
        <g key={i}>
          <rect x={b.x - 13} y={112 - b.h} width="26" height={b.h} rx="5" fill={i === 1 ? '#e9a03b' : '#f0e6dd'} />
          <rect x={b.x - 13} y={112 - 5} width="26" height="5" rx="2" fill="rgb(0 0 0 / 0.12)" />
        </g>
      ))}
      <rect x="22" y="30" width="46" height="4" rx="2" fill="#ebc0a3" opacity="0.5" />
      <rect x="22" y="40" width="28" height="4" rx="2" fill="#ebc0a3" opacity="0.3" />
    </svg>
  );
}

function PenguinArt() {
  return (
    <svg className="world-card__art" viewBox="0 0 240 150" aria-hidden="true">
      <defs>
        <linearGradient id="wa-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a1426" />
          <stop offset="1" stopColor="#173150" />
        </linearGradient>
        <linearGradient id="wa-aurora" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4af0b0" stopOpacity="0" />
          <stop offset="0.4" stopColor="#4af0b0" stopOpacity="0.45" />
          <stop offset="0.75" stopColor="#9a82ff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#9a82ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="240" height="150" fill="url(#wa-sky)" />
      <path d="M0 40 Q60 8 120 30 T240 22 L240 52 Q180 40 120 56 T0 58 Z" fill="url(#wa-aurora)" />
      {[[30, 18], [70, 30], [128, 12], [196, 26], [222, 10], [160, 36]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.2" fill="#e8f4ff" opacity="0.8" />
      ))}
      {/* Ice cliffs and the igloo. */}
      <path d="M0 88 L18 70 L34 82 L58 62 L76 80 L100 72 L118 86 L240 86 L240 100 L0 100 Z" fill="#7da6cc" opacity="0.85" />
      <path d="M170 90 a22 22 0 0 1 44 0 Z" fill="#e6f0fa" />
      <path d="M186 90 a6 6 0 0 1 12 0 Z" fill="#ffa64d" />
      {/* The ice shelf with its blocks. */}
      <ellipse cx="112" cy="122" rx="110" ry="26" fill="#1d4268" />
      <ellipse cx="112" cy="118" rx="96" ry="20" fill="#2a5a88" />
      {BLOCKS.map((b, i) => (
        <g key={i}>
          <rect x={b.x - 12} y={112 - b.h} width="24" height={b.h} rx="5" fill={i === 1 ? '#e9a03b' : '#cfe6fa'} />
          <rect x={b.x - 12} y={112 - b.h} width="24" height="7" rx="3" fill="#ffffff" opacity="0.5" />
        </g>
      ))}
      {/* A penguin, pushing. */}
      <g transform="translate(52 86)">
        <ellipse cx="14" cy="38" rx="14" ry="3" fill="rgb(0 0 0 / 0.25)" />
        <ellipse cx="14" cy="24" rx="12" ry="15" fill="#253047" />
        <ellipse cx="15" cy="27" rx="8.5" ry="11.5" fill="#f6f3ec" />
        <circle cx="14" cy="9" r="8.6" fill="#253047" />
        <circle cx="11" cy="8" r="1.4" fill="#fff" />
        <circle cx="18" cy="8" r="1.4" fill="#fff" />
        <path d="M11 12 L14 10.4 L17 12 L14 15.4 Z" fill="#f39a2e" />
        <path d="M22 22 L35 26" stroke="#253047" strokeWidth="5" strokeLinecap="round" />
        <path d="M8 36 h6 M16 36 h6" stroke="#f39a2e" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function PandaArt() {
  return (
    <svg className="world-card__art" viewBox="0 0 240 150" aria-hidden="true">
      <defs>
        <linearGradient id="wa-dawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ead2" />
          <stop offset="1" stopColor="#dce7d3" />
        </linearGradient>
      </defs>
      <rect width="240" height="150" fill="url(#wa-dawn)" />
      {[18, 40, 196, 222].map((x, i) => (
        <g key={i}>
          <rect x={x - 4} y={10 + (i % 2) * 8} width="8" height="110" rx="4" fill="#8cc152" />
          {[34, 62, 90].map((y) => (
            <rect key={y} x={x - 5} y={y + (i % 2) * 8} width="10" height="3" rx="1.5" fill="#5f8a33" />
          ))}
        </g>
      ))}
      <ellipse cx="120" cy="118" rx="108" ry="24" fill="#d9cca5" />
      {BLOCKS.map((b, i) => (
        <g key={i}>
          <rect x={b.x - 12} y={112 - b.h} width="24" height={b.h} rx="4" fill={i === 1 ? '#e9a03b' : '#c9b483'} />
          {[-6, 0, 6].map((dx) => (
            <rect key={dx} x={b.x + dx - 0.7} y={112 - b.h + 3} width="1.4" height={b.h - 6} fill="#a48b58" opacity="0.6" />
          ))}
        </g>
      ))}
      <g transform="translate(50 82)">
        <ellipse cx="16" cy="40" rx="15" ry="3" fill="rgb(0 0 0 / 0.18)" />
        <ellipse cx="16" cy="27" rx="14" ry="13" fill="#f5f2ea" />
        <ellipse cx="16" cy="22" rx="14.5" ry="5" fill="#1d1d22" />
        <circle cx="16" cy="10" r="10" fill="#f5f2ea" />
        <circle cx="8" cy="3" r="3.4" fill="#1d1d22" />
        <circle cx="24" cy="3" r="3.4" fill="#1d1d22" />
        <ellipse cx="11.5" cy="10" rx="2.3" ry="3" fill="#1d1d22" />
        <ellipse cx="20.5" cy="10" rx="2.3" ry="3" fill="#1d1d22" />
        <ellipse cx="16" cy="14" rx="2.2" ry="1.4" fill="#1d1d22" />
      </g>
    </svg>
  );
}
