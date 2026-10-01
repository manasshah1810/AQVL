// The AQVL world: four hero algorithms + breadth reveal in ONE continuous camera move.
import React from 'react';
import {PRESETS, spring, stag, pulse, clamp, camPath, rng, type CamKey, type V3} from '../lib/motion';
import {Glass, Edge, World, makeProjector, type Cam} from '../lib/rig';
import {HEROES, BREADTH_START, type Built, type SpecNode, type SpecEdge, type SpecLabel} from '../lib/heroes';
import {EditorPanel, Scrubber, Labels, Burst, Focus, AquaVignette, MONO} from '../lib/hud';

const W = 1920, H = 1080;
const K = (t: number, pos: V3, look: V3, fov = 38): CamKey => ({t, pos, look, fov});
const O = (c: V3, az: number, el: number, d: number): V3 => {
  const A = (az * Math.PI) / 180, E = (el * Math.PI) / 180;
  return [c[0] + d * Math.sin(A) * Math.cos(E), c[1] + d * Math.sin(E), c[2] + d * Math.cos(A) * Math.cos(E)];
};
const C1: V3 = [0.3, 1.6, 0], C2: V3 = [21, 3.2, -4], C3: V3 = [38, 3.2, 3], C4: V3 = [56, 1.5, -4.5], CB: V3 = [35, -2.5, -10];
const KEYS: CamKey[] = [
  K(14.5, O(C1, -44, 17, 22), C1),
  K(15.5, O(C1, -40, 18, 21), C1),
  K(18.0, O(C1, -14, 26, 19), C1),
  K(20.0, O(C1, 28, 20, 17), [3, 1.6, 0.5]),
  K(21.6, O(C2, -34, 16, 21), C2),
  K(23.6, O(C2, -8, 22, 20), C2),
  K(25.8, O(C2, 30, 22, 21), C2),
  K(27.4, O(C3, -24, 14, 21), C3),
  K(29.6, O(C3, -2, 20, 19), C3),
  K(31.0, O(C3, 22, 18, 20), [42, 3, 2]),
  K(32.0, O(C4, -32, 20, 21), C4),
  K(33.6, O(C4, -8, 24, 19), C4),
  K(35.2, O(C4, 22, 22, 18), C4),
  K(36.8, O([46, -1, -8], 16, 28, 34), [46, -1, -8], 44),
  K(38.9, O(CB, 0, 38, 36), CB, 46),
  K(41.0, O(CB, -4, 40, 36), CB, 46),
];

export const SHIFT_PANEL = 0.36;
export const worldCam = (t: number): Cam & {raw: Cam} => {
  const c = camPath(KEYS, t);
  let pos: V3 = [...c.pos], look: V3 = [...c.look], fov = c.fov;
  // focus-pull: ease toward the key action, tiny push-in
  for (const h of HEROES) {
    for (const e of h.events) {
      const te = h.t0 + e.t;
      const w = pulse(t - te + 0.05, 0.22, 0.7) * e.s * 0.2;
      if (w <= 0.0005) continue;
      const tgt: V3 = [h.anchor[0] + e.p[0], h.anchor[1] + e.p[1], h.anchor[2] + e.p[2]];
      look = [look[0] + (tgt[0] - look[0]) * w, look[1] + (tgt[1] - look[1]) * w, look[2] + (tgt[2] - look[2]) * w];
      pos = [pos[0] + (tgt[0] - pos[0]) * w * 0.1, pos[1] + (tgt[1] - pos[1]) * w * 0.1, pos[2] + (tgt[2] - pos[2]) * w * 0.1];
      fov -= w * 4;
    }
  }
  const raw: Cam = {pos: [...pos], look: [...look], fov};
  // frame shift: structures sit right of the editor while it is on screen
  const shift = SHIFT_PANEL * (1 - spring(t - (BREADTH_START - 0.1), PRESETS.float)) * clamp((t - 14) * 2);
  const d: V3 = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]];
  const dl = Math.hypot(...d);
  const dn: V3 = [d[0] / dl, d[1] / dl, d[2] / dl];
  const right: V3 = [-dn[2], 0, dn[0]];
  const rl = Math.hypot(right[0], right[2]) || 1;
  const s = -shift * dl * Math.tan((fov * Math.PI) / 360) * (W / H);
  pos = [pos[0] + (right[0] / rl) * s, pos[1], pos[2] + (right[2] / rl) * s];
  look = [look[0] + (right[0] / rl) * s, look[1], look[2] + (right[2] / rl) * s];
  return {pos, look, fov, raw};
};

