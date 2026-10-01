import React from 'react';
import { instructionViews, type AQIRProgram, type PipelineState } from '../types/pipeline';

export interface IDEExecutionDebuggerProps {
  aqir: AQIRProgram | null;
  currentInstructionIndex: number;
  isPlaying: boolean;
  pipelineState: PipelineState;
}

export const IDEExecutionDebugger: React.FC<IDEExecutionDebuggerProps> = ({
  aqir,
  currentInstructionIndex,
  isPlaying,
  pipelineState
}) => {
  const instructions = instructionViews(aqir);
  const totalInstructions = instructions.length;
  const isRuntimeReady = pipelineState.runtime === 'success';

  let statusLabel = 'Compiling';
  if (isRuntimeReady) statusLabel = isPlaying ? 'Playing' : 'Paused';

  const progress = totalInstructions > 0
    ? Math.round((currentInstructionIndex / totalInstructions) * 100)
    : 0;

  return (
    <div className="exec-debugger">
      {/* Header */}
      <div className="exec-debugger-header">
        <span className="exec-debugger-title">Execution</span>
        <span className={`exec-debugger-status${statusLabel === 'Paused' ? ' is-paused' : ''}`}>{statusLabel}</span>
      </div>

      {/* IP Counter */}
      <div className="exec-debugger-ip">
        <span className="exec-debugger-ip-label">Instruction pointer</span>
        <span className="exec-debugger-ip-value">
          {currentInstructionIndex} / {totalInstructions}
        </span>
      </div>

      {/* Progress track */}
      {totalInstructions > 0 && (
        <div className="ide-progress" aria-hidden="true">
          <span className="ide-progress__fill" style={{ transform: `scaleX(${progress / 100})`, transition: 'transform 380ms var(--spring-snappy)' }} />
        </div>
      )}

      {/* Instruction list */}
      <div className="exec-debugger-instructions">
        {instructions.map((inst, idx) => {
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
          <p className="ide-note">No instructions loaded</p>
        )}
      </div>
    </div>
  );
};
