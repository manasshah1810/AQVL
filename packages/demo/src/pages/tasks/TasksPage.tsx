import React, { useEffect, useMemo, useState } from 'react';
import './tasks.css';
import { TasksCtx } from './context';
import { indexTasks, memberSummary } from './model';
import { useLedger, useToday } from './store';
import { MEMBERS } from './teamData';
import type { MemberId } from './types';
import { ManasView, MemberView, OverviewView } from './views';
import { ReportView } from './report';

type Route = 'overview' | 'report' | MemberId;

function readRoute(): Route {
  const seg = window.location.hash.replace(/^#\/tasks\/?/, '').split(/[/?]/)[0];
  if (seg === 'report') return 'report';
  return (MEMBERS.some((m) => m.id === seg) ? seg : 'overview') as Route;
}

export default function TasksPage() {
  const { tasks, sessions, integrity } = useLedger();
  const today = useToday();
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = 'AQVL · Command Center';
  }, []);

  const ctx = useMemo(
    () => ({ tasks, index: indexTasks(tasks), sessions, today, integrity }),
    [tasks, sessions, today, integrity],
  );

  return (
    <TasksCtx.Provider value={ctx}>
      <div className="tk-root" data-theme="dark">
        <header className="tk-top">
          <div className="tk-top__inner">
            <a href="#/" className="tk-brand">
              <span className="tk-brand__mark">AQVL</span>
              <span className="tk-brand__name">Command Center</span>
            </a>
            <nav className="tk-tabs" aria-label="Dashboards">
              <a href="#/tasks" className={route === 'overview' ? 'is-active' : ''} aria-current={route === 'overview' ? 'page' : undefined}>
                Overview
              </a>
              {MEMBERS.map((m) => {
                const s = memberSummary(tasks, m.id, today);
                const alert = s.overdue.length + s.blocked.length;
                return (
                  <a key={m.id} href={`#/tasks/${m.id}`} className={`tk-tab--${m.id} ${route === m.id ? 'is-active' : ''}`} aria-current={route === m.id ? 'page' : undefined}>
                    {m.name.split(' ')[0]}
                    {alert > 0 && <span className="tk-tabs__alert" aria-label={`${alert} overdue or blocked`}>{alert}</span>}
                  </a>
                );
              })}
              <a href="#/tasks/report" className={`tk-tabs__report ${route === 'report' ? 'is-active' : ''}`} aria-current={route === 'report' ? 'page' : undefined}>
                Report
              </a>
            </nav>
            <div className="tk-top__tools">
              <span className="tk-today-chip">{new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </header>

        <main className="tk-main">
          {!integrity.ok && (
            <div className="tk-alert tk-alert--bad" role="alert">
              <strong>Ledger integrity failure.</strong> Only the first {integrity.trusted} of {integrity.total} entries verify, so progress after that point is not counted.{' '}
              {integrity.errors[0]}
            </div>
          )}

          {route === 'overview' && <OverviewView />}
          {route === 'report' && <ReportView />}
          {route === 'manas' && <ManasView />}
          {(route === 'yash' || route === 'tirrth' || route === 'pranav') && <MemberView id={route} />}

          <footer className="tk-foot">
            <p>
              Progress is read from a hash-chained ledger committed to the repo ({integrity.trusted} verified entr{integrity.trusted === 1 ? 'y' : 'ies'}). It cannot be changed from this page, and a task only counts once the work behind it checks out against git.
            </p>
          </footer>
        </main>
      </div>
    </TasksCtx.Provider>
  );
}
