/**
 * Developer Gateway — a local, maintainer-only server for correcting the task ledger.
 *
 *   pnpm gateway            listens on http://127.0.0.1:8787 (GATEWAY_PORT to change)
 *
 * Credentials come from the environment (or a gitignored .env.local at the repo root):
 *   DEV_GATEWAY_ID, DEV_GATEWAY_PASSWORD
 * The server refuses to start without them. It only ever exposes the handful of
 * ledger operations below — no file, SQL or shell access — and every change is
 * recorded in ledger/manual-changes.jsonl with a reason and before/after copies.
 *
 * Because the ledger is hash-chained, any edit/insert/delete re-seals the chain
 * from that point. Touched entries are marked `manual: true`.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLedger, sealEntry, verifyChain } from '../packages/demo/src/pages/tasks/ledger';
import type { LedgerEntry, LedgerEvent } from '../packages/demo/src/pages/tasks/ledger';
import { LEDGER_DIR, LEDGER_FILE, SEEDS } from '../packages/demo/src/pages/tasks/model';

const ROOT = join(__dirname, '..');
const LEDGER_PATH = join(ROOT, LEDGER_FILE);
const HISTORY_PATH = join(ROOT, LEDGER_DIR, 'manual-changes.jsonl');
const TASKS = new Set(SEEDS.map((s) => s.id));
const EVENTS: LedgerEvent[] = ['start', 'block', 'unblock', 'complete', 'flag'];

const envFile = join(ROOT, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const ID = process.env.DEV_GATEWAY_ID;
const PASSWORD = process.env.DEV_GATEWAY_PASSWORD;
if (!ID || !PASSWORD || PASSWORD.length < 12) {
  console.error('Set DEV_GATEWAY_ID and DEV_GATEWAY_PASSWORD (12+ characters) in the environment or .env.local.');
  process.exit(1);
}
const PORT = Number(process.env.GATEWAY_PORT ?? 8787);
const EXTRA_ORIGINS = (process.env.GATEWAY_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// ─── auth ────────────────────────────────────────────────────────────────

const digest = (s: string) => createHash('sha256').update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

const SESSION_MS = 60 * 60_000;
const sessions = new Map<string, number>();
let failures = 0;
let lockedUntil = 0;

function login(id: unknown, password: unknown): string | null {
  if (Date.now() < lockedUntil) return null;
  const ok = typeof id === 'string' && typeof password === 'string' && same(id, ID!) && same(password, PASSWORD!);
  if (!ok) {
    if (++failures >= 5) { lockedUntil = Date.now() + 60_000; failures = 0; }
    return null;
  }
  failures = 0;
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}

function authed(req: IncomingMessage): boolean {
  const m = /^Bearer (\w+)$/.exec(req.headers.authorization ?? '');
  const exp = m && sessions.get(m[1]);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(m![1]); return false; }
  return true;
}

// ─── ledger operations ───────────────────────────────────────────────────

const readEntries = (): LedgerEntry[] => parseLedger(existsSync(LEDGER_PATH) ? readFileSync(LEDGER_PATH, 'utf8') : '').entries;

/** Recompute seq / prev / hash for the whole list, in array order. */
function rechain(list: LedgerEntry[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const e of list) {
    const { hash: _h, prev: _p, seq: _s, ...body } = e;
    out.push(sealEntry(body, out[out.length - 1]));
  }
  return out;
}

function save(entries: LedgerEntry[]) {
  const tmp = `${LEDGER_PATH}.tmp`;
  writeFileSync(tmp, entries.map((e) => `${JSON.stringify(e)}\n`).join(''));
  renameSync(tmp, LEDGER_PATH);
}

function report(entries: LedgerEntry[]) {
  const r = verifyChain(entries, TASKS);
  return { ok: r.ok, errors: r.errors };
}

class Bad extends Error {}

/** Whitelist + validate the editable fields of an entry. */
function fields(input: Record<string, unknown>, partial: boolean) {
  const out: Partial<Pick<LedgerEntry, 'task' | 'event' | 'actor' | 'ts' | 'head' | 'note'>> = {};
  const str = (k: string, max: number) => {
    const v = input[k];
    if (v === undefined && partial) return undefined;
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Bad(`"${k}" is required (max ${max} characters)`);
    return v.trim();
  };
  const task = str('task', 40);
  if (task !== undefined) { if (!TASKS.has(task)) throw new Bad(`unknown task "${task}"`); out.task = task; }
  const event = str('event', 20);
  if (event !== undefined) { if (!EVENTS.includes(event as LedgerEvent)) throw new Bad(`unknown event "${event}"`); out.event = event as LedgerEvent; }
  const actor = str('actor', 120); if (actor !== undefined) out.actor = actor;
  const ts = str('ts', 40);
  if (ts !== undefined) { if (Number.isNaN(Date.parse(ts))) throw new Bad('"ts" is not a valid date'); out.ts = new Date(ts).toISOString(); }
  if (input.head !== undefined || !partial) {
    const head = typeof input.head === 'string' ? input.head.trim() : '';
    if (!/^[0-9a-f]{7,40}$/.test(head)) throw new Bad('"head" must be a git commit hash');
    out.head = head;
  }
  if (input.note !== undefined) {
    if (typeof input.note !== 'string' || input.note.length > 500) throw new Bad('"note" must be text (max 500 characters)');
    out.note = input.note.trim() || undefined;
  }
  return out;
}

