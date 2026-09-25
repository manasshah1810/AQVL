/**
 * Integration coverage for the Playground's core user-facing flow:
 * load an example -> compile -> run -> see the visualization update.
 *
 * @aqvl/renderer's AQVECanvas mounts a react-three-fiber <Canvas>, which
 * needs a real WebGL context that jsdom doesn't provide. It's mocked out
 * with a plain stub that surfaces the sceneState it was handed, so these
 * tests can assert the pipeline produced real frame data without needing
 * a WebGL context.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { SceneState } from '@aqvl/runtime';

vi.mock('@aqvl/renderer', () => ({
  AQVECanvas: ({ sceneState }: { sceneState: SceneState | null }) => (
    <div
      data-testid="aqve-canvas-stub"
      data-element-count={sceneState ? sceneState.elements.size : -1}
    />
  ),
}));

import Playground from '../../src/pages/Playground';

function getStatusLabel() {
  return document.querySelector('.pg-status-chip')?.textContent ?? '';
}

describe('Playground compile & run flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('auto-compiles the default example on load and feeds real scene data to the canvas', async () => {
    render(<Playground />);

    // The pipeline runs synchronously on mount (Lexer -> Parser -> Semantic ->
    // Optimizer -> AQIRGenerator -> ExecutionEngine.loadProgram), so the scene
    // should be populated without needing to wait for user interaction.
    const canvas = await screen.findByTestId('aqve-canvas-stub');
    await waitFor(() => {
      expect(Number(canvas.getAttribute('data-element-count'))).toBeGreaterThan(0);
    });

    // No compile/runtime error overlay should be showing for the known-good default script.
    expect(screen.queryByText(/Compilation Error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Runtime Error/i)).not.toBeInTheDocument();

    // The engine auto-plays ~100ms after a successful compile; the status
    // chip should reflect a live, non-idle state once that kicks in.
    await waitFor(() => {
      expect(getStatusLabel()).toMatch(/Running|Ready/);
    });
  });

  it('shows a compile error and no canvas when the source has invalid syntax', async () => {
    render(<Playground />);
    await screen.findByTestId('aqve-canvas-stub');

    const editor = screen.getByLabelText('AQVL source code editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '@@@ not valid aqvl @@@' } });

    fireEvent.click(screen.getByRole('button', { name: /Compile & Run/i }));

    await waitFor(() => {
      expect(screen.getByText(/Compilation Error/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('aqve-canvas-stub')).not.toBeInTheDocument();
    expect(getStatusLabel()).toMatch(/Compile Error/);
  });

  it('lets the user pick an example from the explorer and loads it into the editor', async () => {
    render(<Playground />);
    await screen.findByTestId('aqve-canvas-stub');

    // First visit auto-opens the explorer (localStorage 'aqvl-visited' unset),
    // so it's already showing — matches what a first-time user actually sees.
    expect(screen.getByRole('dialog', { name: 'Choose a lesson' })).toBeInTheDocument();

    // The explorer defaults to the first registry category (Arrays), so pick
    // an Arrays example other than the one already loaded by default.
    const card = await screen.findByText('Reverse Array');
    fireEvent.click(card.closest('button')!);

    const editor = screen.getByLabelText('AQVL source code editor') as HTMLTextAreaElement;
    await waitFor(
      () => {
        expect(editor.value).not.toBe('');
        expect(editor.value).toMatch(/ArrayReversal/i);
      },
      { timeout: 2000 }
    );
  });
});
