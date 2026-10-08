import { useSyncExternalStore } from 'react';
import type { QualityTier } from '@aqvl/renderer';

/**
 * What the visitor chose to keep: how the 3D stage is drawn and how the
 * Playground is laid out. Stored in the browser only; the world theme has
 * its own store (lib/world.ts).
 */
export interface Settings {
  /** 'auto': the tier the device suggests, dropping when frames run long. */
  quality: 'auto' | QualityTier;
  /** 'auto': follow the OS "reduce motion" setting. */
  calm: 'auto' | 'on' | 'off';
  /** The camera follows the action. */
  follow: boolean;
  /** Snowfall over the pages of the penguin world. */
  snow: boolean;
  /** Penguin mascots on the pages of the penguin world. */
  mascots: boolean;
  /** The Playground hides the editor to give the stage the whole width. */
  focusStage: boolean;
  /** The panel last open beside the stage (null: closed). */
  dock: DockTab | null;
  /** Narrate the run aloud (off until asked: it needs a user gesture and may download a voice). */
  voiceOn: boolean;
  /** full: every step; key: the steps that matter; manual: only when asked. */
  voiceMode: VoiceMode;
  /** neural: Piper in the browser (falling back to the browser's voice); browser: the built-in voice only. */
  voiceEngine: 'neural' | 'browser';
}

export type VoiceMode = 'full' | 'key' | 'manual';

export type DockTab = 'watch' | 'key' | 'output' | 'stage';

export const DEFAULT_SETTINGS: Settings = {
  quality: 'auto',
  calm: 'auto',
  follow: true,
  snow: true,
  mascots: true,
  focusStage: false,
  dock: null,
  voiceOn: false,
  voiceMode: 'key',
  voiceEngine: 'neural',
};

const KEY = 'aqvl-settings';
const listeners = new Set<() => void>();
let current: Settings | null = null;

function read(): Settings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...sanitize(parsed) };
    }
  } catch {
    /* fall through to the defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

function sanitize(p: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (p.quality === 'auto' || p.quality === 'high' || p.quality === 'medium' || p.quality === 'low') out.quality = p.quality;
  if (p.calm === 'auto' || p.calm === 'on' || p.calm === 'off') out.calm = p.calm;
  for (const key of ['follow', 'snow', 'mascots', 'focusStage', 'voiceOn'] as const) if (typeof p[key] === 'boolean') out[key] = p[key];
  if (p.dock === null || p.dock === 'watch' || p.dock === 'key' || p.dock === 'output' || p.dock === 'stage') out.dock = p.dock;
  if (p.voiceMode === 'full' || p.voiceMode === 'key' || p.voiceMode === 'manual') out.voiceMode = p.voiceMode;
  if (p.voiceEngine === 'neural' || p.voiceEngine === 'browser') out.voiceEngine = p.voiceEngine;
  return out;
}

export function getSettings(): Settings {
  if (!current) current = read();
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* kept for this visit only */
  }
  applyAttributes(current);
  listeners.forEach((l) => l());
}

export function resetSettings() {
  updateSettings({ ...DEFAULT_SETTINGS });
}

/** Snow and mascots are switched by attributes on <html> so plain CSS can follow them. */
export function applyAttributes(s: Settings = getSettings()) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-snow', s.snow ? 'on' : 'off');
  root.setAttribute('data-mascots', s.mascots ? 'on' : 'off');
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
}
