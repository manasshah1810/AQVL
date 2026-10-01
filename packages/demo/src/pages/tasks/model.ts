import { ROADMAP } from './roadmapData';
import { GUARDRAILS, TEAM_TASKS } from './teamData';
import type { LedgerEntry, TaskFacts } from './ledger';
import type { MemberId, Priority, Session, Task, TaskSeed } from './types';

// ─── Dates (local calendar days, YYYY-MM-DD) ─────────────────────────────

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

/** Whole days from `today` to `key` (negative = past). */
export function daysBetween(today: string, key: string): number {
  return Math.round((parseKey(key) - parseKey(today)) / 86_400_000);
}

export function formatDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ─── Seed ─────────────────────────────────────────────────────────────────

function promptField(prompt: string, label: string): string {
  const line = prompt.split('\n').find((l) => l.startsWith(`${label}:`));
  return line ? line.slice(label.length + 1).trim() : '';
}

function promptDoNot(prompt: string): string {
  return prompt.split('\n').filter((l) => l.startsWith('Do NOT')).join(' ');
}

const IN_FLIGHT_NOTE =
  'Partial in-flight work exists in the repo (BaseCameraChoreographer.ts, renderer character/, code/, iteration/, linear/, shared/theme/visualTokens.ts, tests/integration/linear-director.test.ts), committed as WIP on 2026-09-27. It has not been reviewed against 2.1–2.4, so this is unverified, not done.';

/** Deadlines are spread evenly across the phase's planned window, so they are derived, not typed. */
export function buildRoadmapSeeds(): TaskSeed[] {
  const seeds: TaskSeed[] = [];
  let order = 0;
  let previous: string | null = null;

  for (const phase of ROADMAP) {
    const priority: Priority = phase.ipd === 'critical' ? 'P0' : phase.ipd === 'partial' ? 'P1' : 'P2';
    const w = phase.window;
    const span = w ? daysBetween(w.start, w.end) : 0;
    const prereqId = `R${phase.number}.0`;

    seeds.push({
      id: prereqId,
      owner: 'manas',
      kind: 'prereq',
      order: order++,
      phase: phase.number,
      title: `Phase ${phase.number} prerequisite`,
      objective: phase.prereq.prompt.split('\n')[0],
      scope: 'Inspection and preparation only; no code changes.',
      outOfScope: 'Any source change before the sub-phase prompts.',
      priority,
      status: 'planned',
      deadline: w ? addDays(w.start, 1) : null,
      dependencies: previous ? [previous] : [],
      expectedOutcome: phase.prereq.outcome,
      definitionOfDone: 'The written summary/map the prompt asks for exists and its starting condition is confirmed.',
      verification: 'Claude Code reported the requested summary with no files modified (git status clean apart from pre-existing work).',
      notes: '',
      prompt: phase.prereq.prompt,
      model: phase.prereq.model,
    });
    previous = prereqId;

    phase.steps.forEach((step, i) => {
      const id = `R${step.id}`;
      const isInFlight = step.id === '2.5';
      seeds.push({
        id,
        owner: 'manas',
        kind: 'subphase',
        order: order++,
        phase: phase.number,
        title: `${step.id} ${step.title}`,
        objective: promptField(step.prompt, 'Objective'),
        scope: promptField(step.prompt, 'Scope'),
        outOfScope: promptDoNot(step.prompt),
        priority,
        status: isInFlight ? 'unverified' : 'planned',
        deadline: w ? addDays(w.start, 1 + Math.round(((span - 1) * (i + 1)) / phase.steps.length)) : null,
        dependencies: previous ? [previous] : [],
        expectedOutcome: step.outcome,
        definitionOfDone: promptField(step.prompt, 'Definition of done'),
        verification: promptField(step.prompt, 'What to test/verify'),
        notes: isInFlight ? IN_FLIGHT_NOTE : '',
        prompt: step.prompt,
        model: step.model,
      });
      previous = id;
    });
  }
  return seeds;
}

