/**
 * CodePanel — the live code-highlight panel.
 *
 * Connects real VM execution state to a visible line of source code. The
 * gap this closes: `ExecutionEngine.execute()` (packages/runtime/src/core/
 * ExecutionEngine.ts) already dispatches `INSTRUCTION_START` with the
 * program counter of the instruction about to run, and the compiler
 * (packages/compiler/src/aqir/generator.ts) already stamps most emitted
 * instructions with `lineNumber` (1-based, into the original .aqvl source).
 * Nothing previously read that pairing to drive a UI — `CodeToVizSection.tsx`
 * in packages/demo is a hardcoded, scripted typing animation for the
 * marketing site, unrelated to real execution. This component is the real
 * consumer: it subscribes to the engine's own events and highlights
 * whichever source line the VM is actually on.
 *
 * Usage: <CodePanel source={aqvlSourceText} engine={executionEngine} />
 * `engine` only needs `eventDispatcher`, `on/off('INSTRUCTION_START', ...)`,
 * and the loaded program's `instructions` array — see `ActiveLineSource`.
 */
import React, { useEffect, useRef, useState } from 'react';

/** An instruction as the compiler/runtime already produce it — only the field this panel needs. */
interface LineNumberedInstruction {
  lineNumber?: number;
}

/**
 * The minimal surface CodePanel needs from an ExecutionEngine: its event
 * dispatcher (for `INSTRUCTION_START`, payload = program counter) and the
 * loaded program's instruction list (to resolve a pc to a source line).
 * Typed structurally rather than importing `ExecutionEngine` directly so
 * this component doesn't force every caller onto the full runtime API.
 */
export interface ActiveLineSource {
  eventDispatcher: {
    on(event: 'INSTRUCTION_START', handler: (pc: number) => void): void;
    off(event: 'INSTRUCTION_START', handler: (pc: number) => void): void;
  };
  getProgramInstructions(): ReadonlyArray<LineNumberedInstruction> | null;
}

/** Subscribes to the engine's real step stream and resolves it to a 1-based source line, or null when unknown (no lineNumber on the current instruction, or nothing loaded yet). */
export function useActiveLine(engine: ActiveLineSource | null | undefined): number | null {
  const [activeLine, setActiveLine] = useState<number | null>(null);

  useEffect(() => {
    if (!engine) {
      setActiveLine(null);
      return;
    }
    const handler = (pc: number) => {
      const instructions = engine.getProgramInstructions();
      const lineNumber = instructions?.[pc]?.lineNumber;
      setActiveLine(typeof lineNumber === 'number' ? lineNumber : null);
    };
    engine.eventDispatcher.on('INSTRUCTION_START', handler);
    return () => engine.eventDispatcher.off('INSTRUCTION_START', handler);
  }, [engine]);

  return activeLine;
}

export interface CodePanelProps {
  /** The .aqvl source text being executed, exactly as compiled (line numbers must line up 1:1). */
  source: string;
  /** The engine driving execution. Pass null/undefined before a program is loaded — the panel renders with no line highlighted. */
  engine: ActiveLineSource | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders `source` as a line-numbered code block with a moving playhead
 * indicator — a soft glow bar that leads the eye to the active line, plus a
 * background wash on that line, rather than a single flat flash. The
 * indicator's vertical position is CSS-transitioned, so it visibly travels
 * between lines instead of jumping, and re-centers the active line into
 * view when it changes.
 */
export const CodePanel: React.FC<CodePanelProps> = ({ source, engine, className, style }) => {
  const activeLine = useActiveLine(engine);
  const lines = source.split('\n');
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeLine == null) return;
    const el = lineRefs.current[activeLine - 1];
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeLine]);

  const playheadTop = activeLine != null ? (activeLine - 1) * LINE_HEIGHT_PX : 0;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        fontFamily: "'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
        fontSize: 13,
        lineHeight: `${LINE_HEIGHT_PX}px`,
        background: '#0f172a',
        color: '#cbd5e1',
        overflowY: 'auto',
        borderRadius: 8,
        padding: '8px 0',
        ...style,
      }}
    >
      {activeLine != null && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: playheadTop + 8,
            height: LINE_HEIGHT_PX,
            background: 'linear-gradient(90deg, rgba(56,189,248,0.22), rgba(56,189,248,0.04) 70%)',
            borderLeft: '3px solid #38bdf8',
            boxShadow: '0 0 12px 2px rgba(56,189,248,0.45)',
            transition: 'top 160ms cubic-bezier(0.22, 1, 0.36, 1)',
            pointerEvents: 'none',
          }}
        />
      )}
      {lines.map((line, i) => {
        const lineNumber = i + 1;
        const isActive = lineNumber === activeLine;
        return (
          <div
            key={lineNumber}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            style={{
              position: 'relative',
              display: 'flex',
              padding: '0 12px',
              whiteSpace: 'pre',
              color: isActive ? '#f1f5f9' : undefined,
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <span style={{ display: 'inline-block', width: 32, textAlign: 'right', marginRight: 12, color: '#475569', userSelect: 'none' }}>
              {lineNumber}
            </span>
            <span>{line.length > 0 ? line : ' '}</span>
          </div>
        );
      })}
    </div>
  );
};

const LINE_HEIGHT_PX = 20;