function reasonOf(body: Record<string, unknown>): string {
  const r = body.reason;
  if (typeof r !== 'string' || r.trim().length < 5 || r.length > 300) throw new Bad('a reason (5–300 characters) is required for every change');
  return r.trim();
}

function logChange(action: string, reason: string, before: LedgerEntry | null, after: LedgerEntry | null, headBefore: string, headAfter: string) {
  const row = { ts: new Date().toISOString(), actor: ID, action, reason, before, after, chainHeadBefore: headBefore, chainHeadAfter: headAfter };
  appendFileSync(HISTORY_PATH, `${JSON.stringify(row)}\n`);
}

const headHash = (l: LedgerEntry[]) => (l.length ? l[l.length - 1].hash : '');
const withManual = (e: LedgerEntry) => ({ ...e, manual: true }) as LedgerEntry;

function addEntry(body: Record<string, unknown>) {
  const reason = reasonOf(body);
  const f = fields(body, false);
  const list = readEntries();
  const after = body.insertAfter === undefined ? list.length : Number(body.insertAfter);
  if (!Number.isInteger(after) || after < 0 || after > list.length) throw new Bad('"insertAfter" must be a seq number or 0');
  const given = body.evidence;
  if (given !== undefined && (typeof given !== 'object' || given === null || Array.isArray(given) || JSON.stringify(given).length > 20_000)) throw new Bad('"evidence" must be an object (max 20 KB)');
  const entry = {
    ...f,
    ...(f.event === 'complete' ? { evidence: given ?? { startHead: f.head!, elapsedMin: 0, files: [], linesAdded: 0, required: [], checks: [] } } : {}),
  } as LedgerEntry;
  const next = rechain([...list.slice(0, after), withManual(entry), ...list.slice(after)]);
  save(next);
  logChange('add', reason, null, next[after], headHash(list), headHash(next));
  return next;
}

function editEntry(seq: number, body: Record<string, unknown>) {
  const reason = reasonOf(body);
  const list = readEntries();
  const i = list.findIndex((e) => e.seq === seq);
  if (i < 0) throw new Bad(`no entry #${seq}`);
  const patch = fields(body, true);
  const edited = withManual({ ...list[i], ...patch });
  if (patch.note === undefined && 'note' in body) delete edited.note;
  const next = rechain(list.map((e, j) => (j === i ? edited : e)));
  save(next);
  logChange('edit', reason, list[i], next[i], headHash(list), headHash(next));
  return next;
}

function deleteEntry(seq: number, body: Record<string, unknown>) {
  const reason = reasonOf(body);
  const list = readEntries();
  const i = list.findIndex((e) => e.seq === seq);
  if (i < 0) throw new Bad(`no entry #${seq}`);
  const next = rechain(list.filter((_, j) => j !== i));
  save(next);
  logChange('delete', reason, list[i], null, headHash(list), headHash(next));
  return next;
}

const readHistory = () => (existsSync(HISTORY_PATH) ? parseLedger(readFileSync(HISTORY_PATH, 'utf8')).entries : []).slice(-100).reverse();

// ─── http ────────────────────────────────────────────────────────────────

const allowedOrigin = (o?: string) => !!o && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || EXTRA_ORIGINS.includes(o));

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024) { reject(new Bad('request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const v = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
        resolve(v as Record<string, unknown>);
      } catch { reject(new Bad('body must be a JSON object')); }
    });
  });
}

const view = (entries: LedgerEntry[]) => ({ entries, chain: report(entries), history: readHistory() });

createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigin(origin)) return send(res, 403, { error: 'origin not allowed' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (req.method === 'POST' && path === '/api/login') {
      const b = await readBody(req);
      if (Date.now() < lockedUntil) return send(res, 429, { error: 'too many attempts; wait a minute' });
      const token = login(b.id, b.password);
      return token ? send(res, 200, { token, expiresInMin: SESSION_MS / 60_000 }) : send(res, 401, { error: 'wrong ID or password' });
    }
    if (!authed(req)) return send(res, 401, { error: 'not signed in' });

    if (req.method === 'GET' && path === '/api/ledger') return send(res, 200, { ...view(readEntries()), tasks: [...TASKS], events: EVENTS });
    if (req.method === 'POST' && path === '/api/entries') return send(res, 200, view(addEntry(await readBody(req))));
    const m = /^\/api\/entries\/(\d+)$/.exec(path);
    if (m && req.method === 'PUT') return send(res, 200, view(editEntry(Number(m[1]), await readBody(req))));
    if (m && req.method === 'DELETE') return send(res, 200, view(deleteEntry(Number(m[1]), await readBody(req))));
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    if (e instanceof Bad) return send(res, 400, { error: e.message });
    console.error(e);
    return send(res, 500, { error: 'server error' });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Developer Gateway on http://127.0.0.1:${PORT} (local only). Open the site at #/developer.`));