/** Team tasks carry no hand-written prompt, so build one from the task's own fields and its owner's guardrails. */
function withTeamPrompt(seed: TaskSeed): TaskSeed {
  if (seed.prompt || seed.owner === 'manas') return seed;
  const g = GUARDRAILS[seed.owner];
  const lines = [
    `You are working on task ${seed.id} (${seed.title}) of the AQVL project.`,
    `Mission: ${g.mission}`,
    `Objective: ${seed.objective}`,
    `Scope: ${seed.scope}`,
    ...(seed.outOfScope ? [`Do NOT: ${seed.outOfScope}`] : []),
    ...g.outOfScope.map((o) => `Do NOT touch: ${o}`),
    `Expected outcome: ${seed.expectedOutcome}`,
    `Definition of done: ${seed.definitionOfDone}`,
    `What to test/verify: ${seed.verification}`,
  ];
  return { ...seed, prompt: lines.join('\n') };
}

export const SEEDS: TaskSeed[] = [...buildRoadmapSeeds(), ...TEAM_TASKS.map(withTeamPrompt)];

// ─── Ledger overlay ──────────────────────────────────────────────────────
// Progress is never stored in the browser or editable in the UI. Status,
// timestamps and durations are replayed from the hash-chained ledger that only
// scripts/task-ledger.ts can append to (see ledger.ts).

export const LEDGER_DIR = 'packages/demo/src/pages/tasks/ledger';
export const LEDGER_FILE = `${LEDGER_DIR}/ledger.jsonl`;

/** Concrete file paths a task promises to deliver; the CLI refuses completion if any is missing. */
export function requiredFiles(seed: TaskSeed): string[] {
  const source = seed.kind === 'team' ? seed.expectedOutcome : (seed.prompt ?? '').split('\n').filter((l) => l.startsWith('Deliverable:')).join(' ');
  const found = source.match(/\b(?:docs|scripts|poc|packages)\/[\w./-]*[\w-]\.[a-z]{1,5}\b/g) ?? [];
  return [...new Set(found)];
}

const START_LINE = (id: string) =>
  `Housekeeping before you begin: run \`pnpm task start ${id}\` once from the repo root. It only stamps the session, and it prints nothing you need to act on.`;
const DONE_LINE = (id: string) =>
  `When, and only when, the definition of done above is genuinely met and your work is committed, finish with \`pnpm task done ${id}\` and paste its output in your final message. It re-checks the work itself, so running it early only gets you a refusal; if it refuses, fix what it names instead of retrying or working around it.`;

/** The prompt that is copied: the visible prompt, wrapped in the bookkeeping steps. */
export function trackedPrompt(id: string, prompt: string): string {
  return `${START_LINE(id)}\n\n${prompt}\n\n${DONE_LINE(id)}`;
}

export function mergeTasks(seeds: TaskSeed[], facts: Map<string, TaskFacts>): Task[] {
  return seeds.map((seed) => {
    const f = facts.get(seed.id);
    return {
      ...seed,
      status: f ? f.status : seed.status,
      blocker: f?.blocker ?? '',
      completedAt: f?.completedAt ?? null,
      startedAt: f?.startedAt ?? null,
      elapsedMin: f?.elapsedMin ?? null,
      doneBy: f?.actor && f.status === 'completed' ? f.actor : null,
      flags: f?.flags.length ?? 0,
      lastFlag: f?.flags.length ? (f.flags[f.flags.length - 1].note ?? '') : '',
      updatedAt: f ? f.history[f.history.length - 1].ts : null,
      copyPrompt: seed.prompt ? trackedPrompt(seed.id, seed.prompt) : undefined,
    };
  });
}

