import React, { useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import type { AQIRProgram, PipelineState, ProgramNode, Token } from '../types/pipeline';
import { spring } from '../lib/motion';

interface IDECompilerPanelProps {
  tokens: Token[];
  ast: ProgramNode | null;
  aqir: AQIRProgram | null;
  pipelineState: PipelineState;
}

const PIPELINE_STAGES = [
  { key: 'lexer' as const, label: 'Lexer', successHint: 'Tokens generated' },
  { key: 'parser' as const, label: 'Parser', successHint: 'AST generated' },
  { key: 'semantic' as const, label: 'Semantic validation', successHint: 'No errors' },
  { key: 'optimizer' as const, label: 'Optimizer', successHint: 'AST optimized' },
  { key: 'generator' as const, label: 'AQIR generator', successHint: 'IR emitted' },
  { key: 'runtime' as const, label: 'Runtime', successHint: 'Ready to run' },
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
        return <span className="status-icon success" aria-label="done">✓</span>;
      case 'error':
        return <span className="status-icon error" aria-label="failed">✗</span>;
      default:
        return <span className="status-icon pending" aria-label="pending">·</span>;
    }
  };

  // Count how many stages are complete
  const stages = ['lexer', 'parser', 'semantic', 'optimizer', 'generator', 'runtime'] as const;
  const completed = stages.filter(s => pipelineState[s] === 'success').length;
  const totalStages = stages.length;
  const hasError = stages.some(s => pipelineState[s] === 'error');

  return (
    <div className="ide-panel ide-center-panel">
      <div className="ide-panel-header" style={{ justifyContent: 'space-between' }}>
        <span>Compiler pipeline</span>
        <span className={hasError ? 'text-cream' : 'muted'}>{hasError ? 'Failed' : `${completed} of ${totalStages}`}</span>
      </div>

      <div className="ide-progress" aria-hidden="true">
        <motion.span
          className="ide-progress__fill"
          initial={false}
          animate={{ scaleX: completed / totalStages }}
          transition={spring.layout}
        />
      </div>

      <div className="ide-tabs" role="tablist" aria-label="Compiler output">
        <LayoutGroup id="ide-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`ide-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {activeTab === tab.key && <motion.span layoutId="ide-tab-on" className="ide-tab__bg" transition={spring.layout} />}
              <span className="relative">{tab.label}</span>
            </button>
          ))}
        </LayoutGroup>
      </div>

      <div className="ide-tab-content" role="tabpanel">
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
                    <span className={status === 'pending' ? 'muted' : undefined}>{stage.label}</span>
                  </div>
                  {status === 'success' && <div className="pipeline-card-status">{stage.successHint}</div>}
                  {status === 'error' && <div className="pipeline-card-status text-cream">Failed</div>}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'tokens' && (
          <pre>
            {tokens.length === 0
              ? '// No tokens generated yet.\n// Press Compile to run the lexer.'
              : tokens.map(t => `${t.type.padEnd(20)} ${t.value}`).join('\n')}
          </pre>
        )}

        {activeTab === 'ast' && (
          <pre>{ast ? JSON.stringify(ast, null, 2) : '// No AST generated yet.\n// Press Compile to parse.'}</pre>
        )}

        {activeTab === 'expandedAst' && (
          <pre>
            {pipelineState.expandedAst
              ? JSON.stringify(pipelineState.expandedAst, null, 2)
              : '// No Expanded AST generated.'}
          </pre>
        )}

        {activeTab === 'aqir' && (
          <pre>{aqir ? JSON.stringify(aqir, null, 2) : '// No AQIR generated yet.\n// Press Compile to generate IR.'}</pre>
        )}
      </div>
    </div>
  );
}
