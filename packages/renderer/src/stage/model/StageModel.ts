import type { SemanticState } from '@aqvl/shared';
import type { ExecutionTrace, TraceEdge, TraceFrame, TraceNode, TraceShape } from '@aqvl/runtime';
import { edgeColorFor, type StagePalette, type StageTheme } from '../look/palette';
import { STATE_TREATMENTS } from '../look/treatments';
import { allocateAttention, isMutation } from '../motion/attention';
import { massFor } from '../motion/spring';
import { parseSourceStructure, type SourceStructure } from '../../components/iteration/sourceStructure';
import { writeRgb } from './colors';
import { paletteFor } from '../worlds/palettes';
import { hasCast, type StageWorld } from '../worlds/types';

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
  /** 'strong' for values and names, 'mono' for captions and code, 'serif' for notes. */
  font: LabelFont;
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
  /** Rides on an edge: placed at the middle of the edge's curve (weights). */
  edge?: number;
}

export type LabelOrient = 'billboard' | 'face' | 'floor';
export type LabelFont = 'strong' | 'mono' | 'serif';

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
const REST_CACHE_SIZE = 96;
/** How far around the step's actors a large scene's camera leans in to. */
const FOCUS_NEIGHBOURHOOD = 4.5;
/** Steps either side whose extent the camera also keeps in frame, so it never pumps in and out. */
const FRAMING_WINDOW = 3;

/** Type sizes (world units): one scale for the whole scene. */
export const TYPE = { value: 0.44, heading: 0.48, note: 0.27, index: 0.36, tag: 0.33, cursor: 0.31, weight: 0.3, relation: 0.38, frame: 0.28 } as const;
/** Average advance of a JetBrains Mono glyph, as a fraction of its size. */
const GLYPH = 0.6;
/** Clear floor between structures standing side by side. */
const STRUCTURE_GAP = 2.4;
/** The camera's angle above structures that stand up: low across a single row, a little higher over rows. */
const ONE_ROW_PITCH = 0.38;
const ROWS_PITCH = 0.52;
/** Width-to-height of the part of the canvas the picture usually gets (the inspector takes the rest). */
const VIEW_ASPECT = 1.35;
/** A node whose bottom is closer than this to the floor has its index printed on the floor in front of it. */
const CAPTION_CLEARANCE = 0.75;
/** How far in front of its node's face an index on the floor stands: far enough to clear the body on screen. */
const INDEX_AHEAD = 0.95;
/** Room kept for a world's crew beside (x) and in front of (z) every cell. */
/** How far in front of a grounded list's row a node staged `1` below it stands. */
const STAGING_DEPTH = 0.9;
const CAST_ROOM_X = 0.95;
const CAST_ROOM_Z = 1.95;

