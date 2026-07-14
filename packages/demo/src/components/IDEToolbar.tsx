import React from 'react';

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

interface IDEToolbarProps {
  onCompile: () => void;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  onStop: () => void;
  isPlaying: boolean;
  canRun: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function IDEToolbar({
  onCompile,
  onRun,
  onPause,
  onResume,
  onStep,
  onReset,
  onStop,
  isPlaying,
  canRun,
  theme,
  onToggleTheme,
}: IDEToolbarProps) {
  return (
    <div className="ide-toolbar">

      {/* ── AQVL Logo ─────────────────────────────────────── */}
      <a href="#/" className="ide-logo" style={{ textDecoration: 'none' }}>
        <div className="ide-logo-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
            <line x1="12" y1="22" x2="12" y2="15.5" />
            <polyline points="22 8.5 12 15.5 2 8.5" />
          </svg>
        </div>
        <span className="ide-logo-wordmark">AQVL</span>
        <span className="ide-logo-badge">IDE</span>
      </a>

      <div className="ide-toolbar-sep" />

      {/* ── Compile ────────────────────────────────────────── */}
      <button className="primary" onClick={onCompile} title="Compile (Ctrl+Enter)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        Compile
      </button>

      <div className="ide-toolbar-sep" />

      {/* ── Playback Controls ──────────────────────────────── */}
      {!isPlaying ? (
        <button onClick={onRun} disabled={!canRun} title="Run animation">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          {canRun ? 'Run / Resume' : 'Run'}
        </button>
      ) : (
        <button onClick={onPause} title="Pause animation">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          Pause
        </button>
      )}

      <button onClick={onStep} disabled={!canRun} title="Step one instruction">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
        Step
      </button>

      <button onClick={onReset} disabled={!canRun} title="Reset to start">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
        </svg>
        Reset
      </button>

      <button onClick={onStop} disabled={!canRun} title="Stop and reset">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
        Stop
      </button>

      <div className="ide-toolbar-spacer" />

      {/* ── Status chip ───────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        background: canRun ? 'var(--success-soft)' : 'var(--accent-soft)',
        border: `1px solid ${canRun ? 'var(--success-border)' : 'var(--accent-border)'}`,
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 600,
        color: canRun ? 'var(--success)' : 'var(--accent)',
        letterSpacing: '0.03em',
        fontFamily: 'var(--font-ui)',
        transition: 'all 0.2s ease',
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'currentColor',
          flexShrink: 0,
          animation: canRun && isPlaying ? 'pulseGreen 1.5s ease-in-out infinite' : 'none',
        }} />
        {isPlaying ? 'Running' : canRun ? 'Ready' : 'Not Compiled'}
      </div>

      <div className="ide-toolbar-sep" />

      {/* ── Theme Toggle ──────────────────────────────────── */}
      <button
        className="ide-theme-btn"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

    </div>
  );
}
