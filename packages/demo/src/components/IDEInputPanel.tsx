import React, { useState } from 'react';

interface IDEInputPanelProps {
  variables: string[]; // list of declared variable names (e.g., ['arr'])
  onUpdateInput: (name: string, value: any) => void;
}

export function IDEInputPanel({ variables, onUpdateInput }: IDEInputPanelProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const handleChange = (name: string, val: string) => {
    setInputs(prev => ({ ...prev, [name]: val }));
  };

  const handleApply = (name: string) => {
    try {
      const parsed = JSON.parse(inputs[name]);
      onUpdateInput(name, parsed);
    } catch (e) {
      alert('Invalid JSON format. For arrays, use format: [1, 2, 3]');
    }
  };

  if (!variables || variables.length === 0) return null;

  return (
    <div className="ide-input-panel" style={{ borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
      <div className="ide-panel-header" style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>Data Overrides</div>
      <div className="ide-panel-content" style={{ padding: '14px', flex: 'none', overflow: 'visible' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>
          Override variables with JSON values (e.g. <code>[10, 20, 30]</code>)
        </p>
        {variables.map(v => (
          <div key={v} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
            <span style={{ color: 'var(--keyword-color)', minWidth: '40px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{v}</span>
            <input 
              type="text" 
              placeholder="[5, 2, 4, 1]"
              value={inputs[v] || ''}
              onChange={(e) => handleChange(v, e.target.value)}
              style={{
                flex: 1,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <button 
              onClick={() => handleApply(v)}
              className="primary"
              style={{ padding: '4px 12px', height: '28px' }}
            >
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
