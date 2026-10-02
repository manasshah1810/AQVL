import type { SemanticState } from '@aqvl/shared';
import type { ExecutionTrace, TraceEdge, TraceFrame, TraceNode, TraceShape } from '@aqvl/runtime';
import { STAGE_PALETTES, edgeColorFor, type StagePalette, type StageTheme } from '../look/palette';
import { STATE_TREATMENTS } from '../look/treatments';
import { allocateAttention, isMutation } from '../motion/attention';
import { massFor } from '../motion/spring';
import { parseSourceStructure, type SourceStructure } from '../../components/iteration/sourceStructure';
import { writeRgb } from './colors';

/** One node identity across the whole run (an instance slot in the renderer). */
export interface NodeSlot {
  id: string;
  shape: TraceShape;
  family: string;
  structure?: string;
}

export interface EdgeSlot {
  id: string;
  directed: boolean;
}

/** Floor marks: footprints, regions, halos, cursors. Shapes match DecalMaterial. */
export const DECAL_SHAPE = {
  roundRect: 0,
  outline: 1,
  dashedOutline: 2,
  ring: 3,
  dashedRing: 4,
  doubleRing: 5,
  chevron: 6,
} as const;

export interface DecalState {
  key: string;
  shape: number;
  x: number;
  z: number;
  /** Width (x) and depth (z) in world units; rings use w as diameter. */
  w: number;
  d: number;
  color: string;
  alpha: number;
  /** Raise order so overlapping marks layer predictably. */
  layer: number;
}

export interface LabelState {
  key: string;
  text: string;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  opacity: number;
  anchorX: 'left' | 'center' | 'right';
  /** 'mono' for code and values, 'serif' for notes. */
  font: 'mono' | 'serif';
  /**
   * How the text sits in the world:
   *  - 'face': printed on the front face of the node it follows (values), so it never cuts into the body;
   *  - 'floor': a small upright sign standing on the floor in front of what it marks (indices, cursors, ranges);
   *  - 'billboard': turned to the camera (names, tags, the compare relation).
   */
  orient: LabelOrient;
  /**
   * Follows a node: positioned from the node's sampled transform. `dy` is a
   * vertical offset ('face' / 'billboard') or, for 'floor', how far in front
   * of the node's face the text lies.
   */
  follow?: { slot: number; dy: number };
}

export type LabelOrient = 'billboard' | 'face' | 'floor';

/** A halo ring drawn around a node in the air (0 solid, 1 dashed, 2 double). */
export interface RingState {
  slot: number;
  style: number;
  color: string;
}

export type EdgeRouteKind = 'straight' | 'arc' | 'loop';

/** Everything that is true of the scene at rest after a step. */
export interface RestFrame {
  index: number;
  present: Uint8Array;
  /** Centre position per node slot (bars and emphasis lift applied). */
  pos: Float32Array;
  /** Box dimensions per slot (x, y, z). */
  dims: Float32Array;
  color: Float32Array;
  textColor: string[];
  glow: Float32Array;
  finish: Float32Array;
  /** Rotation about the view axis (compare tilt), radians. */
  tilt: Float32Array;
  emphasized: Uint8Array;
  state: SemanticState[];
  text: string[];
  caption: string[];
  mass: Float32Array;
  edgePresent: Uint8Array;
  edgeFrom: Int32Array;
  edgeTo: Int32Array;
  edgeColor: Float32Array;
  edgeWidth: Float32Array;
  edgeRoute: EdgeRouteKind[];
  /** Arc height (arc), or sideways offset (straight). */
  edgeBend: Float32Array;
  edgeLabel: (string | undefined)[];
  decals: DecalState[];
  /** Halo rings around emphasised nodes that float above the floor (trees, graphs). */
  rings: RingState[];
  labels: LabelState[];
  callStack: string[];
  /** What the camera should look at. */
  view: ViewKey;
}

export interface ViewKey {
  center: [number, number, number];
  radius: number;
  /** Half extents of the framed box (x, y, z). */
  half: [number, number, number];
  /** Half extents of the step's neighbourhood (the actors and what is near them). */
  focusHalf: [number, number, number];
  focus: [number, number, number];
  /** True when the scene is spread across the floor (look down more). */
  flat: boolean;
  mode: 'AUTO_FIT' | 'FOCUS' | 'ORBIT' | 'POSITION';
  orbitSpeed: number;
  position?: [number, number, number];
}

const NODE_HEIGHT: Record<TraceShape, number> = { box: 1, sphere: 1.1, cylinder: 1 };
const NODE_WIDTH: Record<TraceShape, number> = { box: 1, sphere: 1.1, cylinder: 1 };
const LOW_NAMES = ['low', 'lo', 'left', 'l', 'start'];
const HIGH_NAMES = ['high', 'hi', 'right', 'r', 'end'];
const MID_NAMES = ['mid', 'middle', 'm'];
const MAX_CURSORS = 4;
const MAX_FRAMES_SHOWN = 9;
const REST_CACHE_SIZE = 64;
/** How far around the step's actors a large scene's camera leans in to. */
const FOCUS_NEIGHBOURHOOD = 4.5;

