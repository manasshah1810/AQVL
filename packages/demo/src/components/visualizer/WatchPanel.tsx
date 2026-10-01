import React from 'react';
import type { TraceFrame } from '@aqvl/runtime';

function show(v: number | string | boolean): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `"${v}"`;
}

/**
 * The program's own state at this step: every simple variable (the ones
 * this step changed are marked), and the call stack, innermost on top.
 */
export function WatchPanel({ frame, previous }: { frame: TraceFrame; previous: TraceFrame | undefined }) {
  const vars = Object.entries(frame.vars);
  const stack = [...frame.callStack].reverse();
  if (vars.length === 0 && stack.length === 0) return null;
  return (
    <aside className="vz-panel vz-watch" aria-label="Variables and call stack">
      {vars.length > 0 && (
        <>
          <h3 className="vz-panel__title">Variables</h3>
          <dl className="vz-vars">
            {vars.map(([name, value]) => {
              const changed = previous !== undefined && previous.vars[name] !== value;
              return (
                <div key={name} className={`vz-var${changed ? ' is-changed' : ''}`}>
                  <dt>{name}</dt>
                  <dd>
                    {show(value)}
                    {changed && previous!.vars[name] !== undefined && (
                      <span className="vz-var__was">
                        <span className="sr-only">, was </span>
                        <span aria-hidden="true">← </span>
                        {show(previous!.vars[name])}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
      {stack.length > 0 && (
        <>
          <h3 className="vz-panel__title">Call stack</h3>
          <ol className="vz-stack">
            {stack.slice(0, 12).map((call, i) => (
              <li key={`${stack.length - i}-${call}`} className={i === 0 ? 'is-top' : undefined}>
                {call}
              </li>
            ))}
            {stack.length > 12 && <li className="vz-stack__more">{stack.length - 12} more</li>}
          </ol>
        </>
      )}
    </aside>
  );
}
