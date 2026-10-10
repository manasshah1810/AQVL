import React, { useEffect, useMemo, useState } from 'react';
import { Reorder } from 'motion/react';
import { IDEEditor, type EditorErrorMarker } from '../../../components/IDEEditor';
import { CodeView } from './CodeView';
import { writeScaffold } from './modes';
import {
  blankAnswers,
  bugLine,
  buggyTemplate,
  fillSlots,
  fixedTemplate,
  gappedTemplate,
  indentLines,
  shuffled,
  shuffleLines,
  splitCore,
  withBlanks,
  withCore,
} from './program';
import type { WorkState } from './hints';
import type { Input, Kernel } from './types';

/**
 * The four ways to complete an algorithm. Each shows the program with the
 * current test's data in it and reports the program it would run (with input
 * slots still in place), or null while it is not complete.
 */
export interface WorkspaceProps {
  kernel: Kernel;
  /** The input whose values appear in the code on screen. */
  displayInput: Input;
  /** The program line the stage is on. */
  activeLine: number | null;
  onTemplate: (template: string | null) => void;
  /** Hears what the workspace holds (the hints read it). */
  onState?: (state: WorkState) => void;
}

const PLACEHOLDER = '___';

/* ── A. Fill the Blank ─────────────────────────────────────────────────── */

