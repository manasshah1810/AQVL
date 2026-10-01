import React from 'react';
import { instructionViews, type AQIRProgram } from '../types/pipeline';

interface ConsoleMessage {
  type: 'log' | 'error' | 'success';
  text: string;
}

interface IDEBottomPanelProps {
  aqir: AQIRProgram | null;
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

function SectionHeader({ title }: { title: string }) {
  return <div className="ide-panel-header">{title}</div>;
}

export function IDEBottomPanel({
  aqir,
  currentInstructionIndex,
  runtimeStatus,
  stats,
  consoleLogs
}: IDEBottomPanelProps) {

  const instructions = instructionViews(aqir);
  const isRunning = runtimeStatus.timelineState === 'Running';

  return (
    <div className="ide-bottom-panel">

      {/* ── Execution Timeline ────────────────────────────── */}
      <div className="ide-bottom-section">
        <SectionHeader title="Execution timeline" />
        <div className="ide-panel-content">
          {instructions.length === 0 && (
            <p className="ide-note">No instructions yet</p>
          )}
          {instructions.map((inst, idx) => {
            const isCompleted = idx < currentInstructionIndex;
            const isActive    = idx === currentInstructionIndex;
            return (
              <div
                key={idx}
                className={`timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                <span className="status-icon" aria-hidden="true">
                  {isCompleted ? '✓' : isActive ? '▸' : ''}
                </span>
                <span className="timeline-idx">{idx + 1}</span>
                <span>{inst.type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Runtime Status ────────────────────────────────── */}
      <div className="ide-bottom-section">
        <SectionHeader title="Runtime status" />
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
      <div className="ide-bottom-section">
        <SectionHeader title="Statistics" />
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
      <div className="ide-bottom-section">
        <SectionHeader title="Console" />
        <div className="ide-panel-content">
          {consoleLogs.length === 0 && (
            <p className="ide-note">No output yet</p>
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
