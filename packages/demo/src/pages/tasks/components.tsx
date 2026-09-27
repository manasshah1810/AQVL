import React, { useMemo, useState } from 'react';
import { useTasks } from './context';
import { copyText } from './store';
import { daysBetween, formatDate, depsMet, isOverdue } from './model';
import { MEMBER_BY_ID } from './teamData';
import { PRIORITIES, STATUSES, STATUS_LABEL } from './types';
import type { MemberId, Priority, Session, Status, Task } from './types';

const nowIso = () => new Date().toISOString();

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
  const { dispatch, index, today } = useTasks();
  const [open, setOpen] = useState(defaultOpen);
  const done = task.status === 'completed';
  const waiting = !done && !depsMet(task, index);
  const overdue = isOverdue(task, today);

  return (
    <div className={`tk-row tk-row--${task.status} ${open ? 'is-open' : ''} ${overdue ? 'is-overdue' : ''}`} data-testid={`task-${task.id}`}>
      <div className="tk-row__head">
        <input
          type="checkbox"
          className="tk-check"
          checked={done}
          aria-label={`Mark ${task.title} ${done ? 'incomplete' : 'complete'}`}
          onChange={() => dispatch({ type: 'setStatus', id: task.id, status: done ? 'planned' : 'completed', now: nowIso() })}
        />
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
          {task.prompt && <CopyButton text={task.prompt} label="Copy" />}
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
  const { dispatch, index } = useTasks();
  const [notes, setNotes] = useState(task.notes);
  const [blocker, setBlocker] = useState(task.blocker);
  const now = nowIso;

  return (
    <div className="tk-detail">
      <div className="tk-detail__controls">
        <label>
          Status
          <select value={task.status} onChange={(e) => dispatch({ type: 'setStatus', id: task.id, status: e.target.value as Status, now: now() })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={task.priority} onChange={(e) => dispatch({ type: 'setPriority', id: task.id, priority: e.target.value as Priority, now: now() })}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <span className="tk-detail__owner">Owner: {MEMBER_BY_ID[task.owner].name}</span>
        {task.completedAt && <span className="tk-detail__owner">Completed {new Date(task.completedAt).toLocaleString()}</span>}
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
            <CopyButton text={task.prompt} />
          </div>
          <pre>{task.prompt}</pre>
        </div>
      )}

      <div className="tk-detail__edit">
        <label className="tk-grow">
          Notes
          <textarea
            rows={3}
            value={notes}
            placeholder="Anything worth remembering next session"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== task.notes && dispatch({ type: 'setNotes', id: task.id, notes, now: now() })}
          />
        </label>
        <label className="tk-grow">
          Blocker
          <div className="tk-inline">
            <input value={blocker} placeholder="What is stopping this task?" onChange={(e) => setBlocker(e.target.value)} />
            <button
              type="button"
              className="tk-btn tk-btn--danger"
              disabled={!blocker.trim()}
              onClick={() => dispatch({ type: 'setBlocker', id: task.id, blocker, now: now() })}
            >
              Record blocker
            </button>
            {task.status === 'blocked' && (
              <button
                type="button"
                className="tk-btn"
                onClick={() => {
                  setBlocker('');
                  dispatch({ type: 'setStatus', id: task.id, status: 'in_progress', now: now() });
                }}
              >
                Unblock
              </button>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── Session log ─────────────────────────────────────────────────────────

export function SessionLog({ owner }: { owner: MemberId }) {
  const { sessions, tasks, dispatch } = useTasks();
  const mine = useMemo(() => sessions.filter((s) => s.owner === owner), [sessions, owner]);
  const ownTasks = useMemo(() => tasks.filter((t) => t.owner === owner && t.status !== 'completed'), [tasks, owner]);
  const blank = { workedOn: '', completed: '', remaining: '', blockers: '', note: '', taskIds: [] as string[] };
  const [draft, setDraft] = useState(blank);
  const [showAll, setShowAll] = useState(false);
  const canSave = draft.workedOn.trim().length > 0;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    dispatch({
      type: 'addSession',
      session: { id: `s-${Date.now()}`, date: new Date().toISOString(), owner, ...draft },
    });
    setDraft(blank);
  };

  const shown = showAll ? mine : mine.slice(0, 5);

  return (
    <div className="tk-sessions">
      <form className="tk-session-form" onSubmit={save}>
        <h4>Record this session</h4>
        <label>
          Worked on <span className="tk-req">required</span>
          <textarea rows={2} value={draft.workedOn} onChange={(e) => setDraft({ ...draft, workedOn: e.target.value })} />
        </label>
        <div className="tk-grid-2">
          <label>
            Completed
            <textarea rows={2} value={draft.completed} onChange={(e) => setDraft({ ...draft, completed: e.target.value })} />
          </label>
          <label>
            Remaining
            <textarea rows={2} value={draft.remaining} onChange={(e) => setDraft({ ...draft, remaining: e.target.value })} />
          </label>
          <label>
            Blockers
            <textarea rows={2} value={draft.blockers} onChange={(e) => setDraft({ ...draft, blockers: e.target.value })} />
          </label>
          <label>
            Note
            <textarea rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
        </div>
        <fieldset className="tk-chips">
          <legend>Related tasks</legend>
          {ownTasks.length === 0 && <span className="tk-muted">No open tasks.</span>}
          {ownTasks.map((t) => {
            const on = draft.taskIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                className={`tk-chip ${on ? 'is-on' : ''}`}
                title={t.title}
                onClick={() => setDraft({ ...draft, taskIds: on ? draft.taskIds.filter((x) => x !== t.id) : [...draft.taskIds, t.id] })}
              >
                {t.id}
              </button>
            );
          })}
        </fieldset>
        <button type="submit" className="tk-btn tk-btn--primary" disabled={!canSave}>
          Save session
        </button>
      </form>

      <div className="tk-session-list">
        <h4>History</h4>
        {mine.length === 0 && <Empty>No sessions recorded yet. The first one you save will show up in “Last session”.</Empty>}
        {shown.map((s) => (
          <article key={s.id} className="tk-session">
            <header>
              <time dateTime={s.date}>{new Date(s.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
              {s.taskIds.length > 0 && <span className="tk-session__tasks">{s.taskIds.join(', ')}</span>}
              <button
                type="button"
                className="tk-link"
                onClick={() => window.confirm('Delete this session entry?') && dispatch({ type: 'deleteSession', id: s.id })}
              >
                Delete
              </button>
            </header>
            <SessionBody session={s} />
          </article>
        ))}
        {mine.length > 5 && (
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
      <Field label="Note">{session.note}</Field>
    </dl>
  );
}