interface BarScale {
  min: number;
  max: number;
}

/**
 * The trace prepared for drawing: stable slots for every node / edge /
 * tag, the floor height, value-bar scales, and (lazily, cached) the rest
 * picture of each frame. Pure data; no three.js objects.
 */
export class StageModel {
  readonly palette: StagePalette;
  readonly slots: NodeSlot[] = [];
  readonly slotOf = new Map<string, number>();
  readonly edgeSlots: EdgeSlot[] = [];
  readonly edgeSlotOf = new Map<string, number>();
  readonly floorY: number;
  readonly maxCallDepth: number;
  readonly frames: TraceFrame[];
  private readonly bars = new Map<string, BarScale>();
  private readonly massRange = new Map<string, BarScale>();
  private readonly nodeMaps: (Map<string, TraceNode> | undefined)[] = [];
  private readonly restCache = new Map<number, RestFrame>();
  private readonly source: SourceStructure | null;

  constructor(readonly trace: ExecutionTrace, readonly theme: StageTheme, source?: string) {
    this.palette = STAGE_PALETTES[theme];
    this.frames = trace.frames;
    this.source = source ? parseSourceStructure(source) : null;

    const numericByStructure = new Map<string, { min: number; max: number; allNumeric: boolean; count: number; flat: boolean; family: string }>();
    let maxDepth = 0;
    for (const frame of trace.frames) {
      maxDepth = Math.max(maxDepth, frame.callStack.length);
      for (const n of frame.nodes) {
        if (!this.slotOf.has(n.id)) {
          this.slotOf.set(n.id, this.slots.length);
          this.slots.push({ id: n.id, shape: n.shape, family: n.family, structure: n.structure });
        }
        if (n.structure) {
          let s = numericByStructure.get(n.structure);
          if (!s) {
            s = { min: Infinity, max: -Infinity, allNumeric: true, count: 0, flat: true, family: n.family };
            numericByStructure.set(n.structure, s);
          }
          if (n.numeric === undefined) s.allNumeric = false;
          else {
            s.min = Math.min(s.min, n.numeric);
            s.max = Math.max(s.max, n.numeric);
          }
        }
      }
      for (const e of frame.edges) {
        if (!this.edgeSlotOf.has(e.id)) {
          this.edgeSlotOf.set(e.id, this.edgeSlots.length);
          this.edgeSlots.push({ id: e.id, directed: e.directed });
        }
      }
    }
    this.maxCallDepth = maxDepth;

    // Value bars: a flat numeric array shows each value as a height, so order is visible at a glance.
    const first = trace.frames[0];
    for (const [name, s] of numericByStructure) {
      const members = first?.nodes.filter((n) => n.structure === name) ?? [];
      s.count = members.length;
      s.flat = members.length > 0 && members.every((n) => Math.abs(n.pos.y - members[0].pos.y) < 1e-3);
      if (s.allNumeric && s.max > s.min) this.massRange.set(name, { min: s.min, max: s.max });
      if (s.family === 'ARRAY_ELEMENT' && s.allNumeric && s.count >= 3 && s.flat && s.max > s.min) {
        this.bars.set(name, { min: s.min, max: s.max });
      }
    }

    // The floor: just under the lowest node bottom of the whole run, so nothing ever sinks through it.
    let lowest = Infinity;
    for (const frame of trace.frames) {
      for (const n of frame.nodes) lowest = Math.min(lowest, n.pos.y - NODE_HEIGHT[n.shape] / 2);
    }
    this.floorY = Number.isFinite(lowest) ? lowest - 0.002 : -0.5;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  nodeMap(k: number): Map<string, TraceNode> {
    let m = this.nodeMaps[k];
    if (!m) {
      m = new Map(this.frames[k].nodes.map((n) => [n.id, n]));
      this.nodeMaps[k] = m;
    }
    return m;
  }

  isBar(structure: string | undefined): boolean {
    return !!structure && this.bars.has(structure);
  }

  /** Height of a node's body (value bars scale with their value). */
  heightOf(n: TraceNode): number {
    const bar = n.structure ? this.bars.get(n.structure) : undefined;
    if (bar && n.numeric !== undefined) return 0.7 + 1.5 * ((n.numeric - bar.min) / (bar.max - bar.min));
    return NODE_HEIGHT[n.shape];
  }

  massOf(n: TraceNode): number {
    const range = n.structure ? this.massRange.get(n.structure) : undefined;
    return range ? massFor(n.numeric, range.min, range.max) : 1;
  }

  /** The resting picture of frame k (cached). */
  rest(k: number): RestFrame {
    const hit = this.restCache.get(k);
    if (hit) {
      this.restCache.delete(k);
      this.restCache.set(k, hit);
      return hit;
    }
    const built = this.buildRest(k);
    this.restCache.set(k, built);
    if (this.restCache.size > REST_CACHE_SIZE) {
      const oldest = this.restCache.keys().next().value as number;
      this.restCache.delete(oldest);
    }
    return built;
  }

  // ── Rest frame construction ─────────────────────────────────────────────

  private buildRest(k: number): RestFrame {
    const frame = this.frames[k];
    const nSlots = this.slots.length;
    const nEdges = this.edgeSlots.length;
    const palette = this.palette;
    const rest: RestFrame = {
      index: k,
      present: new Uint8Array(nSlots),
      pos: new Float32Array(nSlots * 3),
      dims: new Float32Array(nSlots * 3),
      color: new Float32Array(nSlots * 3),
      textColor: new Array(nSlots).fill(palette.states.NEUTRAL.text),
      glow: new Float32Array(nSlots),
      finish: new Float32Array(nSlots),
      tilt: new Float32Array(nSlots),
      emphasized: new Uint8Array(nSlots),
      state: new Array(nSlots).fill('NEUTRAL'),
      text: new Array(nSlots).fill(''),
      caption: new Array(nSlots).fill(''),
      mass: new Float32Array(nSlots).fill(1),
      edgePresent: new Uint8Array(nEdges),
      edgeFrom: new Int32Array(nEdges).fill(-1),
      edgeTo: new Int32Array(nEdges).fill(-1),
      edgeColor: new Float32Array(nEdges * 3),
      edgeWidth: new Float32Array(nEdges),
      edgeRoute: new Array(nEdges).fill('straight'),
      edgeBend: new Float32Array(nEdges),
      edgeLabel: new Array(nEdges).fill(undefined),
      decals: [],
      rings: [],
      labels: [],
      callStack: frame.callStack,
      view: { center: [0, 0, 0], radius: 4, half: [2, 2, 2], focusHalf: [2, 2, 2], focus: [0, 0, 0], flat: false, mode: 'AUTO_FIT', orbitSpeed: 0 },
    };

    const emphasized = allocateAttention(frame);
    const mutation = isMutation(frame);

    // Nodes.
    for (const n of frame.nodes) {
      const s = this.slotOf.get(n.id)!;
      const treatment = STATE_TREATMENTS[n.state];
      const isEmph = emphasized.includes(n.id);
      const height = this.heightOf(n);
      // A box widens (up to almost two units) to fit a long value such as a vertex name.
      const width = n.shape === 'box' && n.text.length > 3 ? Math.min(1.9, Math.max(1, 0.26 * n.text.length + 0.34)) : NODE_WIDTH[n.shape];
      const scale = treatment.scale * (n.detached ? 0.86 : 1);
      const bottom = n.pos.y - NODE_HEIGHT[n.shape] / 2;
      const lift = isEmph ? treatment.emphasisLift : 0;
      rest.present[s] = 1;
      rest.pos[s * 3] = n.pos.x;
      rest.pos[s * 3 + 1] = bottom + (height * scale) / 2 + lift + treatment.restLift;
      rest.pos[s * 3 + 2] = n.pos.z;
      rest.dims[s * 3] = width * scale;
      rest.dims[s * 3 + 1] = height * scale;
      rest.dims[s * 3 + 2] = NODE_WIDTH[n.shape] * scale;
      writeRgb(rest.color, s, palette.states[n.state].body);
      rest.textColor[s] = palette.states[n.state].text;
      // The aqua glow is the mutation's alone: a node marked as changing outside a mutation step stays unlit.
      rest.glow[s] = isEmph ? (n.state === 'MODIFYING' ? (mutation ? 0.32 : 0) : treatment.glow) : 0;
      rest.finish[s] = treatment.finish;
      rest.emphasized[s] = isEmph ? 1 : 0;
      rest.state[s] = n.state;
      rest.text[s] = n.text;
      rest.caption[s] = n.caption;
      rest.mass[s] = this.massOf(n);
    }

    // A compared pair leans towards each other.
    if (frame.event.kind === 'compare' && emphasized.length === 2) {
      const [a, b] = emphasized.map((id) => this.slotOf.get(id)!);
      const dir = Math.sign(rest.pos[b * 3] - rest.pos[a * 3]) || 1;
      rest.tilt[a] = -0.07 * dir;
      rest.tilt[b] = 0.07 * dir;
    }

    // Edges.
    const pairs = new Set(frame.edges.map((e) => `${e.from}|${e.to}`));
    for (const e of frame.edges) {
      const es = this.edgeSlotOf.get(e.id)!;
      const from = this.slotOf.get(e.from);
      const to = this.slotOf.get(e.to);
      if (from === undefined || to === undefined) continue;
      rest.edgePresent[es] = 1;
      rest.edgeFrom[es] = from;
      rest.edgeTo[es] = to;
      writeRgb(rest.edgeColor, es, edgeColorFor(palette, e.state));
      rest.edgeWidth[es] = e.state === 'NEUTRAL' ? (e.pointer ? 0.04 : 0.034) : 0.06;
      rest.edgeLabel[es] = e.label;
      this.routeEdge(rest, es, e, pairs);
    }

    this.buildDecalsAndLabels(rest, frame, emphasized);
    rest.view = this.buildView(rest, frame, emphasized);
    return rest;
  }

  /** Linked-list pointers that skip along a row bend around it; opposite pairs separate; self-pointers loop. */
  private routeEdge(rest: RestFrame, es: number, e: TraceEdge, pairs: Set<string>): void {
    const a = rest.edgeFrom[es];
    const b = rest.edgeTo[es];
    if (a === b) {
      rest.edgeRoute[es] = 'loop';
      return;
    }
    const dx = rest.pos[b * 3] - rest.pos[a * 3];
    const dy = rest.pos[b * 3 + 1] - rest.pos[a * 3 + 1];
    const reverse = pairs.has(`${e.to}|${e.from}`);
    if (e.pointer && Math.abs(dy) < 0.5 && Math.abs(dx) > 3.4) {
      const bend = Math.min(2.1, 1.0 + 0.07 * Math.abs(dx));
      rest.edgeRoute[es] = 'arc';
      rest.edgeBend[es] = dx < 0 ? -bend : bend;
    } else if (reverse) {
      rest.edgeRoute[es] = 'straight';
      rest.edgeBend[es] = dx > 0 || (dx === 0 && dy > 0) ? 0.2 : -0.2;
    }
  }

  // ── Floor marks and labels ──────────────────────────────────────────────

  private buildDecalsAndLabels(rest: RestFrame, frame: TraceFrame, emphasized: string[]): void {
    const palette = this.palette;
    const fy = this.floorY;
    const nodes = this.nodeMap(frame.index);

    // Value, caption and tags follow each node.
    for (const n of frame.nodes) {
      const s = this.slotOf.get(n.id)!;
      const h = rest.dims[s * 3 + 1];
      const w = rest.dims[s * 3];
      if (n.text !== '') {
        // Fit the value to the face: long text gets a smaller size, never more than the face is wide.
        const fit = (w * 0.86) / Math.max(1, n.text.length * 0.6);
        rest.labels.push({
          key: `v:${n.id}`,
          text: n.text,
          x: 0, y: 0, z: 0,
          size: Math.min(n.shape === 'sphere' ? 0.4 : 0.44, fit),
          color: rest.textColor[s],
          opacity: n.state === 'DISCARDED' ? 0.8 : 1,
          anchorX: 'center',
          font: 'mono',
          orient: 'face',
          follow: { slot: s, dy: this.isBar(n.structure) ? h / 2 - 0.32 : 0 },
        });
      }
      const onFloor = Math.abs(n.pos.y - NODE_HEIGHT[n.shape] / 2 - this.floorY) < 0.06;
      if (n.caption !== '') {
        const isIndex = /^\d+$/.test(n.caption);
        rest.labels.push({
          key: `c:${n.id}`,
          text: n.caption,
          x: 0, y: 0, z: 0,
          size: isIndex ? 0.26 : 0.22,
          color: palette.caption,
          opacity: n.state === 'DISCARDED' ? 0.55 : 1,
          anchorX: 'center',
          font: 'mono',
          // A node standing on the floor has its index printed on the floor in front of it.
          orient: onFloor ? 'floor' : 'billboard',
          follow: { slot: s, dy: onFloor ? 0.22 : -h / 2 - (isIndex ? 0.28 : 0.32) },
        });
      }
      n.tags.forEach((tag, i) => {
        const below = n.tagPlacement === 'below';
        rest.labels.push({
          key: `t:${tag}`,
          text: below ? `▴ ${tag}` : `${tag} ▾`,
          x: 0, y: 0, z: 0,
          size: 0.28,
          color: tag === 'LEAKED' ? palette.states.MODIFYING.body : palette.tag,
          opacity: 1,
          anchorX: 'center',
          font: 'mono',
          orient: 'billboard',
          follow: { slot: s, dy: below ? -h / 2 - 0.62 - i * 0.34 : h / 2 + 0.38 + i * 0.34 },
        });
      });
    }

    // Edge weights.
    frame.edges.forEach((e) => {
      if (!e.label) return;
      rest.labels.push({
        key: `w:${e.id}`,
        text: e.label,
        x: 0, y: 0, z: 0,
        size: 0.26,
        color: palette.plate,
        opacity: 1,
        anchorX: 'center',
        font: 'mono',
        orient: 'billboard',
      });
    });

    // Structures: a footprint on the floor and a name plate.
    for (const st of frame.structures) {
      const members = st.nodeIds.map((id) => nodes.get(id)).filter((n): n is TraceNode => !!n);
      const attached = members.filter((n) => !n.detached);
      const detached = members.filter((n) => n.detached);
      const b = this.boundsOf(attached, rest);
      if (b) {
        // The structure's footprint: a faint tint inside a hairline, like the site's ruled panels.
        const footprint = {
          x: (b.minX + b.maxX) / 2,
          z: (b.minZ + b.maxZ) / 2,
          w: b.maxX - b.minX + 1.6,
          d: Math.max(1.9, b.maxZ - b.minZ + 1.6),
        };
        rest.decals.push({ key: `plinth:${st.name}`, shape: DECAL_SHAPE.roundRect, ...footprint, color: palette.plinth, alpha: 0.55, layer: 0 });
        rest.decals.push({ key: `rule:${st.name}`, shape: DECAL_SHAPE.outline, ...footprint, color: palette.floorLine, alpha: this.theme === 'dark' ? 0.2 : 0.24, layer: 1 });
        rest.labels.push({
          key: `p:${st.name}`,
          text: st.name,
          x: b.minX - 0.95,
          y: b.topY,
          z: b.topZ,
          size: 0.34,
          color: palette.plate,
          opacity: 1,
          anchorX: 'right',
          font: 'mono',
          orient: 'billboard',
        });
        const note = st.note ?? (st.kind === 'STACK' ? 'stack' : st.kind === 'QUEUE' ? 'queue' : undefined);
        if (note) {
          rest.labels.push({
            key: `pn:${st.name}`,
            text: note,
            x: b.minX - 0.95,
            y: b.topY - 0.4,
            z: b.topZ,
            size: 0.22,
            color: palette.caption,
            opacity: 1,
            anchorX: 'right',
            font: 'serif',
            orient: 'billboard',
          });
        }
      } else if (st.anchor) {
        rest.labels.push({
          key: `p:${st.name}`,
          text: st.note ? `${st.name}: ${st.note}` : st.name,
          x: st.anchor.x + 0.6,
          y: st.anchor.y,
          z: st.anchor.z,
          size: 0.32,
          color: palette.caption,
          opacity: 1,
          anchorX: 'right',
          font: 'mono',
          orient: 'billboard',
        });
      }
      const hb = this.boundsOf(detached, rest);
      if (hb) {
        rest.decals.push({
          key: `heap:${st.name}`,
          shape: DECAL_SHAPE.dashedOutline,
          x: (hb.minX + hb.maxX) / 2,
          z: (hb.minZ + hb.maxZ) / 2,
          w: Math.max(3.2, hb.maxX - hb.minX + 1.8),
          d: Math.max(1.9, hb.maxZ - hb.minZ + 1.6),
          color: palette.plate,
          alpha: 0.75,
          layer: 1,
        });
        rest.labels.push({
          key: `heap:${st.name}`,
          text: 'heap memory · not linked',
          x: hb.minX - 0.6,
          y: fy + 0.22,
          z: hb.maxZ + 1.05,
          size: 0.2,
          color: palette.caption,
          opacity: 1,
          anchorX: 'left',
          font: 'serif',
          orient: 'floor',
        });
      }
    }

    // Sorted ranges, partitions.
    for (const r of frame.regions.sorted) {
      const b = this.rangeBounds(frame, r.structure, r.start, r.end, rest);
      if (!b) continue;
      rest.decals.push({
        key: `sorted:${r.structure}`,
        shape: DECAL_SHAPE.roundRect,
        x: (b.minX + b.maxX) / 2,
        z: (b.minZ + b.maxZ) / 2,
        w: b.maxX - b.minX + 1.25,
        d: Math.max(1.45, b.maxZ - b.minZ + 1.25),
        color: palette.states.SUCCESS.body,
        alpha: 0.22,
        layer: 2,
      });
    }
    for (const p of frame.regions.partitions) {
      const b = this.rangeBounds(frame, p.structure, p.start, p.end, rest);
      if (!b) continue;
      const inset = p.depth * 0.14;
      rest.decals.push({
        key: `part:${p.structure}:${p.depth}`,
        shape: DECAL_SHAPE.dashedOutline,
        x: (b.minX + b.maxX) / 2,
        z: (b.minZ + b.maxZ) / 2,
        w: b.maxX - b.minX + 1.35 - inset * 2,
        d: Math.max(1.5, b.maxZ - b.minZ + 1.35) - inset * 2,
        color: palette.plate,
        alpha: 0.8,
        layer: 3 + p.depth,
      });
      rest.labels.push({
        key: `part:${p.structure}:${p.depth}`,
        text: p.label ?? `[${p.start}..${p.end}]`,
        x: (b.minX + b.maxX) / 2,
        y: fy + 0.2,
        z: b.maxZ + 1.15 + p.depth * 0.32,
        size: 0.2,
        color: palette.caption,
        opacity: 1,
        anchorX: 'center',
        font: 'mono',
        orient: 'floor',
      });
    }

    // Loop cursors and the search window.
    this.addCursors(rest, frame);

    // Halos under emphasised nodes.
    for (const id of emphasized) {
      const n = nodes.get(id);
      if (!n) continue;
      const style = STATE_TREATMENTS[n.state].halo;
      if (style === 'none') continue;
      const s = this.slotOf.get(id)!;
      const bottom = rest.pos[s * 3 + 1] - rest.dims[s * 3 + 1] / 2;
      if (bottom - this.floorY > 0.6) {
        rest.rings.push({ slot: s, style: style === 'dashed' ? 1 : style === 'double' ? 2 : 0, color: palette.states[n.state].body });
        continue;
      }
      rest.decals.push({
        key: `halo:${id}`,
        shape: style === 'dashed' ? DECAL_SHAPE.dashedRing : style === 'double' ? DECAL_SHAPE.doubleRing : DECAL_SHAPE.ring,
        x: rest.pos[s * 3],
        z: rest.pos[s * 3 + 2],
        w: Math.max(rest.dims[s * 3], rest.dims[s * 3 + 2]) + 0.7,
        d: 0,
        color: palette.states[n.state].body,
        alpha: 0.95,
        layer: 6,
      });
    }

    // A compared pair: the relation, written between them.
    if (frame.event.kind === 'compare' && emphasized.length === 2) {
      const [a, b] = emphasized.map((id) => nodes.get(id)!);
      const sa = this.slotOf.get(a.id)!;
      const sb = this.slotOf.get(b.id)!;
      const order = a.numeric !== undefined && b.numeric !== undefined ? Math.sign(a.numeric - b.numeric) : Math.sign(a.text.localeCompare(b.text));
      const rel = order < 0 ? '<' : order > 0 ? '>' : '=';
      const top = Math.max(rest.pos[sa * 3 + 1] + rest.dims[sa * 3 + 1] / 2, rest.pos[sb * 3 + 1] + rest.dims[sb * 3 + 1] / 2);
      rest.labels.push({
        key: 'compare',
        text: `${a.text} ${rel} ${b.text}`,
        x: (rest.pos[sa * 3] + rest.pos[sb * 3]) / 2,
        y: top + 0.95,
        z: (rest.pos[sa * 3 + 2] + rest.pos[sb * 3 + 2]) / 2,
        size: 0.34,
        color: palette.states.EVALUATING.body,
        opacity: 1,
        anchorX: 'center',
        font: 'mono',
        orient: 'billboard',
      });
    }

    // The call stack lane.
    if (this.maxCallDepth > 0) this.addCallStack(rest, frame);
  }

  private addCursors(rest: RestFrame, frame: TraceFrame): void {
    if (!this.source || frame.line === null) return;
    const vars = frame.vars;
    const arrays = frame.structures.filter((s) => s.kind === 'ARRAY' && s.nodeIds.length > 0);
    if (arrays.length === 0) return;
    const actorStructure = frame.event.actors.map((id) => this.nodeMap(frame.index).get(id)?.structure).find((s) => s && arrays.some((a) => a.name === s));
    const array = arrays.find((a) => a.name === actorStructure) ?? arrays[0];
    const cells = new Map<number, TraceNode>();
    for (const id of array.nodeIds) {
      const n = this.nodeMap(frame.index).get(id);
      if (n?.index !== undefined) cells.set(n.index, n);
    }
    const length = cells.size;

    const names: string[] = [];
    const text = this.source.textAt(frame.line);
    const indexRe = new RegExp(`${array.name}\\[\\s*([A-Za-z_]\\w*)`, 'g');
    let m: RegExpExecArray | null;
    while ((m = indexRe.exec(text))) names.push(m[1]);
    for (const loop of this.source.loopsAt(frame.line)) if (loop.kind === 'LOOP' && loop.variable) names.push(loop.variable);
    for (const n of [...LOW_NAMES, ...HIGH_NAMES, ...MID_NAMES]) if (typeof vars[n] === 'number') names.push(n);

    const seen = new Set<string>();
    const stackAt = new Map<number, number>();
    let count = 0;
    for (const name of names) {
      if (seen.has(name) || count >= MAX_CURSORS) continue;
      seen.add(name);
      const v = vars[name];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= length) continue;
      const cell = cells.get(v);
      if (!cell) continue;
      const s = this.slotOf.get(cell.id)!;
      const level = stackAt.get(v) ?? 0;
      stackAt.set(v, level + 1);
      count++;
      const x = rest.pos[s * 3];
      const z = rest.pos[s * 3 + 2] + rest.dims[s * 3 + 2] / 2 + 0.75;
      rest.decals.push({ key: `cur:${name}`, shape: DECAL_SHAPE.chevron, x, z, w: 0.42, d: 0.34, color: this.palette.tag, alpha: 0.95, layer: 7 });
      rest.labels.push({
        key: `cur:${name}`,
        text: `${name} = ${v}`,
        x,
        y: this.floorY + 0.14 + level * 0.32,
        z: z + 0.95,
        size: 0.24,
        color: this.palette.tag,
        opacity: 1,
        anchorX: 'center',
        font: 'mono',
        orient: 'floor',
      });
    }

    const low = LOW_NAMES.find((n) => typeof vars[n] === 'number');
    const high = HIGH_NAMES.find((n) => typeof vars[n] === 'number');
    if (low && high) {
      const lo = Math.max(0, vars[low] as number);
      const hi = Math.min(length - 1, vars[high] as number);
      const b = lo <= hi ? this.rangeBounds(frame, array.name, lo, hi, rest) : null;
      if (b) {
        rest.decals.push({
          key: `window:${array.name}`,
          shape: DECAL_SHAPE.roundRect,
          x: (b.minX + b.maxX) / 2,
          z: (b.minZ + b.maxZ) / 2,
          w: b.maxX - b.minX + 1.3,
          d: Math.max(1.5, b.maxZ - b.minZ + 1.3),
          color: this.palette.states.TRAVERSING.body,
          alpha: 0.2,
          layer: 2,
        });
      }
    }
  }

