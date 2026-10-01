import { replay } from '../../src/pages/tasks/ledger';
import type { LedgerEntry } from '../../src/pages/tasks/ledger';

/** Synthetic ledger entries for display-layer tests (hashes are irrelevant to replay). */
export function entry(task: string, event: LedgerEntry['event'], ts: string, extra: Partial<LedgerEntry> = {}): LedgerEntry {
  return { seq: 0, ts, task, event, actor: 'tester@example.com', head: 'a'.repeat(40), prev: '', hash: '', ...extra };
}

export const done = (task: string, ts: string, elapsedMin = 30): LedgerEntry[] => [
  entry(task, 'start', new Date(Date.parse(ts) - elapsedMin * 60_000).toISOString()),
  entry(task, 'complete', ts, { evidence: { startHead: 'a'.repeat(40), elapsedMin, files: ['x.ts'], linesAdded: 20, required: [], checks: [] } }),
];

export const factsOf = (entries: LedgerEntry[]) => replay(entries);
