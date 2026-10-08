/**
 * Every recorded frame carries the source line of the statement that made it.
 * The editor highlights exactly that line, and every theme reads the same
 * frame, so the line must be right even with blank lines, comments, indentation
 * and CRLF-normalised text shifting things around.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { recordTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

async function framesFor(source: string) {
  const trace = await recordTrace(compile(source) as any);
  expect(trace.error).toBeNull();
  return trace.frames;
}

describe('source line of each frame', () => {
  const source = getExampleById('sorting-bubble-sort')!.source;
  const lines = source.split('\n');

  it('points compare and swap frames at their COMPARE / SWAP statements', async () => {
    const frames = await framesFor(source);
    let checked = 0;
    for (const f of frames.slice(1)) {
      if (f.event.kind !== 'compare' && f.event.kind !== 'swap') continue;
      expect(f.line).not.toBeNull();
      expect(lines[f.line! - 1].toUpperCase()).toContain(f.event.kind === 'compare' ? 'COMPARE' : 'SWAP');
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('moves every frame by exactly the inserted lines when blank lines and comments are added', async () => {
    const base = await framesFor(source);
    const shifted = ['// header', '', '', ...lines.slice(0, 5), '', '// note', ...lines.slice(5)].join('\n');
    const after = await framesFor(shifted);
    expect(after).toHaveLength(base.length);
    const shift = (n: number) => (n > 5 ? n + 5 : n + 3);
    base.forEach((f, i) => expect(after[i].line).toBe(f.line === null ? null : shift(f.line)));
  });
});
