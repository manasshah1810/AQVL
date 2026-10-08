import React, { useEffect, useId, useRef, useState } from 'react';
import { updateSettings, useSettings, type VoiceMode } from '../../lib/settings';
import { THEME_VOICES, useVoiceStatus, type VoiceTheme } from '../../lib/voice';
import './voice.css';

const MODES: { id: VoiceMode; label: string; hint: string }[] = [
  { id: 'key', label: 'Key steps', hint: 'Swaps, writes, calls, results and errors' },
  { id: 'full', label: 'Full explanation', hint: 'Every step, compares included' },
  { id: 'manual', label: 'Manual', hint: 'Only when you press Explain' },
];

const GlyphVoice = ({ on }: { on: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 6.2h2.2L8 3.4v9.2L4.7 9.8H2.5z" fill="currentColor" fillOpacity={on ? 0.9 : 0} />
    {on ? <path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8M12.2 3.8a6 6 0 0 1 0 8.4" /> : <path d="M10.6 6l3 4M13.6 6l-3 4" />}
  </svg>
);

export interface VoiceControlProps {
  theme: VoiceTheme;
  /** The sentence for the current step (shown as the Explain button's tooltip). */
  onExplain: () => void;
}

/** Voice on / off, the narration mode, an Explain button for manual mode, and a status line. */
export function VoiceControl({ theme, onExplain }: VoiceControlProps) {
  const settings = useSettings();
  const status = useVoiceStatus();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const { voiceOn, voiceMode, voiceEngine } = settings;
  const speaking = status.phase === 'speaking';
  const preparing = status.phase === 'preparing';
  const percent = status.progress !== null ? Math.round(status.progress * 100) : null;
  const line = preparing
    ? percent !== null && percent < 100
      ? `Downloading the ${THEME_VOICES[theme].label} voice… ${percent}%`
      : 'Getting the voice ready…'
    : (status.note ?? (speaking ? `${THEME_VOICES[theme].label} is speaking` : `${THEME_VOICES[theme].label} voice`));

  return (
    <div className="vz-voice" ref={rootRef}>
      {voiceOn && voiceMode === 'manual' && (
        <button type="button" className="vz-voice__explain" onClick={onExplain} title="Explain this step aloud">
          Explain
        </button>
      )}
      <button
        type="button"
        className={`vz-voice__toggle${voiceOn ? ' is-on' : ''}${speaking ? ' is-speaking' : ''}`}
        aria-pressed={voiceOn}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (!voiceOn) updateSettings({ voiceOn: true });
          setOpen((o) => !o);
        }}
        title="Voiceover"
      >
        <GlyphVoice on={voiceOn} />
        <span className="vz-voice__label">Voice</span>
      </button>

      {open && (
        <div className="vz-voice__menu" id={menuId} role="dialog" aria-label="Voiceover">
          <label className="vz-voice__row">
            <span>Voiceover</span>
            <input type="checkbox" checked={voiceOn} onChange={(e) => updateSettings({ voiceOn: e.target.checked })} />
          </label>

          <div className="vz-voice__modes" role="radiogroup" aria-label="Narration mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={voiceMode === m.id}
                className={`vz-voice__mode${voiceMode === m.id ? ' is-on' : ''}`}
                onClick={() => updateSettings({ voiceMode: m.id })}
              >
                <b>{m.label}</b>
                <small>{m.hint}</small>
              </button>
            ))}
          </div>

          <label className="vz-voice__row">
            <span>Voice engine</span>
            <select value={voiceEngine} onChange={(e) => updateSettings({ voiceEngine: e.target.value as 'neural' | 'browser' })}>
              <option value="neural">Piper (local neural)</option>
              <option value="browser">Browser voice</option>
            </select>
          </label>

          <p className="vz-voice__status" role="status">
            {line}
          </p>
        </div>
      )}
    </div>
  );
}
