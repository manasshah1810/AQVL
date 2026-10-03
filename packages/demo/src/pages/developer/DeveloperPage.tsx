import React, { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

/**
 * Hidden maintainer page (#/developer). It holds no credentials and no data of its
 * own: everything goes to the local Developer Gateway (`pnpm gateway`), which checks
 * the Developer ID/password and exposes only specific ledger operations.
 */
const API = (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'http://127.0.0.1:8787';

interface Entry {
  seq: number; ts: string; task: string; event: string; actor: string; head: string; note?: string; manual?: boolean; hash: string;
}
interface Change {
  ts: string; actor: string; action: string; reason: string; before: Entry | null; after: Entry | null;
}
interface View {
  entries: Entry[]; chain: { ok: boolean; errors: string[] }; history: Change[]; tasks?: string[]; events?: string[];
}

const box: React.CSSProperties = { border: '1px solid #8884', borderRadius: 6, padding: 12, marginBottom: 16 };
const inp: React.CSSProperties = { font: 'inherit', padding: '4px 6px', margin: '2px 4px 2px 0' };

export default function DeveloperPage() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<View | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<Entry | null>(null);

  const call = useCallback(async (path: string, method = 'GET', body?: unknown, tk = token) => {
    setMsg('');
    try {
      const r = await fetch(`${API}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? `Error ${r.status}`); if (r.status === 401 && tk) setToken(''); return null; }
      return j;
    } catch {
      setMsg(`Cannot reach the gateway at ${API}. Is "pnpm gateway" running?`);
      return null;
    }
  }, [token]);

  const apply = (j: View | null) => {
    if (!j) return;
    setData(j);
    if (j.tasks) setTasks(j.tasks);
    if (j.events) setEvents(j.events);
  };

  const signIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const j = await call('/api/login', 'POST', { id: f.get('id'), password: f.get('password') }, '');
    if (!j) return;
    setToken(j.token);
    apply(await call('/api/ledger', 'GET', undefined, j.token));
  };

  const submit = async (e: FormEvent<HTMLFormElement>, seq?: number) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries([...f.entries()].filter(([, v]) => v !== ''));
    if (seq !== undefined) { body.note = f.get('note') ?? ''; }
    const verb = seq === undefined ? 'add' : 'edit';
    if (!window.confirm(`Save this ${verb}? The hash chain is re-sealed from this entry on.`)) return;
    const j = await call(seq === undefined ? '/api/entries' : `/api/entries/${seq}`, seq === undefined ? 'POST' : 'PUT', body);
    if (j) { apply(j); setEditing(null); e.currentTarget.reset(); setMsg('Saved. Review and commit ledger.jsonl and manual-changes.jsonl.'); }
  };

  const remove = async (en: Entry) => {
    const reason = window.prompt(`Delete entry #${en.seq} (${en.task} ${en.event})? Give a reason:`);
    if (!reason) return;
    const j = await call(`/api/entries/${en.seq}`, 'DELETE', { reason });
    if (j) { apply(j); setMsg('Deleted.'); }
  };

  const page: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: 24, font: '14px/1.5 system-ui, sans-serif' };

  if (!token) {
    return (
      <div style={page}>
        <h1>Developer Gateway</h1>
        <form onSubmit={signIn} style={box}>
          <input name="id" placeholder="Developer ID" autoComplete="username" required style={inp} />
          <input name="password" type="password" placeholder="Password" autoComplete="current-password" required style={inp} />
          <button type="submit">Sign in</button>
        </form>
        {msg && <p role="alert">{msg}</p>}
      </div>
    );
  }

  const form = (en?: Entry) => (
    <form key={en?.seq ?? 'new'} onSubmit={(e) => submit(e, en?.seq)} style={box}>
      <strong>{en ? `Edit entry #${en.seq}` : 'Add entry'}</strong><br />
      <select name="task" defaultValue={en?.task} required style={inp}>{tasks.map((t) => <option key={t}>{t}</option>)}</select>
      <select name="event" defaultValue={en?.event} required style={inp}>{events.map((t) => <option key={t}>{t}</option>)}</select>
      <input name="actor" placeholder="actor" defaultValue={en?.actor} required style={inp} />
      <input name="ts" placeholder="ISO time" defaultValue={en?.ts ?? new Date().toISOString()} required style={{ ...inp, width: 220 }} />
      <input name="head" placeholder="git commit" defaultValue={en?.head} required style={{ ...inp, width: 160 }} />
      <input name="note" placeholder="note" defaultValue={en?.note} style={{ ...inp, width: 240 }} />
      {!en && <input name="insertAfter" placeholder="insert after seq (blank = end)" style={{ ...inp, width: 200 }} />}
      <input name="reason" placeholder="reason for this change (required)" required minLength={5} style={{ ...inp, width: 300 }} />
      <button type="submit">{en ? 'Save edit' : 'Add'}</button>
      {en && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}
    </form>
  );

  return (
    <div style={page}>
      <h1>Developer Gateway</h1>
      <p>
        <button onClick={async () => apply(await call('/api/ledger'))}>Reload</button>{' '}
        <button onClick={() => { setToken(''); setData(null); }}>Sign out</button>{' '}
        {data && <strong style={{ color: data.chain.ok ? 'green' : 'crimson' }}>{data.chain.ok ? 'Chain valid' : 'Chain has problems'}</strong>}
      </p>
      {msg && <p role="alert">{msg}</p>}
      {data && !data.chain.ok && <ul>{data.chain.errors.map((er) => <li key={er}>{er}</li>)}</ul>}
      {data && (
        <>
          {editing ? form(editing) : form()}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>{['#', 'Time (UTC)', 'Task', 'Event', 'Actor', 'Note', ''].map((h) => <th key={h} align="left">{h}</th>)}</tr></thead>
              <tbody>
                {data.entries.map((en) => (
                  <tr key={en.seq} style={{ borderTop: '1px solid #8883' }}>
                    <td>{en.seq}{en.manual ? ' ✎' : ''}</td><td>{en.ts}</td><td>{en.task}</td><td>{en.event}</td><td>{en.actor}</td><td>{en.note}</td>
                    <td><button onClick={() => setEditing(en)}>Edit</button> <button onClick={() => remove(en)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Manual change history</h2>
          {data.history.length === 0 && <p>No manual changes yet.</p>}
          <ul>
            {data.history.map((h) => (
              <li key={`${h.ts}-${h.action}`}>
                {h.ts} · <strong>{h.action}</strong> · {(h.after ?? h.before)?.task} #{(h.after ?? h.before)?.seq} · {h.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
