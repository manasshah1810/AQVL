import React, { useMemo } from 'react';
import { BurnUp, Columns, Donut, Heatmap, Legend, StackedRows } from './charts';
import { Kpi, ProgressRing } from './components';
import { useTasks } from './context';
import { formatIST } from './ledger';
import {
  DOMAINS,
  activityByDay,
  burnUp,
  completedBetween,
  scheduleAdherence,
  sessionStreak,
  statusCounts,
  statusSegments,
  upcomingLoad,
  velocity,
  weeklyThroughput,
} from './metrics';
import { addDays, byOwner, currentPhase, daysBetween, formatDate, isOverdue, progress, shortDate } from './model';
import { IPD_DEADLINE, ROADMAP } from './roadmapData';
import { MEMBERS, MEMBER_BY_ID } from './teamData';
import { PRIORITIES } from './types';
import type { Task } from './types';

export function Panel({ title, sub, children, span = 1, accent }: { title: string; sub?: React.ReactNode; children: React.ReactNode; span?: 1 | 2 | 3; accent?: string }) {
  return (
    <section className={`tk-panel tk-panel--span${span} ${accent ? `tk-panel--${accent}` : ''}`}>
      <header>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </header>
      {children}
    </section>
  );
}

export function StatusLegend({ tasks }: { tasks: Task[] }) {
  const c = statusCounts(tasks);
  return <Legend items={statusSegments(c).map((s) => ({ label: s.label, cls: s.cls, value: s.value }))} />;
}

