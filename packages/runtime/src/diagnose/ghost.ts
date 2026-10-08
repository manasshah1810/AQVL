import type { TraceFrame, TraceNode, Vec3 } from '../trace/types';
import type { ErrorGhost, ErrorInfo } from './types';

/** Id of the cell the stage draws for an access that could not be made. */
export const GHOST_ID = 'error:ghost';

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });

/** Where the missing cell would sit: the structure's own spacing, continued past its last cell (or before its first). */
function ghostPosition(frame: TraceFrame, ghost: ErrorGhost): { pos: Vec3; scale: Vec3; neighbour?: TraceNode } {
  const cells = frame.nodes.filter((n) => n.structure === ghost.structure && !n.detached).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const structure = frame.structures.find((s) => s.name === ghost.structure);
  if (cells.length === 0) {
    return { pos: structure?.anchor ?? { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  }
  const first = cells[0];
  const last = cells[cells.length - 1];
  // One slot of spacing, measured from the structure itself so any layout (spread, tight, vertical) is continued.
  const stride: Vec3 =
    cells.length >= 2
      ? { x: (last.pos.x - first.pos.x) / (cells.length - 1), y: (last.pos.y - first.pos.y) / (cells.length - 1), z: (last.pos.z - first.pos.z) / (cells.length - 1) }
      : { x: Math.max(1.4, first.scale.x * 1.35), y: 0, z: 0 };
  const slot = ghost.slot;
  if (slot === null) return { pos: structure?.anchor ?? first.pos, scale: first.scale };
  if (slot < 0) return { pos: add(first.pos, stride, Math.max(slot, -1)), scale: first.scale, neighbour: first };
  // Far beyond the end the cell is shown just past the last one: the picture says "past the end", the strip says how far.
  const pastLast = Math.max(1, Math.min(slot - (last.index ?? cells.length - 1), 1));
  return { pos: add(last.pos, stride, pastLast), scale: last.scale, neighbour: last };
}

/**
 * The error frame: the scene as it was when the line failed, plus the cell the
 * line reached for and could not have. The failed access is drawn where it
 * would have been, in the error colour, next to the last cell that does exist,
 * so the picture itself says "there is nothing here".
 */
export function buildErrorFrame(base: TraceFrame, info: ErrorInfo, ghost: ErrorGhost | null, caption: string): TraceFrame {
  const nodes = [...base.nodes];
  const actors: string[] = [];
  if (ghost) {
    const { pos, scale, neighbour } = ghostPosition(base, ghost);
    nodes.push({
      id: GHOST_ID,
      shape: 'box',
      family: 'ERROR_GHOST',
      text: ghost.text,
      caption: ghost.caption,
      tags: [],
      tagPlacement: 'above',
      state: 'ERROR',
      pos,
      scale,
      opacity: 0.6,
      detached: false,
    });
    actors.push(GHOST_ID);
    if (neighbour) actors.push(neighbour.id);
  }
  return {
    ...base,
    nodes,
    event: { kind: 'error', actors, edges: [], writes: [] },
    caption,
    line: info.line,
    error: { info, ghost },
  };
}
