import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { usePrefersReducedMotion } from '../../lib/motion';

/**
 * Pulls its child a few pixels toward the pointer. Adapted from React Bits'
 * "Magnet" (reactbits.dev/animations/magnet): rewritten on motion springs
 * with a small, capped pull so the target never runs from the cursor, and
 * inert for touch and reduced motion.
 */
export function Magnet({ children, strength = 0.22, max = 10, className }: { children: React.ReactNode; strength?: number; max?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 260, damping: 18, mass: 0.6 });
  const y = useSpring(my, { stiffness: 260, damping: 18, mass: 0.6 });

  const onMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) * strength;
    const dy = (e.clientY - (r.top + r.height / 2)) * strength;
    mx.set(Math.max(-max, Math.min(max, dx)));
    my.set(Math.max(-max, Math.min(max, dy)));
  };
  const reset = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.span ref={ref} className={`inline-flex ${className ?? ''}`} style={{ x, y }} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </motion.span>
  );
}
