import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  EXAMPLES,
  EXAMPLE_CATEGORIES,
  getExamplesByCategory,
  type Example,
  type ExampleCategory,
} from '../examples/registry';

// ── Category Metadata ─────────────────────────────────────────────────────────

interface CategoryMeta {
  icon: React.ReactNode;
  color: string;
  accent: string;
  glow: string;
  description: string;
  pattern: React.ReactNode;
}

const CATEGORY_META: Record<ExampleCategory, CategoryMeta> = {
  'Sorting': {
    color: '#6366f1',
    accent: 'rgba(99,102,241,0.15)',
    glow: 'rgba(99,102,241,0.35)',
    description: 'Ordering elements efficiently',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="15" y2="12"/>
        <line x1="3" y1="18" x2="9" y2="18"/>
        <polyline points="17 16 21 12 17 8"/>
      </svg>
    ),
    pattern: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
        {[12,20,35,55,80,100].map((h,i) => (
          <rect key={i} x={8 + i*18} y={80-h} width="12" height={h} rx="3"
            fill={`rgba(99,102,241,${0.08 + i*0.05})`}
            stroke="rgba(99,102,241,0.25)" strokeWidth="1"/>
        ))}
        <path d="M14 56 L32 32 L50 42 L68 20 L86 28 L104 8"
          stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" fill="none" strokeDasharray="3 2"/>
      </svg>
    ),
  },
  'Linked Lists': {
    color: '#10b981',
    accent: 'rgba(16,185,129,0.15)',
    glow: 'rgba(16,185,129,0.35)',
    description: 'Chains of connected nodes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="12" r="3"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <path d="M15 10.5 L17 12 L15 13.5"/>
      </svg>
    ),
    pattern: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
        {[20,50,80].map((x,i) => (
          <g key={i}>
            <rect x={x-10} y="28" width="20" height="24" rx="4"
              fill={`rgba(16,185,129,${0.08 + i*0.04})`}
              stroke="rgba(16,185,129,0.3)" strokeWidth="1"/>
            <text x={x} y="44" textAnchor="middle" fill="rgba(16,185,129,0.6)" fontSize="10" fontFamily="monospace">{i+1}</text>
          </g>
        ))}
        {[30,62].map((x,i) => (
          <g key={i}>
            <line x1={x} y1="40" x2={x+8} y2="40" stroke="rgba(16,185,129,0.4)" strokeWidth="1.5"/>
            <path d={`M ${x+6} 37 L ${x+10} 40 L ${x+6} 43`} stroke="rgba(16,185,129,0.4)" strokeWidth="1.5" fill="none"/>
          </g>
        ))}
        <circle cx="105" cy="40" r="6" fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="1" strokeDasharray="2 1"/>
        <text x="105" y="44" textAnchor="middle" fill="rgba(16,185,129,0.35)" fontSize="8">∅</text>
      </svg>
    ),
  },
  'Trees': {
    color: '#f59e0b',
    accent: 'rgba(245,158,11,0.15)',
    glow: 'rgba(245,158,11,0.35)',
    description: 'Hierarchical structures',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="2"/>
        <circle cx="6" cy="16" r="2"/>
        <circle cx="18" cy="16" r="2"/>
        <circle cx="12" cy="16" r="2"/>
        <line x1="12" y1="6" x2="6" y2="14"/>
        <line x1="12" y1="6" x2="12" y2="14"/>
        <line x1="12" y1="6" x2="18" y2="14"/>
      </svg>
    ),
    pattern: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
        <circle cx="60" cy="14" r="8" fill="rgba(245,158,11,0.12)" stroke="rgba(245,158,11,0.4)" strokeWidth="1.5"/>
        <line x1="52" y1="19" x2="36" y2="39" stroke="rgba(245,158,11,0.25)" strokeWidth="1"/>
        <line x1="60" y1="22" x2="60" y2="40" stroke="rgba(245,158,11,0.25)" strokeWidth="1"/>
        <line x1="68" y1="19" x2="84" y2="39" stroke="rgba(245,158,11,0.25)" strokeWidth="1"/>
        {[36,60,84].map((x,i) => (
          <circle key={i} cx={x} cy="46" r="7" fill="rgba(245,158,11,0.1)" stroke="rgba(245,158,11,0.3)" strokeWidth="1"/>
        ))}
        {[28,44,76,92].map((x,i) => (
          <circle key={i} cx={x} cy="68" r="5" fill="rgba(245,158,11,0.07)" stroke="rgba(245,158,11,0.2)" strokeWidth="1"/>
        ))}
        <line x1="30" y1="53" x2="28" y2="63" stroke="rgba(245,158,11,0.2)" strokeWidth="1"/>
        <line x1="42" y1="53" x2="44" y2="63" stroke="rgba(245,158,11,0.2)" strokeWidth="1"/>
        <line x1="76" y1="53" x2="76" y2="63" stroke="rgba(245,158,11,0.2)" strokeWidth="1"/>
        <line x1="92" y1="53" x2="92" y2="63" stroke="rgba(245,158,11,0.2)" strokeWidth="1"/>
      </svg>
    ),
  },
  'Searching': {
    color: '#ec4899',
    accent: 'rgba(236,72,153,0.15)',
    glow: 'rgba(236,72,153,0.35)',
    description: 'Finding the needle in a haystack',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="6"/>
        <line x1="21" y1="21" x2="15" y2="15"/>
      </svg>
    ),
    pattern: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
        {[10,26,42,58,74,90,106].map((x,i) => (
          <rect key={i} x={x} y="28" width="12" height="24" rx="3"
            fill={i === 3 ? 'rgba(236,72,153,0.3)' : `rgba(236,72,153,${0.05 + i*0.02})`}
            stroke={i === 3 ? 'rgba(236,72,153,0.6)' : 'rgba(236,72,153,0.15)'}
            strokeWidth={i === 3 ? 1.5 : 1}/>
        ))}
        <circle cx="64" cy="18" r="9" fill="none" stroke="rgba(236,72,153,0.5)" strokeWidth="1.5" strokeDasharray="3 2">
          <animateTransform attributeName="transform" type="rotate" values="0 64 18;360 64 18" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="64" cy="18" r="3" fill="rgba(236,72,153,0.4)"/>
      </svg>
    ),
  },
  'Loops & Control': {
    color: '#8b5cf6',
    accent: 'rgba(139,92,246,0.15)',
    glow: 'rgba(139,92,246,0.35)',
    description: 'Iteration and flow control',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    ),
    pattern: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
        <path d="M20 40 Q35 15 60 40 Q85 65 100 40"
          stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" fill="none" strokeDasharray="4 2"/>
        <circle cx="20" cy="40" r="4" fill="rgba(139,92,246,0.3)" stroke="rgba(139,92,246,0.6)" strokeWidth="1"/>
        <circle cx="60" cy="40" r="4" fill="rgba(139,92,246,0.3)" stroke="rgba(139,92,246,0.6)" strokeWidth="1"/>
        <circle cx="100" cy="40" r="4" fill="rgba(139,92,246,0.3)" stroke="rgba(139,92,246,0.6)" strokeWidth="1"/>
        <path d="M58 26 L62 22 L66 26" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" fill="none"/>
        <path d="M58 54 L62 58 L66 54" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" fill="none"/>
        <rect x="45" y="6" width="30" height="16" rx="4" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="1"/>
        <text x="60" y="18" textAnchor="middle" fill="rgba(139,92,246,0.5)" fontSize="7">i &lt; n</text>
      </svg>
    ),
  },
};

