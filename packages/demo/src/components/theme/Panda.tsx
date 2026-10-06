import React from 'react';

export type PandaPose = 'stand' | 'wave' | 'peek' | 'sleep' | 'point' | 'eat' | 'roll' | 'walk';

interface PandaProps {
  /** Height in px (the width follows). */
  size?: number;
  pose?: PandaPose;
  className?: string;
  /** Decorative by default (the page says it all without it). */
  title?: string;
}

/**
 * The AQVL panda: a round, soft-edged little animal in flat colour, drawn
 * with the same blobs as its 3D self (white body, a black band over the
 * shoulders, black ears, arms and feet, eye patches, a blush on each cheek).
 * Poses move with CSS (see styles/world-panda.css), so they cost nothing
 * and stop under reduced motion.
 */
export function Panda({ size = 64, pose = 'stand', className, title }: PandaProps) {
  const rolling = pose === 'roll';
  const sleeping = pose === 'sleep';
  const eating = pose === 'eat';
  return (
    <svg
      className={`pnd pnd--${pose}${className ? ` ${className}` : ''}`}
      width={rolling ? size : size * 0.9}
      height={size}
      viewBox={rolling ? '0 0 92 92' : '0 0 84 92'}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {rolling ? (
        <g className="pnd__all">
          <ellipse cx="46" cy="86" rx="26" ry="3.4" fill="rgb(0 0 0 / 0.16)" />
          <g className="pnd__ball">
            {/* Curled into a ball: white back, a black band, black ears and paws, the face tucked in. */}
            <circle cx="46" cy="46" r="30" fill="var(--pnd-white, #f5f2ea)" />
            <path d="M16 46 A30 30 0 0 1 76 46 Q46 56 16 46 Z" fill="var(--pnd-black, #1d1d22)" />
            <circle cx="28" cy="20" r="7" fill="var(--pnd-black, #1d1d22)" />
            <circle cx="64" cy="20" r="7" fill="var(--pnd-black, #1d1d22)" />
            <ellipse cx="34" cy="64" rx="9" ry="6" fill="var(--pnd-black, #1d1d22)" />
            <ellipse cx="58" cy="64" rx="9" ry="6" fill="var(--pnd-black, #1d1d22)" />
            <circle cx="46" cy="40" r="10" fill="var(--pnd-white, #f5f2ea)" />
            <ellipse cx="41" cy="40" rx="2.4" ry="3" fill="var(--pnd-black, #1d1d22)" />
            <ellipse cx="51" cy="40" rx="2.4" ry="3" fill="var(--pnd-black, #1d1d22)" />
          </g>
        </g>
      ) : (
        <g className="pnd__all">
          <ellipse cx="42" cy="87" rx="24" ry="3.4" fill="rgb(0 0 0 / 0.16)" />
          {/* Feet. */}
          <ellipse className="pnd__footL" cx="29" cy="82" rx="10" ry="6.4" fill="var(--pnd-black, #1d1d22)" />
          <ellipse className="pnd__footR" cx="55" cy="82" rx="10" ry="6.4" fill="var(--pnd-black, #1d1d22)" />
          <ellipse cx="29" cy="83" rx="3.6" ry="2.4" fill="#c99a9a" />
          <ellipse cx="55" cy="83" rx="3.6" ry="2.4" fill="#c99a9a" />
          <g className="pnd__body">
            {/* Body, then the black band over the shoulders. */}
            <ellipse cx="42" cy="64" rx="27" ry="23" fill="var(--pnd-white, #f5f2ea)" />
            <ellipse cx="42" cy="49" rx="27.5" ry="9.5" fill="var(--pnd-black, #1d1d22)" />
            {/* Arms. */}
            <ellipse className="pnd__armL" cx="17" cy="62" rx="6.4" ry="15" transform="rotate(14 17 62)" fill="var(--pnd-black, #1d1d22)" />
            <ellipse className="pnd__armR" cx="67" cy="62" rx="6.4" ry="15" transform="rotate(-14 67 62)" fill="var(--pnd-black, #1d1d22)" />
            {eating && (
              <g className="pnd__snack">
                {/* A length of bamboo held in both paws, up at the mouth. */}
                <rect x="38.4" y="26" width="6.2" height="44" rx="3" fill="#7fae4c" transform="rotate(-18 41.5 48)" />
                {[34, 46, 58].map((y) => (
                  <rect key={y} x={37.6 + (58 - y) * -0.07} y={y} width="7.8" height="2.4" rx="1.2" fill="#5f8a33" transform="rotate(-18 41.5 48)" />
                ))}
                <ellipse cx="50" cy="22" rx="3" ry="7.5" transform="rotate(-50 50 22)" fill="#8cc152" />
              </g>
            )}
            {/* Head. */}
            <g className="pnd__head">
              <circle cx="24" cy="15" r="7.4" fill="var(--pnd-black, #1d1d22)" />
              <circle cx="60" cy="15" r="7.4" fill="var(--pnd-black, #1d1d22)" />
              <ellipse cx="42" cy="31" rx="21" ry="18.5" fill="var(--pnd-white, #f5f2ea)" />
              <ellipse cx="32" cy="31" rx="5.6" ry="7.2" transform="rotate(22 32 31)" fill="var(--pnd-black, #1d1d22)" />
              <ellipse cx="52" cy="31" rx="5.6" ry="7.2" transform="rotate(-22 52 31)" fill="var(--pnd-black, #1d1d22)" />
              {sleeping ? (
                <g stroke="#f5f2ea" strokeWidth="1.8" strokeLinecap="round" fill="none">
                  <path d="M29.6 31 q2.6 2.2 5.2 0" />
                  <path d="M49.2 31 q2.6 2.2 5.2 0" />
                </g>
              ) : (
                <g>
                  <ellipse className="pnd__eye" cx="32.4" cy="31" rx="2.3" ry="2.7" fill="#fff" />
                  <ellipse className="pnd__eye" cx="51.6" cy="31" rx="2.3" ry="2.7" fill="#fff" />
                  <circle cx="32.6" cy="31.4" r="1.3" fill="#0b0b0e" />
                  <circle cx="51.4" cy="31.4" r="1.3" fill="#0b0b0e" />
                </g>
              )}
              <ellipse cx="42" cy="40" rx="8.4" ry="5.6" fill="var(--pnd-white, #f5f2ea)" />
              <ellipse cx="42" cy="37.4" rx="3.4" ry="2.3" fill="var(--pnd-black, #1d1d22)" />
              <path d="M38.6 41.4 q3.4 3 6.8 0" stroke="#3a3a42" strokeWidth="1.1" fill="none" strokeLinecap="round" />
              <ellipse cx="27" cy="39.5" rx="3.6" ry="2" fill="#f2a5a5" opacity="0.7" />
              <ellipse cx="57" cy="39.5" rx="3.6" ry="2" fill="#f2a5a5" opacity="0.7" />
            </g>
          </g>
        </g>
      )}
    </svg>
  );
}

