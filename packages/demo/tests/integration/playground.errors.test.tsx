/**
 * The Playground's error teaching flow, end to end (minus WebGL): a program
 * fails, the exact line is marked, the lesson appears, the learner edits, and
 * running again discards everything said about the old code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import type { ExecutionTrace } from '@aqvl/runtime';

vi.mock('@aqvl/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aqvl/renderer')>();
  return {
    ...actual,
    StageCanvas: ({ trace }: { trace: ExecutionTrace }) => <div data-testid="aqve-canvas-stub" data-step-count={trace.frames.length - 1} />,
  };
});

import Playground from '../../src/pages/Playground';

const INDEX_BUG = `SCENE Demo

DECLARE
  ARRAY arr = [5, 3, 2]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i + 1]
  END
END
`;
const UNCLOSED = INDEX_BUG.replace('[5, 3, 2]', '[5, 3, 2');

function editor() {
  return screen.getByLabelText('AQVL source code editor') as HTMLTextAreaElement;
}
function setSource(value: string) {
  fireEvent.change(editor(), { target: { value } });
}
function compile() {
  fireEvent.click(screen.getByRole('button', { name: /Compile & Run/i }));
}

describe('Playground error teaching', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('aqvl-visited', 'true');
  });
  afterEach(() => localStorage.clear());

  it('explains a compile error on the line that needs the change, without touching the code', async () => {
    render(<Playground />);
    await screen.findByTestId('aqve-canvas-stub');
    setSource(UNCLOSED);
    compile();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Compilation error')).toBeInTheDocument();
    // The bracket opened on line 4 is the line to fix, not the line the parser gave up on.
    expect(within(alert).getByText('Line 4')).toBeInTheDocument();
    expect(alert.textContent).toContain('opens a "[" that is never closed');
    expect(alert.textContent).toContain('ARRAY arr = [5, 3, 2]');
    expect(editor().value).toBe(UNCLOSED);
    expect(document.querySelector('.aqvl-issue-band')?.textContent).toBe('Error here');
    expect(screen.queryByTestId('aqve-canvas-stub')).not.toBeInTheDocument();

    // "Edit code" hands the keyboard to the learner, caret on the unclosed bracket itself.
    fireEvent.click(within(alert).getByRole('button', { name: /Edit code/i }));
    expect(editor()).toHaveFocus();
    const rows = UNCLOSED.split(/\r?\n/);
    const lineStart = rows.slice(0, 3).reduce((n, l) => n + l.length + 1, 0);
    expect(editor().selectionStart).toBe(lineStart + rows[3].indexOf('['));
    expect(editor().value).toBe(UNCLOSED);
  });

  it('discards the explanation when the code is edited, and runs the new code on Try again', async () => {
    render(<Playground />);
    await screen.findByTestId('aqve-canvas-stub');
    setSource(UNCLOSED);
    compile();
    const alert = await screen.findByRole('alert');

    // Editing marks the explanation as describing old code.
    setSource(INDEX_BUG);
    expect(await within(alert).findByText(/You have edited the code since this ran/)).toBeInTheDocument();
    expect(document.querySelector('.aqvl-issue-band')).toBeNull();

    // Trying again runs what is in the editor now: the old compile error is gone.
    fireEvent.click(within(alert).getByRole('button', { name: /Try again/i }));
    await waitFor(() => expect(screen.getByTestId('aqve-canvas-stub')).toBeInTheDocument());
    expect(screen.queryByText('Compilation error')).not.toBeInTheDocument();
  });

  it('stops a runtime error on its exact line and teaches it from the values', async () => {
    render(<Playground />);
    await screen.findByTestId('aqve-canvas-stub');
    setSource(INDEX_BUG);
    compile();
    await waitFor(() => expect(screen.getByTestId('aqve-canvas-stub').getAttribute('data-step-count')).toBe('3'));

    // Jump to the end of the run (the development hook the visualizer exposes).
    const hook = (window as unknown as { __aqvl: { playhead: { jumpToStep: (n: number) => void } } }).__aqvl;
    act(() => hook.playhead.jumpToStep(3));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Something went wrong')).toBeInTheDocument();
    expect(within(alert).getByText('Line 8')).toBeInTheDocument();
    expect(alert.textContent).toContain('arr[i + 1]');
    expect(alert.textContent).toContain('i is 2');
    expect(alert.textContent).toContain('LOOP i FROM 0 TO LENGTH(arr) - 2');
    // The editor marks the failing line; the learner's code is exactly what they typed.
    expect(document.querySelector('.aqvl-issue-band')?.textContent).toBe('Error here');
    expect(editor().value).toBe(INDEX_BUG);
    expect(within(alert).getByRole('button', { name: /Edit code/i })).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: /Explain/i })).toBeInTheDocument();

    // Editing makes the explanation stale; the line marker for the old run goes away.
    setSource(INDEX_BUG.replace('LENGTH(arr) - 1', 'LENGTH(arr) - 2'));
    expect(await within(alert).findByText(/You have edited the code since this ran/)).toBeInTheDocument();
    expect(document.querySelector('.aqvl-issue-band')).toBeNull();
  });
});
