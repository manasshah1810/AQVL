import { describe, expect, it } from 'vitest';
import { teachError } from '@aqvl/runtime';
import { errorScript, errorScriptText, speakable, type VoiceTheme } from '../../src/lib/voice';
import { program, run } from './errors.helpers';

const THEMES: VoiceTheme[] = ['default', 'panda', 'penguin', 'rabbit'];

async function indexLesson() {
  const trace = await run(program('LOOP i FROM 0 TO LENGTH(arr) - 1\n  HIGHLIGHT arr[i + 1]\nEND'));
  return teachError(trace.error!.info!);
}

describe('each narrator tells the same lesson in its own voice', () => {
  it('opens with its own wording, from the same facts', async () => {
    const lesson = await indexLesson();
    const what = (t: VoiceTheme) => errorScript(lesson, t)[0].text;
    expect(what('default')).toContain('An index error occurred because the code attempted to access index 3, while the largest valid index is 2.');
    expect(what('panda')).toContain('Oops! We tried to access index 3, but arr only goes up to index 2.');
    expect(what('penguin')).toContain("Whoa! Index 3 doesn't exist here! arr stops at index 2.");
    expect(what('rabbit')).toContain('Oops! We hopped one position too far. The last valid index is 2, so we need to stop before going to 3.');
  });

  it('keeps the technical content identical across themes', async () => {
    const lesson = await indexLesson();
    for (const t of THEMES) {
      const script = errorScript(lesson, t);
      const text = script.map((s) => s.text).join(' ');
      // The same reason and the same fix, word for word.
      expect(text).toContain(lesson.why);
      expect(text).toContain(lesson.fix);
      // And the same numbers up front.
      expect(script[0].text).toMatch(/\b3\b/);
      expect(script[0].text).toMatch(/\b2\b/);
      expect(script[0].text).toContain('line 8');
      expect(script.map((s) => s.id)).toEqual(['what', 'why', 'fix', 'correct', 'again']);
    }
    expect(new Set(THEMES.map((t) => errorScriptText(lesson, t))).size).toBe(4);
  });

  it('is spoken as words, not as code', async () => {
    const lesson = await indexLesson();
    const spoken = speakable(errorScript(lesson, 'default')[1].text);
    expect(spoken).not.toMatch(/[[\]<>]/);
    expect(spoken).toContain('i plus 1');
  });

  it('teaches a syntax error and a logic warning in every voice too', () => {
    // Shape only: the wording belongs to the narrator, the sections to the lesson.
    for (const t of THEMES) {
      const lesson = teachError({
        type: 'SELF_COMPARISON',
        phase: 'logic',
        severity: 'warning',
        confidence: 'high',
        name: 'LogicWarning',
        line: 8,
        lineText: 'IF arr[i] > arr[i]',
        expression: 'arr[i] > arr[i]',
        message: 'x',
        frameIndex: 3,
        evidence: { left: 'arr[i]', right: 'arr[i]', index: 2 },
        variables: {},
      });
      const script = errorScript(lesson, t);
      expect(script[0].text).toContain('arr[i]');
      expect(script.length).toBeGreaterThanOrEqual(4);
    }
  });
});
