import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { ip } from '../lib/core';
import { Canvas2D, Grain, Vignette, bloom } from '../lib/fx';
import { Label, Words } from '../lib/type';
import { drawBST, drawBinarySearch, drawDP, drawDijkstra, drawHash, drawHeap, drawLinkedList, drawQuickSort, drawRecursion, drawTrie } from './viz/algos';

type V = { draw: (ctx: CanvasRenderingContext2D, f: number, dur: number) => void; dur: number; label: string; word?: string; speed?: number };
// cuts land on an implied 120bpm grid (15f), accelerating into the drop
const VIGNETTES: V[] = [
  { draw: drawQuickSort, dur: 45, label: 'QUICK SORT', word: 'Every swap.' },
  { draw: drawDijkstra, dur: 45, label: 'DIJKSTRA · SHORTEST PATH', word: 'Every path.' },
  { draw: drawBST, dur: 45, label: 'BINARY SEARCH TREE', word: 'Every branch.' },
  { draw: drawRecursion, dur: 30, label: 'RECURSION · CALL STACK', word: 'Every call.' },
  { draw: drawDP, dur: 30, label: 'DYNAMIC PROGRAMMING · LCS' },
  { draw: drawBinarySearch, dur: 22, label: 'BINARY SEARCH' },
  { draw: drawLinkedList, dur: 18, label: 'LINKED LIST · REVERSE' },
  { draw: drawHash, dur: 15, label: 'HASH MAP' },
  { draw: drawHeap, dur: 10, label: 'HEAP · SIFT UP' },
  { draw: drawTrie, dur: 10, label: 'TRIE' },
];
export const MONTAGE_DUR = VIGNETTES.reduce((a, v) => a + v.dur, 0);

const Vig: React.FC<{ v: V; i: number }> = ({ v, i }) => {
  const f = useCurrentFrame();
  // speed ramp: each shot starts fast and eases (in-shot time remap)
  const tf = v.dur * (1 - Math.pow(1 - f / v.dur, 1.6));
  const punch = ip(f, 0, 4, 0.35, 0);
  return (
    <AbsoluteFill>
      <Canvas2D
        draw={(ctx) => {
          v.draw(ctx, tf, v.dur);
          bloom(ctx, 0.8 + punch, 5);
          if (punch > 0) {
            ctx.fillStyle = `rgba(255,255,255,${punch * 0.25})`;
            ctx.fillRect(0, 0, 1920, 1080);
          }
        }}
      />
      {v.word && <Words text={v.word} f={f} at={2} x={120} y={110} size={92} />}
      <Label f={f} idx={String(i + 1).padStart(2, '0')} text={v.label} />
      <Vignette strength={0.5} />
      <Grain opacity={0.1} blend="screen" />
    </AbsoluteFill>
  );
};

export const Montage: React.FC = () => {
  let at = 0;
  return (
    <AbsoluteFill>
      {VIGNETTES.map((v, i) => {
        const from = at;
        at += v.dur;
        return (
          <Sequence key={i} from={from} durationInFrames={v.dur}>
            <Vig v={v} i={i} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
