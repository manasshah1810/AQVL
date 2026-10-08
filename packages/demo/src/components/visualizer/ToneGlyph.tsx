import React from 'react';
import type { EventTone } from './events';

/** A small shape per tone, so the chip never relies on colour alone. */
export function ToneGlyph({ tone, size = 12 }: { tone: EventTone; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 12 12', 'aria-hidden': true } as const;
  switch (tone) {
    case 'compare':
      return (
        <svg {...common}>
          <rect x="1.5" y="4" width="3" height="7" rx="0.6" fill="currentColor" />
          <rect x="7.5" y="1" width="3" height="10" rx="0.6" fill="currentColor" />
        </svg>
      );
    case 'mutate':
      return (
        <svg {...common}>
          <path d="M6 0.8 L11.2 6 L6 11.2 L0.8 6 Z" fill="currentColor" />
        </svg>
      );
    case 'visit':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'settle':
      return (
        <svg {...common}>
          <path d="M1.6 6.4 L4.6 9.2 L10.4 2.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'discard':
      return (
        <svg {...common}>
          <path d="M2.4 2.4 L9.6 9.6 M9.6 2.4 L2.4 9.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'mark':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 1.6" />
        </svg>
      );
    case 'error':
      return (
        <svg {...common}>
          <path d="M6 1 L11.2 10.6 L0.8 10.6 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6 4.6 V7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="6" cy="8.9" r="0.8" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.4" fill="currentColor" />
        </svg>
      );
  }
}
