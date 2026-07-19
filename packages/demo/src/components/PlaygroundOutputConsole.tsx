/// <reference types="react" />
import React, { useEffect, useRef, useState } from 'react';
import type { RuntimeLogEntry } from './RuntimeOutputPanel';

// Re-export so consumers only need one import
export type { RuntimeLogEntry };

const KIND_COLORS: Record<RuntimeLogEntry['kind'], { accent: string; label: string; border: string; bg: string }> = {
  traversal:    { bg: 'rgba(59,130,246,0.14)',  border: 'rgba(59,130,246,0.4)',  accent: '#60a5fa', label: 'TRAVERSAL'  },
  search:       { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.4)',   accent: '#4ade80', label: 'SEARCH'     },
  info:         { bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.4)',  accent: '#c084fc', label: 'INFO'       },
  relationship: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)',  accent: '#fbbf24', label: 'RELATION'   },
  operation:    { bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.4)',  accent: '#2dd4bf', label: 'OPERATION'  },
  step:         { bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.3)',  accent: '#a5b4fc', label: 'STEP'       },
  result:       { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.4)',  accent: '#fde68a', label: 'RESULT'     },
  swap:         { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.4)',  accent: '#fb923c', label: 'SWAP'       },
  compare:      { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.4)',   accent: '#facc15', label: 'COMPARE'    },
};

interface PlaygroundOutputConsoleProps {
  logs: RuntimeLogEntry[];
  onClear: () => void;
}

export function PlaygroundOutputConsole({ logs, onClear }: PlaygroundOutputConsoleProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-scroll to bottom on each new log
  useEffect(() => {
    if (!isCollapsed && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs, isCollapsed]);

  return (
    <>
      <style>{`
        @keyframes pocSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pocPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #6366f1; }
          50%       { opacity: 0.5; box-shadow: 0 0 2px #6366f1; }
        }
      `}</style>

      <div className="poc-panel">
        {/* ── Header ── */}
        <div className="poc-header">
          <div className="poc-header-left">
            <div className="poc-dot" style={{ animation: logs.length > 0 ? 'pocPulse 2s ease-in-out infinite' : 'none' }} />
            <span className="poc-title">Output Console</span>
            {logs.length > 0 && (
              <span className="poc-count">{logs.length}</span>
            )}
          </div>
          <div className="poc-header-right">
            {logs.length > 0 && (
              <button
                className="poc-btn"
                onClick={onClear}
                title="Clear console"
              >
                Clear
              </button>
            )}
            <button
              className="poc-btn poc-btn-collapse"
              onClick={() => setIsCollapsed(prev => !prev)}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* ── Log Entries ── */}
        {!isCollapsed && (
          <div ref={listRef} className="poc-body">
            {logs.length === 0 ? (
              <div className="poc-empty">
                <span className="poc-empty-icon">⌥</span>
                <span className="poc-empty-text">Run an operation to see output here</span>
              </div>
            ) : (
              logs.map((entry) => {
                const theme = KIND_COLORS[entry.kind] || KIND_COLORS.operation;
                return (
                  <div
                    key={entry.id}
                    className="poc-entry"
                    style={{
                      background: theme.bg,
                      borderLeft: `3px solid ${theme.accent}`,
                      animation: 'pocSlideIn 0.18s ease-out',
                    }}
                  >
                    {/* Badge row */}
                    <div className="poc-entry-header">
                      <span
                        className="poc-badge"
                        style={{
                          color: theme.accent,
                          background: `${theme.accent}20`,
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        {theme.label}
                      </span>
                      <span className="poc-keyword">{entry.keyword}</span>
                    </div>
                    {/* Message */}
                    <div className="poc-message">{entry.message}</div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}
