import React, { useState } from 'react';
import {
  CopyButton,
  DeadlineChip,
  Empty,
  Kpi,
  ProgressBar,
  ProgressRing,
  SessionBody,
  SessionLog,
  StatusBadge,
  TaskRow,
} from './components';
import { useTasks } from './context';
import { BurnUp, Columns, Donut } from './charts';
import { burnUp, domainOf, statusCounts, statusSegments, weeklyThroughput } from './metrics';
import { Panel, StatusLegend } from './report';
import { byOwner, currentPhase, daysBetween, formatDate, HEALTH_LABEL, isOverdue, memberSummary, progress, shortDate } from './model';
import { IPD_DEADLINE, ROADMAP } from './roadmapData';
import { GUARDRAILS, MEMBERS, MEMBER_BY_ID } from './teamData';
import type { MemberId, Status, Task } from './types';

const nowIso = () => new Date().toISOString();

function Section({ title, sub, children, id }: { title: string; sub?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="tk-section" id={id}>
      <header className="tk-section__head">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </header>
      {children}
    </section>
  );
}

function StartButton({ task, label = 'Start' }: { task: Task; label?: string }) {
  const { dispatch } = useTasks();
  return (
    <button type="button" className="tk-btn tk-btn--primary" onClick={() => dispatch({ type: 'setStatus', id: task.id, status: 'in_progress', now: nowIso() })}>
      {label}
    </button>
  );
}

