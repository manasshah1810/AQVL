import React from 'react';

interface IDEToolbarProps {
  onCompile: () => void;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  onStop: () => void;
  isPlaying: boolean;
  canRun: boolean;
}

export function IDEToolbar({
  onCompile,
  onRun,
  onPause,
  onResume,
  onStep,
  onReset,
  onStop,
  isPlaying,
  canRun
}: IDEToolbarProps) {
  return (
    <div className="ide-toolbar">
      <div style={{ fontWeight: 600, color: 'var(--text-accent)', marginRight: '20px' }}>
        AQVL IDE v0.1
      </div>
      
      <button className="primary" onClick={onCompile}>Compile</button>
      
      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 8px' }}></div>
      
      {!isPlaying ? (
        <button onClick={onRun} disabled={!canRun}>
          {canRun ? 'Run / Resume' : 'Run'}
        </button>
      ) : (
        <button onClick={onPause}>Pause</button>
      )}
      
      <button onClick={onStep} disabled={!canRun}>Step</button>
      <button onClick={onReset} disabled={!canRun}>Reset</button>
      <button onClick={onStop} disabled={!canRun}>Stop</button>
    </div>
  );
}
