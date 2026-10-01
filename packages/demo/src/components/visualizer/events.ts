import type { TraceEventKind } from '@aqvl/runtime';
import { STAGE_PALETTES, type StageTheme } from '@aqvl/renderer';

/** The colour family an event belongs to (the same families the 3D scene uses). */
export type EventTone = 'compare' | 'mutate' | 'visit' | 'settle' | 'discard' | 'mark' | 'neutral';

export const EVENT_META: Record<TraceEventKind, { label: string; tone: EventTone }> = {
  init: { label: 'Start', tone: 'neutral' },
  compare: { label: 'Compare', tone: 'compare' },
  swap: { label: 'Swap', tone: 'mutate' },
  write: { label: 'Write', tone: 'mutate' },
  link: { label: 'Re-link', tone: 'mutate' },
  move: { label: 'Move', tone: 'neutral' },
  create: { label: 'Create', tone: 'mutate' },
  remove: { label: 'Remove', tone: 'mutate' },
  traverse: { label: 'Traverse', tone: 'visit' },
  visit: { label: 'Visit', tone: 'visit' },
  settle: { label: 'Settle', tone: 'settle' },
  discard: { label: 'Rule out', tone: 'discard' },
  mark: { label: 'Mark', tone: 'mark' },
  call: { label: 'Call', tone: 'visit' },
  return: { label: 'Return', tone: 'visit' },
  print: { label: 'Print', tone: 'neutral' },
  assign: { label: 'Assign', tone: 'neutral' },
  layout: { label: 'Layout', tone: 'neutral' },
  camera: { label: 'Camera', tone: 'neutral' },
  hold: { label: 'Wait', tone: 'neutral' },
  none: { label: 'Step', tone: 'neutral' },
};

const TONE_STATE = {
  compare: 'EVALUATING',
  mutate: 'MODIFYING',
  visit: 'TRAVERSING',
  settle: 'SUCCESS',
  discard: 'DISCARDED',
  mark: 'AUXILIARY',
  neutral: 'NEUTRAL',
} as const;

/** The colour of a tone in the given theme (state colours come from the 3D palette, so UI and scene agree). */
export function toneColor(tone: EventTone, theme: StageTheme): string {
  const p = STAGE_PALETTES[theme];
  return tone === 'neutral' ? p.plate : p.states[TONE_STATE[tone]].body;
}

/** A chip filled with the tone's colour, with the text colour that passes AA on it. */
export function toneChip(tone: EventTone, theme: StageTheme): { background: string; color: string } {
  const state = STAGE_PALETTES[theme].states[TONE_STATE[tone]];
  return { background: state.body, color: state.text };
}
