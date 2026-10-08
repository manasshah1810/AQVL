import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { governor, perfCounters, perfExtras } from './perf';

/**
 * Development readout, shown only with `?perf` (or `localStorage['aqvl.perf']='1'`).
 * A plain DOM element rewritten four times a second: it costs nothing per frame
 * beyond a few additions, and never touches React state.
 */
export function PerfMonitor() {
  const gl = useThree((s) => s.gl);
  const box = useRef<HTMLPreElement | null>(null);
  const acc = useRef({ frames: 0, ms: 0, worst: 0, since: performance.now() });

  useEffect(() => {
    const el = document.createElement('pre');
    Object.assign(el.style, {
      position: 'absolute',
      left: '8px',
      bottom: '8px',
      margin: '0',
      padding: '6px 8px',
      font: '11px/1.35 ui-monospace, monospace',
      color: '#c8ffd0',
      background: 'rgba(0,0,0,0.62)',
      borderRadius: '6px',
      pointerEvents: 'none',
      zIndex: '50',
      whiteSpace: 'pre',
    } satisfies Partial<CSSStyleDeclaration>);
    el.setAttribute('data-perf-monitor', '');
    gl.domElement.parentElement?.appendChild(el);
    box.current = el;
    return () => {
      el.remove();
      box.current = null;
    };
  }, [gl]);

  useFrame((_, delta) => {
    const a = acc.current;
    a.frames++;
    a.ms += delta * 1000;
    a.worst = Math.max(a.worst, delta * 1000);
    const now = performance.now();
    if (now - a.since < 250 || !box.current) return;
    const info = gl.info;
    const fps = (a.frames * 1000) / (now - a.since);
    const lines = [
      `FPS         ${fps.toFixed(0)}  (target ${perfCounters.targetFps}, pace ${governor.pace})`,
      `Frame       ${(a.ms / a.frames).toFixed(1)} ms avg, ${a.worst.toFixed(1)} ms worst`,
      `JS / frame  ${perfCounters.jsMs.toFixed(2)} ms`,
      `Draw calls  ${info.render.calls}`,
      `Triangles   ${info.render.triangles}`,
      `Geometries  ${info.memory.geometries}   Textures ${info.memory.textures}`,
      `Animals     ${perfCounters.animalsVisible} in view / ${perfCounters.animalsAwake} awake / ${perfCounters.animalsTotal}`,
      `Animating   ${perfCounters.animations}${perfCounters.offscreen ? '  (canvas off-screen: resting)' : ''}`,
      ...Object.entries(perfExtras).map(([k, v]) => `${k.padEnd(11)} ${v}`),
    ];
    box.current.textContent = lines.join('\n');
    acc.current = { frames: 0, ms: 0, worst: 0, since: now };
  });
  return null;
}
