import React, { useMemo, useState } from 'react';
import { useTasks } from './context';
import { copyText } from './store';
import { daysBetween, formatDate, depsMet, isOverdue } from './model';
import { MEMBER_BY_ID } from './teamData';
import { STATUS_LABEL } from './types';
import { formatDuration, formatIST } from './ledger';
import type { MemberId, Priority, Session, Status, Task } from './types';

// ─── Small atoms ─────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`tk-status tk-status--${status}`}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`tk-prio tk-prio--${priority}`}>{priority}</span>;
}

export function DeadlineChip({ task }: { task: Task }) {
  const { today } = useTasks();
  if (!task.deadline) return <span className="tk-due tk-due--none">No date · post-IPD</span>;
  if (task.status === 'completed') return <span className="tk-due tk-due--done">Due {formatDate(task.deadline)}</span>;
  const d = daysBetween(today, task.deadline);
  const cls = d < 0 ? 'overdue' : d <= 3 ? 'soon' : 'ok';
  const rel = d < 0 ? `${-d}d overdue` : d === 0 ? 'due today' : `in ${d}d`;
  return (
    <span className={`tk-due tk-due--${cls}`} title={formatDate(task.deadline)}>
      {formatDate(task.deadline)} · {rel}
    </span>
  );
}

export function ProgressBar({ pct, label, tone = 'accent' }: { pct: number; label?: string; tone?: 'accent' | 'good' }) {
  return (
    <div className="tk-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`tk-bar__fill tk-bar__fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ pct, size = 112, caption }: { pct: number; size?: number; caption?: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="tk-ring" style={{ width: size, height: size }} role="img" aria-label={`${pct}% ${caption ?? ''}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="tk-ring__track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="tk-ring__fill"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          strokeLinecap="butt"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="tk-ring__label">
        <strong>{pct}%</strong>
        {caption && <span>{caption}</span>}
      </div>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy prompt' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <button
      type="button"
      className={`tk-btn tk-btn--copy ${state !== 'idle' ? `is-${state}` : ''}`}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyText(text);
        setState(ok ? 'ok' : 'fail');
        window.setTimeout(() => setState('idle'), 1600);
      }}
    >
      {state === 'ok' ? 'Copied' : state === 'fail' ? 'Copy failed' : label}
    </button>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'bad' | 'warn' | 'good' | 'accent' }) {
  return (
    <div className={`tk-kpi ${tone ? `tk-kpi--${tone}` : ''}`}>
      <span className="tk-kpi__label">{label}</span>
      <strong className="tk-kpi__value">{value}</strong>
      {sub && <span className="tk-kpi__sub">{sub}</span>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="tk-empty">{children}</p>;
}

// ─── Task row + detail ───────────────────────────────────────────────────

export function TaskRow({ task, showOwner = false, defaultOpen = false }: { task: Task; showOwner?: boolean; defaultOpen?: boolean }) {
  const { index, today } = useTasks();
  const [open, setOpen] = useState(defaultOpen);
  const done = task.status === 'completed';
  const waiting = !done && !depsMet(task, index);
  const overdue = isOverdue(task, today);

  return (
    <div className={`tk-row tk-row--${task.status} ${open ? 'is-open' : ''} ${overdue ? 'is-overdue' : ''}`} data-testid={`task-${task.id}`}>
      <div className="tk-row__head">
        <span className={`tk-check tk-check--locked ${done ? 'is-done' : ''}`} role="img" aria-label={done ? 'Verified complete' : 'Not verified complete'} title={done ? 'Verified complete in the ledger' : 'Set only by the ledger CLI after verification'}>
          {done ? '✓' : ''}
        </span>
        <button type="button" className="tk-row__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="tk-row__id">{task.id}</span>
          <span className="tk-row__title">{task.title}</span>
        </button>
        <div className="tk-row__meta">
          {showOwner && <span className="tk-owner">{MEMBER_BY_ID[task.owner].name.split(' ')[0]}</span>}
          {waiting && (
            <span className="tk-wait" title={`Waiting on ${task.dependencies.join(', ')}`}>
              waits on {task.dependencies.filter((d) => index.get(d)?.status !== 'completed').join(', ')}
            </span>
          )}
          {task.model && <span className="tk-model">{task.model.replace('Claude ', '')}</span>}
          {task.copyPrompt && <CopyButton text={task.copyPrompt} label="Copy" />}
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
          <DeadlineChip task={task} />
        </div>
      </div>
      {open && <TaskDetail task={task} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="tk-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function TaskDetail({ task }: { task: Task }) {
  const { index } = useTasks();

  return (
    <div className="tk-detail">
      <div className="tk-detail__controls">
        <span className="tk-detail__owner">Status: <StatusBadge status={task.status} /></span>
        <span className="tk-detail__owner">Priority: {task.priority}</span>
        <span className="tk-detail__owner">Owner: {MEMBER_BY_ID[task.owner].name}</span>
        {task.startedAt && <span className="tk-detail__owner">Started {formatIST(task.startedAt)}</span>}
        {task.completedAt && <span className="tk-detail__owner">Verified {formatIST(task.completedAt)}{task.elapsedMin !== null ? ` · ${formatDuration(task.elapsedMin)} elapsed` : ''}{task.doneBy ? ` · by ${task.doneBy}` : ''}</span>}
        {!task.completedAt && task.startedAt && <span className="tk-detail__owner">Clock running since start</span>}
      </div>

      <dl className="tk-fields">
        <Field label="Objective">{task.objective}</Field>
        <Field label="Exact scope">{task.scope}</Field>
        <Field label="Not in scope">{task.outOfScope}</Field>
        <Field label="Dependencies">
          {task.dependencies.length
            ? task.dependencies.map((d) => {
                const dep = index.get(d);
                return (
                  <span key={d} className={`tk-dep ${dep?.status === 'completed' ? 'is-met' : ''}`}>
                    {d} {dep?.status === 'completed' ? '✓' : `· ${dep ? STATUS_LABEL[dep.status] : 'unknown'}`}
                  </span>
                );
              })
            : 'None'}
        </Field>
        <Field label="Expected outcome">{task.expectedOutcome}</Field>
        <Field label="Definition of done">{task.definitionOfDone}</Field>
        <Field label="Verification">{task.verification}</Field>
        {task.model && <Field label="Recommended model">{task.model}</Field>}
      </dl>

      {task.prompt && (
        <div className="tk-prompt">
          <div className="tk-prompt__head">
            <span>Claude Code prompt</span>
            <CopyButton text={task.copyPrompt ?? task.prompt} />
          </div>
          <pre>{task.prompt}</pre>
        </div>
      )}

      {task.flags > 0 && <p className="tk-bad">{task.flags} completion attempt{task.flags === 1 ? '' : 's'} refused. Latest: {task.lastFlag}</p>}
      {task.notes && <p className="tk-muted">{task.notes}</p>}
      {task.blocker && <p className="tk-bad">Blocked: {task.blocker}</p>}
    </div>
  );
}

// ─── Session log ─────────────────────────────────────────────────────────

export function SessionLog({ owner }: { owner: MemberId }) {
  const { sessions } = useTasks();
  const mine = useMemo(() => sessions.filter((s) => s.owner === owner), [sessions, owner]);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? mine : mine.slice(0, 8);

  return (
    <div className="tk-sessions">
      <div className="tk-session-list">
        <h4>History</h4>
        {mine.length === 0 && <Empty>Nothing logged yet. Entries appear here only when the ledger CLI records them.</Empty>}
        {shown.map((s) => (
          <article key={s.id} className="tk-session">
            <header>
              <time dateTime={s.date}>{formatIST(s.date)}</time>
              {s.taskIds.length > 0 && <span className="tk-session__tasks">{s.taskIds.join(', ')}</span>}
              {s.durationMin !== undefined && <span className="tk-session__tasks">{formatDuration(s.durationMin)}</span>}
            </header>
            <SessionBody session={s} />
          </article>
        ))}
        {mine.length > 8 && (
          <button type="button" className="tk-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${mine.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

export function SessionBody({ session }: { session: Session }) {
  return (
    <dl className="tk-session__body">
      <Field label="Worked on">{session.workedOn}</Field>
      <Field label="Completed">{session.completed}</Field>
      <Field label="Remaining">{session.remaining}</Field>
      <Field label="Blockers">{session.blockers}</Field>
      <Field label="Recorded by">{session.note}</Field>
    </dl>
  );
}
