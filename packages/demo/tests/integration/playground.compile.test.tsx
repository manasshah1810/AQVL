/**
 * Integration coverage for the Playground's core user-facing flow:
 * load an example -> compile -> run -> see the visualization update.
 *
 * @aqvl/renderer's StageCanvas mounts a react-three-fiber <Canvas>, which
 * needs a real WebGL context that jsdom doesn't provide. Only that component
 * is replaced, with a stub that surfaces the execution trace it was handed;
 * the playhead, timeline and the rest of the visualizer run for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { ExecutionTrace } from '@aqvl/runtime';

vi.mock('@aqvl/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aqvl/renderer')>();
  return {
    ...actual,
    StageCanvas: ({ trace }: { trace: ExecutionTrace }) => (
      <div
        data-testid="aqve-canvas-stub"
        data-element-count={trace.frames[0]?.nodes.length ?? -1}
        data-step-count={trace.frames.length - 1}
      />
    ),
  };
});

import Playground from '../../src/pages/Playground';
import { resetSettings } from '../../src/lib/settings';

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
        expect(editor.value).toMatch(/SCENE ArrayReverse\b/);
      },
      { timeout: 2000 }
    );
  });

  it('keeps the stage clean: the secondary things live in one panel that opens on request and remembers its tab', async () => {
    resetSettings();
    localStorage.setItem('aqvl-visited', 'true');
    render(<Playground />);
    await screen.findByTestId('aqve-canvas-stub');
    // Nothing but the scene, one line of caption and the transport is on the stage: no legend, watch panel or output over it.
    expect(document.querySelector('.vz-dock')).toBeNull();
    expect(document.querySelector('.vz-legend')).toBeNull();
    expect(document.querySelector('.poc')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();

    // One door.
    const door = document.querySelector<HTMLButtonElement>('.vz-panels')!;
    expect(door).toBeTruthy();
    fireEvent.click(door);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual(['Variables', 'Key', 'Output', 'Stage']);

    // Settings are grouped in the Stage tab, the advanced ones collapsed.
    fireEvent.click(screen.getByRole('tab', { name: /Stage/ }));
    expect(screen.getByRole('radiogroup', { name: 'World' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Calm motion/ })).toBeInTheDocument();
    const advanced = document.querySelector('details.vz-set__advanced') as HTMLDetailsElement;
    expect(advanced.open).toBe(false);

    // The Key and Output are one click away too.
    fireEvent.click(screen.getByRole('tab', { name: /Key/ }));
    expect(document.querySelector('.vz-legend')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Output/ }));
    expect(document.querySelector('.poc')).toBeTruthy();

    // It remembers where it was (and that it was open).
    expect(JSON.parse(localStorage.getItem('aqvl-settings')!).dock).toBe('output');
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    await waitFor(() => expect(document.querySelector('.vz-dock')).toBeNull());
    expect(JSON.parse(localStorage.getItem('aqvl-settings')!).dock).toBeNull();
  });

  it('lets the viewer hide the code and give the stage the whole width', async () => {
    resetSettings();
    localStorage.setItem('aqvl-visited', 'true');
    render(<Playground />);
    await screen.findByTestId('aqve-canvas-stub');
    const body = document.querySelector('.pg-body')!;
    expect(body.getAttribute('data-focus')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Focus stage/ }));
    expect(body.getAttribute('data-focus')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Show code/ }));
    expect(body.getAttribute('data-focus')).toBe('false');
  });
});
