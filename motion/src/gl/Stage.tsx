import React, {useLayoutEffect, useRef, useState} from 'react';
import {useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import {fontReady} from '../lib/fonts';
import {Rig} from './rig';

// Hosts the shared rig in a plain WebGL canvas. `draw(rig, t)` must be a pure
// function of t (seconds); the canvas is fully re-rendered every frame.
export type Director = {
  init: (rig: Rig) => void;
  draw: (rig: Rig, t: number) => void;
};

export const Stage: React.FC<{director: () => Director}> = ({director}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{rig: Rig; d: Director} | null>(null);
  const tNow = useRef(frame / fps);
  tNow.current = frame / fps;
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender('init rig + fonts'));

  useLayoutEffect(() => {
    let alive = true;
    // fonts must be ready before any canvas text or label texture is made
    fontReady()
      .then(() => document.fonts.ready)
      .then(() => {
        if (!alive || !ref.current || state.current) return;
        const rig = new Rig(ref.current, width, height);
        const d = director();
        d.init(rig);
        state.current = {rig, d};
        d.draw(rig, tNow.current);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const s = state.current;
    if (!s) return;
    s.d.draw(s.rig, frame / fps);
  }, [frame, fps]);

  return <canvas ref={ref} width={width} height={height} style={{width, height, position: 'absolute', inset: 0}} />;
};
