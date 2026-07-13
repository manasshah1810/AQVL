import React from 'react';

interface ConsoleMessage {
  type: 'log' | 'error' | 'success';
  text: string;
}

interface IDEBottomPanelProps {
  aqir: any;
  currentInstructionIndex: number;
  runtimeStatus: {
    scene: string;
    objectsCount: number;
    instructionsCount: number;
    timelineState: string;
    compilerVersion: string;
    aqirVersion: string;
  };
  stats: {
    compileTime: number;
    executionTime: number;
    framesRendered: number;
    characters: number;
    lines: number;
    tokens: number;
    astNodes: number;
  };
  consoleLogs: ConsoleMessage[];
}

export function IDEBottomPanel({
  aqir,
  currentInstructionIndex,
  runtimeStatus,
  stats,
  consoleLogs
}: IDEBottomPanelProps) {
  
  const instructions = aqir?.instructions || [];

  return (
    <div className="ide-bottom-panel">
      
      {/* Execution Timeline */}
      <div className="ide-bottom-section" style={{ width: '25%' }}>
        <div className="ide-panel-header">Execution Timeline</div>
        <div className="ide-panel-content">
          {instructions.length === 0 && <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>No instructions generated</div>}
          {instructions.map((inst: any, idx: number) => {
            const isCompleted = idx < currentInstructionIndex;
            const isActive = idx === currentInstructionIndex;
            return (
              <div key={idx} className={`timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                <span className="status-icon" style={{ width: '16px' }}>
                  {isCompleted ? '✓' : (isActive ? '▶' : '')}
                </span>
                <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>{idx + 1}</span>
                <span>{inst.type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Runtime Status */}
      <div className="ide-bottom-section" style={{ width: '25%' }}>
        <div className="ide-panel-header">Runtime Status</div>
        <div className="ide-panel-content">
          <ul className="kv-list">
            <li className="kv-item"><span className="kv-key">Scene:</span> <span className="kv-value">{runtimeStatus.scene}</span></li>
            <li className="kv-item"><span className="kv-key">Objects:</span> <span className="kv-value">{runtimeStatus.objectsCount}</span></li>
            <li className="kv-item"><span className="kv-key">Instructions:</span> <span className="kv-value">{runtimeStatus.instructionsCount}</span></li>
            <li className="kv-item"><span className="kv-key">Current Instruction:</span> <span className="kv-value">{currentInstructionIndex}</span></li>
            <li className="kv-item"><span className="kv-key">Timeline:</span> <span className="kv-value">{runtimeStatus.timelineState}</span></li>
            <li className="kv-item"><span className="kv-key">Compiler Version:</span> <span className="kv-value">{runtimeStatus.compilerVersion}</span></li>
            <li className="kv-item"><span className="kv-key">AQIR Version:</span> <span className="kv-value">{runtimeStatus.aqirVersion}</span></li>
          </ul>
        </div>
      </div>

      {/* Statistics */}
      <div className="ide-bottom-section" style={{ width: '25%' }}>
        <div className="ide-panel-header">Statistics</div>
        <div className="ide-panel-content">
          <ul className="kv-list">
            <li className="kv-item"><span className="kv-key">Characters:</span> <span className="kv-value">{stats.characters}</span></li>
            <li className="kv-item"><span className="kv-key">Lines:</span> <span className="kv-value">{stats.lines}</span></li>
            <li className="kv-item"><span className="kv-key">Tokens:</span> <span className="kv-value">{stats.tokens}</span></li>
            <li className="kv-item"><span className="kv-key">AST Nodes:</span> <span className="kv-value">{stats.astNodes}</span></li>
            <li className="kv-item"><span className="kv-key">Compile Time:</span> <span className="kv-value">{stats.compileTime}ms</span></li>
            {/* Note: Execution time and Frames rendered are mock/hard to get precisely in React without deeper integration into TimelineEngine */}
            <li className="kv-item"><span className="kv-key">Execution Time:</span> <span className="kv-value">{stats.executionTime}s</span></li>
            <li className="kv-item"><span className="kv-key">Frames Rendered:</span> <span className="kv-value">{stats.framesRendered}</span></li>
          </ul>
        </div>
      </div>

      {/* Console */}
      <div className="ide-bottom-section" style={{ width: '25%' }}>
        <div className="ide-panel-header">Console</div>
        <div className="ide-panel-content">
          {consoleLogs.map((log, idx) => (
            <div key={idx} className={`console-log ${log.type}`}>
              {log.text}
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}
