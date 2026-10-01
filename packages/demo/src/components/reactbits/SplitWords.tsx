import React from 'react';
import { motion } from 'motion/react';
import { spring, usePrefersReducedMotion, waveDelay } from '../../lib/motion';

/**
 * Word-by-word reveal. Adapted from React Bits' "SplitText"
 * (reactbits.dev/text-animations/split-text): rebuilt on motion springs,
 * transform + opacity only, wave-shaped delays instead of a flat stagger,
 * and screen readers get the sentence once instead of word fragments.
 */
interface SplitWordsProps {
  text: string;
  className?: string;
  /** Total spread of the wave across the sentence, seconds. */
  span?: number;
  delay?: number;
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3';
  /** Animate when scrolled into view rather than on mount. */
  inView?: boolean;
}

export function SplitWords({ text, className, span = 0.5, delay = 0, as = 'p', inView = false }: SplitWordsProps) {
  const reduced = usePrefersReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const Tag = motion[as];

  if (reduced) {
    const Plain = as;
    return <Plain className={className}>{text}</Plain>;
  }

  const trigger = inView
    ? { initial: 'hidden', whileInView: 'shown', viewport: { once: true, margin: '0px 0px -12% 0px' } }
    : { initial: 'hidden', animate: 'shown' };

  return (
    <Tag className={className} {...trigger}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <React.Fragment key={`${w}-${i}`}>
          <span aria-hidden="true" style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.08em' }}>
            <motion.span
              style={{ display: 'inline-block' }}
              variants={{
                hidden: { y: '105%', opacity: 0 },
                shown: { y: '0%', opacity: 1, transition: { ...spring.gentle, delay: delay + waveDelay(i, words.length, span) } },
              }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </Tag>
  );
}