// ───────── breadth: many structures in the same space ─────────
type Extra = {nodes: SpecNode[]; edges: SpecEdge[]};
const mkExtras = (): Extra[] => {
  const r = rng(7);
  const out: Extra[] = [];
  const mk = (): Extra => ({nodes: [], edges: []});
  // linked list
  {
    const e = mk();
    const c: V3[] = Array.from({length: 7}, (_, i) => [6 + i * 2.1, 0.8, -11 + Math.sin(i * 0.8) * 1.6]);
    c.forEach((p, i) => { e.nodes.push({id: 'll' + i, p, size: 0.6}); if (i) e.edges.push({id: 'lle' + i, a: c[i - 1], b: p}); });
    out.push(e);
  }
  // DP grid
  {
    const e = mk();
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const hgt = 0.25 + ((i * 5 + j * 3) % 7) * 0.12;
      e.nodes.push({id: `dp${i}${j}`, p: [22 + j * 1.35, hgt / 2, -12 - i * 1.35], size: [1.15, hgt, 1.15], shape: 'box'});
    }
    out.push(e);
  }
  // ring + spokes
  {
    const e = mk();
    const cen: V3 = [43, 2.2, -14];
    const pts: V3[] = Array.from({length: 9}, (_, i) => [cen[0] + Math.cos((i / 9) * Math.PI * 2) * 4, cen[1] + Math.sin(i * 1.7) * 0.6, cen[2] + Math.sin((i / 9) * Math.PI * 2) * 4]);
    pts.forEach((p, i) => { e.nodes.push({id: 'rg' + i, p, size: 0.55}); e.edges.push({id: 'rge' + i, a: p, b: pts[(i + 1) % 9]}); if (i % 3 === 0) e.edges.push({id: 'rgs' + i, a: p, b: cen}); });
    e.nodes.push({id: 'rgc', p: cen, size: 0.7});
    out.push(e);
  }
  // force-directed cluster
  {
    const e = mk();
    const pts: V3[] = Array.from({length: 11}, () => [62 + (r() - 0.5) * 9, 1.4 + r() * 4, -12 + (r() - 0.5) * 7]);
    pts.forEach((p, i) => e.nodes.push({id: 'fd' + i, p, size: 0.45 + r() * 0.3}));
    for (let i = 1; i < pts.length; i++) e.edges.push({id: 'fde' + i, a: pts[i], b: pts[Math.floor(r() * i)]});
    e.edges.push({id: 'fdx', a: pts[3], b: pts[9]});
    out.push(e);
  }
  // hash buckets
  {
    const e = mk();
    for (let i = 0; i < 6; i++) {
      const hgt = 0.7;
      e.nodes.push({id: 'hb' + i, p: [10 + i * 1.7, hgt / 2, -19], size: [1.3, hgt, 1.3], shape: 'box'});
      const chain = (i * 5) % 4;
      for (let j = 0; j < chain; j++) { e.nodes.push({id: `hc${i}${j}`, p: [10 + i * 1.7, 0.45 + (j + 1) * 1.1, -19], size: 0.4}); e.edges.push({id: `hce${i}${j}`, a: j ? [10 + i * 1.7, 0.45 + j * 1.1, -19] : [10 + i * 1.7, 0.7, -19], b: [10 + i * 1.7, 0.45 + (j + 1) * 1.1, -19]}); }
    }
    out.push(e);
  }
  // small tree
  {
    const e = mk();
    const T: V3[] = [[34, 6, -20], [31, 4.4, -20], [37, 4.4, -20], [29.5, 2.8, -20], [32.5, 2.8, -20], [35.5, 2.8, -20], [38.5, 2.8, -20]];
    T.forEach((p, i) => { e.nodes.push({id: 'tr' + i, p, size: 0.55}); if (i) e.edges.push({id: 'tre' + i, a: T[(i - 1) >> 1], b: p}); });
    out.push(e);
  }
  // stacked slabs + queue
  {
    const e = mk();
    for (let i = 0; i < 4; i++) e.nodes.push({id: 'sq' + i, p: [66, 0.4 + i * 0.7, -12], size: [3, 0.55, 1.6], shape: 'box'});
    for (let i = 0; i < 5; i++) e.nodes.push({id: 'qq' + i, p: [-8 + i * 1.8, 0.5, -14], size: [1.3, 1.0, 1.3], shape: 'box'});
    out.push(e);
  }
  return out;
};
const EXTRAS = mkExtras();
const BX0 = BREADTH_START - 0.4;