/** A paw print: the small icon the grove uses for bullets and markers. */
export function Paw({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={`paw${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <ellipse cx="12" cy="16.2" rx="5.6" ry="4.4" />
      <ellipse cx="5.2" cy="10.6" rx="2.3" ry="3" transform="rotate(-18 5.2 10.6)" />
      <ellipse cx="9.4" cy="5.8" rx="2.3" ry="3.1" transform="rotate(-6 9.4 5.8)" />
      <ellipse cx="14.6" cy="5.8" rx="2.3" ry="3.1" transform="rotate(6 14.6 5.8)" />
      <ellipse cx="18.8" cy="10.6" rx="2.3" ry="3" transform="rotate(18 18.8 10.6)" />
    </svg>
  );
}

/** A stalk of bamboo, drawn flat: used as a divider and in the footer's grove. */
export function BambooStalk({ height = 60, className }: { height?: number; className?: string }) {
  const nodes = Math.max(2, Math.round(height / 18));
  return (
    <svg className={className} width="9" height={height} viewBox={`0 0 9 ${height}`} aria-hidden="true">
      <rect x="1.5" y="0" width="6" height={height} rx="3" fill="var(--bamboo, #8cc152)" />
      {Array.from({ length: nodes }, (_, i) => (
        <rect key={i} x="0.6" y={(i + 0.6) * (height / (nodes + 0.2))} width="7.8" height="2.4" rx="1.2" fill="var(--bamboo-deep, #5f8a33)" />
      ))}
    </svg>
  );
}
