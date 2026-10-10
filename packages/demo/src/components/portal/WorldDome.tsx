import React, { useEffect, useRef, useState } from 'react';
import { WorldArt } from '../theme/WorldArt';
import { usePrefersReducedMotion } from '../../lib/motion';
import { DOME_WORLDS } from './portalWorlds';
import { DomeScene } from './domeScene';
import './portal.css';

interface Props {
  /** Which world the dome shows (0..3, see DOME_WORLDS). Changing it starts a journey. */
  index: number;
  /** The visitor swiped the dome: asks the parent to move one world along. */
  onStep?: (dir: 1 | -1) => void;
  className?: string;
  label?: string;
}

/**
 * The dome on its own canvas. It draws only while on screen and the tab is
 * visible, falls back to the flat world picture where WebGL is unavailable,
 * and releases its GL context when it leaves the page.
 */
export function WorldDome({ index, onStep, className = '', label = 'A glass dome holding a miniature world' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<DomeScene | null>(null);
  const step = useRef(onStep);
  const first = useRef(index);
  const reduced = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    step.current = onStep;
  });

  useEffect(() => {
    const wrap = host.current;
    if (!wrap) return;
    // A fresh canvas per mount: a context released on cleanup can't be reused (StrictMode remounts).
    const el = document.createElement('canvas');
    el.className = 'dome__canvas';
    wrap.appendChild(el);
    let dome: DomeScene;
    try {
      dome = new DomeScene(el, first.current, { reduced, onStep: (d) => step.current?.(d) });
    } catch (err) {
      void err;
      el.remove();
      queueMicrotask(() => setFailed(true));
      return;
    }
    scene.current = dome;
    const size = () => dome.setSize(wrap.clientWidth, wrap.clientHeight);
    size();
    const ro = new ResizeObserver(size);
    ro.observe(wrap);

    let visible = true;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      dome.frame((now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        wake();
      },
      { rootMargin: '80px' },
    );
    io.observe(wrap);
    document.addEventListener('visibilitychange', wake);
    wake();

    const lost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    el.addEventListener('webglcontextlost', lost);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', wake);
      el.removeEventListener('webglcontextlost', lost);
      dome.dispose();
      el.remove();
      scene.current = null;
    };
  }, [reduced]);

  useEffect(() => {
    scene.current?.travelTo(index);
  }, [index]);

  return (
    <div ref={host} className={`dome ${className}`} role="img" aria-label={label}>
      {failed && (
        <div className="dome__fallback" aria-hidden="true">
          <WorldArt world={DOME_WORLDS[index]} />
        </div>
      )}
    </div>
  );
}
