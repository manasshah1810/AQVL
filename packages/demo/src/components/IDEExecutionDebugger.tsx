import React from 'react';

export interface IDEExecutionDebuggerProps {
  aqir: any;
  currentInstructionIndex: number;
  isPlaying: boolean;
  pipelineState: any;
}

export const IDEExecutionDebugger: React.FC<IDEExecutionDebuggerProps> = ({
  aqir,
  currentInstructionIndex,
  isPlaying,
  pipelineState
}) => {
  const instructions = aqir?.instructions || [];
  const totalInstructions = instructions.length;
  const isRuntimeReady = pipelineState.runtime === 'success';

  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      width: '320px',
      background: 'rgba(20, 20, 20, 0.85)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '12px',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: 'var(--shadow-lg)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
        <strong style={{ color: 'var(--text-highlight)' }}>Execution Debugger</strong>
        <span>
          {isRuntimeReady ? (isPlaying ? '🟢 PLAYING' : '⏸ PAUSED') : '⚙️ COMPILING'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Instr Pointer (IP):</span>
        <span>{currentInstructionIndex} / {totalInstructions}</span>
      </div>

      <div style={{
        marginTop: '4px',
        maxHeight: '120px',
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.4)',
        borderRadius: '4px',
        padding: '4px'
      }}>
        {instructions.map((inst: any, idx: number) => {
          const isActive = idx === currentInstructionIndex;
          const isPast = idx < currentInstructionIndex;
          return (
            <div 
              key={idx} 
              style={{ 
                padding: '2px 4px',
                color: isActive ? '#4caf50' : (isPast ? '#666' : '#bbb'),
                background: isActive ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                borderLeft: isActive ? '2px solid #4caf50' : '2px solid transparent',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              <span style={{ opacity: 0.5, marginRight: '8px' }}>{String(idx).padStart(3, '0')}</span>
              {inst.action === 'GENERIC_ACTION' ? inst.actionName : inst.action}{' '}
              {inst.leftId && inst.rightId ? `(${inst.leftId}, ${inst.rightId})` : ''}
              {!inst.rightId && inst.leftId ? `(${inst.leftId})` : ''}
              {inst.targetId ? `(${inst.targetId})` : ''}
              {inst.args ? `(${inst.args.join(', ')})` : ''}
            </div>
          );
        })}
        {instructions.length === 0 && (
          <div style={{ color: '#666', fontStyle: 'italic', padding: '4px' }}>No instructions loaded</div>
        )}
      </div>
    </div>
  );
};