const extrasBuild = (t: number): Built => {
  const nodes: SpecNode[] = [], edges: SpecEdge[] = [];
  let gi = 0;
  for (const ex of EXTRAS) {
    for (const n of ex.nodes) {
      const dx = (n.p[0] - 34) / 70;
      const t0 = BX0 + Math.abs(dx) * 1.4 + stag(gi++ % 9, 0.02);
      const a = spring(t - t0, PRESETS.pop);
      const sweep = pulse(t - (BX0 + 0.8 + (n.p[0] + 10) * 0.035), 0.08, 0.45);
      nodes.push({...n, appear: a, active: sweep * 0.8, p: [n.p[0], n.p[1] + (1 - spring(t - t0, PRESETS.heavy)) * 2.5, n.p[2]]});
    }
    for (const e of ex.edges) {
      const t0 = BX0 + 0.25 + Math.abs((e.a[0] - 34) / 70) * 1.4;
      const sweep = pulse(t - (BX0 + 0.8 + (e.a[0] + 10) * 0.035), 0.08, 0.45);
      edges.push({...e, grow: clamp(spring(t - t0, PRESETS.snap), 0, 1), active: sweep * 0.7});
    }
  }
  return {nodes, edges, labels: [] as SpecLabel[]};
};

const Tagline: React.FC<{t: number; t0: number; text: string; y: number; size: number}> = ({t, t0, text, y, size}) => {
  const chars = [...text];
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', fontFamily: MONO, fontSize: size, fontWeight: 600, color: '#eaf3ff', letterSpacing: 1}}>
      {chars.map((c, i) => {
        const k = spring(t - (t0 + stag(i, 0.028)), PRESETS.snap);
        const k2 = spring(t - (t0 + stag(i, 0.028) + 0.6), PRESETS.float);
        const ac = i >= text.indexOf('Watch') ? COL_AMBER : '#eaf3ff';
        return <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', opacity: clamp(k * 1.5), transform: `translateY(${(1 - k) * 34}px)`, color: ac, textShadow: '0 0 30px rgba(0,0,0,0.8)', filter: `blur(${(1 - clamp(k)) * 6}px)`}}>{c}{void k2}</span>;
      })}
    </div>
  );
};
const COL_AMBER = '#ffcf7a';
export {Tagline};

export const WorldScene: React.FC<{t: number; panelT: number}> = ({t, panelT}) => {
  const cam = worldCam(t);
  const proj = makeProjector(cam, W, H);
  const floorFade = spring(t - WORLD_T0, PRESETS.float);
  const hero = HEROES.map((h) => ({h, b: h.build(t - h.t0)}));
  const ex = extrasBuild(t);
  // visible heroes: spring in a bit before the camera arrives
  const vis = (i: number) => i === 0 || t > HEROES[i].t0 - 1.4;
  const labels: (SpecLabel & {anchor: V3})[] = [];
  hero.forEach(({h, b}, i) => { if (vis(i)) b.labels.forEach((l) => labels.push({...l, anchor: h.anchor})); });
  const labs = labels.map((l) => ({...l, p: [l.p[0] + l.anchor[0], l.p[1] + l.anchor[1], l.p[2] + l.anchor[2]] as V3}));
  // bursts + focus
  let fx = 1190, fy = 470, fa = 0;
  const bursts: {x: number; y: number; k: number; s: number}[] = [];
  for (const h of HEROES) for (const e of h.events) {
    const te = h.t0 + e.t;
    const k = pulse(t - te, 0.05, 0.38) * 1.0;
    const q = proj([h.anchor[0] + e.p[0], h.anchor[1] + e.p[1], h.anchor[2] + e.p[2]]);
    if (k > 0.01) bursts.push({x: q.x, y: q.y, k, s: e.s});
    const w = pulse(t - te + 0.1, 0.25, 0.8);
    if (w > fa) { fa = w; fx = q.x; fy = q.y; }
  }
  const showTag = t > BREADTH_START + 0.4;
  return (
    <div style={{position: 'absolute', inset: 0, width: W, height: H, background: '#0b121c', overflow: 'hidden'}}>
      <World cam={cam} width={W} height={H} floorFade={floorFade} pool={[cam.raw.look[0], cam.raw.look[2]]}>
        {hero.map(({h, b}, i) => vis(i) && (
          <group key={h.id} position={h.anchor}>
            {b.edges.map((e) => <Edge key={e.id} {...e} />)}
            {b.nodes.map((n) => <Glass key={n.id} {...n} />)}
          </group>
        ))}
        <group>
          {ex.edges.map((e) => <Edge key={e.id} {...e} />)}
          {ex.nodes.map((n) => <Glass key={n.id} {...n} />)}
        </group>
      </World>
      <Focus x={fx} y={fy} amount={clamp(fa)} />
      <Labels items={labs} proj={proj} />
      {bursts.map((b, i) => <Burst key={i} x={b.x} y={b.y} k={b.k} size={560 * b.s} />)}
      <AquaVignette />
      <EditorPanel t={t} panelT={panelT} out={BREADTH_START - 0.1} />
      <Scrubber t={t} panelT={panelT} />
      {showTag && <Tagline t={t} t0={BREADTH_START + 0.6} text="Write the algorithm. Watch it think." y={915} size={50} />}
    </div>
  );
};
const WORLD_T0 = HEROES[0].t0;
