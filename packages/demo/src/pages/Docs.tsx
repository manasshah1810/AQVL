import React, { useState, useEffect, useRef, useCallback } from 'react';
import './docs.css';

// ─── Icons ───────────────────────────────────────────────
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

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const WarnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const TipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

// ─── Syntax Highlighter ───────────────────────────────────
const KEYWORDS = new Set([
  'SCENE','DECLARE','SEQUENCE','END','ARRAY','LINKEDLIST',
  'HIGHLIGHT','COMPARE','SWAP','UPDATE','INSERT','DELETE',
  'INSERT_HEAD','INSERT_TAIL','DELETE_HEAD','DELETE_TAIL',
  'LOOP','FROM','TO','IF','LENGTH','NULL','WAIT','DOUBLY'
]);

// CIRCULAR gets its own class to distinguish it visually as a structural modifier
const CIRCULAR_KEYWORD = 'CIRCULAR';

function highlightAQVL(source: string): React.ReactNode[] {
  return source.split('\n').map((line, lineIdx) => {
    const isLast = lineIdx === source.split('\n').length - 1;

    // Comment line
    if (line.trimStart().startsWith('//')) {
      return (
        <span key={lineIdx}>
          <span className="tok-comment">{line}</span>
          {!isLast && '\n'}
        </span>
      );
    }

    // Tokenise
    const parts = line.split(/(\s+|\[|\]|=|,|\(|\)|>|<|\+|-|\*|\/)/g);
    const nodes = parts.map((part, partIdx) => {
      if (part === CIRCULAR_KEYWORD) return <span key={partIdx} className="tok-circular">{part}</span>;
      if (KEYWORDS.has(part)) return <span key={partIdx} className="tok-keyword">{part}</span>;
      if (/^\d+$/.test(part))  return <span key={partIdx} className="tok-number">{part}</span>;
      if (/^[a-z_][a-z0-9_]*$/i.test(part) && part.length > 0)
        return <span key={partIdx} className="tok-variable">{part}</span>;
      if (/^[=><+\-*/,[\]()]+$/.test(part) && part.trim())
        return <span key={partIdx} className="tok-operator">{part}</span>;
      return <span key={partIdx}>{part}</span>;
    });

    return (
      <span key={lineIdx}>
        {nodes}
        {!isLast && '\n'}
      </span>
    );
  });
}

// ─── CodeBlock ────────────────────────────────────────────
interface CodeBlockProps {
  code: string;
  label?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, label = 'aqvl' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="docs-codeblock">
      <div className="docs-codeblock-header">
        <div className="docs-codeblock-dots">
          <span /><span /><span />
        </div>
        <span className="docs-codeblock-lang">{label}</span>
        <button
          className={`docs-copy-btn${copied ? ' is-copied' : ''}`}
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
        </button>
      </div>
      <div className="docs-codeblock-body">
        <pre>{highlightAQVL(code)}</pre>
      </div>
    </div>
  );
};

// ─── Alert ────────────────────────────────────────────────
type AlertKind = 'note' | 'warn' | 'tip';
const Alert: React.FC<{ kind: AlertKind; title: string; children: React.ReactNode }> = ({ kind, title, children }) => {
  const icons: Record<AlertKind, React.ReactNode> = {
    note: <InfoIcon />,
    warn: <WarnIcon />,
    tip:  <TipIcon />,
  };
  const cls: Record<AlertKind, string> = {
    note: 'docs-alert-note',
    warn: 'docs-alert-warn',
    tip:  'docs-alert-tip',
  };
  return (
    <div className={`docs-alert ${cls[kind]}`}>
      <span className="docs-alert-icon">{icons[kind]}</span>
      <div className="docs-alert-body">
        <p className="docs-alert-title">{title}</p>
        <p>{children}</p>
      </div>
    </div>
  );
};

// ─── Inline code helper ───────────────────────────────────
const C: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="docs-ic">{children}</code>
);

// ─── TOC definition ───────────────────────────────────────
const TOC_ITEMS_ARRAYS = [
  { id: 'introduction',  label: 'Introduction' },
  { id: 'declaration',   label: 'Declaring an Array' },
  { id: 'commands',      label: 'Commands Reference' },
  { id: 'examples',      label: 'Examples' },
  { id: 'errors',        label: 'Errors & Tips' },
];

const TOC_ITEMS_LINKED_LISTS = [
  { id: 'll-introduction',  label: 'Introduction' },
  { id: 'll-overview-singly',label: 'Singly Linked List' },
  { id: 'll-overview-doubly',label: 'Doubly Linked List' },
  { id: 'll-overview-circular',label: 'Circular Linked List' },
];

