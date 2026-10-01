import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, E, clamp, hash, ip, lerp, noise1, rng } from '../../lib/core';
import { Grain, Vignette } from '../../lib/fx';
import { MONO, SANS, SERIF } from '../../fonts';
import { Student } from './shared';
import { LiveGraph } from '../viz/LiveGraph';

export const CODE = `void dijkstra(int src, vector<vector<pair<int,int>>>& adj) {
  priority_queue<pair<int,int>, vector<pair<int,int>>,
                 greater<pair<int,int>>> pq;
  vector<int> dist(adj.size(), INT_MAX);
  dist[src] = 0; pq.push({0, src});
  while (!pq.empty()) {
    auto [d, u] = pq.top(); pq.pop();
    if (d > dist[u]) continue;
    for (auto& [v, w] : adj[u]) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        pq.push({dist[v], v});
      }
    }
  }
  for (int i = 0; i < (int)adj.size(); ++i)
    printf("%d -> %d : %d\\n", src, i, dist[i]);
}
// relax(u, v): if (d[u] + w(u,v) < d[v]) d[v] = d[u] + w(u,v)
// invariant: S = { u : dist[u] final }, Q = V \\ S
// complexity: O((V + E) log V) with binary heap`;

export const Slide: React.FC<{ kind: 'lecture' | 'code' | 'aqvl'; f: number }> = ({ kind, f }) => {
  if (kind === 'aqvl')
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#05060A' }}>
        <LiveGraph f={f} />
      </div>
    );
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#F3EDDD', padding: '56px 72px', color: '#1d1a16' }}>
      <div style={{ fontFamily: SERIF, fontSize: 64, lineHeight: 1 }}>{kind === 'lecture' ? 'Dijkstra’s Algorithm' : 'Implementation'}</div>
      <div style={{ height: 3, background: '#7a2a1a', width: 380, margin: '18px 0 26px' }} />
      {kind === 'lecture' ? (
        <div style={{ display: 'flex', gap: 40 }}>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, lineHeight: 1.75, flex: 1 }}>
            {['Initialize dist[s] = 0, others ∞', 'Extract vertex u with min dist', 'Relax every edge (u, v)', 'Repeat until the queue is empty'].map((b, i) => (
              <div key={i}>• {b}</div>
            ))}
          </div>
          <svg width={360} height={300} viewBox="0 0 360 300">
            {[
              [60, 150, 180, 60],
              [60, 150, 180, 240],
              [180, 60, 300, 150],
              [180, 240, 300, 150],
              [180, 60, 180, 240],
            ].map(([a, b, c, d], i) => (
              <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="#222" strokeWidth={3} />
            ))}
            {[
              [60, 150],
              [180, 60],
              [180, 240],
              [300, 150],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={26} fill="#F3EDDD" stroke="#222" strokeWidth={3} />
            ))}
          </svg>
        </div>
      ) : (
        <pre style={{ fontFamily: MONO, fontSize: 21.5, lineHeight: 1.32, margin: 0, whiteSpace: 'pre', color: '#1d1a16' }}>{CODE}</pre>
      )}
      <div style={{ position: 'absolute', bottom: 28, left: 72, right: 72, display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 20, opacity: 0.55 }}>
        <span>CS 201 · Lecture 7 · Graph Algorithms</span>
        <span>{kind === 'lecture' ? '14 / 38' : '15 / 38'}</span>
      </div>
    </div>
  );
};

const ROWS = (() => {
  const out: { x: number; y: number; s: number; seed: number; row: number }[] = [];
  const rows = [
    { y: 830, s: 0.62, n: 9, x0: 140, dx: 205 },
    { y: 930, s: 0.85, n: 7, x0: 60, dx: 290 },
    { y: 1080, s: 1.25, n: 5, x0: -40, dx: 470 },
  ];
  rows.forEach((r, ri) => {
    for (let i = 0; i < r.n; i++) out.push({ x: r.x0 + i * r.dx + (hash(ri * 10 + i) - 0.5) * 40, y: r.y, s: r.s, seed: ri * 100 + i, row: ri });
  });
  return out;
})();

/**
 * Back of a lecture hall. slide = what the projector shows.
 * confusion 0..1 tilts heads; lit 0..1 swaps warm projector light for AQVL light.
 */
