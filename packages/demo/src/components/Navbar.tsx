import React from 'react';

/* ── Icons ──────────────────────────────────────────────────── */
const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const BookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const LogoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

/* ── Navbar Props ────────────────────────────────────────────── */
interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

/* ══════════════════════════════════════════════════════════════
   Navbar Component
═══════════════════════════════════════════════════════════════ */
export function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const isDark = theme === 'dark';

  return (
    <nav className="nb-navbar" data-theme={theme}>
      {/* ── Left: Logo ── */}
      <div className="nb-navbar-left">
        <a href="#/" className="nb-logo" aria-label="AQVL Home">
          <div className="nb-logo-icon">
            <LogoIcon />
          </div>
          <div className="nb-logo-text">
            <span className="nb-logo-wordmark">AQVL</span>
            <span className="nb-logo-domain-badge">DSA</span>
          </div>
        </a>

        <div className="nb-nav-sep" />

        {/* Domain switcher */}
        <div className="nb-domain-tabs" role="tablist" aria-label="Product domains">
          <a
            href="#/"
            className="nb-domain-tab nb-domain-tab--active"
            role="tab"
            aria-selected="true"
            id="nav-tab-dsa"
          >
            <span className="nb-domain-tab-dot" />
            DSA
          </a>

          <button
            className="nb-domain-tab nb-domain-tab--soon"
            role="tab"
            aria-selected="false"
            aria-disabled="true"
            id="nav-tab-aiml"
            disabled
            title="Coming Soon"
          >
            AI / ML
            <span className="nb-soon-pill">Soon</span>
          </button>

          <button
            className="nb-domain-tab nb-domain-tab--soon"
            role="tab"
            aria-selected="false"
            aria-disabled="true"
            id="nav-tab-blockchain"
            disabled
            title="Coming Soon"
          >
            Blockchain
            <span className="nb-soon-pill">Soon</span>
          </button>
        </div>
      </div>

      {/* ── Right: CTAs + Theme ── */}
      <div className="nb-navbar-right">
        <a href="#/playground" className="nb-nav-btn nb-nav-btn--playground" id="nav-btn-playground">
          <PlayIcon />
          <span>Playground</span>
        </a>

        <a href="#/docs" className="nb-nav-btn nb-nav-btn--docs" id="nav-btn-docs">
          <BookIcon />
          <span>Documentation</span>
        </a>

        <div className="nb-nav-sep" />

        <button
          className="nb-theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          id="nav-btn-theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </nav>
  );
}