const TOC_ITEMS_SINGLY = [
  { id: 'sl-introduction',  label: 'Introduction' },
  { id: 'sl-declaration',   label: 'Declaring a Singly List' },
  { id: 'sl-commands',      label: 'Commands Reference' },
  { id: 'sl-examples',      label: 'Examples' },
  { id: 'sl-errors',        label: 'Errors & Tips' },
];

const TOC_ITEMS_DOUBLY = [
  { id: 'dl-introduction',  label: 'Introduction' },
  { id: 'dl-declaration',   label: 'Declaring a Doubly List' },
  { id: 'dl-commands',      label: 'Commands Reference' },
  { id: 'dl-examples',      label: 'Examples' },
  { id: 'dl-errors',        label: 'Errors & Tips' },
];

const TOC_ITEMS_CIRCULAR = [
  { id: 'cl-introduction',  label: 'Introduction' },
  { id: 'cl-declaration',   label: 'Declaring a Circular List' },
  { id: 'cl-commands',      label: 'Commands Reference' },
  { id: 'cl-examples',      label: 'Examples' },
  { id: 'cl-errors',        label: 'Errors & Tips' },
];

// ─── Main Docs page ───────────────────────────────────────
export default function Docs() {
  const [activePage, setActivePage] = useState<'arrays'|'linked-lists'|'singly-linked-list'|'doubly-linked-list'|'circular-linked-list'>('arrays');
  const [theme, setTheme]           = useState<'light'|'dark'>('dark');
  const [activeId, setActiveId]     = useState('introduction');
  const [scrollPct, setScrollPct]   = useState(0);
  const observerRef                 = useRef<IntersectionObserver | null>(null);

  const TOC_ITEMS =
    activePage === 'arrays'               ? TOC_ITEMS_ARRAYS :
    activePage === 'linked-lists'         ? TOC_ITEMS_LINKED_LISTS :
    activePage === 'singly-linked-list'   ? TOC_ITEMS_SINGLY :
    activePage === 'doubly-linked-list'   ? TOC_ITEMS_DOUBLY :
                                           TOC_ITEMS_CIRCULAR;

  // Restore theme
  useEffect(() => {
    const saved = (localStorage.getItem('aqvl-docs-theme') ?? 'dark') as 'light'|'dark';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aqvl-docs-theme', next);
  };

  // IntersectionObserver — root is the scrollable container
  useEffect(() => {
    const root = document.querySelector('.docs-main-wrap');
    const cb: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveId(entry.target.id);
      }
    };
    observerRef.current = new IntersectionObserver(cb, {
      root,
      rootMargin: '-10% 0px -75% 0px',
      threshold: 0,
    });
    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current!.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [activePage, TOC_ITEMS]);

  // Scroll progress bar — track .docs-main-wrap, not window
  useEffect(() => {
    const container = document.querySelector('.docs-main-wrap');
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const pct = scrollHeight - clientHeight > 0
        ? (scrollTop / (scrollHeight - clientHeight)) * 100
        : 0;
      setScrollPct(pct);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    const container = document.querySelector('.docs-main-wrap');
    if (el && container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollBy({ top: elTop - containerTop - 32, behavior: 'smooth' });
    }
  }, []);

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="docs-root">
      {/* Progress bar */}
      <div className="docs-progress-bar" style={{ width: `${scrollPct}%` }} />

      <div className="docs-layout">
        {/* ── Left Sidebar ─────────────────────────────── */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-topbar">
            <a href="#/" className="docs-brand">
              <div className="docs-brand-logo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
              </div>
              <span className="docs-brand-name">AQVL</span>
            </a>
            <button className="theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>

          <nav className="docs-sidebar-nav" aria-label="Sidebar navigation">
            <div className="docs-nav-group">
              <div className="docs-nav-group-label">Getting Started</div>
              {TOC_ITEMS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`docs-nav-item${activeId === id ? ' is-active' : ''}`}
                  onClick={() => scrollTo(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="docs-nav-group">
              <div className="docs-nav-group-label">Data Structures</div>
              <button 
                className={`docs-nav-item ${activePage === 'arrays' ? 'is-active' : ''}`}
                onClick={() => { setActivePage('arrays'); setActiveId('introduction'); }}
              >
                Arrays
              </button>

              {/* ── Linked Lists parent + nested children ─ */}
              <button 
                className={`docs-nav-item ${activePage === 'linked-lists' ? 'is-active' : (activePage === 'singly-linked-list' || activePage === 'doubly-linked-list' || activePage === 'circular-linked-list') ? 'is-parent-active' : ''}`}
                onClick={() => { setActivePage('linked-lists'); setActiveId('ll-introduction'); }}
              >
                Linked Lists
              </button>

              {/* Children — shown whenever any linked-list page is active */}
              {(activePage === 'linked-lists' || activePage === 'singly-linked-list' || activePage === 'doubly-linked-list' || activePage === 'circular-linked-list') && (
                <div className="docs-nav-children">
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'singly-linked-list' ? 'is-active' : ''}`}
                    onClick={() => { setActivePage('singly-linked-list'); setActiveId('sl-introduction'); }}
                  >
                    Singly
                  </button>
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'doubly-linked-list' ? 'is-active' : ''}`}
                    onClick={() => { setActivePage('doubly-linked-list'); setActiveId('dl-introduction'); }}
                  >
                    Doubly
                  </button>
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'circular-linked-list' ? 'is-active' : ''}`}
                    onClick={() => { setActivePage('circular-linked-list'); setActiveId('cl-introduction'); }}
                  >
                    Circular
                  </button>
                </div>
              )}

              <a href="#" className="docs-nav-item is-disabled">
                Trees
                <span className="docs-nav-badge">Soon</span>
              </a>
              <a href="#" className="docs-nav-item is-disabled">
                Graphs
                <span className="docs-nav-badge">Soon</span>
              </a>
              <a href="#" className="docs-nav-item is-disabled">
                Stacks &amp; Queues
                <span className="docs-nav-badge">Soon</span>
              </a>
            </div>

            <div className="docs-nav-group">
              <div className="docs-nav-group-label">Algorithms</div>
              <a href="#" className="docs-nav-item is-disabled">
                Sorting
                <span className="docs-nav-badge">Soon</span>
              </a>
              <a href="#" className="docs-nav-item is-disabled">
                Searching
                <span className="docs-nav-badge">Soon</span>
              </a>
            </div>
          </nav>
        </aside>

        {/* ── Main content ─────────────────────────────── */}
        <div className="docs-main-wrap">
          <div className="docs-content">

            {activePage === 'arrays' && (
              <>
                {/* Page hero */}
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                      <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
                    </svg>
                    Data Structures
                  </div>
                  <h1 className="docs-page-title">Arrays</h1>
                  <p className="docs-page-lead">
                    Learn how to declare, manipulate, and animate arrays in AQVL — the language built for visualizing algorithms.
                  </p>
                </header>

                {/* ── § Introduction ─────────────────────── */}
                <section id="introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    In AQVL, an <C>ARRAY</C> is a fixed-width, contiguous sequence of integer elements. When you declare
                    one, the runtime immediately renders each element as a numbered box on screen — so you can see your
                    data right away, before a single instruction runs.
                  </p>
                  <p className="docs-p">
                    Arrays are the first data structure in AQVL and are paired with a set of high-level commands — 
                    <C>HIGHLIGHT</C>, <C>COMPARE</C>, <C>SWAP</C>, <C>UPDATE</C>, <C>INSERT</C>, and <C>DELETE</C> — that 
                    produce smooth, step-by-step animations. Combine them with <C>LOOP</C> and <C>IF</C> control flow to 
                    express any sorting or searching algorithm in just a few readable lines.
                  </p>
                  <Alert kind="note" title="Note">
                    AQVL programs consist of three top-level blocks: <C>DECLARE</C> (define data), <C>SEQUENCE</C> (define 
                    steps), and the wrapping <C>SCENE</C> / <C>END</C> pair. All three must be present for a valid program.
                  </Alert>
                </section>

                {/* ── § Declaration ──────────────────────── */}
                <section id="declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring an Array</h2>
                  <p className="docs-p">
                    Place your array declaration inside the <C>DECLARE</C> block. Provide a name and an initial list of
                    integer values enclosed in square brackets.
                  </p>

                  <CodeBlock
                    label="Syntax"
                    code={`ARRAY <name> = [<value>, <value>, ...]`}
                  />

                  <p className="docs-p">A full minimal program looks like this:</p>

                  <CodeBlock
                    code={`SCENE MyFirstArray\n\nDECLARE\n  ARRAY nums = [10, 20, 30, 40, 50]\n\nSEQUENCE\n  HIGHLIGHT nums[0]\nEND`}
                  />

                  <p className="docs-p">
                    When this program is loaded, the visualizer will instantly render five boxes labeled <em>10, 20, 30, 40, 50</em>.
                    Running the sequence will then animate the first element lighting up.
                  </p>

                  <Alert kind="warn" title="No empty arrays">
                    <C>ARRAY arr = []</C> is not valid. You must provide at least one initial value. Elements can be added
                    dynamically using <C>INSERT</C> after the scene starts.
                  </Alert>
                </section>

                {/* ── § Commands ─────────────────────────── */}
                <section id="commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    All array commands live inside the <C>SEQUENCE</C> block. Each command maps 1-to-1 to an animation
                    step the runtime plays back.
                  </p>

                  <table className="docs-cmd-table">
                    <thead>
                      <tr>
                        <th>Command</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">name[i]</span></td>
                        <td>Pulses the element at index <C>i</C> with a bright accent color. Use it to mark the current element of interest — e.g., the minimum candidate in Selection Sort.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">COMPARE</span> <span className="tok-param">name[i] name[j]</span></td>
                        <td>Simultaneously highlights two elements to show they are being evaluated against each other. Neither is modified.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SWAP</span> <span className="tok-param">name[i] name[j]</span></td>
                        <td>Animates an arc-swap of the values at indices <C>i</C> and <C>j</C>. Both the visual position and the internal value are exchanged.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">UPDATE</span> <span className="tok-param">name[i] value</span></td>
                        <td>Sets the element at index <C>i</C> to <C>value</C>, animating the number changing inside the box.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT</span> <span className="tok-param">name[i] value</span></td>
                        <td>Inserts a new box containing <C>value</C> at position <C>i</C>. All subsequent elements shift right with a slide animation. The array grows by one.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE</span> <span className="tok-param">name[i]</span></td>
                        <td>Removes the element at index <C>i</C>. All subsequent elements shift left to close the gap. The array shrinks by one.</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 className="docs-h3">Control Flow</h3>
                  <p className="docs-p">
                    You can use <C>LOOP</C> and <C>IF</C> to build algorithm logic around the array commands above.
                  </p>

                  <table className="docs-cmd-table">
                    <thead>
                      <tr>
                        <th>Construct</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">LOOP</span> <span className="tok-param">var</span> <span className="tok-keyword">FROM</span> <span className="tok-param">start</span> <span className="tok-keyword">TO</span> <span className="tok-param">end</span></td>
                        <td>Iterates <C>var</C> from <C>start</C> to <C>end</C> (inclusive). Close with <C>END</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">IF</span> <span className="tok-param">expr</span></td>
                        <td>Conditionally executes its body if <C>expr</C> is truthy. Supports <C>&gt;</C>, <C>&lt;</C>, <C>=</C>. Close with <C>END</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-builtin">LENGTH</span>(<span className="tok-param">name</span>)</td>
                        <td>Returns the current length of the named array. Useful as the upper bound of a loop.</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                {/* ── § Examples ─────────────────────────── */}
                <section id="examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — All Basic Operations</h3>
                  <p className="docs-p">
                    This program exercises every array command in sequence so you can see exactly what each one does in
                    the visualizer.
                  </p>
                  <CodeBlock
                    code={`SCENE ArrayOps\n\nDECLARE\n  ARRAY arr = [10, 20, 30, 40]\n\nSEQUENCE\n  // Draw attention to arr[0]\n  HIGHLIGHT arr[0]\n\n  // Show arr[0] vs arr[1]\n  COMPARE arr[0] arr[1]\n\n  // Exchange them\n  SWAP arr[0] arr[1]\n\n  // Overwrite arr[1] with 99\n  UPDATE arr[1] 99\n\n  // Insert 25 before arr[2]\n  INSERT arr[2] 25\n\n  // Remove the element now at arr[3]\n  DELETE arr[3]\nEND`}
                  />
                  <p className="docs-p">
                    <strong>Expected behaviour:</strong> After SWAP, <C>arr</C> becomes <C>[20, 10, 30, 40]</C>.
                    After UPDATE it becomes <C>[20, 99, 30, 40]</C>. After INSERT, <C>[20, 99, 25, 30, 40]</C>.
                    After DELETE, <C>[20, 99, 25, 40]</C>.
                  </p>

                  <h3 className="docs-h3">Example 2 — Bubble Sort</h3>
                  <p className="docs-p">
                    Classic O(n²) comparison sort. The largest unsorted element "bubbles" to its correct position on each
                    outer pass.
                  </p>
                  <CodeBlock
                    code={`SCENE BubbleSort\n\nDECLARE\n  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]\n\nSEQUENCE\n  LOOP i FROM 0 TO LENGTH(arr) - 2\n    LOOP j FROM 0 TO LENGTH(arr) - i - 2\n      COMPARE arr[j] arr[j+1]\n      IF arr[j] > arr[j+1]\n        SWAP arr[j] arr[j+1]\n      END\n    END\n    HIGHLIGHT arr[LENGTH(arr) - i - 1]\n  END\n  HIGHLIGHT arr[0]\nEND`}
                  />
                  <p className="docs-p">
                    <strong>Expected behaviour:</strong> After every outer pass, the rightmost unsorted element snaps into
                    its final position (highlighted in green). The final <C>HIGHLIGHT arr[0]</C> marks the last remaining
                    element as sorted.
                  </p>

                  <h3 className="docs-h3">Example 3 — Selection Sort</h3>
                  <p className="docs-p">
                    On each pass, the current minimum in the unsorted portion is found and swapped into place.
                  </p>
                  <CodeBlock
                    code={`SCENE SelectionSort\n\nDECLARE\n  ARRAY arr = [64, 25, 12, 22, 11]\n\nSEQUENCE\n  LOOP i FROM 0 TO LENGTH(arr) - 2\n    HIGHLIGHT arr[i]\n    LOOP j FROM i + 1 TO LENGTH(arr) - 1\n      COMPARE arr[i] arr[j]\n      IF arr[i] > arr[j]\n        SWAP arr[i] arr[j]\n      END\n    END\n  END\nEND`}
                  />
                </section>

                {/* ── § Errors ───────────────────────────── */}
                <section id="errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Index out of bounds">
                    Accessing <C>arr[5]</C> on a 5-element array (indices 0–4) triggers a runtime error and halts
                    execution. Always use <C>LENGTH(arr) - 1</C> as your upper bound in loops.
                  </Alert>

                  <Alert kind="warn" title="Missing SCENE or END">
                    Every AQVL program must open with <C>SCENE &lt;name&gt;</C> and close with <C>END</C>. Forgetting
                    either is the most common source of parse errors.
                  </Alert>

                  <Alert kind="warn" title="Unclosed blocks">
                    Each <C>LOOP</C> and <C>IF</C> block must have its own <C>END</C> keyword. A missing <C>END</C>
                    causes the parser to fail with an "unexpected token" error.
                  </Alert>

                  <Alert kind="tip" title="Tip: use LENGTH() for dynamic arrays">
                    If your program uses <C>INSERT</C> or <C>DELETE</C>, the array length changes at runtime. 
                    Always reference <C>LENGTH(arr)</C> instead of a hardcoded number in your loop bounds.
                  </Alert>

                  <Alert kind="note" title="Comments for clarity">
                    Single-line comments start with <C>//</C>. They have no effect on execution and are stripped by the
                    lexer — use them liberally to document the intent of each step.
                  </Alert>
                </section>
              </>
            )}

            {activePage === 'linked-lists' && (
              <>
                {/* Page hero */}
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                      <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
                    </svg>
                    Data Structures
                  </div>
                  <h1 className="docs-page-title">Linked Lists</h1>
                  <p className="docs-page-lead">
                    AQVL supports three flavors of linked list: Singly, Doubly, and Circular. Each one is a separate page — select one in the sidebar to dive deep.
                  </p>
                </header>

                {/* ── § Introduction ─────────────────────── */}
                <section id="ll-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    In AQVL, a Linked List is a dynamic sequence of nodes. Unlike Arrays, Linked Lists are not contiguous in memory and rely on explicit relationships (edges) to connect nodes. AQVL renders each node as a sphere and each pointer as an animated edge.
                  </p>
                  <Alert kind="note" title="Dynamic Nature">
                    Linked List nodes are rendered as spheres and edges represent pointers. The visualizer automatically re-layouts the structure as you insert or delete nodes.
                  </Alert>
                </section>

                {/* ── § Overview: Singly ─────────────────── */}
                <section id="ll-overview-singly" className="docs-section">
                  <h2 className="docs-h2">Singly Linked List</h2>
                  <p className="docs-p">
                    The simplest form. Each node holds a value and a single <em>next</em> pointer. The chain terminates with a <C>NULL</C> sentinel.
                  </p>
                  <CodeBlock label="Syntax" code={`LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => { setActivePage('singly-linked-list'); setActiveId('sl-introduction'); }}
                  >
                    → Open full Singly Linked List documentation
                  </button>
                </section>

                {/* ── § Overview: Doubly ─────────────────── */}
                <section id="ll-overview-doubly" className="docs-section">
                  <h2 className="docs-h2">Doubly Linked List</h2>
                  <p className="docs-p">
                    Each node has both a <em>next</em> and a <em>prev</em> pointer, enabling bidirectional traversal. Declare one by prepending the <C>DOUBLY</C> keyword.
                  </p>
                  <CodeBlock label="Syntax" code={`DOUBLY LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => { setActivePage('doubly-linked-list'); setActiveId('dl-introduction'); }}
                  >
                    → Open full Doubly Linked List documentation
                  </button>
                </section>

                {/* ── § Overview: Circular ───────────────── */}
                <section id="ll-overview-circular" className="docs-section">
                  <h2 className="docs-h2">Circular Linked List</h2>
                  <p className="docs-p">
                    The last node's <em>next</em> wraps back to the first node, forming a loop. Declare one by prepending the <span className="tok-circular">CIRCULAR</span> keyword.
                  </p>
                  <CodeBlock label="Syntax" code={`CIRCULAR LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => { setActivePage('circular-linked-list'); setActiveId('cl-introduction'); }}
                  >
                    → Open full Circular Linked List documentation
                  </button>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                SINGLY LINKED LIST PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'singly-linked-list' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                      <line x1="7" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="17" y2="12"/>
                    </svg>
                    Linked Lists
                  </div>
                  <h1 className="docs-page-title">Singly Linked List</h1>
                  <p className="docs-page-lead">
                    A linear chain of nodes where each node points to the next. The simplest dynamic data structure — no backward traversal, terminated by <code>NULL</code>.
                  </p>
                </header>

                <section id="sl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Singly Linked List is a linear sequence of nodes. Each node stores a value and a single <em>next</em> pointer to the following node. The first node is the <C>HEAD</C> and the last node's <em>next</em> pointer is set to <C>NULL</C>, marking the end of the list.
                  </p>
                  <p className="docs-p">
                    AQVL handles all pointer manipulation behind the scenes. You never write raw pointer code — you just issue high-level commands like <C>INSERT_HEAD</C> or <C>DELETE_TAIL</C> and watch the animation unfold.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Singly list nodes render as spheres. One directed edge per node shows the <em>next</em> pointer. The <C>NULL</C> terminal is shown as a special sentinel node.
                  </Alert>
                </section>

                <section id="sl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Singly Linked List</h2>
                  <p className="docs-p">
                    Place your declaration inside the <C>DECLARE</C> block. Provide a name and an initial list of integer values.
                  </p>
                  <CodeBlock label="Syntax" code={`LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE SinglyIntro\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  HIGHLIGHT list[0]\nEND`} />
                  <p className="docs-p">
                    The visualizer renders <C>HEAD → 10 → 20 → 30 → NULL</C> immediately on load.
                  </p>
                  <Alert kind="warn" title="No empty lists">
                    <C>LINKEDLIST list = []</C> is invalid. Provide at least one value; add more dynamically with <C>INSERT_HEAD</C> or <C>INSERT_TAIL</C>.
                  </Alert>
                </section>

                <section id="sl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    All linked-list commands go inside the <C>SEQUENCE</C> block.
                  </p>
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">name[i]</span></td>
                        <td>Pulses the node at logical index <C>i</C> with an accent color.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">name value</span></td>
                        <td>Creates a new node and inserts it at the front of the list, re-routing <C>HEAD</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">name value</span></td>
                        <td>Creates a new node and appends it to the end, pointing it to <C>NULL</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">name</span></td>
                        <td>Removes the first node and advances the <C>HEAD</C> pointer to the next node.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">name</span></td>
                        <td>Removes the last node and updates the previous node's pointer to <C>NULL</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">WAIT</span></td>
                        <td>Pauses the animation for one step. Useful to let the audience observe the current state.</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section id="sl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Insertions & Deletions</h3>
                  <p className="docs-p">Exercises all four structural commands in sequence.</p>
                  <CodeBlock code={`SCENE SinglyOps\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  // Add to front and back\n  INSERT_HEAD list 5\n  INSERT_TAIL list 40\n\n  // Remove from front and back\n  DELETE_HEAD list\n  DELETE_TAIL list\nEND`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> After both inserts, list is <C>5 → 10 → 20 → 30 → 40</C>. After both deletes, <C>10 → 20 → 30</C>.
                  </p>

                  <h3 className="docs-h3">Example 2 — Linear Traversal</h3>
                  <p className="docs-p">
                    Highlight every node in order to visualize a linear scan / search.
                  </p>
                  <CodeBlock code={`SCENE SinglyTraversal\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30, 40]\n\nSEQUENCE\n  LOOP i FROM 0 TO 3\n    HIGHLIGHT list[i]\n    WAIT\n  END\nEND`} />
                </section>

                <section id="sl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Index out of bounds">
                    <C>HIGHLIGHT list[5]</C> on a 3-node list is a runtime error. Keep indices within <C>0</C> to <C>LENGTH(list) - 1</C>.
                  </Alert>
                  <Alert kind="tip" title="HEAD is automatic">
                    <C>HEAD</C> is managed by the runtime. You cannot manually assign or read it — use commands instead.
                  </Alert>
                  <Alert kind="note" title="Traversal order">
                    Singly lists only support forward traversal. For backward traversal, use a Doubly Linked List.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                DOUBLY LINKED LIST PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'doubly-linked-list' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                      <line x1="7" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="17" y2="12"/>
                    </svg>
                    Linked Lists
                  </div>
                  <h1 className="docs-page-title">Doubly Linked List</h1>
                  <p className="docs-page-lead">
                    Each node carries both a <em>next</em> and a <em>prev</em> pointer, enabling rich bidirectional traversal and visually distinct two-headed edges.
                  </p>
                </header>

                <section id="dl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Doubly Linked List extends the singly variant by adding a backward (<em>prev</em>) pointer to every node. This allows traversal in both directions — forward from <C>HEAD</C> to <C>NULL</C>, and backward from any node to <C>HEAD</C>.
                  </p>
                  <p className="docs-p">
                    In the AQVL visualizer, doubly linked nodes render with two directed edges: a solid forward arrow and a dashed backward arrow, making the dual-pointer structure immediately clear.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Each node displays two edges: a solid <em>next</em> arrow pointing right and a dashed <em>prev</em> arrow pointing left. Both animate smoothly on insert / delete.
                  </Alert>
                </section>

                <section id="dl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Doubly Linked List</h2>
                  <p className="docs-p">
                    Prepend the <C>DOUBLY</C> keyword before <C>LINKEDLIST</C>. Everything else is identical to the singly syntax.
                  </p>
                  <CodeBlock label="Syntax" code={`DOUBLY LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE DoublyIntro\n\nDECLARE\n  DOUBLY LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  HIGHLIGHT list[1]\nEND`} />
                  <p className="docs-p">
                    The runtime automatically wires every node with both forward and backward edges.
                  </p>
                </section>

                <section id="dl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    The same commands used for singly lists work on doubly lists. The runtime automatically manages both the <em>next</em> and <em>prev</em> pointers.
                  </p>
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">name[i]</span></td>
                        <td>Highlights the node at index <C>i</C>. Works the same as on a singly list.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">name value</span></td>
                        <td>Inserts a new node at the front, updating both the <em>next</em> link from new node and the <em>prev</em> link of the old head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">name value</span></td>
                        <td>Inserts a new node at the end, creating a mutual link between it and the previous tail.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">name</span></td>
                        <td>Removes the head node and clears the <em>prev</em> pointer on the new head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">name</span></td>
                        <td>Removes the tail node and clears the <em>next</em> pointer on the new tail.</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section id="dl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Bidirectional Traversal</h3>
                  <p className="docs-p">
                    This example first traverses forward, then manually walks backward — possible only because of the <em>prev</em> pointers.
                  </p>
                  <CodeBlock code={`SCENE DoublyTraversal\n\nDECLARE\n  DOUBLY LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  // Forward pass\n  LOOP i FROM 0 TO 2\n    HIGHLIGHT list[i]\n    WAIT\n  END\n\n  // Backward pass\n  HIGHLIGHT list[2]\n  WAIT\n  HIGHLIGHT list[1]\n  WAIT\n  HIGHLIGHT list[0]\n  WAIT\nEND`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> Nodes glow in order 10 → 20 → 30, then 30 → 20 → 10 — the backward arrows illuminate during the reverse pass.
                  </p>

                  <h3 className="docs-h3">Example 2 — Insert &amp; Delete</h3>
                  <CodeBlock code={`SCENE DoublyOps\n\nDECLARE\n  DOUBLY LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  INSERT_HEAD list 5\n  WAIT\n  INSERT_TAIL list 40\n  WAIT\n  DELETE_HEAD list\n  WAIT\n  DELETE_TAIL list\n  WAIT\nEND`} />
                </section>

                <section id="dl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Index out of bounds">
                    Same rule as singly lists: indices must be within <C>0</C> to <C>LENGTH(list) - 1</C>.
                  </Alert>
                  <Alert kind="tip" title="Both pointers update automatically">
                    You never manually set <em>prev</em> — every insert/delete command fixes both ends of the edge automatically.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                CIRCULAR LINKED LIST PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'circular-linked-list' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 12a9.5 9.5 0 1 1-9.5-9.5"/>
                      <polyline points="21.5 3 21.5 7 17.5 7"/>
                    </svg>
                    Linked Lists
                  </div>
                  <h1 className="docs-page-title">Circular Linked List</h1>
                  <p className="docs-page-lead">
                    The last node wraps back to the first, creating a continuous loop with no <code>NULL</code> terminator. Declared with the <span className="tok-circular">CIRCULAR</span> keyword.
                  </p>
                </header>

                <section id="cl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Circular Linked List is a singly linked list where the last node's <em>next</em> pointer does not point to <C>NULL</C> — it loops back to the <C>HEAD</C> node, forming a closed ring.
                  </p>
                  <p className="docs-p">
                    This structure is well-suited for round-robin scheduling, buffering, and any algorithm that needs to wrap around endlessly.
                  </p>
                  <Alert kind="note" title="Visualization">
                    The AQVL renderer draws the wrap-around edge as a curved arc that arcs back from the tail to the head, visually conveying the circular topology.
                  </Alert>
                </section>

                <section id="cl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Circular Linked List</h2>
                  <p className="docs-p">
                    Prepend the <span className="tok-circular">CIRCULAR</span> keyword before <C>LINKEDLIST</C>. The runtime automatically manages the tail-to-head back-edge.
                  </p>
                  <CodeBlock label="Syntax" code={`CIRCULAR LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE CircularIntro\n\nDECLARE\n  CIRCULAR LINKEDLIST clist = [1, 2, 3]\n\nSEQUENCE\n  // The circular back-edge is visible immediately\n  WAIT\nEND`} />
                  <p className="docs-p">
                    Even before any commands run, the visualizer shows the curved arc from node <em>3</em> back to node <em>1</em>.
                  </p>
                  <Alert kind="warn" title="No NULL node">
                    Unlike singly or doubly lists, a circular list has no <C>NULL</C> sentinel. The ring is truly endless — make sure your algorithm doesn't rely on finding a <C>NULL</C> terminator.
                  </Alert>
                </section>

                <section id="cl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    Circular lists support the same structural commands. After every insert or delete, the runtime automatically re-attaches the circular back-edge to the new extremity.
                  </p>
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">name[i]</span></td>
                        <td>Pulses the node at index <C>i</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">name value</span></td>
                        <td>Inserts at the front. The tail's back-edge automatically re-points to the new head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">name value</span></td>
                        <td>Appends to the end. The new node's <em>next</em> wraps back to the head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">name</span></td>
                        <td>Removes the head and updates the tail's back-edge to point to the new head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">name</span></td>
                        <td>Removes the tail. The new tail's <em>next</em> is re-routed to the head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">WAIT</span></td>
                        <td>Pauses the animation so the viewer can see the current circular state.</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section id="cl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Circular Insertions</h3>
                  <p className="docs-p">
                    Observe how the back-edge dynamically re-attaches after each insertion.
                  </p>
                  <CodeBlock code={`SCENE CircularOps\n\nDECLARE\n  CIRCULAR LINKEDLIST clist = [1, 2, 3]\n\nSEQUENCE\n  // Observe the initial circular arc\n  WAIT\n\n  // Tail insert — new node becomes tail, arc moves\n  INSERT_TAIL clist 4\n  WAIT\n\n  // Head insert — new node becomes head, arc re-anchors\n  INSERT_HEAD clist 0\n  WAIT\nEND`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> The curved back-edge visibly shifts to point from the new tail (4) back to the new head (0).
                  </p>

                  <h3 className="docs-h3">Example 2 — Circular Traversal</h3>
                  <p className="docs-p">
                    Because the list is circular, you can represent infinite round-robin traversal. This example shows two full cycles.
                  </p>
                  <CodeBlock code={`SCENE CircularTraversal\n\nDECLARE\n  CIRCULAR LINKEDLIST clist = [10, 20, 30]\n\nSEQUENCE\n  // First cycle\n  LOOP i FROM 0 TO 2\n    HIGHLIGHT clist[i]\n    WAIT\n  END\n\n  // Second cycle\n  LOOP i FROM 0 TO 2\n    HIGHLIGHT clist[i]\n    WAIT\n  END\nEND`} />
                </section>

                <section id="cl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Infinite loop risk">
                    Because there is no <C>NULL</C> terminator, a naive traversal loop that keeps following <em>next</em> will loop forever. Always bound your <C>LOOP</C> with a known count.
                  </Alert>
                  <Alert kind="tip" title="Back-edge is automatic">
                    You never write code to maintain the circular back-edge. Every insert/delete command handles it for you.
                  </Alert>
                  <Alert kind="note" title="Works with DOUBLY too">
                    A future AQVL version will support <C>CIRCULAR DOUBLY LINKEDLIST</C> — a doubly linked ring. Watch the changelog!
                  </Alert>
                </section>
              </>
            )}

          </div>
        </div>

        {/* ── Right TOC ──────────────────────────────── */}
        <aside className="docs-toc-panel" aria-label="On this page">
          <div className="docs-toc-inner">
            <div className="docs-toc-label">On this page</div>
            <ul className="docs-toc-list" role="list">
              {TOC_ITEMS.map(({ id, label }) => (
                <li key={id} className="docs-toc-item">
                  <button
                    className={`docs-toc-btn${activeId === id ? ' is-active' : ''}`}
                    onClick={() => scrollTo(id)}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
