import React, { useState, useEffect } from 'react';
import './landing.css';

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
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

export default function Landing() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Restore theme on mount
  useEffect(() => {
    const saved = (localStorage.getItem('aqvl-docs-theme') ?? 'dark') as 'light' | 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aqvl-docs-theme', next);
  };

  return (
    <div className="landing-root" data-theme={theme}>
      <div className="landing-topbar">
        <button className="ide-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <div className="landing-content">
        <div className="landing-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        
        <h1 className="landing-title">AQVL</h1>
        <p className="landing-subtitle">
          AlgoQuest Visualization Language — transforming algorithms and data structures into interactive 3D visualizations through a dedicated, easy-to-learn language.
        </p>

        <div className="landing-cards">
          {/* Playground */}
          <a href="#/playground" className="landing-card">
            <div className="landing-card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
            <h2 className="landing-card-title">Playground</h2>
            <p className="landing-card-desc">
              Intended for teachers and students. A simplified environment providing an editor, execution controls, and the 3D visualization canvas without exposing compiler internals.
            </p>
            <div className="landing-card-link">
              Open Playground
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </a>

          {/* Developer IDE */}
          <a href="#/ide" className="landing-card">
            <div className="landing-card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h2 className="landing-card-title">Developer IDE</h2>
            <p className="landing-card-desc">
              Intended for professors, mentors and developers. Full access to the compiler pipeline, Tokens, AST, Expanded AST, AQIR, and advanced Runtime Inspector debugging tools.
            </p>
            <div className="landing-card-link">
              Launch IDE
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </a>

          {/* Documentation */}
          <a href="#/docs" className="landing-card">
            <div className="landing-card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <h2 className="landing-card-title">Documentation</h2>
            <p className="landing-card-desc">
              Intended for anyone wanting to learn AQVL. Comprehensive language documentation covering data structures, syntax guides, examples, and detailed tutorials.
            </p>
            <div className="landing-card-link">
              Read Docs
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