  private addCallStack(rest: RestFrame, frame: TraceFrame): void {
    const stack = frame.callStack;
    const lane = this.laneX();
    const shown = stack.slice(-MAX_FRAMES_SHOWN);
    const hidden = stack.length - shown.length;
    shown.forEach((call, i) => {
      const depth = hidden + i;
      const isTop = depth === stack.length - 1;
      rest.labels.push({
        key: `frame:${depth}`,
        text: call,
        x: lane.x,
        y: this.floorY + 0.36 + i * 0.62,
        z: lane.z,
        size: 0.24,
        color: isTop ? this.palette.frameTop : this.palette.frameText,
        opacity: 1,
        anchorX: 'center',
        font: 'mono',
        orient: 'face',
      });
    });
    if (stack.length === 0) return;
    rest.labels.push({
      key: 'frame:title',
      text: hidden > 0 ? `call stack · ${hidden} more below` : 'call stack',
      x: lane.x,
      y: this.floorY + 0.36 + shown.length * 0.62 + 0.15,
      z: lane.z,
      size: 0.2,
      color: this.palette.caption,
      opacity: 1,
      anchorX: 'center',
      font: 'serif',
      orient: 'billboard',
    });
  }

  /** Centre and radius of everything the whole run ever shows (lights, shadows, fog). */
  private boundsCache: { center: [number, number, number]; radius: number } | null = null;
  sceneBounds(): { center: [number, number, number]; radius: number } {
    if (!this.boundsCache) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const f of this.frames) {
        for (const n of f.nodes) {
          minX = Math.min(minX, n.pos.x); maxX = Math.max(maxX, n.pos.x);
          minY = Math.min(minY, n.pos.y); maxY = Math.max(maxY, n.pos.y);
          minZ = Math.min(minZ, n.pos.z); maxZ = Math.max(maxZ, n.pos.z);
        }
      }
      if (this.maxCallDepth > 0) minX = Math.min(minX, this.laneX().x - 2);
      if (!Number.isFinite(minX)) {
        this.boundsCache = { center: [0, this.floorY, 0], radius: 4 };
      } else {
        this.boundsCache = {
          center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
          radius: Math.max(3, 0.5 * Math.hypot(maxX - minX, maxY - minY + 2, maxZ - minZ)),
        };
      }
    }
    return this.boundsCache;
  }

  /** Where the call-stack lane stands: left of everything the run ever shows. */
  private laneCache: { x: number; z: number } | null = null;
  laneX(): { x: number; z: number } {
    if (!this.laneCache) {
      let minX = Infinity;
      let maxZ = -Infinity;
      for (const f of this.frames) {
        for (const n of f.nodes) {
          minX = Math.min(minX, n.pos.x);
          maxZ = Math.max(maxZ, n.pos.z);
        }
      }
      // Wide enough for the longest call, clear of the structures' name plates.
      let longest = 8;
      for (const f of this.frames) for (const call of f.callStack) longest = Math.max(longest, call.length);
      const halfWidth = Math.max(1.1, (longest * 0.24 * 0.62 + 0.7) / 2);
      this.laneCache = { x: (Number.isFinite(minX) ? minX : 0) - 3.2 - halfWidth, z: Number.isFinite(maxZ) ? maxZ : 0 };
    }
    return this.laneCache;
  }

  private boundsOf(members: TraceNode[], rest: RestFrame) {
    if (members.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, topY = -Infinity, topZ = 0;
    for (const n of members) {
      const s = this.slotOf.get(n.id)!;
      const x = rest.pos[s * 3];
      const y = rest.pos[s * 3 + 1];
      const z = rest.pos[s * 3 + 2];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      if (n.pos.y > topY + 1e-6) {
        topY = n.pos.y;
        topZ = z;
      }
    }
    return { minX, maxX, minZ, maxZ, topY, topZ };
  }

  private rangeBounds(frame: TraceFrame, structure: string, start: number, end: number, rest: RestFrame) {
    const members = frame.nodes.filter((n) => n.structure === structure && n.index !== undefined && n.index >= start && n.index <= end);
    return this.boundsOf(members, rest);
  }

  // ── Camera keys ─────────────────────────────────────────────────────────

  private buildView(rest: RestFrame, frame: TraceFrame, emphasized: string[]): ViewKey {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const grow = (x: number, y: number, z: number, r = 0) => {
      minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
      minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
      minZ = Math.min(minZ, z - r); maxZ = Math.max(maxZ, z + r);
    };
    const camera = frame.camera;
    const focusStructure = camera?.mode === 'FOCUS' ? camera.targetId : undefined;
    for (let s = 0; s < this.slots.length; s++) {
      if (!rest.present[s]) continue;
      if (focusStructure && this.slots[s].structure !== focusStructure && this.slots[s].id !== focusStructure) continue;
      grow(rest.pos[s * 3], rest.pos[s * 3 + 1], rest.pos[s * 3 + 2], Math.max(rest.dims[s * 3], rest.dims[s * 3 + 1]) / 2 + 0.25);
    }
    // Whether the structures lie across the floor (look down on them) or stand up (look across):
    // decided by where the node centres spread, not by their padding or by labels.
    let cMinY = Infinity, cMaxY = -Infinity, cMinZ = Infinity, cMaxZ = -Infinity;
    for (let s = 0; s < this.slots.length; s++) {
      if (!rest.present[s]) continue;
      cMinY = Math.min(cMinY, rest.pos[s * 3 + 1]); cMaxY = Math.max(cMaxY, rest.pos[s * 3 + 1]);
      cMinZ = Math.min(cMinZ, rest.pos[s * 3 + 2]); cMaxZ = Math.max(cMaxZ, rest.pos[s * 3 + 2]);
    }
    const flat = Number.isFinite(cMinZ) && cMaxZ - cMinZ > 2.5 && cMaxZ - cMinZ > (cMaxY - cMinY) * 0.9;
    if (!focusStructure) {
      for (const l of rest.labels) {
        if (l.follow) continue;
        const width = l.text.length * l.size * 0.62;
        const left = l.anchorX === 'right' ? l.x - width : l.anchorX === 'center' ? l.x - width / 2 : l.x;
        grow(left, l.y, l.z);
        grow(left + width, l.y, l.z);
      }
    }
    if (!Number.isFinite(minX)) {
      minX = -2; maxX = 2; minY = this.floorY; maxY = this.floorY + 2; minZ = -1; maxZ = 1;
    }
    // Room for tags above and captions below.
    maxY += 0.7;
    minY = Math.min(minY, this.floorY);
    const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
    const radius = Math.max(2.4, 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ));

    let focus: [number, number, number] = center;
    if (emphasized.length > 0) {
      let fx = 0, fy = 0, fz = 0;
      for (const id of emphasized) {
        const s = this.slotOf.get(id)!;
        fx += rest.pos[s * 3]; fy += rest.pos[s * 3 + 1]; fz += rest.pos[s * 3 + 2];
      }
      focus = [fx / emphasized.length, fy / emphasized.length, fz / emphasized.length];
    }
    // The neighbourhood of the step's actors: what a big scene leans in towards.
    let focusHalf: [number, number, number] = [Math.max(1.6, (maxX - minX) / 2), Math.max(1.2, (maxY - minY) / 2), Math.max(0.8, (maxZ - minZ) / 2)];
    if (emphasized.length > 0 && !focusStructure) {
      let nMinX = Infinity, nMaxX = -Infinity, nMinY = Infinity, nMaxY = -Infinity, nMinZ = Infinity, nMaxZ = -Infinity;
      for (let s = 0; s < this.slots.length; s++) {
        if (!rest.present[s]) continue;
        const x = rest.pos[s * 3], y = rest.pos[s * 3 + 1], z = rest.pos[s * 3 + 2];
        if (Math.hypot(x - focus[0], y - focus[1], z - focus[2]) > FOCUS_NEIGHBOURHOOD) continue;
        nMinX = Math.min(nMinX, x); nMaxX = Math.max(nMaxX, x);
        nMinY = Math.min(nMinY, y); nMaxY = Math.max(nMaxY, y);
        nMinZ = Math.min(nMinZ, z); nMaxZ = Math.max(nMaxZ, z);
      }
      if (Number.isFinite(nMinX)) focusHalf = [Math.max(2.4, (nMaxX - nMinX) / 2 + 1.2), Math.max(1.6, (nMaxY - nMinY) / 2 + 1.1), Math.max(1, (nMaxZ - nMinZ) / 2 + 0.8)];
    }
    const mode = camera?.mode ?? 'AUTO_FIT';
    return {
      center,
      radius,
      half: [Math.max(1.6, (maxX - minX) / 2), Math.max(1.2, (maxY - minY) / 2), Math.max(0.8, (maxZ - minZ) / 2)],
      focusHalf,
      focus,
      flat,
      mode: mode === 'FOCUS' || mode === 'ORBIT' || mode === 'POSITION' ? mode : 'AUTO_FIT',
      orbitSpeed: camera?.speed ?? 12,
      position: camera?.position ? [camera.position.x, camera.position.y, camera.position.z] : undefined,
    };
  }
}
