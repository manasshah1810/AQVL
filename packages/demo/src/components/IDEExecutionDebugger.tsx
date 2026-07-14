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

  let statusLabel = 'Compiling';
  let dotClass = 'compiling';
  let statusColor = '#a5b4fc';

  if (isRuntimeReady) {
    if (isPlaying) {
      statusLabel = 'Playing';
      dotClass = 'playing';
      statusColor = 'var(--success)';
    } else {
      statusLabel = 'Paused';
      dotClass = 'paused';
      statusColor = 'var(--warning)';
    }
  }

  const progress = totalInstructions > 0
    ? Math.round((currentInstructionIndex / totalInstructions) * 100)
    : 0;

  return (
    <div className="exec-debugger">
      {/* Header */}
      <div className="exec-debugger-header">
        <span className="exec-debugger-title">Execution Debugger</span>
        <span className="exec-debugger-status" style={{ color: statusColor }}>
          <span className={`exec-debugger-status-dot ${dotClass}`} />
          {statusLabel}
        </span>
      </div>

      {/* IP Counter */}
      <div className="exec-debugger-ip">
        <span className="exec-debugger-ip-label">Instr Pointer (IP):</span>
        <span className="exec-debugger-ip-value">
          {currentInstructionIndex} / {totalInstructions}
        </span>
      </div>

      {/* Progress track */}
      {totalInstructions > 0 && (
        <div style={{
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '99px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #6366f1, #22c55e)',
            borderRadius: '99px',
            transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: '0 0 6px rgba(99,102,241,.4)',
          }} />
        </div>
      )}

      {/* Instruction list */}
      <div className="exec-debugger-instructions">
        {instructions.map((inst: any, idx: number) => {
          const isActive = idx === currentInstructionIndex;
          const isPast   = idx < currentInstructionIndex;

          const actionName = inst.action === 'GENERIC_ACTION' ? inst.actionName : inst.action;
          const args = [
            inst.leftId && inst.rightId ? `(${inst.leftId}, ${inst.rightId})` : '',
            !inst.rightId && inst.leftId ? `(${inst.leftId})` : '',
            inst.targetId ? `(${inst.targetId})` : '',
            inst.args ? `(${inst.args.join(', ')})` : '',
          ].filter(Boolean).join('');

          return (
            <div
              key={idx}
              className={`exec-instr ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
            >
              <span className="exec-instr-idx">{String(idx).padStart(3, '0')}</span>
              {actionName}{args}
            </div>
          );
        })}

        {instructions.length === 0 && (
          <div style={{
            color: 'var(--text-subtle)',
            fontStyle: 'italic',
            padding: '4px 6px',
            fontSize: '10.5px',
          }}>
            No instructions loaded
          </div>
        )}
      </div>
    </div>
  );
};
