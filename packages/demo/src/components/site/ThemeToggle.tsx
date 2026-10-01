import React from 'react';
import { motion } from 'motion/react';
import { setTheme, useTheme } from '../../lib/theme';
import { spring } from '../../lib/motion';

/**
 * Light/dark switch. The glyph is a disc split down the middle; the filled
 * half turns over on a spring when the theme changes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Keyboard activation reports 0,0; reveal from the button either way.
    setTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  return (
    <button
      type="button"
      className={`icon-btn ${className ?? ''}`}
      onClick={onClick}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <motion.svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        aria-hidden="true"
        initial={false}
        animate={{ rotate: theme === 'dark' ? 0 : 180 }}
        transition={spring.lively}
      >
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2.75 A7.25 7.25 0 0 1 10 17.25 Z" fill="currentColor" />
      </motion.svg>
    </button>
  );
}