export const Room: React.FC<{ slide: 'lecture' | 'code' | 'aqvl'; dur: number; confusion?: number; lit?: number; push?: [number, number]; switchAt?: number; dutch?: number }> = ({
  slide,
  dur,
  confusion = 0,
  lit = 0,
  push = [1, 1.08],
  switchAt = -1,
  dutch = 0,
}) => {
  const f = useCurrentFrame();
  const z = ip(f, 0, dur, push[0], push[1], E.soft);
  const pan = ip(f, 0, dur, 30, -30, E.soft);
  const flick = 0.93 + 0.07 * noise1(f * 0.9, 5) + (hash(f) > 0.93 ? -0.08 : 0);
  const kind = switchAt >= 0 && f < switchAt ? 'lecture' : slide;
  const sw = switchAt >= 0 ? clamp(1 - Math.abs(f - switchAt) / 3) : 0; // projector clunk dip
  const beam = lit > 0 ? `rgba(150,180,255,${0.1 + 0.05 * lit})` : 'rgba(255,214,160,0.16)';
  const rim = lit > 0.5 ? 'rgba(170,195,255,0.65)' : 'rgba(255,214,160,0.55)';
  const motes = [];
  const R = rng(4);
  for (let i = 0; i < 70; i++) {
    const t = R();
    const x = lerp(960, lerp(560, 1360, R()), t) + noise1(f / 40 + i, i) * 20;
    const y = lerp(900, lerp(140, 640, R()), t) + noise1(f / 50 + i * 3, i + 3) * 20;
    motes.push(<circle key={i} cx={x} cy={y} r={0.8 + R() * 1.8} fill={lit > 0.5 ? '#cfdcff' : '#ffe4bd'} opacity={0.25 + 0.4 * R()} />);
  }
  return (
    <AbsoluteFill style={{ background: lit > 0.5 ? '#06070C' : '#120C08', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateX(${pan * 0.3}px) scale(${z}) rotate(${dutch}deg)`, transformOrigin: '50% 40%' }}>
        {/* wall glow around the screen */}
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 50% 45% at 50% 35%, ${lit > 0.5 ? 'rgba(120,150,255,0.18)' : 'rgba(255,200,140,0.22)'}, rgba(0,0,0,0) 70%)` }} />
        {/* screen with slight keystone */}
        <div style={{ position: 'absolute', left: 560, top: 110, width: 800, height: 450, perspective: 1200 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 1280,
              height: 720,
              transform: 'scale(0.625) rotateX(3deg)',
              transformOrigin: '0 0',
              filter: `brightness(${(flick - sw * 0.5) * (lit > 0.5 ? 1.05 : 0.92)}) sepia(${lit > 0.5 ? 0 : 0.25})`,
              boxShadow: '0 0 80px rgba(255,220,170,0.25)',
              overflow: 'hidden',
            }}
          >
            <Slide kind={kind} f={f} />
          </div>
        </div>
        {/* projector beam + motes */}
        <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
          <defs>
            <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor={beam} />
              <stop offset="1" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          <polygon points="940,905 980,905 1360,560 560,560" fill="url(#beam)" style={{ filter: 'blur(14px)' }} opacity={flick} />
          {motes}
        </svg>
        {/* overhead projector */}
        <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <rect x={880} y={905} width={160} height={70} rx={8} fill="#0a0705" />
          <rect x={955} y={800} width={10} height={110} fill="#0a0705" />
          <rect x={930} y={790} width={60} height={34} rx={6} fill="#0a0705" />
          <circle cx={960} cy={905} r={6} fill={lit > 0.5 ? '#bcd0ff' : '#ffe2b0'} opacity={0.9} />
        </svg>
        {/* rows of students, parallax by row */}
        <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {ROWS.map((st, i) => {
            const conf = clamp(confusion * 1.6 - hash(i * 3.3) * 0.6);
            const tilt = conf * (hash(i * 5.1) > 0.5 ? 1 : -1) * (8 + hash(i) * 10);
            const nod = lit > 0.5 ? Math.max(0, Math.sin((f + i * 7) / 6)) * 4 * (hash(i * 2.2) > 0.6 ? 1 : 0) : 0;
            return (
              <g key={i} transform={`translate(${pan * (st.row + 1) * 0.6} 0)`}>
                <Student x={st.x} y={st.y} s={st.s} seed={st.seed} tilt={tilt} nod={nod - conf * 6} rim={rim} />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
      <Vignette strength={0.75} color="5,3,2" />
      <Grain opacity={0.26} />
    </AbsoluteFill>
  );
};
