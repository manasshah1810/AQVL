import React, {useLayoutEffect, useRef, useState} from 'react';
import {useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import {Rig} from './rig';

// Hosts the shared rig in a plain WebGL canvas. `draw(rig, t)` must be a pure
// function of t (seconds); the canvas is fully re-rendered every frame.
export type Director = {
  init: (rig: Rig) => void;
  draw: (rig: Rig, t: number) => void;
};

export const Stage: React.FC<{director: () => Director; offset?: number}> = ({director, offset = 0}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{rig: Rig; d: Director} | null>(null);
  const {delayRender, continueRender} = useDelayRender();
  const [handle] = useState(() => delayRender('init rig'));

  useLayoutEffect(() => {
    if (!ref.current || state.current) return;
    const rig = new Rig(ref.current, width, height);
    const d = director();
    d.init(rig);
    state.current = {rig, d};
    continueRender(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const s = state.current;
    if (!s) return;
    s.d.draw(s.rig, frame / fps + offset);
  }, [frame, fps, offset]);

  return <canvas ref={ref} width={width} height={height} style={{width, height, position: 'absolute', inset: 0}} />;
};
