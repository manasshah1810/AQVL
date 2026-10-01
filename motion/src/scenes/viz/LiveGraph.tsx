import React from 'react';
import { Canvas2D, bloom } from '../../lib/fx';
import { drawDijkstra } from './algos';
export const LiveGraph: React.FC<{ f: number }> = ({ f }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: 'scale(0.6667)', transformOrigin: '0 0' }}>
    <Canvas2D
      draw={(ctx) => {
        drawDijkstra(ctx, 20 + (f % 70), 95, { dist: 17 });
        bloom(ctx, 0.8, 5);
      }}
    />
  </div>
);
