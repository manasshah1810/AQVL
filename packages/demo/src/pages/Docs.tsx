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
  'SCENE','DECLARE','SEQUENCE','END','ARRAY',
  'HIGHLIGHT','COMPARE','SWAP','UPDATE','INSERT','DELETE',
  'LOOP','FROM','TO','IF','LENGTH'
]);

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
const TOC_ITEMS = [
  { id: 'introduction',  label: 'Introduction' },
  { id: 'declaration',   label: 'Declaring an Array' },
  { id: 'commands',      label: 'Commands Reference' },
  { id: 'examples',      label: 'Examples' },
  { id: 'errors',        label: 'Errors & Tips' },
];

// ─── Main Docs page ───────────────────────────────────────
export default function Docs() {
  const [theme, setTheme]           = useState<'light'|'dark'>('dark');
  const [activeId, setActiveId]     = useState('introduction');
  const [scrollPct, setScrollPct]   = useState(0);
  const observerRef                 = useRef<IntersectionObserver | null>(null);

  // Restore theme
  useEffect(() => {
    const saved = (localStorage.getItem('aqvl-docs-theme') ?? 'dark') as 'light'|'dark';
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
  }, []);

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
            <a href="/docs" className="docs-brand">
              <div className="docs-brand-logo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
              </div>
              <span className="docs-brand-name">AQVL</span>
              <span className="docs-brand-version">v0.1</span>
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
              <button className="docs-nav-item is-active">Arrays</button>
              <a href="#" className="docs-nav-item is-disabled">
                Linked Lists
                <span className="docs-nav-badge">Soon</span>
              </a>
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
