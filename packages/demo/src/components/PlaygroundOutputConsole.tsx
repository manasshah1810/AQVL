import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { RuntimeLogEntry } from './RuntimeOutputPanel';
import { spring } from '../lib/motion';

// Re-export so consumers only need one import
export type { RuntimeLogEntry };

/** Plain-language names for the engine's log kinds. */
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

interface PlaygroundOutputConsoleProps {
  logs: RuntimeLogEntry[];
  onClear: () => void;
  /** Living in the stage panel: always open, and filling it. */
  embedded?: boolean;
}

/** The run, narrated: one line per thing the engine did, newest at the bottom. */
export function PlaygroundOutputConsole({ logs, onClear, embedded = false }: PlaygroundOutputConsoleProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapsed = embedded ? false : isCollapsed;

  // Auto-scroll to bottom on each new log
  useEffect(() => {
    if (!collapsed && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs, collapsed]);

  return (
    <section className={`poc${embedded ? ' poc--embedded' : ''}`} aria-label="Output console">
      <div className="poc__head">
        <h2 className="poc__title">
          Output
          {logs.length > 0 && <span className="poc__count">{logs.length} lines</span>}
        </h2>
        <div className="flex items-center gap-1">
          {logs.length > 0 && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={onClear}>
              Clear
            </button>
          )}
          {!embedded && (
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-expanded={!collapsed}
              aria-controls="poc-body"
            >
              {collapsed ? 'Show' : 'Hide'}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div ref={listRef} id="poc-body" className="poc__body" role="log" aria-live="polite" aria-relevant="additions">
          {logs.length === 0 ? (
            <p className="poc__empty">Each step of the run is explained here as it happens.</p>
          ) : (
            <AnimatePresence initial={false}>
              {logs.map((entry) => (
                <motion.div
                  key={entry.id}
                  className={`poc__entry${entry.kind === 'result' ? ' is-result' : ''}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: spring.snappy }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                >
                  <span className="poc__kind">
                    <b>{entry.keyword}</b>
                    {KIND_LABEL[entry.kind] ?? entry.kind}
                  </span>
                  <span className="poc__msg">{entry.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </section>
  );
}