export function FillBlank({ kernel, displayInput, activeLine, onTemplate, onState }: WorkspaceProps) {
  const answers = useMemo(() => blankAnswers(kernel), [kernel]);
  const options = useMemo(() => kernel.blanks.map((wrong, i) => shuffled([answers[i], ...wrong], `${kernel.id}:${i}`)), [kernel, answers]);
  const [picks, setPicks] = useState<(string | null)[]>(() => answers.map(() => null));

  useEffect(() => {
    onTemplate(picks.every((p) => p !== null) ? withBlanks(kernel, picks as string[]) : null);
    onState?.({ mode: 'blank', picks });
  }, [picks, kernel, onTemplate, onState]);

  const code = fillSlots(gappedTemplate(kernel), displayInput);
  return (
    <div className="ch-ws">
      <p className="ch-ws__ask">
        Pick the right piece for {answers.length === 1 ? 'the gap' : `each of the ${answers.length} gaps`}, then press <span className="ic">Run</span>.
      </p>
      <CodeView
        code={code}
        activeLine={activeLine}
        label="Program with gaps"
        renderGap={(i) => (
          <select
            className={`ch-gap${picks[i] === null ? ' is-empty' : ''}`}
            aria-label={`Gap ${i + 1}`}
            value={picks[i] ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setPicks((prev) => prev.map((p, k) => (k === i ? (v === '' ? null : v) : p)));
            }}
          >
            <option value="">{PLACEHOLDER}</option>
            {options[i].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      />
    </div>
  );
}

/* ── B. Assemble the Steps ─────────────────────────────────────────────── */

interface Tile {
  key: string;
  text: string;
}

export function Assemble({ kernel, displayInput, activeLine, onTemplate, onState }: WorkspaceProps) {
  const split = useMemo(() => splitCore(kernel), [kernel]);
  const [tiles, setTiles] = useState<Tile[]>(() =>
    shuffleLines(
      split.core.map((l, i) => `${i}\u0000${l.trim()}`),
      kernel.id,
    ).map((k) => {
      const [key, text] = k.split('\u0000');
      return { key, text };
    }),
  );
  const indented = indentLines(
    tiles.map((t) => t.text),
    split.indent,
  );

  useEffect(() => {
    onTemplate(withCore(kernel, indented.join('\n')));
    onState?.({ mode: 'order', lines: tiles.map((t) => t.text) });
  }, [indented.join('\n'), kernel, onTemplate, onState]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (from: number, to: number) => {
    if (to < 0 || to >= tiles.length) return;
    setTiles((prev) => {
      const next = [...prev];
      const [t] = next.splice(from, 1);
      next.splice(to, 0, t);
      return next;
    });
  };

  const firstCore = split.before.length + 1;
  return (
    <div className="ch-ws">
      <p className="ch-ws__ask">
        The {tiles.length} lines of the core are shuffled. Drag them (or use the arrows) into the right order; blocks indent as you go.
      </p>
      <CodeView code={fillSlots(split.before.join('\n'), displayInput)} activeLine={activeLine} dim label="Fixed lines before the core" />
      <Reorder.Group axis="y" values={tiles} onReorder={setTiles} className="ch-tiles" aria-label="Core lines, in order">
        {tiles.map((t, i) => (
          <Reorder.Item key={t.key} value={t} className={`ch-tile${activeLine === firstCore + i ? ' is-active' : ''}`}>
            <span className="ch-tile__ln" aria-hidden="true">
              {firstCore + i}
            </span>
            <span className="ch-tile__grip" aria-hidden="true">
              ⋮⋮
            </span>
            <code className="ch-tile__src">{indented[i].slice(split.indent.length)}</code>
            <span className="ch-tile__moves">
              <button type="button" className="icon-btn ch-tile__btn" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move "${t.text}" up`}>
                ↑
              </button>
              <button type="button" className="icon-btn ch-tile__btn" onClick={() => move(i, i + 1)} disabled={i === tiles.length - 1} aria-label={`Move "${t.text}" down`}>
                ↓
              </button>
            </span>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <CodeView code={fillSlots(split.after.join('\n'), displayInput)} firstLine={firstCore + tiles.length} activeLine={activeLine} dim label="Fixed lines after the core" />
    </div>
  );
}

/* ── C. Spot the Bug ───────────────────────────────────────────────────── */

export interface SpotBugProps extends WorkspaceProps {
  /** The line was found (the runner can say so). */
  onFound?: () => void;
}

export function SpotBug({ kernel, displayInput, activeLine, onTemplate, onFound, onState }: SpotBugProps) {
  const target = bugLine(kernel) + 1;
  const fixes = useMemo(() => shuffled([kernel.bug.find, ...kernel.bug.fixes], `${kernel.id}:fix`), [kernel]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [found, setFound] = useState(false);
  const [fix, setFix] = useState<string | null>(null);

  useEffect(() => {
    onTemplate(found && fix !== null ? fixedTemplate(kernel, fix) : null);
    onState?.({ mode: 'bug', found, wrongPicks: wrong, fix });
  }, [found, fix, wrong, kernel, onTemplate, onState]);

  const pick = (line: number) => {
    if (found) return;
    if (line === target) {
      setFound(true);
      onFound?.();
    } else if (!wrong.includes(line)) setWrong((w) => [...w, line]);
  };

  const shown = fix !== null ? fixedTemplate(kernel, fix) : buggyTemplate(kernel);
  const marks: Record<number, 'wrong' | 'found'> = {};
  for (const w of wrong) marks[w] = 'wrong';
  if (found) marks[target] = 'found';

  return (
    <div className="ch-ws">
      <p className="ch-ws__ask" aria-live="polite">
        {!found
          ? wrong.length === 0
            ? 'One line of this program is wrong. Watch the stage misbehave, then click the faulty line.'
            : `Line ${wrong[wrong.length - 1]} is fine. Watch the stage again: where does it first go wrong?`
          : 'Found it. Now pick the fix for that line, then press Run.'}
      </p>
      <CodeView code={fillSlots(shown, displayInput)} activeLine={activeLine} onPickLine={found ? undefined : pick} marks={marks} label="Program with one bug" />
      {found && (
        <fieldset className="ch-fixes">
          <legend className="mono muted">Fix line {target}</legend>
          {fixes.map((f) => (
            <label key={f} className={`ch-fix${fix === f ? ' is-on' : ''}`}>
              <input type="radio" name={`fix-${kernel.id}`} value={f} checked={fix === f} onChange={() => setFix(f)} />
              <code>{f.trim()}</code>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

/* ── D. Write the Core ─────────────────────────────────────────────────── */

export interface WriteCoreProps extends WorkspaceProps {
  /** Compile errors, as program lines (mapped into the editor here). */
  errorMarkers?: EditorErrorMarker[];
}

export function WriteCore({ kernel, displayInput, activeLine, onTemplate, onState, errorMarkers = [] }: WriteCoreProps) {
  const split = useMemo(() => splitCore(kernel), [kernel]);
  const [text, setText] = useState(() => writeScaffold(kernel));

  useEffect(() => {
    onTemplate(withCore(kernel, text));
    onState?.({ mode: 'write', text });
  }, [text, kernel, onTemplate, onState]);

  const offset = split.before.length;
  const lineCount = text.replace(/\s+$/, '').split('\n').length;
  const editorLine = (line: number) => Math.min(Math.max(1, line - offset), lineCount);
  const markers = errorMarkers.map((m) => ({ ...m, line: editorLine(m.line) }));
  const inCore = activeLine !== null && activeLine > offset && activeLine <= offset + lineCount ? activeLine - offset : null;

  return (
    <div className="ch-ws">
      <p className="ch-ws__ask">Write the core in AQVL. The lines above and below stay as they are; your code is graded by running it.</p>
      <CodeView code={fillSlots(split.before.join('\n'), displayInput)} activeLine={activeLine} dim label="Fixed lines before the core" />
      <div className="ch-editor" style={{ height: `${Math.max(9, Math.min(22, lineCount + 3)) * 22 + 24}px` }}>
        <IDEEditor initialValue={text} onChange={setText} errorMarkers={markers} activeLine={inCore} />
      </div>
      <CodeView code={fillSlots(split.after.join('\n'), displayInput)} firstLine={offset + lineCount + 1} activeLine={activeLine} dim label="Fixed lines after the core" />
    </div>
  );
}
