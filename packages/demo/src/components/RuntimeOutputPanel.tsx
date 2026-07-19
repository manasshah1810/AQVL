/// <reference types="react" />
import React, { useEffect, useRef } from 'react';

export interface RuntimeLogEntry {
  id: number;
  timestamp: number;
  keyword: string;
  message: string;
  kind: 'traversal' | 'search' | 'info' | 'relationship' | 'operation' | 'step' | 'result' | 'swap' | 'compare';
}

interface RuntimeOutputPanelProps {
  logs: RuntimeLogEntry[];
  onClear: () => void;
}

const KIND_COLORS: Record<RuntimeLogEntry['kind'], { bg: string; border: string; accent: string; label: string }> = {
  traversal:    { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.5)',   accent: '#60a5fa', label: 'TRAVERSAL'  },
  search:       { bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.45)',   accent: '#4ade80', label: 'SEARCH'     },
  info:         { bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.45)',  accent: '#c084fc', label: 'INFO'       },
  relationship: { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.45)',  accent: '#fbbf24', label: 'RELATION'   },
  operation:    { bg: 'rgba(20,184,166,0.15)',  border: 'rgba(20,184,166,0.45)',  accent: '#2dd4bf', label: 'OPERATION'  },
  step:         { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.35)',  accent: '#a5b4fc', label: 'STEP'       },
  result:       { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.45)',  accent: '#fde68a', label: 'RESULT'     },
  swap:         { bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.45)',  accent: '#fb923c', label: 'SWAP'       },
  compare:      { bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.45)',   accent: '#facc15', label: 'COMPARE'    },
};

export function RuntimeOutputPanel({ logs, onClear }: RuntimeOutputPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes ropSlideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ropPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        width: '360px',
        maxHeight: 'calc(100% - 24px)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(12,12,22,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#6366f1',
              boxShadow: '0 0 8px #6366f1',
              animation: 'ropPulse 2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#e2e8f0',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: '"Inter", sans-serif',
            }}>
              Output
            </span>
            <span style={{
              background: 'rgba(99,102,241,0.25)',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '10px',
              padding: '1px 8px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#a5b4fc',
              fontFamily: '"Inter", sans-serif',
            }}>
              {logs.length}
            </span>
          </div>
          <button
            onClick={onClear}
            title="Clear output"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              color: 'rgba(148,163,184,0.7)',
              fontSize: '11px',
              lineHeight: 1,
              padding: '3px 7px',
              borderRadius: '5px',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#f87171';
              e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(148,163,184,0.7)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Log Entries ── */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            background: 'rgba(8,8,16,0.96)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {logs.map((entry) => {
            const theme = KIND_COLORS[entry.kind];
            return (
              <div
                key={entry.id}
                style={{
                  padding: '10px 14px',
                  background: theme.bg,
                  borderLeft: `3px solid ${theme.accent}`,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  animation: 'ropSlideIn 0.2s ease-out',
                }}
              >
                {/* Kind badge + keyword */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    color: theme.accent,
                    padding: '2px 6px',
                    background: `${theme.accent}20`,
                    borderRadius: '4px',
                    border: `1px solid ${theme.border}`,
                    textTransform: 'uppercase',
                    fontFamily: '"Inter", sans-serif',
                    flexShrink: 0,
                  }}>
                    {theme.label}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: 'rgba(148,163,184,0.6)',
                    letterSpacing: '0.06em',
                  }}>
                    {entry.keyword}
                  </span>
                </div>

                {/* Main message — BIG and readable */}
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#f1f5f9',
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  letterSpacing: '0.01em',
                }}>
                  {entry.message}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
