import React from 'react';
import type { StageTheme } from '@aqvl/renderer';
import { STAGE_PALETTES } from '@aqvl/renderer';
import type { EventTone } from './events';
import { ToneGlyph } from './ToneGlyph';

const ROWS: { state: keyof (typeof STAGE_PALETTES)['dark']['states']; tone: EventTone; name: string; cue: string }[] = [
  { state: 'NEUTRAL', tone: 'neutral', name: 'Idle', cue: 'rests on the floor' },
  { state: 'EVALUATING', tone: 'compare', name: 'Compared', cue: 'the pair rises, the relation is written between them' },
  { state: 'MODIFYING', tone: 'mutate', name: 'Changed', cue: 'arcs across or is rewritten, one ripple on the floor' },
  { state: 'TRAVERSING', tone: 'visit', name: 'Visited', cue: 'lifts, a solid ring; a dot runs along the edge' },
  { state: 'AUXILIARY', tone: 'mark', name: 'Marked', cue: 'a dashed ring underneath' },
  { state: 'SUCCESS', tone: 'settle', name: 'Settled', cue: 'turns matte and still, locks in with a ripple' },
  { state: 'DISCARDED', tone: 'discard', name: 'Ruled out', cue: 'shrinks, greyed and matte' },
];

/** What each colour means, and the shape or motion that says the same thing without colour. */
export function Legend({ theme, id }: { theme: StageTheme; id: string }) {
  const palette = STAGE_PALETTES[theme];
  return (
    <aside className="vz-panel vz-legend" id={id} aria-label="Legend">
      <h3 className="vz-panel__title">Key</h3>
      <ul>
        {ROWS.map((r) => (
          <li key={r.state}>
            <span className="vz-legend__swatch" style={{ background: palette.states[r.state].body, color: palette.states[r.state].text }}>
              <ToneGlyph tone={r.tone} size={11} />
            </span>
            <span className="vz-legend__name">{r.name}</span>
            <span className="vz-legend__cue">{r.cue}</span>
          </li>
        ))}
      </ul>
      <p className="vz-legend__keys">
        <kbd>Space</kbd> play · <kbd>←</kbd>
        <kbd>→</kbd> step · <kbd>Home</kbd>/<kbd>End</kbd> · <kbd>[</kbd>
        <kbd>]</kbd> speed · <kbd>C</kbd> calm · <kbd>F</kbd> follow
      </p>
    </aside>
  );
}
