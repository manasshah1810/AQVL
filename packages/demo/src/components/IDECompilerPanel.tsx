import React, { useState } from 'react';

interface IDECompilerPanelProps {
  tokens: any[];
  ast: any;
  aqir: any;
  pipelineState: {
    lexer: 'pending' | 'success' | 'error';
    parser: 'pending' | 'success' | 'error';
    semantic: 'pending' | 'success' | 'error';
    optimizer: 'pending' | 'success' | 'error';
    generator: 'pending' | 'success' | 'error';
    runtime: 'pending' | 'success' | 'error';
    expandedAst?: any;
  };
}

const PIPELINE_STAGES = [
  {
    key: 'lexer' as const,
    label: 'Lexer',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    successHint: 'Tokens generated',
  },
  {
    key: 'parser' as const,
    label: 'Parser',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
    successHint: 'AST Generated',
  },
  {
    key: 'semantic' as const,
    label: 'Semantic Validation',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    successHint: 'No errors',
  },
  {
    key: 'optimizer' as const,
    label: 'Optimizer',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    successHint: 'AST optimized',
  },
  {
    key: 'generator' as const,
    label: 'AQIR Generator',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    successHint: 'IR emitted',
  },
  {
    key: 'runtime' as const,
    label: 'Runtime',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
      </svg>
    ),
    successHint: 'Ready to run',
  },
] as const;

type TabKey = 'pipeline' | 'tokens' | 'ast' | 'expandedAst' | 'aqir';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'tokens', label: 'Tokens' },
  { key: 'ast', label: 'AST' },
  { key: 'expandedAst', label: 'Expanded AST' },
  { key: 'aqir', label: 'AQIR' },
];

export function IDECompilerPanel({ tokens, ast, aqir, pipelineState }: IDECompilerPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('pipeline');

  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return (
          <span className="status-icon success">✓</span>
        );
      case 'error':
        return (
          <span className="status-icon error">✗</span>
        );
      default:
        return (
          <span className="status-icon pending">·</span>
        );
    }
  };

  // Count how many stages are complete
  const stages = ['lexer', 'parser', 'semantic', 'optimizer', 'generator', 'runtime'] as const;
  const completed = stages.filter(s => pipelineState[s] === 'success').length;
  const totalStages = stages.length;
  const hasError = stages.some(s => pipelineState[s] === 'error');

  return (
    <div className="ide-panel ide-center-panel">
      {/* Panel header with progress */}
      <div className="ide-panel-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg className="ide-panel-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="16" y1="18" x2="22" y2="12" />
            <line x1="16" y1="6" x2="22" y2="12" />
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
          Compiler Pipeline
        </div>
        {/* Mini progress indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: hasError ? 'var(--error)' : completed === totalStages ? 'var(--success)' : 'var(--text-muted)',
          fontWeight: 600,
        }}>
          {hasError ? '✗ Error' : `${completed}/${totalStages}`}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '2px',
        background: 'var(--border-color)',
        flexShrink: 0,
      }}>
        <div style={{
          height: '100%',
          width: `${(completed / totalStages) * 100}%`,
          background: hasError
            ? 'var(--error)'
            : 'linear-gradient(90deg, #6366f1, #22c55e)',
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: hasError ? '0 0 6px var(--error)' : '0 0 8px rgba(99,102,241,.5)',
        }} />
      </div>

      {/* Tabs */}
      <div className="ide-tabs">
        {TABS.map(tab => (
          <div
            key={tab.key}
            className={`ide-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div className="ide-tab-content">
        {/* ── Pipeline view ─────────────────────────────────── */}
        {activeTab === 'pipeline' && (
          <div>
            {PIPELINE_STAGES.map(stage => {
              const status = pipelineState[stage.key];
              return (
                <div
                  key={stage.key}
                  className={`pipeline-card ${status === 'success' ? 'active' : ''} ${status === 'error' ? 'has-error' : ''}`}
                >
                  <div className="pipeline-card-title">
                    {getStatusIcon(status)}
                    <span style={{ color: status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {stage.label}
                    </span>
                  </div>
                  {status === 'success' && (
                    <div className="pipeline-card-status">{stage.successHint}</div>
                  )}
                  {status === 'error' && (
                    <div className="pipeline-card-status" style={{ color: 'var(--error)' }}>Failed</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tokens view ───────────────────────────────────── */}
        {activeTab === 'tokens' && (
          <pre>
            {tokens.length === 0
              ? '// No tokens generated yet.\n// Press Compile to run the lexer.'
              : tokens.map(t => `${t.type.padEnd(20)} ${t.value}`).join('\n')}
          </pre>
        )}

        {/* ── AST view ──────────────────────────────────────── */}
        {activeTab === 'ast' && (
          <pre>
            {ast ? JSON.stringify(ast, null, 2) : '// No AST generated yet.\n// Press Compile to parse.'}
          </pre>
        )}

        {/* ── Expanded AST view ─────────────────────────────── */}
        {activeTab === 'expandedAst' && (
          <pre>
            {pipelineState.expandedAst
              ? JSON.stringify(pipelineState.expandedAst, null, 2)
              : '// No Expanded AST generated.'}
          </pre>
        )}

        {/* ── AQIR view ─────────────────────────────────────── */}
        {activeTab === 'aqir' && (
          <pre>
            {aqir ? JSON.stringify(aqir, null, 2) : '// No AQIR generated yet.\n// Press Compile to generate IR.'}
          </pre>
        )}
      </div>
    </div>
  );
}