interface GroupExtent {
  key: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  bottom: number;
  top: number;
  /** Room on the left for the structure's name and note. */
  pad: number;
}

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
  /** How far the camera looks down on structures that stand up (radians; see camera.ts). */
  uprightPitch = ONE_ROW_PITCH;
  readonly maxCallDepth: number;
  readonly frames: TraceFrame[];
  private readonly bars = new Map<string, BarScale>();
  private readonly massRange = new Map<string, BarScale>();
  private readonly nodeMaps: (Map<string, TraceNode> | undefined)[] = [];
  private readonly restCache = new Map<number, RestFrame>();
  private readonly framingCache = new Map<number, ViewKey>();
  private readonly source: SourceStructure | null;
  /** Where each structure was moved to stand side by side (keyed by structure name, '' for loose nodes). */
  private readonly shift = new Map<string, [number, number, number]>();
  /** Rows of cells packed closer (x scaled about `origin`), so an array reads as one block of memory. */
  private readonly packing = new Map<string, { f: number; origin: number }>();
  /** Chains hanging under hash-map buckets, spread apart vertically (y scaled about `origin`) so each link shows. */
  private readonly hang = new Map<string, { f: number; origin: number }>();
  /** Structures spread across the floor (graphs, chained hash maps): looked down on, named at their back corner. */
  private readonly flatStructures = new Set<string>();
  /**
   * Linked lists in the penguin world lie on the ice: the row stands on the floor, and a node the runtime
   * stages below the row (a new, unlinked node) is staged on the ice in front of it instead.
   * Maps a structure to the y of its row.
   */
  private readonly groundRow = new Map<string, number>();

  constructor(readonly trace: ExecutionTrace, readonly theme: StageTheme, source?: string, readonly world: StageWorld = 'studio') {
    this.palette = paletteFor(theme, world);
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

    this.findGroundRows();
    this.pack();
    this.findFlat();
    this.arrange();

    // The floor: just under the lowest node bottom of the whole run, so nothing ever sinks through it.
    let lowest = Infinity;
    for (const frame of trace.frames) {
      for (const n of frame.nodes) lowest = Math.min(lowest, this.py(n) - NODE_HEIGHT[n.shape] / 2);
    }
    this.floorY = Number.isFinite(lowest) ? lowest - 0.002 : -0.5;
  }

  // ── Placement ───────────────────────────────────────────────────────────

  /** x within the node's own structure (cells packed). */
  private localX(n: TraceNode): number {
    const p = n.structure ? this.packing.get(n.structure) : undefined;
    return p ? p.origin + (n.pos.x - p.origin) * p.f : n.pos.x;
  }

  /** y within the node's own structure (hanging chains spread). */
  private localY(n: TraceNode): number {
    const h = n.structure ? this.hang.get(n.structure) : undefined;
    const y = this.groundRow.get(n.structure ?? '') ?? undefined;
    if (y !== undefined) return y;
    return h ? h.origin + (n.pos.y - h.origin) * h.f : n.pos.y;
  }

  /** z within the node's own structure (a node staged below a grounded row stands in front of it). */
  private localZ(n: TraceNode): number {
    const row = this.groundRow.get(n.structure ?? '');
    return row === undefined ? n.pos.z : n.pos.z + Math.max(0, row - n.pos.y) * STAGING_DEPTH;
  }

  /** World position of a trace node, with its structure's place applied. */
  px(n: TraceNode): number {
    return this.localX(n) + (this.shift.get(n.structure ?? '')?.[0] ?? 0);
  }
  py(n: TraceNode): number {
    return this.localY(n) + (this.shift.get(n.structure ?? '')?.[1] ?? 0);
  }
  pz(n: TraceNode): number {
    return this.localZ(n) + (this.shift.get(n.structure ?? '')?.[2] ?? 0);
  }

  /** Width of a node's body: a box widens (up to almost two units) to fit a long value such as a vertex name. */
  private widthOf(n: TraceNode): number {
    return n.shape === 'box' && n.text.length > 3 ? Math.min(1.9, Math.max(1, 0.26 * n.text.length + 0.34)) : NODE_WIDTH[n.shape];
  }

  private noteOf(note: string | undefined, kind: string): string | undefined {
    return note ?? (kind === 'STACK' ? 'stack' : kind === 'QUEUE' ? 'queue' : undefined);
  }

  /**
   * Rows of cells (arrays, queues, hash-map buckets) are laid out by the
   * runtime with wide gaps. Packed to one clear hand-width between the
   * widest cells, an array reads as a single block of memory and the
   * whole picture can be larger in the frame.
   */
  private pack(): void {
    const kinds = new Map<string, string>();
    for (const f of this.frames) for (const st of f.structures) kinds.set(st.name, st.kind);
    // Cell spacing, measured within each frame (an array that re-centres as it grows shifts by half a cell).
    const step = new Map<string, number>();
    const widest = new Map<string, number>();
    for (const f of this.frames) {
      const xs = new Map<string, number[]>();
      for (const n of f.nodes) {
        if (!n.structure || n.detached) continue;
        const kind = kinds.get(n.structure);
        if (kind !== 'ARRAY' && kind !== 'QUEUE' && kind !== 'HASH_MAP') continue;
        let list = xs.get(n.structure);
        if (!list) xs.set(n.structure, (list = []));
        list.push(n.pos.x);
        widest.set(n.structure, Math.max(widest.get(n.structure) ?? 0, this.widthOf(n)));
      }
      for (const [name, list] of xs) {
        list.sort((a, b) => a - b);
        for (let i = 1; i < list.length; i++) {
          const dx = list[i] - list[i - 1];
          if (dx > 1e-3) step.set(name, Math.min(step.get(name) ?? Infinity, dx));
        }
      }
    }
    for (const [name, dx] of step) {
      const target = (widest.get(name) ?? 1) + 0.42;
      if (target < dx - 0.05) this.packing.set(name, { f: target / dx, origin: 0 });
    }
    // Hash-map chains hang one unit apart under their bucket: give each link a visible gap.
    for (const [name, kind] of kinds) {
      if (kind !== 'HASH_MAP') continue;
      let top = -Infinity;
      for (const f of this.frames) for (const n of f.nodes) if (n.structure === name) top = Math.max(top, n.pos.y);
      if (Number.isFinite(top)) this.hang.set(name, { f: 1.45, origin: top });
    }
  }

  /** Penguin world: every linked list lies on the ice (see `groundRow`). */
  private findGroundRows(): void {
    if (this.world !== 'penguin') return;
    const top = new Map<string, number>();
    for (const f of this.frames) {
      for (const n of f.nodes) {
        if (n.family !== 'LINKEDLIST_NODE' || !n.structure) continue;
        top.set(n.structure, Math.max(top.get(n.structure) ?? -Infinity, n.pos.y));
      }
    }
    for (const [name, y] of top) this.groundRow.set(name, y);
  }

  /** Whether a structure lies on the ice (a linked list in the penguin world). */
  isGrounded(structure: string | undefined): boolean {
    return this.groundRow.has(structure ?? '');
  }

  /** A structure whose node centres spread further in depth than in height lies across the floor. */
  private findFlat(): void {
    const spread = new Map<string, { y0: number; y1: number; z0: number; z1: number }>();
    for (const f of this.frames) {
      for (const n of f.nodes) {
        const key = n.structure ?? '';
        const r = spread.get(key) ?? { y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
        r.y0 = Math.min(r.y0, n.pos.y); r.y1 = Math.max(r.y1, n.pos.y);
        r.z0 = Math.min(r.z0, n.pos.z); r.z1 = Math.max(r.z1, n.pos.z);
        spread.set(key, r);
      }
    }
    for (const [key, r] of spread) if (r.z1 - r.z0 > 2 && r.z1 - r.z0 > (r.y1 - r.y0) * 0.9) this.flatStructures.add(key);
  }

  /**
   * Gives every structure its own place on the floor, once for the whole
   * run so nothing jumps between steps: side by side in order of first
   * appearance, one clear gap apart, all standing on the same floor, with
   * room on each one's left for its name. A row that gets too wide wraps,
   * the first row standing at the back (the top of the picture). A program
   * with a single structure keeps the layout it was given.
   */
  private arrange(): void {
    const groups = new Map<string, GroupExtent>();
    const labelWidth = new Map<string, number>();
    const grow = (key: string, x0: number, x1: number, z0: number, z1: number, bottom: number, top: number) => {
      let g = groups.get(key);
      if (!g) {
        g = { key, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, bottom: Infinity, top: -Infinity, pad: 0 };
        groups.set(key, g);
      }
      g.minX = Math.min(g.minX, x0);
      g.maxX = Math.max(g.maxX, x1);
      g.minZ = Math.min(g.minZ, z0);
      g.maxZ = Math.max(g.maxZ, z1);
      g.bottom = Math.min(g.bottom, bottom);
      g.top = Math.max(g.top, top);
    };
    for (const frame of this.frames) {
      for (const n of frame.nodes) {
        const hw = this.widthOf(n) / 2;
        const hd = NODE_WIDTH[n.shape] / 2;
        const bottom = this.localY(n) - NODE_HEIGHT[n.shape] / 2;
        const x = this.localX(n);
        grow(n.structure ?? '', x - hw, x + hw, this.localZ(n) - hd, this.localZ(n) + hd, bottom, bottom + this.heightOf(n));
      }
      for (const st of frame.structures) {
        const note = this.noteOf(st.note, st.kind);
        const w = Math.max(st.name.length * TYPE.heading, (note?.length ?? 0) * TYPE.note) * GLYPH;
        labelWidth.set(st.name, Math.max(labelWidth.get(st.name) ?? 0, w));
        if (st.anchor && st.nodeIds.length === 0 && !groups.has(st.name)) {
          grow(st.name, st.anchor.x - 0.5, st.anchor.x + 0.5, st.anchor.z - 0.5, st.anchor.z + 0.5, st.anchor.y - 0.5, st.anchor.y + 0.5);
        }
      }
    }
    if (groups.size <= 1) return;

    const all = [...groups.values()];
    for (const g of all) g.pad = labelWidth.has(g.key) ? labelWidth.get(g.key)! + 0.8 : 0;
    const lowest = Math.min(...all.map((g) => g.bottom));
    const span = (g: GroupExtent) => g.maxX - g.minX + g.pad;
    const heightOf = (row: GroupExtent[]) => Math.max(...row.map((g) => g.top - g.bottom));
    const depthOf = (row: GroupExtent[]) => Math.max(...row.map((g) => g.maxZ - g.minZ));
    const widthOf = (row: GroupExtent[]) => row.reduce((sum, g) => sum + span(g), 0) + STRUCTURE_GAP * (row.length - 1);

    // Rows in reading order, wrapping at `limit`; the tallest row stands at the back, and each row in
    // front stands far enough forward that its tallest body stays below the feet of the row behind it.
    const plan = (limit: number) => {
      const rows: GroupExtent[][] = [[]];
      let used = 0;
      for (const g of all) {
        const row = rows[rows.length - 1];
        if (row.length > 0 && used + STRUCTURE_GAP + span(g) > limit) {
          rows.push([g]);
          used = span(g);
        } else {
          used += (row.length > 0 ? STRUCTURE_GAP : 0) + span(g);
          row.push(g);
        }
      }
      rows.sort((x, y) => heightOf(y) - heightOf(x));
      // Seen from the camera's angle, a row behind another rises tan(pitch) on screen per unit of depth.
      const pitch = rows.length > 1 ? ROWS_PITCH : ONE_ROW_PITCH;
      const rise = Math.tan(pitch);
      const fronts: number[] = [];
      let front = 0;
      rows.forEach((row, r) => {
        front = r === 0 ? depthOf(row) : front + 1.6 + (heightOf(row) + 0.9) / rise + depthOf(row);
        fronts.push(front);
      });
      const width = Math.max(...rows.map(widthOf));
      // Height on screen from that angle (captions in front included).
      const height = front * Math.sin(pitch) + heightOf(rows[0]) * Math.cos(pitch) + 1.2;
      return { rows, fronts, pitch, scale: Math.min(VIEW_ASPECT / width, 1 / height) };
    };
    const widest = Math.max(...all.map(span));
    const total = widthOf(all);
    const plans = all.map((_, r) => plan(Math.max(widest, total / (r + 1) + 0.01)));
    const best = Math.max(...plans.map((p) => p.scale));
    // Side by side is preferred: the fewest rows that come within a few percent of the best fit.
    const chosen = plans.filter((p) => p.scale >= best * 0.9).sort((x, y) => x.rows.length - y.rows.length)[0];
    this.uprightPitch = chosen.pitch;

    chosen.rows.forEach((row, r) => {
      const depth = depthOf(row);
      const centerZ = chosen.fronts[r] - depth / 2;
      let cursor = -widthOf(row) / 2;
      for (const g of row) {
        this.shift.set(g.key, [cursor + g.pad - g.minX, lowest - g.bottom, centerZ - (g.minZ + g.maxZ) / 2]);
        cursor += span(g) + STRUCTURE_GAP;
      }
    });
  }

  /** Whether anything at all is ever drawn as a node. */
  get hasNodes(): boolean {
    return this.slots.length > 0;
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
      const width = this.widthOf(n);
      const scale = treatment.scale * (n.detached ? 0.86 : 1);
      const bottom = this.py(n) - NODE_HEIGHT[n.shape] / 2;
      const lift = isEmph ? treatment.emphasisLift : 0;
      rest.present[s] = 1;
      rest.pos[s * 3] = this.px(n);
      rest.pos[s * 3 + 1] = bottom + (height * scale) / 2 + lift + treatment.restLift;
      rest.pos[s * 3 + 2] = this.pz(n);
      rest.dims[s * 3] = width * scale;
      rest.dims[s * 3 + 1] = height * scale;
      rest.dims[s * 3 + 2] = NODE_WIDTH[n.shape] * scale;
      writeRgb(rest.color, s, palette.states[n.state].body);
      rest.textColor[s] = palette.states[n.state].text;
      // Nothing glows: state is carried by colour, finish, size, lift and rings.
      rest.glow[s] = isEmph && n.state === 'MODIFYING' && mutation ? treatment.glow : 0;
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
      rest.edgeWidth[es] = e.state === 'NEUTRAL' ? (e.pointer ? 0.036 : 0.03) : 0.05;
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
      // How far the node's resting bottom is above the floor (emphasis lift aside).
      const clearance = this.py(n) - NODE_HEIGHT[n.shape] / 2 - this.floorY;
      if (n.text !== '') {
        // Fit the value to the face: long text gets a smaller size, never more than the face is wide.
        const fit = (w * 0.84) / Math.max(1, n.text.length * GLYPH);
        rest.labels.push({
          key: `v:${n.id}`,
          text: n.text,
          x: 0, y: 0, z: 0,
          size: Math.min(n.shape === 'sphere' ? 0.4 : TYPE.value, fit),
          color: rest.textColor[s],
          opacity: n.state === 'DISCARDED' ? 0.75 : 1,
          anchorX: 'center',
          font: 'strong',
          orient: 'face',
          follow: { slot: s, dy: this.isBar(n.structure) ? h / 2 - 0.32 : 0 },
        });
      }
      // Too close to the floor to hang a caption underneath: print it on the floor in front instead.
      const onFloor = clearance < CAPTION_CLEARANCE;
      if (n.caption !== '') {
        const isIndex = /^\d+$/.test(n.caption);
        rest.labels.push({
          key: `c:${n.id}`,
          text: n.caption,
          x: 0, y: 0, z: 0,
          size: isIndex ? TYPE.index : TYPE.note,
          color: palette.caption,
          opacity: n.state === 'DISCARDED' ? 0.55 : 1,
          anchorX: 'center',
          font: 'mono',
          orient: onFloor ? 'floor' : 'billboard',
          follow: { slot: s, dy: onFloor ? INDEX_AHEAD : -h / 2 - 0.34 },
        });
      }
      // Pointer tags always stand above their node: below, they would cross a tree's child edges or
      // an array's index captions.
      n.tags.forEach((tag, i) => {
        rest.labels.push({
          key: `t:${tag}`,
          text: `${tag} ▾`,
          x: 0, y: 0, z: 0,
          size: TYPE.tag,
          color: palette.tag,
          opacity: 1,
          anchorX: 'center',
          font: 'strong',
          orient: 'billboard',
          follow: { slot: s, dy: h / 2 + 0.42 + i * 0.36 },
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
        edge: this.edgeSlotOf.get(e.id),
        size: TYPE.weight,
        color: palette.plate,
        opacity: 1,
        anchorX: 'center',
        font: 'mono',
        orient: 'billboard',
      });
    });

    // Structures: a footprint under those that stand on the floor, and a name on the left.
    for (const st of frame.structures) {
      const members = st.nodeIds.map((id) => nodes.get(id)).filter((n): n is TraceNode => !!n);
      const attached = members.filter((n) => !n.detached);
      const detached = members.filter((n) => n.detached);
      const b = this.boundsOf(attached, rest);
      const note = this.noteOf(st.note, st.kind);
      if (b) {
        const grounded = attached.filter((n) => this.py(n) - NODE_HEIGHT[n.shape] / 2 - fy < 0.3).length >= attached.length * 0.6;
        if (grounded) {
          // A tray under the cells; when they are numbered it reaches forward to carry the indices on its front lip.
          const numbered = attached.some((n) => n.caption !== '' && this.py(n) - NODE_HEIGHT[n.shape] / 2 - fy < CAPTION_CLEARANCE);
          const back = b.back - 0.45;
          const front = b.front + (numbered ? INDEX_AHEAD + TYPE.index + 0.1 : 0.45);
          const footprint = {
            x: (b.left + b.right) / 2,
            z: (back + front) / 2,
            w: b.right - b.left + 0.9,
            d: front - back,
          };
          rest.decals.push({ key: `plinth:${st.name}`, shape: DECAL_SHAPE.roundRect, ...footprint, color: palette.plinth, alpha: 1, layer: 0 });
          rest.decals.push({ key: `rule:${st.name}`, shape: DECAL_SHAPE.outline, ...footprint, color: palette.plinthLine, alpha: 1, layer: 1 });
        }
        // The name sits at the structure's top-left corner, like a figure title: left of an array's first
        // cell, level with a tree's root; a structure spread across the floor is named at its back-left corner.
        const flatSt = this.flatStructures.has(st.name);
        const nameZ = flatSt ? b.back + 0.5 : b.topZ;
        // Beside the top row if nothing else of the structure (or its tags) is in the way, else at the far left.
        const nameW = Math.max(st.name.length * TYPE.heading, (note?.length ?? 0) * TYPE.note) * GLYPH;
        let nameX = b.topLeft - 0.45;
        if (!flatSt && nameX > b.left - 0.45) {
          const top = b.topY + TYPE.heading;
          const bottom = b.topY - (note ? 0.34 + TYPE.note : TYPE.heading);
          const blocked = attached.some((n) => {
            const s = this.slotOf.get(n.id)!;
            const x = rest.pos[s * 3];
            const hw = rest.dims[s * 3] / 2;
            const y = this.py(n);
            const hh = rest.dims[s * 3 + 1] / 2;
            const above = n.tags.length > 0 ? 0.42 + 0.36 * n.tags.length : 0;
            return x + Math.max(hw, n.tags.length > 0 ? 0.9 : 0) > nameX - nameW - 0.2 && x - hw < nameX + 0.2 && y + hh + above > bottom && y - hh < top && Math.abs(y - b.topY) > 0.35;
          });
          if (blocked) nameX = b.left - 0.45;
        }
        if (flatSt) nameX = b.left - 0.45;
        rest.labels.push({
          key: `p:${st.name}`,
          text: st.name,
          x: nameX,
          y: note ? b.topY + 0.16 : b.topY,
          z: nameZ,
          size: TYPE.heading,
          color: palette.plate,
          opacity: 1,
          anchorX: 'right',
          font: 'strong',
          orient: 'billboard',
        });
        if (note) {
          rest.labels.push({
            key: `pn:${st.name}`,
            text: note,
            x: nameX,
            y: b.topY - 0.34,
            z: nameZ,
            size: TYPE.note,
            color: palette.caption,
            opacity: 1,
            anchorX: 'right',
            font: 'serif',
            orient: 'billboard',
          });
        }
      } else if (st.anchor) {
        const shift = this.shift.get(st.name) ?? [0, 0, 0];
        rest.labels.push({
          key: `p:${st.name}`,
          text: note ? `${st.name} · ${note}` : st.name,
          x: st.anchor.x + shift[0] + 0.5,
          y: Math.max(st.anchor.y + shift[1], fy + 0.5),
          z: st.anchor.z + shift[2],
          size: TYPE.heading * 0.85,
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
          x: (hb.left + hb.right) / 2,
          z: (hb.back + hb.front) / 2,
          w: Math.max(3.2, hb.right - hb.left + 1.0),
          d: Math.max(1.9, hb.front - hb.back + 0.9),
          color: palette.caption,
          alpha: 0.6,
          layer: 1,
        });
        rest.labels.push({
          key: `heap:${st.name}`,
          text: 'heap memory · not linked',
          x: hb.left - 0.2,
          y: fy + 0.22,
          z: hb.front + 0.75,
          size: TYPE.note,
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
        x: (b.left + b.right) / 2,
        z: (b.back + b.front) / 2,
        w: b.right - b.left + 0.36,
        d: b.front - b.back + 0.36,
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
        x: (b.left + b.right) / 2,
        z: (b.back + b.front) / 2,
        w: b.right - b.left + 0.62 - inset * 2,
        d: b.front - b.back + 0.62 - inset * 2,
        color: palette.plate,
        alpha: 0.8,
        layer: 3 + p.depth,
      });
      rest.labels.push({
        key: `part:${p.structure}:${p.depth}`,
        text: p.label ?? `[${p.start}..${p.end}]`,
        x: (b.minX + b.maxX) / 2,
        y: fy + 0.2,
        z: b.front + 2.45 + p.depth * 0.42,
        size: TYPE.note,
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
        size: TYPE.relation,
        color: palette.tag,
        opacity: 1,
        anchorX: 'center',
        font: 'strong',
        orient: 'billboard',
      });
    }

    // The call stack lane: only for a program with nothing else to show (otherwise the
    // inspector's call-stack panel says the same thing without crowding the scene).
    if (this.maxCallDepth > 0 && !this.hasNodes) this.addCallStack(rest, frame);
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

    // Cursors pointing at the same cell share one chevron and one label ("low = high = 0").
    const seen = new Set<string>();
    const byCell = new Map<number, string[]>();
    for (const name of names) {
      if (seen.has(name) || seen.size >= MAX_CURSORS) continue;
      seen.add(name);
      const v = vars[name];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= length || !cells.has(v)) continue;
      const list = byCell.get(v) ?? [];
      list.push(name);
      byCell.set(v, list);
    }
    // Left to right; a label that would touch its neighbour steps forward a row.
    const rowEnds: number[] = [];
    for (const v of [...byCell.keys()].sort((a, b) => a - b)) {
      const group = byCell.get(v)!;
      const s = this.slotOf.get(cells.get(v)!.id)!;
      const x = rest.pos[s * 3];
      const z = rest.pos[s * 3 + 2] + rest.dims[s * 3 + 2] / 2 + INDEX_AHEAD + 0.75;
      const text = `${group.join(' = ')} = ${v}`;
      const half = (text.length * TYPE.cursor * GLYPH) / 2;
      let row = 0;
      while (row < rowEnds.length && rowEnds[row] > x - half - 0.2) row++;
      rowEnds[row] = x + half;
      rest.decals.push({ key: `cur:${group[0]}`, shape: DECAL_SHAPE.chevron, x, z, w: 0.42, d: 0.34, color: this.palette.tag, alpha: 0.95, layer: 7 });
      rest.labels.push({
        key: `cur:${group[0]}`,
        text,
        x,
        y: this.floorY + 0.24,
        z: z + 0.9 + row * 0.55,
        size: TYPE.cursor,
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
          x: (b.left + b.right) / 2,
          z: (b.back + b.front) / 2,
          w: b.right - b.left + 0.5,
          d: b.front - b.back + 0.5,
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
        size: TYPE.frame,
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
      size: TYPE.note,
      color: this.palette.caption,
      opacity: 1,
      anchorX: 'center',
      font: 'serif',
      orient: 'billboard',
    });
  }

  /**
   * The ground the whole run ever covers (node centres, half a cell either
   * side) and how high above the floor anything ever reaches. Worlds lay out
   * their scenery around this, so nothing they place stands in a structure.
   */
  private footprintCache: { minX: number; maxX: number; minZ: number; maxZ: number; top: number } | null = null;
  footprint(): { minX: number; maxX: number; minZ: number; maxZ: number; top: number } {
    if (!this.footprintCache) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, top = this.floorY;
      for (const f of this.frames) {
        for (const n of f.nodes) {
          const x = this.px(n), z = this.pz(n);
          minX = Math.min(minX, x - 0.6); maxX = Math.max(maxX, x + 0.6);
          minZ = Math.min(minZ, z - 0.6); maxZ = Math.max(maxZ, z + 0.6);
          top = Math.max(top, this.py(n) + this.heightOf(n) / 2);
        }
      }
      if (!Number.isFinite(minX)) {
        const lane = this.laneX();
        minX = lane.x - 2; maxX = lane.x + 2; minZ = lane.z - 1; maxZ = lane.z + 1;
        top = this.floorY + 1 + this.maxCallDepth * 0.62;
      }
      this.footprintCache = { minX, maxX, minZ, maxZ, top: top - this.floorY };
    }
    return this.footprintCache;
  }

  /** Centre and radius of everything the whole run ever shows (lights, shadows, fog). */
  private boundsCache: { center: [number, number, number]; radius: number } | null = null;
  sceneBounds(): { center: [number, number, number]; radius: number } {
    if (!this.boundsCache) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const f of this.frames) {
        for (const n of f.nodes) {
          minX = Math.min(minX, this.px(n)); maxX = Math.max(maxX, this.px(n));
          minY = Math.min(minY, this.py(n)); maxY = Math.max(maxY, this.py(n));
          minZ = Math.min(minZ, this.pz(n)); maxZ = Math.max(maxZ, this.pz(n));
        }
      }
      if (this.maxCallDepth > 0 && !this.hasNodes) minX = Math.min(minX, this.laneX().x - 2);
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
          minX = Math.min(minX, this.px(n));
          maxZ = Math.max(maxZ, this.pz(n));
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
    let left = Infinity, right = -Infinity, back = Infinity, front = -Infinity;
    for (const n of members) {
      const s = this.slotOf.get(n.id)!;
      const x = rest.pos[s * 3];
      const z = rest.pos[s * 3 + 2];
      const hw = rest.dims[s * 3] / 2;
      const hd = rest.dims[s * 3 + 2] / 2;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      left = Math.min(left, x - hw);
      right = Math.max(right, x + hw);
      back = Math.min(back, z - hd);
      front = Math.max(front, z + hd);
      // The highest resting centre (emphasis lift ignored, so names don't bob with the action).
      const y = this.py(n);
      if (y > topY + 1e-6) {
        topY = y;
        topZ = z;
      }
    }
    // Left edge of the top row (an array's first cell, a tree's root, a stack's top): where its name goes.
    let topLeft = Infinity;
    for (const n of members) {
      if (Math.abs(this.py(n) - topY) > 0.35) continue;
      const s = this.slotOf.get(n.id)!;
      topLeft = Math.min(topLeft, rest.pos[s * 3] - rest.dims[s * 3] / 2);
    }
    return { minX, maxX, minZ, maxZ, left, right, back, front, topY, topZ, topLeft };
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
      const x = rest.pos[s * 3], y = rest.pos[s * 3 + 1], z = rest.pos[s * 3 + 2];
      grow(x - rest.dims[s * 3] / 2 - 0.15, y - rest.dims[s * 3 + 1] / 2, z - rest.dims[s * 3 + 2] / 2 - 0.15);
      grow(x + rest.dims[s * 3] / 2 + 0.15, y + rest.dims[s * 3 + 1] / 2, z + rest.dims[s * 3 + 2] / 2 + 0.15);
    }
    // A world's crew stands on the floor in the gaps in front of the cells: keep that strip in frame.
    if (hasCast(this.world)) {
      for (let s = 0; s < this.slots.length; s++) {
        if (!rest.present[s]) continue;
        if (focusStructure && this.slots[s].structure !== focusStructure && this.slots[s].id !== focusStructure) continue;
        const x = rest.pos[s * 3], z = rest.pos[s * 3 + 2];
        const hw = rest.dims[s * 3] / 2, hd = rest.dims[s * 3 + 2] / 2;
        grow(x - hw - CAST_ROOM_X, this.floorY, z + hd + CAST_ROOM_Z);
        grow(x + hw + CAST_ROOM_X, this.floorY + 1.1, z + hd + CAST_ROOM_Z);
      }
    }
    // Captions printed on the floor in front of their node.
    for (const l of rest.labels) {
      if (!l.follow || l.orient !== 'floor' || !rest.present[l.follow.slot]) continue;
      const s = l.follow.slot;
      grow(rest.pos[s * 3], this.floorY, rest.pos[s * 3 + 2] + rest.dims[s * 3 + 2] / 2 + l.follow.dy + l.size);
    }
    // Look down on the scene when any structure in it lies across the floor (decided per structure,
    // so rows of structures standing one behind another still get the low, across-the-table view).
    let flat = false;
    for (let s = 0; s < this.slots.length && !flat; s++) if (rest.present[s] && this.flatStructures.has(this.slots[s].structure ?? '')) flat = true;
    if (!focusStructure) {
      for (const l of rest.labels) {
        if (l.follow || l.edge !== undefined) continue;
        const width = l.text.length * l.size * GLYPH;
        const left = l.anchorX === 'right' ? l.x - width : l.anchorX === 'center' ? l.x - width / 2 : l.x;
        grow(left, l.y - l.size / 2, l.z);
        grow(left + width, l.y + l.size / 2, l.z);
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
      position: camera?.position
        ? [camera.position.x + this.meanShift[0], camera.position.y + this.meanShift[1], camera.position.z + this.meanShift[2]]
        : undefined,
    };
  }

  /** Average structure move (an absolute camera position written for the given layout moves with the scene). */
  private get meanShift(): [number, number, number] {
    if (this.shift.size === 0) return [0, 0, 0];
    const sum: [number, number, number] = [0, 0, 0];
    for (const v of this.shift.values()) for (let i = 0; i < 3; i++) sum[i] += v[i] / this.shift.size;
    return sum;
  }

  /**
   * What the camera frames at step k: the step's own view, widened to keep
   * everything shown a few steps either side in frame too, so a structure
   * that grows is made room for before it grows and the camera never pumps
   * in and out from one step to the next.
   */
  framing(k: number): ViewKey {
    const hit = this.framingCache.get(k);
    if (hit) return hit;
    const base = this.rest(k).view;
    let view = base;
    if (base.mode === 'AUTO_FIT' || base.mode === 'ORBIT') {
      const lo = [base.center[0] - base.half[0], base.center[1] - base.half[1], base.center[2] - base.half[2]];
      const hi = [base.center[0] + base.half[0], base.center[1] + base.half[1], base.center[2] + base.half[2]];
      let flatVotes = 0;
      let votes = 0;
      for (let j = Math.max(0, k - FRAMING_WINDOW); j <= Math.min(this.frames.length - 1, k + FRAMING_WINDOW); j++) {
        const v = j === k ? base : this.rest(j).view;
        if (v.mode !== base.mode) continue;
        votes++;
        if (v.flat) flatVotes++;
        for (let i = 0; i < 3; i++) {
          lo[i] = Math.min(lo[i], v.center[i] - v.half[i]);
          hi[i] = Math.max(hi[i], v.center[i] + v.half[i]);
        }
      }
      const center: [number, number, number] = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
      const half: [number, number, number] = [(hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, (hi[2] - lo[2]) / 2];
      view = { ...base, center, half, radius: Math.hypot(half[0], half[1], half[2]), flat: flatVotes * 2 > votes };
    }
    this.framingCache.set(k, view);
    return view;
  }
}