// ── Difficulty Badge ───────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  Easy:   { label: 'Easy',   bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)',  text: '#10b981' },
  Medium: { label: 'Medium', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',  text: '#f59e0b' },
  Hard:   { label: 'Hard',   bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',   text: '#ef4444' },
};

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/>
    <line x1="21" y1="21" x2="16" y2="16"/>
  </svg>
);

const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── Props ──────────────────────────────────────────────────────────────────────

interface ExampleExplorerProps {
  activeSource: string;
  onSelect: (source: string) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ExampleExplorer({ activeSource, onSelect, onClose }: ExampleExplorerProps) {
  const [activeCategory, setActiveCategory] = useState<ExampleCategory | 'All'>(EXAMPLE_CATEGORIES[0]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [cardTransitionKey, setCardTransitionKey] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (query) setQuery('');
        else handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      requestAnimationFrame(() => {
        const editor = document.querySelector('.aqvl-editor-textarea') as HTMLTextAreaElement | null;
        if (editor) editor.focus();
      });
    };
  }, [query]);

  // When searching, switch to All
  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed && activeCategory !== 'All') {
      setActiveCategory('All');
    }
  }, [query]);

  const trimmedQuery = query.trim().toLowerCase();

  const filteredExamples = useMemo(() => {
    let list = EXAMPLES;
    if (activeCategory !== 'All') {
      list = list.filter(e => e.category === activeCategory);
    }
    if (trimmedQuery) {
      list = list.filter(e =>
        e.title.toLowerCase().includes(trimmedQuery) ||
        e.description.toLowerCase().includes(trimmedQuery)
      );
    }
    return list;
  }, [activeCategory, trimmedQuery]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(), 220);
  }, [onClose]);

  const handleCategoryChange = (cat: ExampleCategory | 'All') => {
    setActiveCategory(cat);
    setQuery('');
    setCardTransitionKey(k => k + 1);
  };

  const handleSelect = useCallback((example: Example) => {
    setSelectedId(example.id);
    setTimeout(() => {
      onSelect(example.source);
      setIsExiting(true);
      setTimeout(() => onClose(), 200);
    }, 280);
  }, [onSelect, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const renderTitle = (title: string) => {
    if (!trimmedQuery) return title;
    const idx = title.toLowerCase().indexOf(trimmedQuery);
    if (idx === -1) return title;
    return (
      <>
        {title.slice(0, idx)}
        <mark className="lp-match">{title.slice(idx, idx + trimmedQuery.length)}</mark>
        {title.slice(idx + trimmedQuery.length)}
      </>
    );
  };

  const currentMeta = activeCategory !== 'All' ? CATEGORY_META[activeCategory as ExampleCategory] : null;
  const totalCount = filteredExamples.length;

  return (
    <div
      className={`lp-backdrop${isExiting ? ' exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a lesson"
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        className={`lp-shell${isExiting ? ' exiting' : ''}`}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Left Sidebar ── */}
        <aside className="lp-sidebar">

          {/* Wordmark */}
          <div className="lp-sidebar-brand">
            <div className="lp-brand-dot" />
            <span className="lp-brand-label">Choose a Lesson</span>
          </div>

          {/* Category Nav */}
          <nav className="lp-cat-nav" aria-label="Categories">
            <button
              className={`lp-cat-item${activeCategory === 'All' ? ' active' : ''}`}
              onClick={() => handleCategoryChange('All')}
              data-color="#a1a1aa"
            >
              <span className="lp-cat-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </span>
              <span className="lp-cat-item-label">All Examples</span>
              <span className="lp-cat-item-count">{EXAMPLES.length}</span>
            </button>

            <div className="lp-cat-divider" />

            {EXAMPLE_CATEGORIES.map(cat => {
              const meta = CATEGORY_META[cat];
              const count = EXAMPLES.filter(e => e.category === cat).length;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  className={`lp-cat-item${isActive ? ' active' : ''}`}
                  onClick={() => handleCategoryChange(cat)}
                  style={{ '--cat-color': meta.color } as React.CSSProperties}
                >
                  <span className="lp-cat-item-icon" style={{ color: isActive ? meta.color : undefined }}>
                    {meta.icon}
                  </span>
                  <span className="lp-cat-item-label">{cat}</span>
                  <span className="lp-cat-item-count">{count}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="lp-sidebar-footer">
            <div className="lp-footer-hint">
              <kbd className="lp-kbd">Esc</kbd>
              <span>to close</span>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="lp-main">

          {/* Header */}
          <div className="lp-main-header">
            <div className="lp-header-left">
              {currentMeta ? (
                <>
                  <div className="lp-header-cat-dot" style={{ background: currentMeta.color, boxShadow: `0 0 8px ${currentMeta.color}` }} />
                  <h2 className="lp-header-title">{activeCategory}</h2>
                  <span className="lp-header-sub">{currentMeta.description}</span>
                </>
              ) : (
                <>
                  <h2 className="lp-header-title">All Examples</h2>
                  <span className="lp-header-sub">{totalCount} lessons available</span>
                </>
              )}
            </div>

            <div className="lp-header-right">
              {/* Search */}
              <div className="lp-search-wrap">
                <span className="lp-search-icon"><IconSearch /></span>
                <input
                  ref={searchInputRef}
                  className="lp-search-input"
                  type="text"
                  placeholder="Search…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="Search examples"
                />
                {query && (
                  <button
                    className="lp-search-clear"
                    onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
                    aria-label="Clear search"
                  >
                    <IconClose />
                  </button>
                )}
              </div>

              {/* Close */}
              <button className="lp-close-btn" onClick={handleClose} aria-label="Close lesson picker">
                <IconClose />
              </button>
            </div>
          </div>

          {/* Card Grid */}
          <div className="lp-scroll-area">
            {filteredExamples.length === 0 ? (
              <div className="lp-empty">
                <div className="lp-empty-icon">
                  <IconSearch />
                </div>
                <div className="lp-empty-title">No lessons found</div>
                <div className="lp-empty-hint">Try a different search term or browse a category</div>
              </div>
            ) : (
              <div className="lp-grid" key={cardTransitionKey}>
                {filteredExamples.map((example, idx) => {
                  const meta = CATEGORY_META[example.category];
                  const diff = DIFFICULTY_CONFIG[example.difficulty];
                  const isActive = example.source === activeSource;
                  const isSelected = selectedId === example.id;

                  return (
                    <button
                      key={example.id}
                      className={`lp-card${isActive ? ' active' : ''}${isSelected ? ' selecting' : ''}`}
                      style={{
                        '--card-color': meta.color,
                        '--card-accent': meta.accent,
                        '--card-glow': meta.glow,
                        animationDelay: `${idx * 40}ms`,
                      } as React.CSSProperties}
                      onClick={() => handleSelect(example)}
                      aria-pressed={isActive}
                    >
                      {/* Visual preview area */}
                      <div className="lp-card-preview" style={{ background: `radial-gradient(ellipse at 60% 40%, ${meta.accent}, transparent 70%)` }}>
                        <div className="lp-card-preview-art">
                          {meta.pattern}
                        </div>
                        {isActive && (
                          <div className="lp-card-active-badge">
                            <IconCheck />
                            <span>Current</span>
                          </div>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="lp-card-body">
                        <div className="lp-card-meta">
                          <span className="lp-diff-badge" style={{ color: diff.text, background: diff.bg, borderColor: diff.border }}>
                            {diff.label}
                          </span>
                          <span className="lp-card-category">{example.category}</span>
                        </div>
                        <div className="lp-card-title">{renderTitle(example.title)}</div>
                        <div className="lp-card-desc">{example.description}</div>
                        <div className="lp-card-cta">
                          {isSelected ? (
                            <span className="lp-card-cta-loading">
                              <span className="lp-spinner" />
                              Loading…
                            </span>
                          ) : isActive ? (
                            <span className="lp-card-cta-active">
                              <IconCheck />
                              Currently open
                            </span>
                          ) : (
                            <span className="lp-card-cta-default">
                              Open lesson
                              <IconArrow />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
