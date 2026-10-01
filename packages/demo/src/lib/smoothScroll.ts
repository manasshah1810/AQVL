import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap';
import { prefersReducedMotion } from './motion';

/**
 * Lenis smooth scrolling for the long editorial pages, driven from GSAP's
 * ticker so ScrollTrigger scrubs stay locked to the eased scroll position.
 * Off for reduced motion and for touch-first devices (native momentum wins).
 */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return;

    let lenis: Lenis | null = null;
    try {
      lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true });
    } catch {
      return;
    }
    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);
    const tick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add('lenis-on');

    return () => {
      gsap.ticker.remove(tick);
      lenis?.destroy();
      document.documentElement.classList.remove('lenis-on');
    };
  }, [enabled]);
}
