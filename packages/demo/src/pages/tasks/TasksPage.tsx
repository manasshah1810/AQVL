import React, { useEffect, useMemo, useRef, useState } from 'react';
import './tasks.css';
import { TasksCtx } from './context';
import { emptyState, indexTasks, isPersistedState, memberSummary } from './model';
import { exportState, useTaskStore, useToday } from './store';
import { MEMBERS } from './teamData';
import type { MemberId } from './types';
import { ManasView, MemberView, OverviewView } from './views';

type Route = 'overview' | MemberId;

function readRoute(): Route {
  const seg = window.location.hash.replace(/^#\/tasks\/?/, '').split(/[/?]/)[0];
  return (MEMBERS.some((m) => m.id === seg) ? seg : 'overview') as Route;
}

export default function TasksPage() {
  const { state, tasks, dispatch, saveError } = useTaskStore();
  const today = useToday();
  const [route, setRoute] = useState<Route>(readRoute);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('aqvl-docs-theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    () => ({ tasks, index: indexTasks(tasks), sessions: state.sessions, today, dispatch }),
    [tasks, state.sessions, today, dispatch],
  );

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('aqvl-docs-theme', next);
    } catch {
      /* theme just won't persist */
    }
  };

  const onImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isPersistedState(parsed)) throw new Error('not an AQVL tasks export');
      if (!window.confirm('Replace the task state in this browser with the imported file?')) return;
      dispatch({ type: 'replace', state: parsed });
      setImportMsg(`Imported ${Object.keys(parsed.overrides).length} task updates and ${parsed.sessions.length} sessions.`);
    } catch (e) {
      setImportMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <TasksCtx.Provider value={ctx}>
      <div className="tk-root" data-theme={theme}>
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
                  <a key={m.id} href={`#/tasks/${m.id}`} className={route === m.id ? 'is-active' : ''} aria-current={route === m.id ? 'page' : undefined}>
                    {m.name.split(' ')[0]}
                    {alert > 0 && <span className="tk-tabs__alert" aria-label={`${alert} overdue or blocked`}>{alert}</span>}
                  </a>
                );
              })}
            </nav>
            <div className="tk-top__tools">
              <span className="tk-today-chip">{new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <button type="button" className="tk-btn" onClick={() => exportState(state)}>Export</button>
              <button type="button" className="tk-btn" onClick={() => fileRef.current?.click()}>Import</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = '';
                }}
              />
              <button type="button" className="tk-btn" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        </header>

        <main className="tk-main">
          {saveError && <div className="tk-alert tk-alert--bad" role="alert">{saveError}</div>}
          {importMsg && (
            <div className="tk-alert" role="status">
              {importMsg} <button type="button" className="tk-link" onClick={() => setImportMsg(null)}>Dismiss</button>
            </div>
          )}

          {route === 'overview' && <OverviewView />}
          {route === 'manas' && <ManasView />}
          {(route === 'yash' || route === 'tirrth' || route === 'pranav') && <MemberView id={route} />}

          <footer className="tk-foot">
            <p>
              State is saved in this browser. The site has no backend, so use Export and Import to share progress across machines or with the team.
            </p>
            <button
              type="button"
              className="tk-link tk-link--bad"
              onClick={() => {
                if (window.confirm('Reset ALL task statuses, notes and sessions in this browser? Export first if you want a backup.')) {
                  dispatch({ type: 'replace', state: emptyState() });
                }
              }}
            >
              Reset all progress
            </button>
          </footer>
        </main>
      </div>
    </TasksCtx.Provider>
  );
}
