import React from 'react';

interface IDEToolbarProps {
  onCompile: () => void;
  onRun: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onStop: () => void;
  isPlaying: boolean;
  canRun: boolean;
}

/** Inspector toolbar: compile, then drive the runtime one instruction at a time. */
export function IDEToolbar({ onCompile, onRun, onPause, onStep, onReset, onStop, isPlaying, canRun }: IDEToolbarProps) {
  return (
    <div className="ide-toolbar" role="toolbar" aria-label="Compiler inspector">
      <span className="ide-toolbar__label">Compiler inspector</span>

      <button type="button" className="btn btn--sm" onClick={onCompile}>
        Compile
      </button>

      <div className="ide-toolbar-sep" aria-hidden="true" />

      {!isPlaying ? (
        <button type="button" className="btn btn--quiet btn--sm" onClick={onRun} disabled={!canRun}>
          {canRun ? 'Run / resume' : 'Run'}
        </button>
      ) : (
        <button type="button" className="btn btn--quiet btn--sm" onClick={onPause}>
          Pause
        </button>
      )}
      <button type="button" className="btn btn--quiet btn--sm" onClick={onStep} disabled={!canRun}>
        Step
      </button>
      <button type="button" className="btn btn--quiet btn--sm" onClick={onReset} disabled={!canRun}>
        Reset
      </button>
      <button type="button" className="btn btn--quiet btn--sm" onClick={onStop} disabled={!canRun}>
        Stop
      </button>

      <div className="ide-toolbar-spacer" />

      <div className={`ide-status-chip ${isPlaying ? 'running' : canRun ? 'ready' : 'idle'}`} role="status">
        <span className="ide-status-chip-dot" aria-hidden="true" />
        {isPlaying ? 'Running' : canRun ? 'Ready' : 'Not compiled'}
      </div>
    </div>
  );
}
