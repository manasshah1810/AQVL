/**
 * The voiceover's words come from the recorded execution, not from a script:
 * the same program with different values must be explained with those values,
 * every sentence belongs to the frame whose line the editor highlights, and
 * a run that fails is explained from its own error.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { explainError, explainFrame, recordTrace } from '../../packages/runtime/src';
import { getExampleById } from '../../packages/demo/src/examples/registry';
import { THEME_VOICES, voiceThemeOf } from '../../packages/demo/src/lib/voice/themeVoice';
import { speakable } from '../../packages/demo/src/lib/voice/VoiceEngine';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

const bubble = getExampleById('sorting-bubble-sort')!.source;

async function run(source: string) {
  return recordTrace(compile(source) as any);
}

describe('dynamic explanations', () => {
  it('explains a compare and a swap with the actual values, and the reason carries over', async () => {
    const trace = await run(bubble);
    const compare = explainFrame(trace, 1);
    expect(compare.operation).toBe('COMPARE');
    expect(compare.text).toContain('64');
    expect(compare.text).toContain('34');
    expect(compare.text).toContain('greater than');
    expect(compare.importance).toBe('detail');

    const swap = explainFrame(trace, 2);
    expect(swap.operation).toBe('SWAP');
    expect(swap.importance).toBe('key');
    expect(swap.text).toMatch(/64.*34/);
    expect(swap.text).toContain('64 is greater than 34');
  });

  it('follows the code when the values change', async () => {
    const changed = bubble.replace('[64, 34, 25, 12, 22, 11, 90]', '[91, 14, 37, 6]');
    expect(changed).not.toBe(bubble);
    const trace = await run(changed);
    const texts = trace.frames.map((_, i) => explainFrame(trace, i).text).join('\n');
    expect(texts).toContain('91');
    expect(texts).toContain('14');
    expect(texts).not.toContain('64');
    expect(explainFrame(trace, 1).text).toMatch(/91.*14/);
    expect(explainFrame(trace, 0).text).toContain('4 elements');
  });

  it('gives every frame a sentence tied to that frame\'s own line', async () => {
    const trace = await run(bubble);
    trace.frames.forEach((f, i) => {
      const e = explainFrame(trace, i);
      expect(e.text.length).toBeGreaterThan(10);
      expect(e.line).toBe(f.line);
    });
    const last = explainFrame(trace, trace.frames.length - 1);
    expect(last.importance).toBe('key');
    expect(last.operation).toContain('COMPLETE');
  });

  it('marks the steps that matter as key and keeps compares for full mode', async () => {
    const trace = await run(bubble);
    const byOp = new Map<string, Set<string>>();
    trace.frames.forEach((_, i) => {
      const e = explainFrame(trace, i);
      byOp.set(e.operation, (byOp.get(e.operation) ?? new Set()).add(e.importance));
    });
    expect([...byOp.get('SWAP')!]).toEqual(['key']);
    expect([...byOp.get('COMPARE')!]).toContain('detail');
  });

  it('explains stacks, lists and recursion from their own events', async () => {
    const lines: string[] = [];
    for (const id of ['linked-list-singly', 'recursion-factorial']) {
      const ex = getExampleById(id);
      if (!ex) continue;
      const trace = await run(ex.source);
      trace.frames.forEach((_, i) => lines.push(explainFrame(trace, i).text));
    }
    expect(lines.some((t) => /added to the list|removed|re-link|pointer|call/i.test(t))).toBe(true);
  });
});

describe('error explanations', () => {
  it('explains a runtime error with its line, the source and the values involved', async () => {
    const broken = bubble.replace(/arr\[j\]/, 'arr[j + 40]');
    const trace = await run(broken);
    if (!trace.error) throw new Error('expected the modified program to fail');
    const e = explainError(trace, { source: broken })!;
    expect(e.operation).toBe('ERROR');
    expect(e.importance).toBe('key');
    expect(e.line).toBe(trace.error.line);
    expect(e.text).toContain(`line ${trace.error.line}`);
    expect(e.text).toContain(trace.error.message.replace(/\s+/g, ' ').trim().replace(/[.\s]*$/, ''));
    expect(e.text.length).toBeGreaterThan(80);
  });

  it('returns nothing when the run succeeded', async () => {
    expect(explainError(await run(bubble))).toBeNull();
  });
});

describe('theme voices', () => {
  it('give each world a distinct model and pace, and map worlds to voices', () => {
    const voices = Object.values(THEME_VOICES);
    expect(new Set(voices.map((v) => v.piper.voiceId)).size).toBe(4);
    expect(THEME_VOICES.panda.piper.rate).toBeLessThan(THEME_VOICES.default.piper.rate);
    expect(THEME_VOICES.penguin.piper.rate).toBeGreaterThan(THEME_VOICES.default.piper.rate);
    expect(THEME_VOICES.rabbit.speech.pitch).toBeGreaterThan(THEME_VOICES.penguin.speech.pitch);
    expect(voiceThemeOf('panda')).toBe('panda');
    expect(voiceThemeOf('penguin')).toBe('penguin');
    expect(voiceThemeOf('rabbit')).toBe('rabbit');
    expect(voiceThemeOf('studio')).toBe('default');
    expect(voiceThemeOf('ocean')).toBe('default');
  });

  it('turns symbols into speakable words', () => {
    expect(speakable('Swapped [0] (64) ↔ [1] (34)')).toBe('Swapped position 0 (64) with position 1 (34)');
    expect(speakable('curr → node 10')).toBe('curr points to node 10');
  });
});