function CompleteButton({ task }: { task: Task }) {
  const { dispatch } = useTasks();
  return (
    <button type="button" className="tk-btn tk-btn--good" onClick={() => dispatch({ type: 'setStatus', id: task.id, status: 'completed', now: nowIso() })}>
      Mark complete
    </button>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────

export function OverviewView() {
  const { tasks, today, sessions } = useTasks();
  const roadmap = byOwner(tasks, 'manas');
  const rp = progress(roadmap);
  const phase = currentPhase(roadmap);
  const phaseInfo = ROADMAP.find((p) => p.number === phase);
  const team = tasks.filter((t) => t.owner !== 'manas');
  const tp = progress(team);
  const ipdDays = daysBetween(today, IPD_DEADLINE);

  const soon = tasks.filter(
    (t) => t.status !== 'completed' && t.deadline && daysBetween(today, t.deadline) >= 0 && daysBetween(today, t.deadline) <= 7,
  );
  const criticalMap = new Map<string, Task>();
  [...tasks.filter((t) => isOverdue(t, today)), ...tasks.filter((t) => t.status === 'blocked'), ...soon].forEach((t) => criticalMap.set(t.id, t));
  const critical = [...criticalMap.values()].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));

  return (
    <>
      <section className="tk-hero">
        <div className="tk-hero__main">
          <span className="tk-eyebrow">AQVL overall status</span>
          <h1>
            {rp.done === 0 ? 'Roadmap not started' : `${rp.done} of ${rp.total} roadmap tasks complete`}
          </h1>
          <p className="tk-hero__lead">
            {phaseInfo
              ? <>Current phase: <strong>Phase {phaseInfo.number} — {phaseInfo.title}</strong>. </>
              : 'All roadmap phases are complete. '}
            Percentages are computed from task states only; nothing is pre-filled.
          </p>
          <div className="tk-hero__bars">
            <div>
              <span>Roadmap · {rp.done}/{rp.total}</span>
              <ProgressBar pct={rp.pct} label="Roadmap progress" />
            </div>
            <div>
              <span>Team tasks · {tp.done}/{tp.total}</span>
              <ProgressBar pct={tp.pct} label="Team task progress" tone="good" />
            </div>
          </div>
        </div>
        <div className="tk-hero__side">
          <ProgressRing pct={rp.pct} caption="roadmap" />
          <Kpi label="IPD target" value={`${ipdDays}d`} sub={`${formatDate(IPD_DEADLINE)} · from roadmap synthesis`} tone={ipdDays < 30 ? 'warn' : undefined} />
        </div>
      </section>

      <div className="tk-panels">
        <Panel title="Roadmap: plan vs. actual" sub="Completed tasks against tasks due by each date" span={2} accent="purple">
          {burnUp(roadmap, today, '2026-09-27') && <BurnUp data={burnUp(roadmap, today, '2026-09-27')!} today={today} height={220} />}
        </Panel>
        <Panel title="Everything by status" sub={`${tasks.length} tasks across the team`} accent="blue">
          <div className="tk-donut-wrap">
            <Donut segments={statusSegments(statusCounts(tasks))} center={`${progress(tasks).pct}%`} sub="complete" />
            <StatusLegend tasks={tasks} />
          </div>
        </Panel>
      </div>

      <Section title="Team" sub={<>Every figure is derived from that person’s task records. <a href="#/tasks/report" className="tk-link">Open the full report →</a></>}>
        <div className="tk-team">
          {MEMBERS.map((m) => {
            const s = memberSummary(tasks, m.id, today);
            const focus = s.active ?? s.next;
            return (
              <a key={m.id} href={`#/tasks/${m.id}`} className={`tk-member tk-member--${s.health}`} data-testid={`member-${m.id}`}>
                <header>
                  <div>
                    <strong>{m.name}</strong>
                    <span>{m.role}</span>
                  </div>
                  <span className={`tk-health tk-health--${s.health}`}>{HEALTH_LABEL[s.health]}</span>
                </header>
                <div className="tk-member__area">{m.id === 'manas' && phaseInfo ? `Phase ${phaseInfo.number} · ${phaseInfo.title}` : m.area}</div>
                <div className="tk-member__focus">
                  <span>{s.active ? 'Current task' : 'Up next'}</span>
                  <p>{focus ? `${focus.id} — ${focus.title}` : 'No actionable task'}</p>
                </div>
                <div className="tk-member__prog">
                  <ProgressBar pct={s.progress.pct} label={`${m.name} progress`} />
                  <span>{s.progress.pct}% · {s.progress.done}/{s.progress.total}</span>
                </div>
                <dl className="tk-member__stats">
                  <div><dt>Next deadline</dt><dd>{s.nextDeadline ? formatDate(s.nextDeadline.deadline!) : '—'}</dd></div>
                  <div className={s.overdue.length ? 'is-bad' : ''}><dt>Overdue</dt><dd>{s.overdue.length}</dd></div>
                  <div className={s.blocked.length ? 'is-bad' : ''}><dt>Blocked</dt><dd>{s.blocked.length}</dd></div>
                </dl>
              </a>
            );
          })}
        </div>
      </Section>

      <Section title="Critical: overdue, blocked, due within 7 days" sub={`${critical.length} item${critical.length === 1 ? '' : 's'}`}>
        {critical.length === 0 ? <Empty>Nothing overdue, blocked, or due in the next 7 days.</Empty> : (
          <div className="tk-list">{critical.map((t) => <TaskRow key={t.id} task={t} showOwner />)}</div>
        )}
      </Section>

      <Section title="Recent sessions" sub="Across the whole team">
        {sessions.length === 0 ? <Empty>No sessions recorded yet.</Empty> : (
          <div className="tk-session-feed">
            {sessions.slice(0, 5).map((s) => (
              <article key={s.id} className="tk-session">
                <header>
                  <strong>{MEMBER_BY_ID[s.owner].name}</strong>
                  <time dateTime={s.date}>{new Date(s.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </header>
                <SessionBody session={s} />
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

// ─── Manas ───────────────────────────────────────────────────────────────

export function ManasView() {
  const { tasks, today, sessions } = useTasks();
  const s = memberSummary(tasks, 'manas', today);
  const roadmap = s.tasks;
  const phase = currentPhase(roadmap);
  const lastSession = sessions.find((x) => x.owner === 'manas');
  const ipdDays = daysBetween(today, IPD_DEADLINE);
  const [open, setOpen] = useState<Set<number>>(() => new Set(phase ? [phase] : []));
  const [filter, setFilter] = useState<'all' | 'open' | Status>('all');

  const toggle = (n: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const jumpTo = (n: number) => {
    setOpen((prev) => new Set(prev).add(n));
    window.setTimeout(() => document.getElementById(`phase-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const phaseInfo = ROADMAP.find((p) => p.number === phase);

  return (
    <>
      <MemberHeader id="manas" />

      <Section title="Today" sub={formatDate(today)}>
        <div className="tk-today">
          <div className="tk-today__cell">
            <span className="tk-eyebrow">Last session</span>
            {lastSession ? (
              <>
                <time>{new Date(lastSession.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                <p><strong>Completed:</strong> {lastSession.completed || '—'}</p>
                <p><strong>Left open:</strong> {lastSession.remaining || '—'}</p>
              </>
            ) : <Empty>No session recorded yet. Record one at the bottom when you finish today.</Empty>}
          </div>
          <div className="tk-today__cell tk-today__cell--now">
            <span className="tk-eyebrow">Working on now</span>
            {s.active ? (
              <>
                <p className="tk-today__task">{s.active.title}</p>
                <DeadlineChip task={s.active} />
                <div className="tk-inline">
                  {s.active.prompt && <CopyButton text={s.active.prompt} />}
                  <CompleteButton task={s.active} />
                </div>
              </>
            ) : <Empty>Nothing is marked In progress.</Empty>}
          </div>
          <div className="tk-today__cell">
            <span className="tk-eyebrow">Do next</span>
            {s.next ? (
              <>
                <p className="tk-today__task">{s.next.title}</p>
                <span className="tk-muted">Model: {s.next.model}</span>
                <div className="tk-inline">
                  {s.next.prompt && <CopyButton text={s.next.prompt} />}
                  <StartButton task={s.next} />
                </div>
              </>
            ) : <Empty>No task is ready (dependencies incomplete or roadmap finished).</Empty>}
          </div>
          <div className={`tk-today__cell ${s.blocked.length ? 'is-bad' : ''}`}>
            <span className="tk-eyebrow">Blocked</span>
            {s.blocked.length ? s.blocked.map((b) => (
              <p key={b.id}><strong>{b.id}</strong> {b.blocker || 'No blocker text recorded'}</p>
            )) : <Empty>Nothing blocked.</Empty>}
          </div>
          <div className={`tk-today__cell ${s.overdue.length ? 'is-bad' : ''}`}>
            <span className="tk-eyebrow">Deadline</span>
            {s.overdue.length > 0 && <p className="tk-bad">{s.overdue.length} overdue — oldest: {s.overdue[0].id}</p>}
            {s.nextDeadline ? (
              <>
                <p className="tk-today__task">{s.nextDeadline.title}</p>
                <DeadlineChip task={s.nextDeadline} />
              </>
            ) : <Empty>No upcoming dated task.</Empty>}
          </div>
        </div>
      </Section>

      <div className="tk-kpis">
        <div className="tk-kpi tk-kpi--ring"><ProgressRing pct={s.progress.pct} size={96} caption="roadmap" /></div>
        <Kpi label="Current phase" value={phase ? `${phase} / 12` : 'Done'} sub={phaseInfo?.title} />
        <Kpi label="Completed" value={s.progress.done} sub={`${s.progress.total - s.progress.done} remaining`} />
        <Kpi label="Overdue" value={s.overdue.length} tone={s.overdue.length ? 'bad' : undefined} sub="target dates passed" />
        <Kpi label="Blocked" value={s.blocked.length} tone={s.blocked.length ? 'bad' : undefined} />
        <Kpi label="Unverified" value={roadmap.filter((t) => t.status === 'unverified').length} tone="warn" sub="exists, not verified" />
        <Kpi label="IPD target" value={`${ipdDays}d`} sub={formatDate(IPD_DEADLINE)} />
      </div>

      <div className="tk-panels">
        <Panel title="Roadmap burn-up" sub="Completed vs. due-by-date" span={2} accent="purple">
          {burnUp(roadmap, today, '2026-09-27') && <BurnUp data={burnUp(roadmap, today, '2026-09-27')!} today={today} height={220} />}
        </Panel>
        <Panel title="Roadmap by status" accent="yellow">
          <div className="tk-donut-wrap">
            <Donut segments={statusSegments(statusCounts(roadmap))} center={`${s.progress.pct}%`} sub={`${s.progress.done}/${s.progress.total}`} />
            <StatusLegend tasks={roadmap} />
          </div>
        </Panel>
      </div>

      <Section title="Phase progress" sub="Target windows come from the roadmap synthesis; sub-phase dates are spread evenly inside each window.">
        <div className="tk-phases">
          {ROADMAP.map((p) => {
            const pt = roadmap.filter((t) => t.phase === p.number);
            const pp = progress(pt);
            const late = pt.some((t) => isOverdue(t, today));
            return (
              <button key={p.number} type="button" className={`tk-phase-row tk-dom--${domainOf(p.number)} ${p.number === phase ? 'is-current' : ''}`} onClick={() => jumpTo(p.number)}>
                <span className="tk-phase-row__num">P{p.number}</span>
                <span className="tk-phase-row__title">{p.title}</span>
                <ProgressBar pct={pp.pct} label={`Phase ${p.number} progress`} />
                <span className="tk-phase-row__count">{pp.done}/{pp.total}</span>
                <span className="tk-phase-row__win">{p.window ? `${formatDate(p.window.start)} → ${formatDate(p.window.end)}` : 'Unscheduled'}</span>
                <span className={`tk-ipd tk-ipd--${p.ipd}`}>{p.ipd === 'critical' ? 'IPD-critical' : p.ipd === 'partial' ? 'IPD PoC' : 'Post-IPD'}</span>
                {late && <span className="tk-bad">late</span>}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Roadmap, tasks & prompts"
        sub={
          <span className="tk-inline">
            Click a phase to open its prerequisite and sub-phase prompts.
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter roadmap tasks">
              <option value="all">All tasks</option>
              <option value="open">Not completed</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="unverified">Unverified</option>
              <option value="completed">Completed</option>
            </select>
            <button type="button" className="tk-link" onClick={() => setOpen(new Set(ROADMAP.map((p) => p.number)))}>Expand all</button>
            <button type="button" className="tk-link" onClick={() => setOpen(new Set())}>Collapse all</button>
          </span>
        }
      >
        <div className="tk-roadmap">
          {ROADMAP.map((p) => {
            const pt = roadmap.filter((t) => t.phase === p.number);
            const pp = progress(pt);
            const visible = pt.filter((t) => filter === 'all' || (filter === 'open' ? t.status !== 'completed' : t.status === filter));
            const isOpen = open.has(p.number);
            return (
              <div key={p.number} id={`phase-${p.number}`} className={`tk-phase tk-dom--${domainOf(p.number)} ${isOpen ? 'is-open' : ''} ${p.number === phase ? 'is-current' : ''}`}>
                <button type="button" className="tk-phase__head" aria-expanded={isOpen} onClick={() => toggle(p.number)}>
                  <span className="tk-phase__chev">{isOpen ? '−' : '+'}</span>
                  <span className="tk-phase__num">Phase {p.number}</span>
                  <span className="tk-phase__title">{p.title}</span>
                  <span className="tk-phase__load">Load: {p.load}</span>
                  <span className="tk-phase__count">{pp.done}/{pp.total}</span>
                </button>
                {isOpen && (
                  <div className="tk-phase__body">
                    <p className="tk-phase__summary">{p.summary}</p>
                    {visible.length === 0 ? <Empty>No tasks match this filter.</Empty> : visible.map((t) => <TaskRow key={t.id} task={t} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Session log" sub="Saved sessions drive the “Last session” card above.">
        <SessionLog owner="manas" />
      </Section>
    </>
  );
}

// ─── Team members ────────────────────────────────────────────────────────

function MemberHeader({ id }: { id: MemberId }) {
  const m = MEMBER_BY_ID[id];
  return (
    <header className={`tk-member-head tk-who-bg--${id}`}>
      <div>
        <span className="tk-eyebrow">{m.role} · {m.tool}</span>
        <h1>{m.name}</h1>
        <p>{m.area}</p>
      </div>
    </header>
  );
}

function Timeline({ tasks }: { tasks: Task[] }) {
  const { today } = useTasks();
  const dated = tasks.filter((t) => t.deadline);
  if (!dated.length) return null;
  const start = [today, ...dated.map((t) => t.deadline!)].sort()[0];
  const end = dated.map((t) => t.deadline!).sort().at(-1)!;
  const span = Math.max(1, daysBetween(start, end));
  const pos = (k: string) => `${(daysBetween(start, k) / span) * 100}%`;
  const todayIn = daysBetween(start, today) >= 0 && daysBetween(today, end) >= 0;

  return (
    <div className="tk-timeline" role="list" aria-label="Deadline timeline">
      <div className="tk-timeline__axis">
        <span>{formatDate(start)}</span>
        <span>{formatDate(end)}</span>
      </div>
      {dated.map((t) => (
        <div key={t.id} className="tk-timeline__row" role="listitem">
          <span className="tk-timeline__label">{t.id} <em>{t.title}</em></span>
          <div className="tk-timeline__track">
            {todayIn && <span className="tk-timeline__today" style={{ left: pos(today) }} title="Today" />}
            <span
              className={`tk-timeline__mark tk-timeline__mark--${isOverdue(t, today) ? 'overdue' : t.status}`}
              style={{ left: pos(t.deadline!) }}
              title={`${t.id} · ${formatDate(t.deadline!)}`}
            />
          </div>
          <span className="tk-timeline__date">{formatDate(t.deadline!)}</span>
        </div>
      ))}
    </div>
  );
}

function Groups({ tasks, title }: { tasks: Task[]; title: string }) {
  const areas = [...new Set(tasks.map((t) => t.area ?? 'Other'))];
  return (
    <Section title={title}>
      <div className="tk-groups">
        {areas.map((a) => {
          const g = tasks.filter((t) => (t.area ?? 'Other') === a);
          const gp = progress(g);
          return (
            <div key={a} className="tk-group">
              <header><strong>{a}</strong><span>{gp.done}/{gp.total}</span></header>
              <ProgressBar pct={gp.pct} label={`${a} progress`} />
              <ul>{g.map((t) => <li key={t.id}><StatusBadge status={t.status} /> {t.id} {t.title}</li>)}</ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function YashPipeline({ tasks }: { tasks: Task[] }) {
  const stages: { label: string; ids: string[] }[] = [
    { label: 'Output contract', ids: ['Y1'] },
    { label: 'Prompt + examples', ids: ['Y3'] },
    { label: 'LLM API', ids: ['Y4'] },
    { label: 'Compile check + retry', ids: ['Y2', 'Y5'] },
    { label: 'Evaluation', ids: ['Y6'] },
    { label: 'Playground hand-off', ids: ['Y7'] },
    { label: 'Teacher demo', ids: ['Y8'] },
  ];
  const stageStatus = (ids: string[]): Status => {
    const st = ids.map((i) => tasks.find((t) => t.id === i)!.status);
    if (st.every((x) => x === 'completed')) return 'completed';
    if (st.includes('blocked')) return 'blocked';
    if (st.some((x) => x === 'in_progress' || x === 'completed')) return 'in_progress';
    return 'planned';
  };
  return (
    <Section title="Demo pipeline" sub="Topic in → valid AQVL out → existing Playground renders it. The compiler is only called, never changed.">
      <ol className="tk-pipeline">
        {stages.map((s) => (
          <li key={s.label} className={`tk-pipeline__stage tk-pipeline__stage--${stageStatus(s.ids)}`}>
            <strong>{s.label}</strong>
            <span>{s.ids.join(' · ')}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function MemberView({ id }: { id: Exclude<MemberId, 'manas'> }) {
  const { tasks, today } = useTasks();
  const s = memberSummary(tasks, id, today);
  const g = GUARDRAILS[id];
  const focus = s.active ?? s.next;

  return (
    <>
      <MemberHeader id={id} />

      <div className={`tk-guard tk-guard--${id}`}>
        <p className="tk-guard__mission">{g.mission}</p>
        <div className="tk-grid-2">
          <div>
            <h4>In scope</h4>
            <ul>{g.inScope.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="tk-guard__no">
            <h4>Out of scope — do not touch</h4>
            <ul>{g.outOfScope.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </div>

      <div className="tk-kpis">
        <div className="tk-kpi tk-kpi--ring"><ProgressRing pct={s.progress.pct} size={96} caption="done" /></div>
        <Kpi label="Completed" value={`${s.progress.done}/${s.progress.total}`} />
        <Kpi label="Overdue" value={s.overdue.length} tone={s.overdue.length ? 'bad' : undefined} />
        <Kpi label="Blocked" value={s.blocked.length} tone={s.blocked.length ? 'bad' : undefined} />
        <Kpi label="Next deadline" value={s.nextDeadline ? formatDate(s.nextDeadline.deadline!) : '—'} sub={s.nextDeadline?.id} />
      </div>

      <div className="tk-panels">
        <Panel title="Plan vs. actual" sub="Completed against tasks due by each date" span={2} accent={id === 'yash' ? 'blue' : id === 'tirrth' ? 'pink' : 'green'}>
          {burnUp(s.tasks, today, '2026-09-27') && <BurnUp data={burnUp(s.tasks, today, '2026-09-27')!} today={today} height={200} />}
        </Panel>
        <Panel title="By status" accent="yellow">
          <div className="tk-donut-wrap">
            <Donut segments={statusSegments(statusCounts(s.tasks))} center={`${s.progress.pct}%`} sub={`${s.progress.done}/${s.progress.total}`} size={140} />
            <StatusLegend tasks={s.tasks} />
          </div>
        </Panel>
        <Panel title="Weekly throughput" sub="Tasks completed per week" span={3}>
          <Columns
            bars={weeklyThroughput(s.tasks, today, 6).map((w) => ({ label: shortDate(w.week), value: w.value, title: `Week of ${formatDate(w.week)}: ${w.value} completed` }))}
            cls="tkc-col--good"
            height={160}
            emptyNote="Nothing completed yet"
          />
        </Panel>
      </div>

      <Section title={s.active ? 'Current task' : 'Up next'}>
        {focus ? (
          <div className="tk-focus">
            <header>
              <span className="tk-row__id">{focus.id}</span>
              <h3>{focus.title}</h3>
              <StatusBadge status={focus.status} />
              <DeadlineChip task={focus} />
            </header>
            <dl className="tk-fields">
              <div className="tk-field"><dt>Objective</dt><dd>{focus.objective}</dd></div>
              <div className="tk-field"><dt>Expected output</dt><dd>{focus.expectedOutcome}</dd></div>
              <div className="tk-field"><dt>Definition of done</dt><dd>{focus.definitionOfDone}</dd></div>
              {focus.blocker && <div className="tk-field is-bad"><dt>Blocker</dt><dd>{focus.blocker}</dd></div>}
            </dl>
            <div className="tk-inline">
              {focus.status === 'in_progress' ? <CompleteButton task={focus} /> : <StartButton task={focus} label="Start this task" />}
            </div>
          </div>
        ) : <Empty>{s.progress.done === s.progress.total ? 'All tasks complete.' : 'No task is ready — check blocked tasks and dependencies.'}</Empty>}
      </Section>

      {id === 'yash' && <YashPipeline tasks={s.tasks} />}
      {id === 'tirrth' && <Groups tasks={s.tasks} title="Visual surfaces" />}
      {id === 'pranav' && <Groups tasks={s.tasks} title="Work streams" />}

      <Section title="Sequence & deadlines" sub="Markers sit on each deadline; the dashed line is today.">
        <Timeline tasks={s.tasks} />
      </Section>

      <Section title="All tasks" sub="Open a task for full scope, dependencies and verification.">
        <div className="tk-list">{s.tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
      </Section>

      <Section title="Session log">
        <SessionLog owner={id} />
      </Section>
    </>
  );
}
