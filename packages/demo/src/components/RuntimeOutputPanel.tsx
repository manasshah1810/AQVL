import React, { useEffect, useRef } from 'react';

export interface RuntimeLogEntry {
  id: number;
  timestamp: number;
  keyword: string;
  message: string;
  kind: 'traversal' | 'search' | 'info' | 'relationship' | 'operation' | 'step' | 'result' | 'swap' | 'compare';
  /** Visible step (1-based) whose execution produced this line; lets the playground drop lines when stepping back. */
  step?: number;
}

interface RuntimeOutputPanelProps {
  logs: RuntimeLogEntry[];
  onClear: () => void;
}

const KIND_LABEL: Record<RuntimeLogEntry['kind'], string> = {
  traversal: 'traversal',
  search: 'search',
  info: 'note',
  relationship: 'relation',
  operation: 'operation',
  step: 'step',
  result: 'result',
  swap: 'swap',
  compare: 'compare',
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
    <section className="rop" aria-label="Runtime output">
      <div className="rop__head">
        <span>
          Output <span className="muted">{logs.length}</span>
        </span>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onClear}>
          Clear
        </button>
      </div>
      <div ref={listRef} className="rop__list" role="log" aria-live="polite">
        {logs.map((entry) => (
          <div key={entry.id} className="rop__entry">
            <div className="rop__kind">
              <b>{entry.keyword}</b>
              {KIND_LABEL[entry.kind] ?? entry.kind}
            </div>
            <div className="rop__msg">{entry.message}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
