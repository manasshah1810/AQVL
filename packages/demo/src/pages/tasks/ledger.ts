/**
 * Tamper-evident task ledger — the only source of task progress.
 *
 * Pure and dependency-free so the same code runs in the browser (read-only
 * display) and in Node (scripts/task-ledger.ts, the only writer). Every entry
 * commits to the previous entry's hash, so editing, deleting or reordering any
 * line breaks every hash after it. The git-aware checks (does this commit
 * exist, was there real work between start and done) live in the CLI, which
 * CI re-runs on every push.
 */

export type LedgerEvent = 'start' | 'block' | 'unblock' | 'complete' | 'flag';

export interface LedgerCheck {
  cmd: string;
  exit: number;
}

export interface LedgerEntry {
  seq: number;
  /** ISO timestamp, UTC. */
  ts: string;
  task: string;
  event: LedgerEvent;
  actor: string;
  /** Commit the repo was at when the entry was written. */
  head: string;
  note?: string;
  /** complete only: what the CLI observed when it accepted the task. */
  evidence?: {
    startHead: string;
    elapsedMin: number;
    files: string[];
    linesAdded: number;
    required: string[];
    checks: LedgerCheck[];
  };
  prev: string;
  hash: string;
}

export const GENESIS = '0'.repeat(64);

// ─── SHA-256 (sync, so browser and Node share one implementation) ────────

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(padded.length - 4, bitLen >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

// ─── Hashing, parsing ────────────────────────────────────────────────────

/** Stable serialisation: keys sorted, so a re-ordered-but-equal object hashes the same. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export function entryHash(e: Omit<LedgerEntry, 'hash'>): string {
  return sha256(canonical(e));
}

export function sealEntry(e: Omit<LedgerEntry, 'hash' | 'prev' | 'seq'>, prior: LedgerEntry | undefined): LedgerEntry {
  const body = { ...e, seq: prior ? prior.seq + 1 : 1, prev: prior ? prior.hash : GENESIS };
  return { ...body, hash: entryHash(body) };
}

export function parseLedger(raw: string): { entries: LedgerEntry[]; errors: string[] } {
  const entries: LedgerEntry[] = [];
  const errors: string[] = [];
  raw.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try {
      entries.push(JSON.parse(line) as LedgerEntry);
    } catch {
      errors.push(`line ${i + 1}: not valid JSON`);
    }
  });
  return { entries, errors };
}

export const serializeEntry = (e: LedgerEntry) => `${JSON.stringify(e)}\n`;

// ─── Structural verification ─────────────────────────────────────────────

export type Transition = 'planned' | 'in_progress' | 'blocked' | 'completed';
const EVENTS: LedgerEvent[] = ['start', 'block', 'unblock', 'complete', 'flag'];

/** What event may legally follow the task's current state. */
const ALLOWED: Record<Transition, LedgerEvent[]> = {
  planned: ['start'],
  in_progress: ['block', 'complete'],
  blocked: ['unblock'],
  completed: [],
};

/** `flag` records a refused or suspicious attempt and never changes a task's state. */
export function nextState(state: Transition, event: LedgerEvent): Transition | null {
  if (event === 'flag') return state;
  if (!ALLOWED[state].includes(event)) return null;
  return event === 'start' || event === 'unblock' ? 'in_progress' : event === 'block' ? 'blocked' : 'completed';
}

export interface ChainReport {
  ok: boolean;
  errors: string[];
  /** Entries that are trustworthy: the verified prefix before the first break. */
  trusted: LedgerEntry[];
}

/** Hash chain, ordering, timestamps and per-task state machine. No git needed. */
export function verifyChain(entries: LedgerEntry[], knownTasks: Set<string>, now = Date.now()): ChainReport {
  const errors: string[] = [];
  const trusted: LedgerEntry[] = [];
  const state = new Map<string, Transition>();
  let prev: LedgerEntry | undefined;

  for (const e of entries) {
    const at = `entry #${e?.seq ?? '?'}`;
    const fail = (msg: string) => errors.push(`${at}: ${msg}`);
    if (!e || typeof e !== 'object') { fail('malformed'); break; }
    if (e.seq !== (prev ? prev.seq + 1 : 1)) { fail(`sequence broken (expected ${prev ? prev.seq + 1 : 1})`); break; }
    if (e.prev !== (prev ? prev.hash : GENESIS)) { fail('does not chain to the previous entry'); break; }
    const { hash, ...body } = e;
    if (entryHash(body) !== hash) { fail('contents do not match their hash (edited after the fact)'); break; }
    if (!EVENTS.includes(e.event)) { fail(`unknown event "${e.event}"`); break; }
    if (!knownTasks.has(e.task)) { fail(`unknown task "${e.task}"`); break; }
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) { fail('bad timestamp'); break; }
    if (prev && t < Date.parse(prev.ts)) { fail('timestamp runs backwards'); break; }
    if (t > now + 5 * 60_000) { fail('timestamp is in the future'); break; }
    const next = nextState(state.get(e.task) ?? 'planned', e.event);
    if (!next) { fail(`"${e.event}" is not allowed while ${e.task} is ${state.get(e.task) ?? 'planned'}`); break; }
    if (e.event === 'complete' && !e.evidence) { fail('completion has no evidence attached'); break; }
    state.set(e.task, next);
    trusted.push(e);
    prev = e;
  }
  return { ok: errors.length === 0, errors, trusted };
}

// ─── Replay: ledger → per-task facts ─────────────────────────────────────

export interface TaskFacts {
  status: Transition;
  startedAt: string | null;
  completedAt: string | null;
  blocker: string;
  actor: string | null;
  /** Minutes between start and complete, as the CLI measured them. */
  elapsedMin: number | null;
  /** Refused completion attempts and integrity flags recorded against the task. */
  flags: LedgerEntry[];
  history: LedgerEntry[];
}

export function replay(entries: LedgerEntry[]): Map<string, TaskFacts> {
  const out = new Map<string, TaskFacts>();
  for (const e of entries) {
    const f = out.get(e.task) ?? { status: 'planned' as Transition, startedAt: null, completedAt: null, blocker: '', actor: null, elapsedMin: null, flags: [], history: [] };
    f.history.push(e);
    if (e.event === 'flag') { f.flags.push(e); out.set(e.task, f); continue; }
    f.actor = e.actor;
    if (e.event === 'start') { f.status = 'in_progress'; f.startedAt = e.ts; }
    else if (e.event === 'block') { f.status = 'blocked'; f.blocker = e.note ?? ''; }
    else if (e.event === 'unblock') { f.status = 'in_progress'; f.blocker = ''; }
    else if (e.event === 'complete') { f.status = 'completed'; f.completedAt = e.ts; f.elapsedMin = e.evidence?.elapsedMin ?? null; f.blocker = ''; }
    out.set(e.task, f);
  }
  return out;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${Math.max(0, Math.round(min))}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}
