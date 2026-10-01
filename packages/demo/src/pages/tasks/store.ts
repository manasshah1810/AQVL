import { useEffect, useMemo, useState } from 'react';
import ledgerRaw from './ledger/ledger.jsonl?raw';
import { parseLedger, replay, verifyChain } from './ledger';
import type { ChainReport, LedgerEntry } from './ledger';
import { SEEDS, mergeTasks, sessionsFromLedger, toDateKey } from './model';
import type { Session, Task } from './types';

export interface LedgerView {
  tasks: Task[];
  sessions: Session[];
  entries: LedgerEntry[];
  integrity: { ok: boolean; errors: string[]; total: number; trusted: number };
}

const KNOWN = new Set(SEEDS.map((s) => s.id));

/**
 * Build the whole view from the committed ledger. Nothing here is writable:
 * if the chain is broken, only the verified prefix counts and the page says so.
 */
export function buildLedgerView(raw: string, now = Date.now()): LedgerView {
  const { entries, errors: parseErrors } = parseLedger(raw);
  const report: ChainReport = verifyChain(entries, KNOWN, now);
  const tasks = mergeTasks(SEEDS, replay(report.trusted));
  return {
    tasks,
    sessions: sessionsFromLedger(report.trusted, tasks),
    entries: report.trusted,
    integrity: { ok: report.ok && parseErrors.length === 0, errors: [...parseErrors, ...report.errors], total: entries.length, trusted: report.trusted.length },
  };
}

export function useLedger(): LedgerView {
  return useMemo(() => buildLedgerView(ledgerRaw), []);
}

/** Today's date key; rolls over at midnight so overdue flags stay correct in a tab left open. */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => {
      const k = toDateKey(new Date());
      setToday((prev) => (prev === k ? prev : k));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = legacyCopy();
    document.body.removeChild(ta);
    return ok;
  }
}

function legacyCopy(): boolean {
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}
