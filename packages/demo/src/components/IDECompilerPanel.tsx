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
  };
}

export function IDECompilerPanel({ tokens, ast, aqir, pipelineState }: IDECompilerPanelProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'tokens' | 'ast' | 'aqir'>('pipeline');

  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'success': return <span className="status-icon success">✓</span>;
      case 'error': return <span className="status-icon error">✗</span>;
      default: return <span className="status-icon pending">◯</span>;
    }
  };

  return (
    <div className="ide-panel ide-center-panel">
      <div className="ide-panel-header">Compiler Pipeline</div>
      
      <div className="ide-tabs">
        <div 
          className={`ide-tab ${activeTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >Pipeline</div>
        <div 
          className={`ide-tab ${activeTab === 'tokens' ? 'active' : ''}`}
          onClick={() => setActiveTab('tokens')}
        >Tokens</div>
        <div 
          className={`ide-tab ${activeTab === 'ast' ? 'active' : ''}`}
          onClick={() => setActiveTab('ast')}
        >AST</div>
        <div 
          className={`ide-tab ${activeTab === 'aqir' ? 'active' : ''}`}
          onClick={() => setActiveTab('aqir')}
        >AQIR</div>
      </div>
      
      <div className="ide-tab-content">
        {activeTab === 'pipeline' && (
          <div>
            <div className={`pipeline-card ${pipelineState.lexer === 'success' ? 'active' : ''}`}>
              <div className="pipeline-card-title">{getStatusIcon(pipelineState.lexer)} Lexer</div>
            </div>
            <div className={`pipeline-card ${pipelineState.parser === 'success' ? 'active' : ''}`}>
              <div className="pipeline-card-title">{getStatusIcon(pipelineState.parser)} Parser</div>
              {pipelineState.parser === 'success' && <div className="pipeline-card-status">AST Generated</div>}
            </div>
            <div className={`pipeline-card ${pipelineState.semantic === 'success' ? 'active' : ''}`}>
              <div className="pipeline-card-title">{getStatusIcon(pipelineState.semantic)} Semantic Validation</div>
            </div>
            <div className={`pipeline-card ${pipelineState.optimizer === 'success' ? 'active' : ''}`}>
              <div className="pipeline-card-title">{getStatusIcon(pipelineState.optimizer)} Optimizer</div>
            </div>
            <div className={`pipeline-card ${pipelineState.generator === 'success' ? 'active' : ''}`}>
              <div className="pipeline-card-title">{getStatusIcon(pipelineState.generator)} AQIR Generator</div>
            </div>
            <div className={`pipeline-card ${pipelineState.runtime === 'success' ? 'active' : ''}`}>
              <div className="pipeline-card-title">{getStatusIcon(pipelineState.runtime)} Runtime</div>
              {pipelineState.runtime === 'success' && <div className="pipeline-card-status">Ready</div>}
            </div>
          </div>
        )}
        
        {activeTab === 'tokens' && (
          <pre>
            {tokens.length === 0 ? 'No tokens generated' : tokens.map(t => `${t.type}(${t.value})`).join('\n')}
          </pre>
        )}
        
        {activeTab === 'ast' && (
          <pre>
            {ast ? JSON.stringify(ast, null, 2) : 'No AST generated'}
          </pre>
        )}
        
        {activeTab === 'aqir' && (
          <pre>
            {aqir ? JSON.stringify(aqir, null, 2) : 'No AQIR generated'}
          </pre>
        )}
      </div>
    </div>
  );
}
