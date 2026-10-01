/**
 * Task ledger CLI — the only thing that can change a task's status.
 *
 *   pnpm task start <id>            stamp the start of work (starts the clock)
 *   pnpm task done  <id>            verify the work against git, then record completion
 *   pnpm task block <id> <reason>   record a blocker
 *   pnpm task unblock <id>
 *   pnpm task status                show where everything stands
 *   pnpm task verify [--base REF]   re-derive every entry from git (pre-commit + CI)
 *   pnpm task protected --staged | --base REF --actor NAME
 *                                   fail if the tracker itself was edited by a non-maintainer
 *
 * A completion is accepted only if git independently shows the work: commits
 * by the same person since `start`, real changed lines, every promised
 * deliverable file committed, dependencies already verified, a minimum elapsed
 * time, and (for code phases) a green `pnpm test`. `verify` repeats all of that
 * from history, so a hand-edited or re-hashed ledger line still fails.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLedger, replay, sealEntry, serializeEntry, verifyChain } from '../packages/demo/src/pages/tasks/ledger';
import type { LedgerEntry, LedgerEvent } from '../packages/demo/src/pages/tasks/ledger';
import { LEDGER_FILE, SEEDS, requiredFiles } from '../packages/demo/src/pages/tasks/model';
import type { TaskSeed } from '../packages/demo/src/pages/tasks/types';

const ROOT = join(__dirname, '..');
const LEDGER_PATH = join(ROOT, LEDGER_FILE);
const SEED_BY_ID = new Map(SEEDS.map((s) => [s.id, s]));

/** Files that define the rules. Only a maintainer may change them (enforced locally and in CI). */
export const MAINTAINERS = { logins: ['manasshah1810'], emails: ['manasshah1210@gmail.com'] };
export const PROTECTED = [
  'scripts/task-ledger.ts',
  'packages/demo/src/pages/tasks/ledger.ts',
  'packages/demo/src/pages/tasks/model.ts',
  'packages/demo/src/pages/tasks/roadmapData.ts',
  'packages/demo/src/pages/tasks/teamData.ts',
  'packages/demo/src/pages/tasks/types.ts',
  '.husky/pre-commit',
  '.github/',
  '.claude/settings.json',
  '.claude/hooks/',
  'AGENTS.md',
];

const MIN_ELAPSED_MIN = { prereq: 3, subphase: 10, team: 15 } as const;
const MIN_LINES = { prereq: 0, subphase: 15, team: 15 } as const;
const MIN_DELIVERABLE_BYTES = 120;
const TEST_CMD = 'pnpm test';

