import React from 'react';

export type PenguinPose = 'stand' | 'wave' | 'peek' | 'slide' | 'sleep' | 'point';

interface PenguinProps {
  /** Height in px (the width follows). */
  size?: number;
  pose?: PenguinPose;
  /** Knitted scarf colour (a stripe pair), or none. */
  scarf?: [string, string] | null;
  className?: string;
  /** Decorative by default (the page says it all without it). */
  title?: string;
}

/**
 * The AQVL penguin: a round, soft-edged little animal in flat colour, drawn
 * with the same blobs as its 3D self (dark back, cream belly, orange beak
 * and feet, a blush on each cheek). Poses move with CSS (see
 * styles/world-penguin.css), so they cost nothing and stop under reduced motion.
 */
export function Penguin({ size = 64, pose = 'stand', scarf = ['#c8406a', '#f6e7d2'], className, title }: PenguinProps) {
  const width = pose === 'slide' ? size * 1.45 : size * 0.86;
  const slide = pose === 'slide';
  const sleeping = pose === 'sleep';
  return (
    <svg
      className={`pen pen--${pose}${className ? ` ${className}` : ''}`}
      width={width}
      height={size}
      viewBox={slide ? '0 0 116 80' : '0 0 80 92'}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {slide ? (
        <g className="pen__all" transform="translate(4 6)">
          {/* Belly-sliding: flat on the ice, flippers swept back, a spray of snow behind. */}
          <ellipse cx="46" cy="64" rx="44" ry="5" fill="rgb(0 0 0 / 0.16)" />
          <ellipse cx="50" cy="46" rx="40" ry="20" fill="var(--pen-ink, #253047)" />
          <ellipse cx="54" cy="52" rx="32" ry="14" fill="var(--pen-belly, #f6f3ec)" />
          <circle cx="86" cy="36" r="15" fill="var(--pen-ink, #253047)" />
          <ellipse cx="90" cy="40" rx="9" ry="8" fill="var(--pen-belly, #f6f3ec)" />
          <circle cx="90" cy="34" r="2.4" fill="#0b0d12" />
          <path d="M99 40 L110 43 L99 46 Z" fill="#f39a2e" />
          <ellipse className="pen__flipL" cx="42" cy="38" rx="5" ry="14" transform="rotate(70 42 38)" fill="var(--pen-ink, #253047)" />
          <ellipse cx="10" cy="52" rx="6" ry="3.4" fill="#f39a2e" />
          <circle className="pen__spray" cx="-2" cy="54" r="2.2" fill="#e8f4ff" />
          <circle className="pen__spray pen__spray--b" cx="2" cy="46" r="1.6" fill="#e8f4ff" />
        </g>
      ) : (
        <g className="pen__all">
          <ellipse cx="40" cy="86" rx="22" ry="3.4" fill="rgb(0 0 0 / 0.16)" />
          {/* Feet. */}
          <ellipse className="pen__footL" cx="30" cy="84" rx="8.5" ry="3.4" fill="#f39a2e" />
          <ellipse className="pen__footR" cx="50" cy="84" rx="8.5" ry="3.4" fill="#f39a2e" />
          <g className="pen__body">
            {/* Flippers, then the back, then the belly over it. */}
            <ellipse className="pen__flipL" cx="17" cy="56" rx="5.5" ry="17" transform="rotate(14 17 56)" fill="var(--pen-ink, #253047)" />
            <ellipse className="pen__flipR" cx="63" cy="56" rx="5.5" ry="17" transform="rotate(-14 63 56)" fill="var(--pen-ink, #253047)" />
            <ellipse cx="40" cy="58" rx="25" ry="29" fill="var(--pen-ink, #253047)" />
            <ellipse cx="40" cy="62" rx="19" ry="25" fill="var(--pen-belly, #f6f3ec)" />
            {scarf && (
              <g>
                <path d="M19 40 Q40 52 61 40 L61 47 Q40 59 19 47 Z" fill={scarf[0]} />
                <path d="M27 46.5 Q40 54 53 46.5 L53 49.5 Q40 57 27 49.5 Z" fill={scarf[1]} />
                <rect x="50" y="48" width="8" height="17" rx="3" fill={scarf[0]} transform="rotate(-8 54 56)" />
                <rect x="50" y="56" width="8" height="3.4" fill={scarf[1]} transform="rotate(-8 54 56)" />
              </g>
            )}
            {/* Head. */}
            <g className="pen__head">
              <ellipse cx="40" cy="30" rx="19" ry="17.5" fill="var(--pen-ink, #253047)" />
              <ellipse cx="40" cy="34" rx="13" ry="11" fill="var(--pen-belly, #f6f3ec)" />
              {sleeping ? (
                <g stroke="#0b0d12" strokeWidth="1.8" strokeLinecap="round" fill="none">
                  <path d="M29 30 q3 2.4 6 0" />
                  <path d="M45 30 q3 2.4 6 0" />
                </g>
              ) : (
                <g>
                  <ellipse className="pen__eye" cx="32" cy="30" rx="2.6" ry="3.4" fill="#0b0d12" />
                  <ellipse className="pen__eye" cx="48" cy="30" rx="2.6" ry="3.4" fill="#0b0d12" />
                  <circle cx="33" cy="28.6" r="0.9" fill="#fff" />
                  <circle cx="49" cy="28.6" r="0.9" fill="#fff" />
                </g>
              )}
              <ellipse cx="26" cy="36" rx="3.4" ry="2" fill="#f2a0a8" opacity="0.85" />
              <ellipse cx="54" cy="36" rx="3.4" ry="2" fill="#f2a0a8" opacity="0.85" />
              <path d="M34.5 36 Q40 33.2 45.5 36 Q40 43 34.5 36 Z" fill="#f39a2e" />
            </g>
          </g>
        </g>
      )}
    </svg>
  );
}
