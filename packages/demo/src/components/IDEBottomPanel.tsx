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

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="ide-panel-header" style={{ justifyContent: 'flex-start' }}>
      <span className="ide-panel-header-icon">{icon}</span>
      {title}
    </div>
  );
}

const TimelineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const StatusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const StatsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="18" y="3" width="4" height="18" rx="1" />
    <rect x="10" y="8" width="4" height="13" rx="1" />
    <rect x="2" y="13" width="4" height="8" rx="1" />
  </svg>
);

const ConsoleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export function IDEBottomPanel({
  aqir,
  currentInstructionIndex,
  runtimeStatus,
  stats,
  consoleLogs
}: IDEBottomPanelProps) {

  const instructions = aqir?.instructions || [];
  const isRunning = runtimeStatus.timelineState === 'Running';

  return (
    <div className="ide-bottom-panel">

      {/* ── Execution Timeline ────────────────────────────── */}
      <div className="ide-bottom-section" style={{ width: '25%' }}>
        <SectionHeader icon={<TimelineIcon />} title="Execution Timeline" />
        <div className="ide-panel-content">
          {instructions.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No instructions
            </div>
          )}
          {instructions.map((inst: any, idx: number) => {
            const isCompleted = idx < currentInstructionIndex;
            const isActive    = idx === currentInstructionIndex;
            return (
              <div
                key={idx}
                className={`timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                <span className="status-icon" style={{
                  width: '15px',
                  height: '15px',
                  fontSize: '9px',
                  color: isCompleted ? 'var(--success)' : isActive ? '#a5b4fc' : 'var(--text-subtle)',
                }}>
                  {isCompleted ? '✓' : isActive ? '▶' : ''}
                </span>
                <span className="timeline-idx">{idx + 1}</span>
                <span style={{ color: isActive ? 'var(--text-primary)' : undefined }}>
                  {inst.type}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Runtime Status ────────────────────────────────── */}
      <div className="ide-bottom-section" style={{ width: '25%' }}>
        <SectionHeader icon={<StatusIcon />} title="Runtime Status" />
        <div className="ide-panel-content">
          <ul className="kv-list">
            <li className="kv-item">
              <span className="kv-key">Scene</span>
              <span className="kv-value">{runtimeStatus.scene}</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Objects</span>
              <span className="kv-value">{runtimeStatus.objectsCount}</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Instructions</span>
              <span className="kv-value">{runtimeStatus.instructionsCount}</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Current Instr</span>
              <span className="kv-value">{currentInstructionIndex}</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Timeline</span>
              <span className={`kv-value ${isRunning ? 'running' : 'stopped'}`}>
                {runtimeStatus.timelineState}
              </span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Compiler</span>
              <span className="kv-value">AQVL</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">AQIR Version</span>
              <span className="kv-value">{runtimeStatus.aqirVersion}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Statistics ────────────────────────────────────── */}
      <div className="ide-bottom-section" style={{ width: '25%' }}>
        <SectionHeader icon={<StatsIcon />} title="Statistics" />
        <div className="ide-panel-content">
          <ul className="kv-list">
            <li className="kv-item">
              <span className="kv-key">Characters</span>
              <span className="kv-value">{stats.characters}</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Lines</span>
              <span className="kv-value">{stats.lines}</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Tokens</span>
              <span className="kv-value">{stats.tokens}</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">AST Nodes</span>
              <span className="kv-value">{stats.astNodes}</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Compile Time</span>
              <span className="kv-value success">{stats.compileTime}ms</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Execution Time</span>
              <span className="kv-value">{stats.executionTime}s</span>
            </li>
            <li className="kv-item">
              <span className="kv-key">Frames</span>
              <span className="kv-value">{stats.framesRendered}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Console ───────────────────────────────────────── */}
      <div className="ide-bottom-section" style={{ width: '25%' }}>
        <SectionHeader icon={<ConsoleIcon />} title="Console" />
        <div className="ide-panel-content">
          {consoleLogs.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No output yet
            </div>
          )}
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
