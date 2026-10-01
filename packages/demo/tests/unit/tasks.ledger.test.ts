import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import ledgerRaw from '../../src/pages/tasks/ledger/ledger.jsonl?raw';
import { GENESIS, parseLedger, replay, sealEntry, sha256, verifyChain } from '../../src/pages/tasks/ledger';
import type { LedgerEntry } from '../../src/pages/tasks/ledger';
import { SEEDS, requiredFiles } from '../../src/pages/tasks/model';

const known = new Set(SEEDS.map((s) => s.id));
const T0 = Date.parse('2026-10-01T10:00:00Z');
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
const base = { actor: 'a@b.c', head: 'c'.repeat(40) };
const ev = { startHead: base.head, elapsedMin: 20, files: ['f'], linesAdded: 20, required: [], checks: [] };

function build(events: Omit<LedgerEntry, 'hash' | 'prev' | 'seq'>[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const e of events) out.push(sealEntry(e, out[out.length - 1]));
  return out;
}

describe('sha256', () => {
  it.each(['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'héllo wörld ✓', 'x'.repeat(1000)])('matches node crypto for case %#', (s) => {
    expect(sha256(s)).toBe(createHash('sha256').update(s).digest('hex'));
  });
});

describe('verifyChain', () => {
  const ok = () =>
    build([
      { ...base, ts: at(0), task: 'R1.0', event: 'start' },
      { ...base, ts: at(20), task: 'R1.0', event: 'complete', evidence: ev },
    ]);
  const now = T0 + 3_600_000;

  it('accepts a well-formed chain', () => {
    const r = verifyChain(ok(), known, now);
    expect(r.ok).toBe(true);
    expect(replay(r.trusted).get('R1.0')?.status).toBe('completed');
  });

  it('detects an edited entry and trusts only what precedes it', () => {
    const e = ok();
    e[1] = { ...e[1], evidence: { ...ev, linesAdded: 9999 } };
    const r = verifyChain(e, known, now);
    expect(r.ok).toBe(false);
    expect(r.trusted).toHaveLength(1);
  });

  it('detects a deleted or reordered entry', () => {
    expect(verifyChain(ok().slice(1), known, now).ok).toBe(false);
    expect(verifyChain([...ok()].reverse(), known, now).ok).toBe(false);
  });

  it('rejects completing a task that was never started', () => {
    const e = build([{ ...base, ts: at(0), task: 'R1.0', event: 'complete', evidence: ev }]);
    expect(verifyChain(e, known, now).errors[0]).toMatch(/not allowed while R1\.0 is planned/);
  });

  it('rejects a repeat start, backwards time, future time and unknown tasks', () => {
    expect(verifyChain(build([...ok(), { ...base, ts: at(30), task: 'R1.0', event: 'start' }]), known, now).ok).toBe(false);
    expect(verifyChain(build([{ ...base, ts: at(10), task: 'R1.0', event: 'start' }, { ...base, ts: at(5), task: 'R1.0', event: 'block', note: 'x' }]), known, now).ok).toBe(false);
    expect(verifyChain(build([{ ...base, ts: at(500), task: 'R1.0', event: 'start' }]), known, now).errors[0]).toMatch(/future/);
    expect(verifyChain(build([{ ...base, ts: at(0), task: 'ZZ9', event: 'start' }]), known, now).errors[0]).toMatch(/unknown task/);
  });

  it('rejects a completion with no evidence even when the hash is valid', () => {
    const e = build([
      { ...base, ts: at(0), task: 'R1.0', event: 'start' },
      { ...base, ts: at(20), task: 'R1.0', event: 'complete' },
    ]);
    expect(verifyChain(e, known, now).errors[0]).toMatch(/no evidence/);
  });

  it('starts from the genesis hash', () => {
    expect(ok()[0].prev).toBe(GENESIS);
  });
});

describe('the committed ledger', () => {
  it('is structurally valid and chains from genesis', () => {
    const { entries, errors } = parseLedger(ledgerRaw);
    expect(errors).toEqual([]);
    expect(verifyChain(entries, known).errors).toEqual([]);
  });
});

describe('requiredFiles', () => {
  it('extracts promised deliverables from prompts and team outcomes', () => {
    expect(requiredFiles(SEEDS.find((s) => s.id === 'R1.1')!)).toEqual(['docs/design/phase1-regression-baseline.md']);
    expect(requiredFiles(SEEDS.find((s) => s.id === 'Y2')!)).toContain('poc/ai-api/validate.ts');
    expect(requiredFiles(SEEDS.find((s) => s.id === 'R1.0')!)).toEqual([]);
  });
});