/** Source areas each non-lead member must not change (mirrors the guardrails on their dashboard). */
const FORBIDDEN: Record<string, RegExp[]> = {
  yash: [/^packages\/(compiler|runtime|renderer|shared)\//],
  tirrth: [/^packages\/(compiler|runtime)\//],
  pranav: [/^packages\/[^/]+\/src\//, /^tests\//],
};

// ─── git helpers ─────────────────────────────────────────────────────────

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
}
function gitOk(...args: string[]): boolean {
  try {
    execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const head = () => git('rev-parse', 'HEAD');
const actorEmail = () => {
  try {
    return git('config', 'user.email');
  } catch {
    return '';
  }
};
const isAncestor = (a: string, b: string) => gitOk('merge-base', '--is-ancestor', a, b);
const commitTime = (sha: string) => Number(git('show', '-s', '--format=%ct', sha)) * 1000;

/** What `actor` actually committed between two commits (merges and the ledger itself excluded). */
function workBy(actor: string, from: string, to: string) {
  const out = git('log', '--no-merges', `--author=${actor}`, '--numstat', '--format=@@%H', `${from}..${to}`);
  const files = new Set<string>();
  let added = 0;
  let commits = 0;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@')) { commits++; continue; }
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m || m[3].startsWith('packages/demo/src/pages/tasks/ledger/')) continue;
    files.add(m[3]);
    if (m[1] !== '-') added += Number(m[1]);
  }
  return { files: [...files].sort(), linesAdded: added, commits };
}

// ─── ledger I/O ──────────────────────────────────────────────────────────

function readLedger(): LedgerEntry[] {
  const raw = existsSync(LEDGER_PATH) ? readFileSync(LEDGER_PATH, 'utf8') : '';
  const { entries, errors } = parseLedger(raw);
  if (errors.length) die(`Ledger is unreadable: ${errors[0]}`);
  return entries;
}

function die(msg: string, code = 1): never {
  console.error(`\n${msg}\n`);
  process.exit(code);
}

function append(e: Omit<LedgerEntry, 'hash' | 'prev' | 'seq'>, entries: LedgerEntry[]): LedgerEntry {
  const sealed = sealEntry(e, entries[entries.length - 1]);
  appendFileSync(LEDGER_PATH, serializeEntry(sealed));
  return sealed;
}

const now = () => new Date().toISOString();

// ─── the gates (shared by `done` and `verify`) ───────────────────────────

const needsTests = (s: TaskSeed) => s.kind === 'subphase' && (s.phase ?? 0) >= 2;

function depsCompleted(seed: TaskSeed, prior: LedgerEntry[]): string[] {
  const facts = replay(prior);
  return seed.dependencies.filter((d) => facts.get(d)?.status !== 'completed');
}

/** Every reason this completion must be refused. Empty = acceptable. */
function judgeCompletion(seed: TaskSeed, start: LedgerEntry | undefined, done: Pick<LedgerEntry, 'ts' | 'head' | 'actor'> & { evidence: NonNullable<LedgerEntry['evidence']> }, prior: LedgerEntry[]): string[] {
  const why: string[] = [];
  const ev = done.evidence;
  if (!start) return [`${seed.id} was never started. Run \`pnpm task start ${seed.id}\` before the work, not after it.`];

  const unmet = depsCompleted(seed, prior);
  if (unmet.length) why.push(`Dependencies not verified complete: ${unmet.join(', ')}. Phases run in order; none can be skipped.`);

  if (ev.startHead !== start.head) why.push('Evidence does not match the recorded start commit.');
  if (!isAncestor(start.head, done.head)) why.push('The start commit is not an ancestor of the completion commit (history was rewritten).');
  if (!isAncestor(done.head, 'HEAD')) why.push('The completion commit is not part of this branch.');

  const minutes = (Date.parse(done.ts) - Date.parse(start.ts)) / 60_000;
  const minNeeded = MIN_ELAPSED_MIN[seed.kind];
  if (minutes < minNeeded) why.push(`Only ${minutes.toFixed(1)} min since start; ${seed.kind} tasks need at least ${minNeeded} min of real work.`);
  if (Math.abs(minutes - ev.elapsedMin) > 1) why.push('Recorded elapsed time does not match the start and completion timestamps.');
  if (commitTime(done.head) > Date.parse(done.ts) + 120_000) why.push('Completion is stamped earlier than the commit it claims.');
  if (commitTime(start.head) > Date.parse(start.ts) + 120_000) why.push('Start is stamped earlier than the commit it claims.');

  if (seed.kind !== 'prereq') {
    const work = workBy(done.actor, start.head, done.head);
    if (work.commits === 0) why.push(`No commits by ${done.actor} between start and now. Nothing was committed, so nothing can be verified.`);
    if (work.linesAdded < MIN_LINES[seed.kind]) why.push(`Only ${work.linesAdded} lines added by ${done.actor}; ${seed.kind} tasks need at least ${MIN_LINES[seed.kind]}.`);
    if (work.files.length === 0) why.push('No files were changed.');
    if (JSON.stringify(work.files) !== JSON.stringify(ev.files) || work.linesAdded !== ev.linesAdded) why.push('Recorded evidence does not match what git shows for this range.');

    const banned = FORBIDDEN[seed.owner] ?? [];
    const out = work.files.filter((f) => banned.some((re) => re.test(f)));
    if (out.length) why.push(`Out-of-scope changes for ${seed.owner}: ${out.slice(0, 4).join(', ')}. Revert them before this task can complete.`);
  }

  const required = requiredFiles(seed);
  if (JSON.stringify(required) !== JSON.stringify(ev.required)) why.push('Recorded deliverable list differs from the task definition.');
  for (const f of required) {
    let size = 0;
    try {
      size = Number(git('cat-file', '-s', `${done.head}:${f}`));
    } catch {
      /* not in that commit */
    }
    if (size === 0) why.push(`Promised deliverable is not committed: ${f}`);
    else if (size < MIN_DELIVERABLE_BYTES) why.push(`Deliverable is a stub (${size} bytes): ${f}`);
  }

  if (needsTests(seed) && !ev.checks.some((c) => c.cmd === TEST_CMD && c.exit === 0)) why.push(`\`${TEST_CMD}\` was not recorded as passing.`);
  return why;
}

// ─── commands ────────────────────────────────────────────────────────────

function loadChecked(): LedgerEntry[] {
  const entries = readLedger();
  const report = verifyChain(entries, new Set(SEED_BY_ID.keys()));
  if (!report.ok) die(`Ledger integrity check failed:\n  ${report.errors.join('\n  ')}\nNo further entries can be recorded until a maintainer repairs it.`, 2);
  return entries;
}

function seedOrDie(id?: string): TaskSeed {
  const seed = id ? SEED_BY_ID.get(id) : undefined;
  if (!seed) die(`Unknown task "${id ?? ''}". Ids look like R1.1, Y2, T3, P4.`);
  return seed;
}

function flag(seed: TaskSeed, reasons: string[], entries: LedgerEntry[]): never {
  append({ ts: now(), task: seed.id, event: 'flag', actor: actorEmail() || 'unknown', head: head(), note: reasons.join(' | ').slice(0, 600) }, entries);
  console.error(`\nREFUSED: ${seed.id} (${seed.title}) cannot be marked complete.\n`);
  reasons.forEach((r) => console.error(`  - ${r}`));
  console.error(
    '\nThis refusal has been recorded against the task in the ledger and is visible on the dashboard.' +
      '\nThe status cannot be set any other way: the dashboard is read-only, the ledger is hash-chained, and CI re-checks every completion against git.' +
      '\nDo not edit the ledger, bypass hooks, or change the tracker. Do the work, commit it, then run the command again.\n',
  );
  process.exit(3);
}

function cmdStart(id?: string) {
  const seed = seedOrDie(id);
  const entries = loadChecked();
  const facts = replay(entries).get(seed.id);
  if (facts?.status === 'completed') die(`${seed.id} is already complete.`);
  if (facts?.status === 'in_progress') die(`${seed.id} is already in progress (started ${facts.startedAt}).`);
  if (facts?.status === 'blocked') die(`${seed.id} is blocked. Run \`pnpm task unblock ${seed.id}\` first.`);
  const unmet = depsCompleted(seed, entries);
  if (unmet.length) die(`${seed.id} cannot start yet: ${unmet.join(', ')} must be verified complete first.`);
  const e = append({ ts: now(), task: seed.id, event: 'start', actor: actorEmail() || 'unknown', head: head() }, entries);
  console.log(`Started ${seed.id} at ${e.ts} (entry #${e.seq}).`);
}

function cmdDone(id?: string) {
  const seed = seedOrDie(id);
  const entries = loadChecked();
  const facts = replay(entries).get(seed.id);
  if (facts?.status === 'completed') die(`${seed.id} is already complete.`);
  const start = facts?.status === 'in_progress' ? [...entries].reverse().find((e) => e.task === seed.id && e.event === 'start') : undefined;
  const actor = actorEmail() || 'unknown';

  if (!start) flag(seed, [`${seed.id} is ${facts?.status ?? 'planned'}, not in progress. It must be started and worked on before it can complete.`], entries);

  const dirty = git('status', '--porcelain', '--untracked-files=no').split('\n').filter((l) => l && !l.includes('pages/tasks/ledger/'));
  if (dirty.length) flag(seed, [`Uncommitted changes to tracked files (${dirty.length}). Commit the work first so it can be verified: ${dirty.slice(0, 3).map((l) => l.replace(/^\s*\S+\s+/, '')).join(', ')}`], entries);

  const headNow = head();
  const work = seed.kind === 'prereq' ? { files: [] as string[], linesAdded: 0 } : workBy(actor, start.head, headNow);
  const draft = {
    ts: now(),
    head: headNow,
    actor,
    evidence: {
      startHead: start.head,
      elapsedMin: Math.round(((Date.now() - Date.parse(start.ts)) / 60_000) * 10) / 10,
      files: work.files,
      linesAdded: work.linesAdded,
      required: requiredFiles(seed),
      checks: [] as { cmd: string; exit: number }[],
    },
  };

  let why = judgeCompletion(seed, start, draft, entries);
  if (why.length) flag(seed, why, entries);

  if (needsTests(seed)) {
    console.log(`Running ${TEST_CMD} ...`);
    const r = spawnSync(TEST_CMD, { cwd: ROOT, shell: true, stdio: 'inherit' });
    draft.evidence.checks.push({ cmd: TEST_CMD, exit: r.status ?? 1 });
    draft.ts = now();
    draft.evidence.elapsedMin = Math.round(((Date.now() - Date.parse(start.ts)) / 60_000) * 10) / 10;
    why = judgeCompletion(seed, start, draft, entries);
    if (r.status !== 0) why.unshift(`\`${TEST_CMD}\` failed (exit ${r.status}).`);
    if (why.length) flag(seed, why, entries);
  }

  const e = append({ ...draft, task: seed.id, event: 'complete' as LedgerEvent }, entries);
  console.log(`\nVERIFIED: ${seed.id} ${seed.title}`);
  console.log(`  ${e.evidence!.elapsedMin} min elapsed, ${e.evidence!.files.length} files changed, +${e.evidence!.linesAdded} lines, ${e.evidence!.checks.length} check(s) passed.`);
  console.log(`  Recorded as ledger entry #${e.seq}. Commit the ledger file so the dashboard picks it up:\n    git add ${LEDGER_FILE} && git commit -m "chore(tasks): ${seed.id} verified"`);
}

function cmdBlock(id?: string, reason?: string) {
  const seed = seedOrDie(id);
  if (!reason?.trim()) die('A blocker needs a reason: pnpm task block <id> "what is stopping it"');
  const entries = loadChecked();
  const status = replay(entries).get(seed.id)?.status ?? 'planned';
  if (status !== 'in_progress') die(`${seed.id} is ${status}; only a task in progress can be blocked.`);
  append({ ts: now(), task: seed.id, event: 'block', actor: actorEmail() || 'unknown', head: head(), note: reason.trim() }, entries);
  console.log(`${seed.id} marked blocked.`);
}

function cmdUnblock(id?: string) {
  const seed = seedOrDie(id);
  const entries = loadChecked();
  if ((replay(entries).get(seed.id)?.status ?? 'planned') !== 'blocked') die(`${seed.id} is not blocked.`);
  append({ ts: now(), task: seed.id, event: 'unblock', actor: actorEmail() || 'unknown', head: head() }, entries);
  console.log(`${seed.id} unblocked.`);
}

function cmdStatus() {
  const entries = loadChecked();
  const facts = replay(entries);
  const done = SEEDS.filter((s) => facts.get(s.id)?.status === 'completed').length;
  console.log(`${done}/${SEEDS.length} tasks verified complete, ${entries.length} ledger entries.`);
  for (const s of SEEDS) {
    const f = facts.get(s.id);
    if (f && f.status !== 'planned') console.log(`  ${s.id.padEnd(6)} ${f.status.padEnd(12)} ${s.title}${f.flags.length ? `  [${f.flags.length} refused]` : ''}`);
  }
}

/** Full re-derivation. Exits non-zero on any problem. */
function cmdVerify(base?: string) {
  const problems: string[] = [];
  const entries = readLedger();

  const report = verifyChain(entries, new Set(SEED_BY_ID.keys()));
  problems.push(...report.errors);

  if (base) {
    let committed = '';
    try {
      committed = git('show', `${base}:${LEDGER_FILE}`);
    } catch {
      /* ledger did not exist at base: anything is an append */
    }
    const current = existsSync(LEDGER_PATH) ? readFileSync(LEDGER_PATH, 'utf8') : '';
    const norm = (s: string) => (s.endsWith('\n') || !s ? s : `${s}\n`);
    if (committed && !current.startsWith(norm(committed))) problems.push(`The ledger was rewritten, not appended to, relative to ${base}. Existing entries must never change.`);
  }

  if (report.ok) {
    const prior: LedgerEntry[] = [];
    for (const e of entries) {
      const seed = SEED_BY_ID.get(e.task)!;
      if (!gitOk('cat-file', '-e', `${e.head}^{commit}`)) problems.push(`entry #${e.seq}: commit ${e.head.slice(0, 8)} does not exist in this repository`);
      else if (!isAncestor(e.head, 'HEAD')) problems.push(`entry #${e.seq}: commit ${e.head.slice(0, 8)} is not on this branch`);
      else if (e.event === 'start') {
        const unmet = depsCompleted(seed, prior);
        if (unmet.length) problems.push(`entry #${e.seq}: ${e.task} started before ${unmet.join(', ')} were verified`);
      } else if (e.event === 'complete') {
        const start = [...prior].reverse().find((p) => p.task === e.task && p.event === 'start');
        const why = judgeCompletion(seed, start, { ts: e.ts, head: e.head, actor: e.actor, evidence: e.evidence! }, prior);
        problems.push(...why.map((w) => `entry #${e.seq} (${e.task} complete): ${w}`));
      }
      prior.push(e);
    }
  }

  if (problems.length) {
    console.error(`\nTask ledger verification FAILED (${problems.length} problem${problems.length === 1 ? '' : 's'}):`);
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error('\nProgress can only be recorded through `pnpm task`, and only for work that exists in git.\n');
    process.exit(4);
  }
  console.log(`Task ledger OK: ${entries.length} entries verified against git.`);
}

function cmdProtected(args: string[]) {
  const staged = args.includes('--staged');
  const base = args[args.indexOf('--base') + 1];
  const actor = args.includes('--actor') ? args[args.indexOf('--actor') + 1] : '';
  const changed = (staged ? git('diff', '--cached', '--name-only') : git('diff', '--name-only', `${base}...HEAD`)).split('\n').filter(Boolean);
  const hit = changed.filter((f) => PROTECTED.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
  if (!hit.length) return console.log('No protected tracker files changed.');
  const ok = staged
    ? MAINTAINERS.emails.includes(actorEmail().toLowerCase()) || MAINTAINERS.logins.includes(git('config', 'user.name').toLowerCase())
    : MAINTAINERS.logins.includes(actor.toLowerCase());
  if (ok) return console.log(`Protected files changed by maintainer: ${hit.join(', ')}`);
  console.error(`\nBLOCKED: these files define how progress is tracked and only the project maintainer may change them:\n  ${hit.join('\n  ')}\n`);
  process.exit(5);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'start': cmdStart(rest[0]); break;
  case 'done': cmdDone(rest[0]); break;
  case 'block': cmdBlock(rest[0], rest.slice(1).join(' ')); break;
  case 'unblock': cmdUnblock(rest[0]); break;
  case 'status': cmdStatus(); break;
  case 'verify': cmdVerify(rest.includes('--base') ? rest[rest.indexOf('--base') + 1] : undefined); break;
  case 'protected': cmdProtected(rest); break;
  default:
    die('Usage: pnpm task <start|done|block|unblock|status|verify|protected> [args]');
}