/** Read-only work log: one entry per verified completion or recorded blocker. */
export function sessionsFromLedger(entries: LedgerEntry[], tasks: Task[]): Session[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: Session[] = [];
  for (const e of entries) {
    const t = byId.get(e.task);
    if (!t || (e.event !== 'complete' && e.event !== 'block')) continue;
    const ev = e.evidence;
    out.push({
      id: `l-${e.seq}`,
      date: e.ts,
      owner: t.owner,
      workedOn: `${t.id} ${t.title}`,
      completed: e.event === 'complete' && ev ? `Verified: ${ev.files.length} file${ev.files.length === 1 ? '' : 's'} changed, +${ev.linesAdded} lines, ${ev.checks.length} check${ev.checks.length === 1 ? '' : 's'} passed` : '',
      remaining: '',
      blockers: e.event === 'block' ? (e.note ?? '') : '',
      note: e.actor,
      taskIds: [t.id],
      durationMin: ev?.elapsedMin,
    });
  }
  return out.reverse();
}

// ─── Selectors ───────────────────────────────────────────────────────────

export function byOwner(tasks: Task[], owner: MemberId): Task[] {
  return tasks.filter((t) => t.owner === owner).sort((a, b) => a.order - b.order);
}

export function progress(tasks: Task[]): { done: number; total: number; pct: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function isOverdue(t: Task, today: string): boolean {
  return t.deadline !== null && t.status !== 'completed' && daysBetween(today, t.deadline) < 0;
}

export function depsMet(t: Task, index: Map<string, Task>): boolean {
  return t.dependencies.every((d) => index.get(d)?.status === 'completed');
}

export function indexTasks(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((t) => [t.id, t]));
}

export function activeTask(tasks: Task[]): Task | null {
  return tasks.filter((t) => t.status === 'in_progress').sort((a, b) => a.order - b.order)[0] ?? null;
}

/** First not-started task in sequence whose dependencies are complete. */
export function nextTask(tasks: Task[], index: Map<string, Task>): Task | null {
  return (
    tasks
      .filter((t) => (t.status === 'planned' || t.status === 'unverified') && depsMet(t, index))
      .sort((a, b) => a.order - b.order)[0] ?? null
  );
}

export function nextDeadline(tasks: Task[], today: string): Task | null {
  return (
    tasks
      .filter((t) => t.deadline && t.status !== 'completed' && daysBetween(today, t.deadline) >= 0)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : a.deadline! > b.deadline! ? 1 : a.order - b.order))[0] ?? null
  );
}

/** The lowest roadmap phase that still has unfinished work. */
export function currentPhase(roadmapTasks: Task[]): number | null {
  const open = roadmapTasks.filter((t) => t.status !== 'completed' && t.phase !== undefined);
  return open.length ? Math.min(...open.map((t) => t.phase!)) : null;
}

export type Health = 'not_started' | 'on_track' | 'at_risk' | 'blocked' | 'done';

export function health(tasks: Task[], today: string): Health {
  if (tasks.length && tasks.every((t) => t.status === 'completed')) return 'done';
  if (tasks.some((t) => t.status === 'blocked')) return 'blocked';
  if (tasks.some((t) => isOverdue(t, today))) return 'at_risk';
  if (!tasks.some((t) => t.status === 'completed' || t.status === 'in_progress')) return 'not_started';
  return 'on_track';
}

export const HEALTH_LABEL: Record<Health, string> = {
  not_started: 'Not started',
  on_track: 'On track',
  at_risk: 'Overdue work',
  blocked: 'Blocked',
  done: 'Done',
};

export function memberSummary(all: Task[], owner: MemberId, today: string) {
  const tasks = byOwner(all, owner);
  const index = indexTasks(all);
  return {
    tasks,
    progress: progress(tasks),
    active: activeTask(tasks),
    next: nextTask(tasks, index),
    nextDeadline: nextDeadline(tasks, today),
    overdue: tasks.filter((t) => isOverdue(t, today)),
    blocked: tasks.filter((t) => t.status === 'blocked'),
    health: health(tasks, today),
  };
}
