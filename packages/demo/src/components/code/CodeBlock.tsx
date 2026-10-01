import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { highlightLines } from '../../lib/aqvlSyntax';
import { spring } from '../../lib/motion';

interface CodeBlockProps {
  code: string;
  /** Shown in the header, e.g. "bubble-sort.aqvl" or "Syntax". */
  label?: string;
  lineNumbers?: boolean;
  /** 1-based line drawn with the playhead band. */
  activeLine?: number | null;
  copy?: boolean;
  className?: string;
  /** Extra controls rendered at the right of the header. */
  actions?: React.ReactNode;
}

export function CodeBlock({ code, label = 'aqvl', lineNumbers = false, activeLine = null, copy = true, className, actions }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => highlightLines(code), [code]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  };

  return (
    <div className={`code ${className ?? ''}`}>
      <div className="code__head">
        <span className="mono code__label">{label}</span>
        <span className="flex items-center gap-1">
          {actions}
          {copy && (
            <button type="button" className="code__copy mono" onClick={handleCopy} aria-label={copied ? 'Copied' : 'Copy code'}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? 'done' : 'copy'}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: spring.snappy }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
                  className="inline-block"
                >
                  {copied ? 'Copied' : 'Copy'}
                </motion.span>
              </AnimatePresence>
            </button>
          )}
        </span>
      </div>
      <div className="code__body">
        <pre className="code__pre">
          {activeLine != null && (
            <motion.span
              aria-hidden="true"
              className="code__playhead"
              initial={false}
              animate={{ y: `${(activeLine - 1) * 1.7}em` }}
              transition={spring.layout}
            />
          )}
          {lines.map((node, i) => (
            <span key={i} className={`code__line${activeLine === i + 1 ? ' is-active' : ''}`}>
              {lineNumbers && (
                <span className="code__ln" aria-hidden="true">
                  {i + 1}
                </span>
              )}
              <span className="code__src">{node}</span>
              {'\n'}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
