import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../src/examples/registry';
import { run } from './errors.helpers';

/**
 * Error handling must stay silent on programs that work. Every shipped
 * example is a correct program: none may produce an error, an error frame or
 * a logic warning.
 */
describe('every shipped example runs clean', () => {
  it('has no error, error frame or logic warning on any example', async () => {
    const noisy: string[] = [];
    for (const ex of EXAMPLES) {
      const trace = await run(ex.source);
      const problems = [
        trace.error ? `error: ${trace.error.message}` : '',
        trace.frames.some((f) => f.event.kind === 'error') ? 'error frame' : '',
        ...trace.diagnostics.map((d) => `logic: ${d.type}`),
      ].filter(Boolean);
      if (problems.length) noisy.push(`${ex.id}: ${problems.join(', ')}`);
    }
    expect(noisy).toEqual([]);
  }, 600_000);
});