export function ReportView() {
  const { tasks, sessions, today } = useTasks();
  const roadmap = byOwner(tasks, 'manas');
  const team = tasks.filter((t) => t.owner !== 'manas');

  const m = useMemo(() => {
    const all = progress(tasks);
    const counts = statusCounts(tasks);
    const adherence = scheduleAdherence(tasks, today);
    const vel = velocity(tasks, today);
    const sessions7 = sessions.filter((s) => daysBetween(s.date.slice(0, 10), today) <= 6).length;
    const dueSoon = tasks.filter((t) => t.status !== 'completed' && t.deadline && daysBetween(today, t.deadline) >= 0 && daysBetween(today, t.deadline) <= 7).length;
    const ipdTasks = roadmap.filter((t) => ROADMAP.find((p) => p.number === t.phase)?.ipd !== 'post');
    return {
      all,
      counts,
      adherence,
      vel,
      sessions7,
      dueSoon,
      overdue: tasks.filter((t) => isOverdue(t, today)).length,
      streak: sessionStreak(sessions, today),
      ipd: progress(ipdTasks),
      roadmapBurn: burnUp(roadmap, today, '2026-09-27'),
      teamBurn: burnUp(team, today, '2026-09-27'),
      throughput: weeklyThroughput(tasks, today, 10),
      load: upcomingLoad(tasks, today, 8),
      activity: activityByDay(tasks, sessions),
    };
  }, [tasks, sessions, today, roadmap, team]);

  const phase = currentPhase(roadmap);
  const ipdDays = daysBetween(today, IPD_DEADLINE);
  const recent = tasks
    .filter((t) => t.status === 'completed' && t.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
    .slice(0, 10);

  return (
    <div className="tk-report">
      <header className="tk-report__head">
        <div>
          <span className="tk-eyebrow">Progress report · as of {formatDate(today)}</span>
          <h1>AQVL project status</h1>
          <p>
            {m.all.done} of {m.all.total} tracked tasks complete ({m.all.pct}%).{' '}
            {phase ? `Roadmap is in Phase ${phase}: ${ROADMAP.find((p) => p.number === phase)!.title}.` : 'All roadmap phases complete.'}{' '}
            Every figure is computed from task states, deadlines and completion timestamps.
          </p>
        </div>
        <button type="button" className="tk-btn tk-btn--primary tk-noprint" onClick={() => window.print()}>
          Print / save PDF
        </button>
      </header>

      <div className="tk-kpi-grid">
        <Kpi label="Overall complete" value={`${m.all.pct}%`} sub={`${m.all.done}/${m.all.total} tasks`} tone="accent" />
        <Kpi label="Roadmap" value={`${progress(roadmap).done}/${roadmap.length}`} sub={`${progress(roadmap).pct}% of sub-phases`} />
        <Kpi label="IPD scope" value={`${m.ipd.pct}%`} sub={`${m.ipd.done}/${m.ipd.total} Phase 1–9 tasks`} />
        <Kpi label="Team tasks" value={`${progress(team).done}/${team.length}`} sub={`${progress(team).pct}% complete`} />
        <Kpi label="In progress" value={m.counts.in_progress} sub="active right now" />
        <Kpi label="Blocked" value={m.counts.blocked} tone={m.counts.blocked ? 'bad' : undefined} sub="need unblocking" />
        <Kpi label="Overdue" value={m.overdue} tone={m.overdue ? 'bad' : undefined} sub="past target date" />
        <Kpi label="Due in 7 days" value={m.dueSoon} tone={m.dueSoon ? 'warn' : undefined} sub="open, dated" />
        <Kpi
          label="On schedule"
          value={m.adherence.pct === null ? '—' : `${m.adherence.pct}%`}
          sub={m.adherence.due ? `${m.adherence.done}/${m.adherence.due} due-by-today done` : 'nothing due yet'}
          tone={m.adherence.pct !== null && m.adherence.pct < 70 ? 'bad' : undefined}
        />
        <Kpi label="Done, last 7 days" value={m.vel.last7} sub={`${completedBetween(tasks, addDays(today, -13), addDays(today, -7))} the week before`} />
        <Kpi label="Pace" value={m.vel.perWeek.toFixed(1)} sub="tasks / week (4-wk avg)" />
        <Kpi
          label="Projected finish"
          value={m.vel.projected ? shortDate(m.vel.projected) : '—'}
          sub={m.vel.projected ? `at current pace, ${m.vel.remaining} left` : 'needs completions to project'}
          tone={m.vel.projected && m.vel.projected > IPD_DEADLINE ? 'bad' : undefined}
        />
        <Kpi label="Days to IPD" value={ipdDays} sub={formatDate(IPD_DEADLINE)} tone={ipdDays < 45 ? 'warn' : undefined} />
        <Kpi label="Sessions, 7 days" value={m.sessions7} sub={`${sessions.length} logged in total`} />
        <Kpi label="Session streak" value={`${m.streak}d`} sub="consecutive days logged" />
        <Kpi label="Unverified" value={m.counts.unverified} tone={m.counts.unverified ? 'warn' : undefined} sub="exists, not verified" />
      </div>

      <div className="tk-panels">
        <Panel title="Roadmap burn-up" sub="Completed vs. due-by-date for the dated roadmap (Phases 1–9)" span={2} accent="purple">
          {m.roadmapBurn && <BurnUp data={m.roadmapBurn} today={today} />}
        </Panel>
        <Panel title="All work by status" sub={`${m.all.total} tasks`} accent="blue">
          <div className="tk-donut-wrap">
            <Donut segments={statusSegments(m.counts)} center={`${m.all.pct}%`} sub="complete" />
            <StatusLegend tasks={tasks} />
          </div>
        </Panel>

        <Panel title="Team burn-up" sub="Yash, Tirrth and Pranav combined" span={2} accent="green">
          {m.teamBurn && <BurnUp data={m.teamBurn} today={today} height={220} />}
        </Panel>
        <Panel title="Progress by domain" sub="Roadmap tasks grouped by area" accent="yellow">
          <div className="tk-rings">
            {DOMAINS.map((d) => {
              const dp = progress(roadmap.filter((t) => d.phases.includes(t.phase!)));
              return (
                <div key={d.id} className={`tk-ring-cell tk-dom--${d.id}`}>
                  <ProgressRing pct={dp.pct} size={78} />
                  <strong>{d.label}</strong>
                  <span>{dp.done}/{dp.total}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Phase breakdown" sub="Each bar is a phase, split by task status" span={2} accent="purple">
          <StackedRows
            rows={ROADMAP.map((p) => {
              const pt = roadmap.filter((t) => t.phase === p.number);
              const pp = progress(pt);
              return {
                key: String(p.number),
                label: <><b>P{p.number}</b> {p.title}</>,
                segments: statusSegments(statusCounts(pt)),
                right: `${pp.done}/${pp.total}`,
              };
            })}
          />
          <StatusLegend tasks={roadmap} />
        </Panel>
        <Panel title="Team workload" sub="Tasks per person by status" accent="pink">
          <StackedRows
            rows={MEMBERS.map((mem) => {
              const mt = byOwner(tasks, mem.id);
              const mp = progress(mt);
              return { key: mem.id, label: <span className={`tk-who tk-who--${mem.id}`}>{mem.name.split(' ')[0]}</span>, segments: statusSegments(statusCounts(mt)), right: `${mp.pct}%` };
            })}
          />
          <div className="tk-mini-donuts">
            {MEMBERS.map((mem) => {
              const mt = byOwner(tasks, mem.id);
              return (
                <div key={mem.id}>
                  <Donut segments={statusSegments(statusCounts(mt))} size={76} center={`${progress(mt).pct}%`} />
                  <span className={`tk-who tk-who--${mem.id}`}>{mem.name.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Weekly throughput" sub="Tasks completed per week (weeks start Monday)" span={2} accent="green">
          <Columns
            bars={m.throughput.map((w) => ({ label: shortDate(w.week), value: w.value, title: `Week of ${formatDate(w.week)}: ${w.value} completed` }))}
            cls="tkc-col--good"
            emptyNote="No tasks completed in this window yet"
          />
        </Panel>
        <Panel title="Open work by priority" accent="blue">
          <StackedRows
            rows={PRIORITIES.map((p) => {
              const pt = tasks.filter((t) => t.priority === p);
              return { key: p, label: <b>{p}</b>, segments: statusSegments(statusCounts(pt)), right: `${pt.filter((t) => t.status !== 'completed').length} open` };
            })}
          />
        </Panel>

        <Panel title="Deadline load" sub="Open tasks due each week; the first bar is everything already overdue" span={2} accent="yellow">
          <Columns
            bars={[
              { label: 'Overdue', value: m.load.overdue, cls: 'tkc-col--bad', title: `${m.load.overdue} overdue` },
              ...m.load.buckets.map((b) => ({ label: shortDate(b.week), value: b.value, title: `Week of ${formatDate(b.week)}: ${b.value} due` })),
            ]}
            cls="tkc-col--warn"
          />
        </Panel>
        <Panel title="Activity" sub="Sessions logged + tasks completed per day" accent="pink">
          <Heatmap data={m.activity} today={today} weeks={14} />
        </Panel>

        <Panel title="Recently completed" sub="Latest 10, newest first" span={3}>
          {recent.length === 0 ? (
            <p className="tk-empty">Nothing completed yet. Completed tasks appear here with their completion time.</p>
          ) : (
            <table className="tk-table">
              <thead>
                <tr><th>Completed</th><th>Task</th><th>Owner</th><th>Target date</th><th>On time</th></tr>
              </thead>
              <tbody>
                {recent.map((t) => {
                  const doneDay = t.completedAt!.slice(0, 10);
                  const onTime = !t.deadline || new Date(t.completedAt!) <= new Date(`${t.deadline}T23:59:59`);
                  return (
                    <tr key={t.id}>
                      <td>{formatIST(t.completedAt!)}</td>
                      <td><span className="tk-row__id">{t.id}</span> {t.title}</td>
                      <td><span className={`tk-who tk-who--${t.owner}`}>{MEMBER_BY_ID[t.owner].name.split(' ')[0]}</span></td>
                      <td>{t.deadline ? formatDate(t.deadline) : '—'}</td>
                      <td className={onTime ? 'tk-good' : 'tk-bad'} title={doneDay}>{onTime ? 'Yes' : 'Late'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
