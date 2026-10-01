import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CodeBlock as SiteCodeBlock } from '../components/code/CodeBlock';
import { navigate, parseHash, replaceHash } from '../lib/router';
import { spring } from '../lib/motion';
import './docs.css';

// ─── CodeBlock ────────────────────────────────────────────
// Full programs (they start with SCENE) get a "Run" action that hands the
// source to the playground through sessionStorage.
interface CodeBlockProps {
  code: string;
  label?: string;
}

export const HANDOFF_KEY = 'aqvl-handoff';

const CodeBlock: React.FC<CodeBlockProps> = ({ code, label = 'aqvl' }) => {
  const runnable = /^\s*SCENE\s+\w+/.test(code);
  const run = () => {
    try {
      sessionStorage.setItem(HANDOFF_KEY, code);
    } catch {
      return;
    }
    navigate('/playground?from=docs');
  };
  return (
    <SiteCodeBlock
      code={code}
      label={label}
      className="docs-code"
      actions={
        runnable ? (
          <button type="button" className="code__copy mono" onClick={run}>
            Run
          </button>
        ) : undefined
      }
    />
  );
};

// ─── Alert ────────────────────────────────────────────────
type AlertKind = 'note' | 'warn' | 'tip';
const ALERT_WORD: Record<AlertKind, string> = { note: 'Note', warn: 'Watch out', tip: 'Tip' };

const Alert: React.FC<{ kind: AlertKind; title: string; children: React.ReactNode }> = ({ kind, title, children }) => (
  <aside className={`docs-alert docs-alert--${kind}`} aria-label={`${ALERT_WORD[kind]}: ${title}`}>
    <p className="docs-alert__title">
      <span className="docs-alert__kind mono">{ALERT_WORD[kind]}</span>
      {title}
    </p>
    <div className="docs-alert__body">{children}</div>
  </aside>
);

// ─── Inline code helper ───────────────────────────────────
const C: React.FC<{ children: React.ReactNode }> = ({ children }) => <code className="docs-ic">{children}</code>;

// ─── Page header ──────────────────────────────────────────
const PageHero: React.FC<{ group: string; title: string; children: React.ReactNode }> = ({ group, title, children }) => (
  <header className="docs-hero">
    <p className="docs-hero__crumb mono">
      Docs <span aria-hidden="true">/</span> {group}
    </p>
    <h1 className="docs-hero__title">{title}</h1>
    <p className="docs-hero__lead">{children}</p>
  </header>
);

// ─── TOC definition ───────────────────────────────────────
const TOC_ITEMS_ARRAYS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'declaration', label: 'Declaring an Array' },
  { id: 'commands', label: 'Commands Reference' },
  { id: 'examples', label: 'Examples' },
  { id: 'errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_LINKED_LISTS = [
  { id: 'll-introduction', label: 'Introduction' },
  { id: 'll-overview-singly', label: 'Singly Linked List' },
  { id: 'll-overview-doubly', label: 'Doubly Linked List' },
  { id: 'll-overview-circular', label: 'Circular Linked List' },
];

const TOC_ITEMS_SINGLY = [
  { id: 'sl-introduction', label: 'Introduction' },
  { id: 'sl-declaration', label: 'Declaring a Singly List' },
  { id: 'sl-commands', label: 'Commands Reference' },
  { id: 'sl-examples', label: 'Examples' },
  { id: 'sl-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_DOUBLY = [
  { id: 'dl-introduction', label: 'Introduction' },
  { id: 'dl-declaration', label: 'Declaring a Doubly List' },
  { id: 'dl-commands', label: 'Commands Reference' },
  { id: 'dl-examples', label: 'Examples' },
  { id: 'dl-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_CIRCULAR = [
  { id: 'cl-introduction', label: 'Introduction' },
  { id: 'cl-declaration', label: 'Declaring a Circular List' },
  { id: 'cl-commands', label: 'Commands Reference' },
  { id: 'cl-examples', label: 'Examples' },
  { id: 'cl-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_TREES = [
  { id: 'tr-introduction', label: 'Introduction' },
  { id: 'tr-overview-general', label: 'General Tree' },
  { id: 'tr-overview-binary', label: 'Binary Tree' },
  { id: 'tr-overview-bst', label: 'Binary Search Tree' },
];

const TOC_ITEMS_GENERAL_TREE = [
  { id: 'gt-introduction', label: 'Introduction' },
  { id: 'gt-declaration', label: 'Declaring a General Tree' },
  { id: 'gt-commands', label: 'Commands Reference' },
  { id: 'gt-examples', label: 'Examples' },
  { id: 'gt-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_BINARY_TREE = [
  { id: 'bt-introduction', label: 'Introduction' },
  { id: 'bt-declaration', label: 'Declaring a Binary Tree' },
  { id: 'bt-commands', label: 'Pointer Code Reference' },
  { id: 'bt-examples', label: 'Examples' },
  { id: 'bt-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_BST = [
  { id: 'bst-introduction', label: 'Introduction' },
  { id: 'bst-declaration', label: 'Declaring a BST' },
  { id: 'bst-commands', label: 'Commands Reference' },
  { id: 'bst-examples', label: 'Examples' },
  { id: 'bst-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_STACKS = [
  { id: 'sk-introduction', label: 'Introduction' },
  { id: 'sk-declaration', label: 'Declaring a Stack' },
  { id: 'sk-commands', label: 'Commands Reference' },
  { id: 'sk-examples', label: 'Examples' },
  { id: 'sk-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_QUEUES = [
  { id: 'qu-introduction', label: 'Introduction' },
  { id: 'qu-declaration', label: 'Declaring a Queue' },
  { id: 'qu-commands', label: 'Commands Reference' },
  { id: 'qu-examples', label: 'Examples' },
  { id: 'qu-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_GRAPHS = [
  { id: 'gp-introduction', label: 'Introduction' },
  { id: 'gp-declaration', label: 'Declaring a Graph' },
  { id: 'gp-commands', label: 'Graph Code Reference' },
  { id: 'gp-examples', label: 'Examples' },
  { id: 'gp-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_HEAPS = [
  { id: 'hp-introduction', label: 'Introduction' },
  { id: 'hp-declaration', label: 'Declaring a Heap' },
  { id: 'hp-commands', label: 'Heap Code Reference' },
  { id: 'hp-examples', label: 'Examples' },
  { id: 'hp-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_TRIES = [
  { id: 'tri-introduction', label: 'Introduction' },
  { id: 'tri-declaration', label: 'Declaring a Trie' },
  { id: 'tri-commands', label: 'Trie Code Reference' },
  { id: 'tri-examples', label: 'Examples' },
  { id: 'tri-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_HASHMAPS = [
  { id: 'hm-introduction', label: 'Introduction' },
  { id: 'hm-declaration', label: 'Declaring a Hash Map' },
  { id: 'hm-commands', label: 'Hash Map Code Reference' },
  { id: 'hm-examples', label: 'Examples' },
  { id: 'hm-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_CONTROL_FLOW = [
  { id: 'cf-introduction', label: 'Introduction' },
  { id: 'cf-declaration', label: 'Variables & Literals' },
  { id: 'cf-commands', label: 'Loops, Conditions & Operators' },
  { id: 'cf-examples', label: 'Examples' },
  { id: 'cf-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_FUNCTIONS = [
  { id: 'fn-introduction', label: 'Introduction' },
  { id: 'fn-declaration', label: 'Declaring a Function' },
  { id: 'fn-recursion', label: 'Recursion' },
  { id: 'fn-commands', label: 'Patterns Reference' },
  { id: 'fn-examples', label: 'Examples' },
  { id: 'fn-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_SORTING = [
  { id: 'so-introduction', label: 'Introduction' },
  { id: 'so-declaration', label: 'Two Ways to Sort' },
  { id: 'so-commands', label: 'Commands Reference' },
  { id: 'so-examples', label: 'Examples' },
  { id: 'so-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_SEARCHING = [
  { id: 'se-introduction', label: 'Introduction' },
  { id: 'se-declaration', label: 'The Search Window' },
  { id: 'se-commands', label: 'Commands Reference' },
  { id: 'se-examples', label: 'Examples' },
  { id: 'se-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_LAYOUT_CAMERA = [
  { id: 'lc-introduction', label: 'Introduction' },
  { id: 'lc-declaration', label: 'LAYOUT Strategies' },
  { id: 'lc-commands', label: 'Commands Reference' },
  { id: 'lc-examples', label: 'Examples' },
  { id: 'lc-errors', label: 'Errors & Tips' },
];

type PageId =
  | 'arrays' | 'linked-lists' | 'singly-linked-list' | 'doubly-linked-list' | 'circular-linked-list'
  | 'trees' | 'general-tree' | 'binary-tree' | 'bst'
  | 'stacks' | 'queues' | 'graphs' | 'heaps' | 'tries' | 'hashmaps'
  | 'control-flow' | 'functions' | 'sorting' | 'searching' | 'layout-camera';

const TOC_BY_PAGE: Record<PageId, { id: string; label: string }[]> = {
  'arrays': TOC_ITEMS_ARRAYS,
  'linked-lists': TOC_ITEMS_LINKED_LISTS,
  'singly-linked-list': TOC_ITEMS_SINGLY,
  'doubly-linked-list': TOC_ITEMS_DOUBLY,
  'circular-linked-list': TOC_ITEMS_CIRCULAR,
  'trees': TOC_ITEMS_TREES,
  'general-tree': TOC_ITEMS_GENERAL_TREE,
  'binary-tree': TOC_ITEMS_BINARY_TREE,
  'bst': TOC_ITEMS_BST,
  'stacks': TOC_ITEMS_STACKS,
  'queues': TOC_ITEMS_QUEUES,
  'graphs': TOC_ITEMS_GRAPHS,
  'heaps': TOC_ITEMS_HEAPS,
  'tries': TOC_ITEMS_TRIES,
  'hashmaps': TOC_ITEMS_HASHMAPS,
  'control-flow': TOC_ITEMS_CONTROL_FLOW,
  'functions': TOC_ITEMS_FUNCTIONS,
  'sorting': TOC_ITEMS_SORTING,
  'searching': TOC_ITEMS_SEARCHING,
  'layout-camera': TOC_ITEMS_LAYOUT_CAMERA,
};

// ─── Navigation model ─────────────────────────────────────
interface NavEntry {
  page: PageId;
  label: string;
  children?: { page: PageId; label: string }[];
}

const NAV_GROUPS: { label: string; items: NavEntry[] }[] = [
  {
    label: 'Data structures',
    items: [
      { page: 'arrays', label: 'Arrays' },
      {
        page: 'linked-lists',
        label: 'Linked lists',
        children: [
          { page: 'singly-linked-list', label: 'Singly' },
          { page: 'doubly-linked-list', label: 'Doubly' },
          { page: 'circular-linked-list', label: 'Circular' },
        ],
      },
      {
        page: 'trees',
        label: 'Trees',
        children: [
          { page: 'general-tree', label: 'General tree' },
          { page: 'binary-tree', label: 'Binary tree' },
          { page: 'bst', label: 'Binary search tree' },
        ],
      },
      { page: 'stacks', label: 'Stacks' },
      { page: 'queues', label: 'Queues' },
      { page: 'graphs', label: 'Graphs' },
      { page: 'heaps', label: 'Heaps' },
      { page: 'tries', label: 'Tries' },
      { page: 'hashmaps', label: 'Hash maps' },
    ],
  },
  {
    label: 'Language',
    items: [
      { page: 'control-flow', label: 'Loops & control flow' },
      { page: 'functions', label: 'Functions & recursion' },
    ],
  },
  { label: 'Spatial syntax', items: [{ page: 'layout-camera', label: 'Layout & camera' }] },
  {
    label: 'Algorithms',
    items: [
      { page: 'sorting', label: 'Sorting' },
      { page: 'searching', label: 'Searching' },
    ],
  },
];

const PAGE_IDS = Object.keys(TOC_BY_PAGE) as PageId[];

function pageFromHash(): PageId {
  const seg = parseHash(window.location.hash).rest[0];
  return seg && (PAGE_IDS as string[]).includes(seg) ? (seg as PageId) : 'arrays';
}

function SideNav({ activePage, onPick }: { activePage: PageId; onPick: (p: PageId) => void }) {
  return (
    <nav className="docs-nav" aria-label="Documentation">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="docs-nav__group">
          <p className="docs-nav__label mono">{group.label}</p>
          <ul role="list">
            {group.items.map((item) => {
              const inFamily = activePage === item.page || !!item.children?.some((c) => c.page === activePage);
              return (
                <li key={item.page}>
                  <a
                    href={`#/docs/${item.page}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onPick(item.page);
                    }}
                    className={`docs-nav__item${activePage === item.page ? ' is-active' : inFamily ? ' is-family' : ''}`}
                    aria-current={activePage === item.page ? 'page' : undefined}
                  >
                    {activePage === item.page && <motion.span layoutId="docs-nav-on" className="docs-nav__bg" transition={spring.layout} />}
                    <span className="relative">{item.label}</span>
                  </a>
                  {item.children && inFamily && (
                    <ul role="list" className="docs-nav__children">
                      {item.children.map((child) => (
                        <li key={child.page}>
                          <a
                            href={`#/docs/${child.page}`}
                            onClick={(e) => {
                              e.preventDefault();
                              onPick(child.page);
                            }}
                            className={`docs-nav__item docs-nav__child${activePage === child.page ? ' is-active' : ''}`}
                            aria-current={activePage === child.page ? 'page' : undefined}
                          >
                            {activePage === child.page && <motion.span layoutId="docs-nav-on" className="docs-nav__bg" transition={spring.layout} />}
                            <span className="relative">{child.label}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// ─── Main Docs page ───────────────────────────────────────
export default function Docs() {
  const [activePage, setActivePage] = useState<PageId>(pageFromHash);
  const [activeId, setActiveId] = useState(() => TOC_BY_PAGE[pageFromHash()][0].id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const drawerBtnRef = useRef<HTMLButtonElement>(null);

  const TOC_ITEMS = TOC_BY_PAGE[activePage];

  /** Switches page and resets the active TOC anchor to that page's first section. */
  const goToPage = useCallback((page: PageId) => {
    setActivePage(page);
    setActiveId(TOC_BY_PAGE[page][0].id);
    setDrawerOpen(false);
    replaceHash(`/docs/${page}`);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  // Links from elsewhere on the site (e.g. #/docs/layout-camera) while docs is open.
  useEffect(() => {
    const onHash = () => {
      const p = pageFromHash();
      setActivePage(p);
      setActiveId(TOC_BY_PAGE[p][0].id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // IntersectionObserver — root is the scrollable container
  useEffect(() => {
    const root = mainRef.current;
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

  // Reading progress, written straight to the bar's transform (no re-render per scroll event).
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const pct = scrollHeight - clientHeight > 0 ? scrollTop / (scrollHeight - clientHeight) : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${pct})`;
    };
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [activePage]);

  // Drawer: Escape closes, focus returns to its button.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        drawerBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    const container = mainRef.current;
    if (el && container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollBy({ top: elTop - containerTop - 32, behavior: 'smooth' });
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  }, []);

  const currentLabel =
    NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])])).find((i) => i.page === activePage)?.label ?? 'Docs';

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="docs-shell">
      <aside className="docs-side" aria-label="Documentation sections">
        <SideNav activePage={activePage} onPick={goToPage} />
      </aside>

      <div className="docs-main-wrap" ref={mainRef}>
        <div className="docs-progress" aria-hidden="true">
          <span ref={progressRef} className="docs-progress__bar" />
        </div>

        <div className="docs-mobilebar">
          <button
            ref={drawerBtnRef}
            type="button"
            className="btn btn--quiet btn--sm"
            aria-expanded={drawerOpen}
            aria-controls="docs-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            Contents
          </button>
          <span className="mono muted truncate">{currentLabel}</span>
        </div>

        <motion.div
          key={activePage}
          className="docs-content"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: spring.gentle }}
        >

            {activePage === 'arrays' && (
              <>
                <PageHero group="Data structures" title="Arrays">
                  Learn how to declare, manipulate, and animate arrays in AQVL — the language built for visualizing algorithms.
                </PageHero>

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

                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr>
                          <th>Command</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">HIGHLIGHT</span><br/><span className="tok-param">name[i]</span></td>
                          <td>Pulses the element at index <C>i</C> with a bright accent color. Use it to mark the current element of interest — e.g., the minimum candidate in Selection Sort.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">COMPARE</span><br/><span className="tok-param">name[i]</span><br/><span className="tok-param">name[j]</span></td>
                          <td>Simultaneously highlights two elements to show they are being evaluated against each other. Neither is modified.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SWAP</span> <span className="tok-param">name[i]</span><br/><span className="tok-param">name[j]</span></td>
                          <td>Animates an arc-swap of the values at indices <C>i</C> and <C>j</C>. Both the visual position and the internal value are exchanged.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">UPDATE</span> <span className="tok-param">name[i]</span><br/><span className="tok-param">value</span></td>
                          <td>Sets the element at index <C>i</C> to <C>value</C>, animating the number changing inside the box.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">INSERT</span> <span className="tok-param">name[i]</span><br/><span className="tok-param">value</span></td>
                          <td>Inserts a new box containing <C>value</C> at position <C>i</C>. All subsequent elements shift right with a slide animation. The array grows by one.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">DELETE</span> <span className="tok-param">name[i]</span></td>
                          <td>Removes the element at index <C>i</C>. All subsequent elements shift left to close the gap. The array shrinks by one.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Control Flow</h3>
                  <p className="docs-p">
                    You can use <C>LOOP</C> and <C>IF</C> to build algorithm logic around the array commands above.
                  </p>

                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr>
                          <th>Construct</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">LOOP</span> <span className="tok-param">var</span><br/><span className="tok-keyword">FROM</span> <span className="tok-param">start</span> <span className="tok-keyword">TO</span> <span className="tok-param">end</span></td>
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
                  </div>
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
                    <strong>Expected behavior:</strong> After SWAP, <C>arr</C> becomes <C>[20, 10, 30, 40]</C>.
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
                    <strong>Expected behavior:</strong> After every outer pass, the rightmost unsorted element snaps into
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
                <PageHero group="Data structures" title="Linked Lists">
                  AQVL supports three flavors of linked list: Singly, Doubly, and Circular. Each one is a separate page — select one in the sidebar to dive deep.
                </PageHero>

                {/* ── § Introduction ─────────────────────── */}
                <section id="ll-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    In AQVL, a Linked List is a dynamic sequence of nodes connected by pointers. Each node is drawn as a sphere and each pointer as an arrow. You work with lists the way you would in C: pointer variables such as <C>curr</C> walk the list (<C>curr = curr.next</C>), pointer writes relink nodes (<C>prev.next = curr.next</C>), <C>NEW_NODE</C> allocates and <C>FREE</C> releases memory.
                  </p>
                  <Alert kind="note" title="What you see">
                    The first node is tagged <C>HEAD</C> and the last <C>TAIL</C>; every pointer variable appears as a tag on the node it points to and moves with it. The arrow a pointer follows lights up. A node that is not part of the list — just allocated, or unlinked and waiting for <C>FREE</C> — sits in the list's <em>heap memory</em> box below it, and one that nothing points to any more is flagged <C>LEAKED</C>.
                  </Alert>
                </section>

                {/* ── § Overview: Singly ─────────────────── */}
                <section id="ll-overview-singly" className="docs-section">
                  <h2 className="docs-h2">Singly Linked List</h2>
                  <p className="docs-p">
                    The simplest form. Each node holds a value and a single <em>next</em> pointer; the last node's <em>next</em> is <C>NULL</C>.
                  </p>
                  <CodeBlock label="Syntax" code={`LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <button
                    className="docs-overview-link"
                    onClick={() => goToPage('singly-linked-list')}
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
                    className="docs-overview-link"
                    onClick={() => goToPage('doubly-linked-list')}
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
                    className="docs-overview-link"
                    onClick={() => goToPage('circular-linked-list')}
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
                <PageHero group="Linked lists" title="Singly Linked List">
                  A linear chain of nodes where each node points to the next, ending in <C>NULL</C>. You walk it and relink it with real pointer code.
                </PageHero>

                <section id="sl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Singly Linked List is a sequence of nodes; each stores a value and a single <em>next</em> pointer. <C>list.head</C> is the first node and the last node's <em>next</em> is <C>NULL</C>.
                  </p>
                  <p className="docs-p">
                    Write algorithms as you would in C — pointer variables, <C>WHILE</C> loops and <C>IF</C>s — and every pointer move and pointer write is animated as its own step and explained in the output console.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Nodes are spheres and each <em>next</em> pointer is an arrow. The first node is tagged <C>HEAD</C>, the last <C>TAIL</C>, and pointer variables (<C>curr</C>, <C>prev</C>, ...) are tags that move with them. Unlinked nodes wait in the heap-memory box below the list until <C>FREE</C>.
                  </Alert>
                </section>

                <section id="sl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Singly Linked List</h2>
                  <p className="docs-p">
                    Place your declaration inside the <C>DECLARE</C> block with a name and initial values (<C>LINKEDLIST</C> and <C>SINGLY LINKEDLIST</C> are the same).
                  </p>
                  <CodeBlock label="Syntax" code={`LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE SinglyIntro\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  PRINT list\nEND`} />
                  <p className="docs-p">
                    This prints <C>10 -&gt; 20 -&gt; 30 -&gt; NULL</C>. An empty list (<C>LINKEDLIST list = []</C>) is valid too: its head is <C>NULL</C>.
                  </p>
                </section>

                <section id="sl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <h3 className="docs-h3">Pointer code</h3>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-param">list</span>.head</td>
                        <td>The first node (or <C>NULL</C> when the list is empty). Assignable: <C>list.head = newNode</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">list</span>.tail</td>
                        <td>The last node, found by following <em>next</em> from the head (read-only).</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span>.val</td>
                        <td>The node's value. Assignable: <C>p.val = 25</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span>.next</td>
                        <td>The next node, or <C>NULL</C>. Assign to relink: <C>prev.next = curr.next</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span> = <span className="tok-param">p</span>.next</td>
                        <td>Moves a pointer variable; its tag moves on screen and the followed arrow lights up.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">NEW_NODE</span>(<span className="tok-param">list, value</span>)</td>
                        <td>Allocates an unlinked node in the list’s heap memory and returns it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">FREE</span> <span className="tok-param">p</span></td>
                        <td>Releases the node’s memory. Unlink it first — freeing a linked node warns about dangling pointers.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">LENGTH</span>(<span className="tok-param">list</span>), <span className="tok-param">list</span>[i]</td>
                        <td>Node count, and the node <C>i</C> hops from the head (found by walking the list).</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>

                  <h3 className="docs-h3">Built-in operations</h3>
                  <p className="docs-p">
                    One-line shortcuts. Each one still animates the real work — walking the list node by node and relinking pointers.
                  </p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">list value</span></td>
                        <td>Allocates a node, points it at the old head, then moves <C>head</C> to it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">list value</span></td>
                        <td>Walks to the last node (O(n) — there is no tail pointer), then links the new node after it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">list</span></td>
                        <td>Moves <C>head</C> to the second node — the old head drops into heap memory — then frees it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">list</span></td>
                        <td>Walks to the second-to-last node, sets its <em>next</em> to <C>NULL</C>, then frees the old tail.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT</span> <span className="tok-param">list[i] value</span></td>
                        <td>Walks to position <C>i - 1</C> and links a new node after it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE</span> <span className="tok-param">list[i]</span></td>
                        <td>Walks to position <C>i - 1</C>, unlinks the next node and frees it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">UPDATE</span> <span className="tok-param">list[i] value</span></td>
                        <td>Walks to position <C>i</C> and changes its value.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SEARCH</span> <span className="tok-param">list value</span></td>
                        <td>Follows <em>next</em> from the head comparing values until found or the end.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">REVERSE</span> <span className="tok-param">list</span></td>
                        <td>In-place reversal with prev / curr / next pointers.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">target</span></td>
                        <td>Highlights a node: <C>list[i]</C>, a pointer variable such as <C>curr</C>, or an expression such as <C>curr.next</C>.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="sl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>
                  <h3 className="docs-h3">Example 1 — Traversal</h3>
                  <CodeBlock code={`SCENE SinglyTraverse\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30, 40]\n\nSEQUENCE\n  curr = list.head\n  WHILE curr != NULL\n    PRINT "Visit" curr.val\n    curr = curr.next\n  END\nEND`} />
                  <h3 className="docs-h3">Example 2 — Delete a node by value</h3>
                  <CodeBlock code={`SCENE SinglyDelete\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30, 40]\n\nSEQUENCE\n  // Stop at the node BEFORE the one to delete\n  prev = list.head\n  WHILE prev.next != NULL AND prev.next.val != 30\n    prev = prev.next\n  END\n  IF prev.next != NULL\n    temp = prev.next\n    prev.next = temp.next   // 30 drops into heap memory\n    FREE temp               // and is released\n  END\n  PRINT "List:" list\nEND`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>10 -&gt; 20 -&gt; 40 -&gt; NULL</C>. Node 30 moves to heap memory when it is unlinked and disappears on <C>FREE</C>.
                  </p>
                  <h3 className="docs-h3">Example 3 — Insert at the head</h3>
                  <CodeBlock code={`SCENE SinglyInsertHead\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  newNode = NEW_NODE(list, 5)\n  newNode.next = list.head\n  list.head = newNode\n  PRINT "List:" list\nEND`} />
                  <p className="docs-p">
                    More in the Playground: reversal, middle node, cycle detection, merging, removing the nth node from the end, palindromes and duplicates.
                  </p>
                </section>

                <section id="sl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="NULL pointer dereference">
                    Reading <C>p.next</C> or <C>p.val</C> when <C>p</C> is <C>NULL</C> stops the program with a clear error. Guard loops with <C>WHILE p != NULL</C>; <C>AND</C> / <C>OR</C> short-circuit, so <C>p != NULL AND p.next != NULL</C> is safe.
                  </Alert>
                  <Alert kind="warn" title="Use after free / double free">
                    After <C>FREE p</C> the node is gone: reading through <C>p</C> again, or freeing it twice, is a runtime error. Set <C>p = NULL</C> when you are done with it.
                  </Alert>
                  <Alert kind="tip" title="Variables inside loops are local">
                    A variable first assigned inside a <C>WHILE</C> / <C>IF</C> body only exists inside it. Assign pointers you need afterwards (e.g. <C>tail = NULL</C>) before the loop.
                  </Alert>
                  <Alert kind="warn" title="Index out of range">
                    <C>list[i]</C> must be between <C>0</C> and <C>LENGTH(list) - 1</C>; it is found by walking <C>i</C> nodes from the head.
                  </Alert>
                  <Alert kind="note" title="Forward only">
                    Singly nodes have no <C>prev</C>; reading <C>p.prev</C> is an error. Use a Doubly Linked List for backward traversal.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                DOUBLY LINKED LIST PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'doubly-linked-list' && (
              <>
                <PageHero group="Linked lists" title="Doubly Linked List">
                  Each node carries both a <em>next</em> and a <em>prev</em> pointer, so the list can be walked in both directions.
                </PageHero>

                <section id="dl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Doubly Linked List adds a backward (<em>prev</em>) pointer to every node: forward from <C>list.head</C> following <C>next</C>, backward from the last node following <C>prev</C>. The head's <em>prev</em> and the tail's <em>next</em> are <C>NULL</C>.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Every pair of neighbours is joined by two separate arrows: the <em>next</em> arrow pointing right runs above the <em>prev</em> arrow pointing left.
                  </Alert>
                </section>

                <section id="dl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Doubly Linked List</h2>
                  <CodeBlock label="Syntax" code={`DOUBLY LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">
                    Every initial node is wired with both pointers. After that, <C>p.prev</C> is read and written just like <C>p.next</C> — keeping both directions consistent is part of the algorithm (see the examples).
                  </p>
                </section>

                <section id="dl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <h3 className="docs-h3">Pointer code</h3>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-param">list</span>.head</td>
                        <td>The first node (or <C>NULL</C> when the list is empty). Assignable: <C>list.head = newNode</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">list</span>.tail</td>
                        <td>The last node, found by following <em>next</em> from the head (read-only).</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span>.val</td>
                        <td>The node's value. Assignable: <C>p.val = 25</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span>.next</td>
                        <td>The next node, or <C>NULL</C>. Assign to relink: <C>prev.next = curr.next</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span>.prev</td>
                        <td>The previous node, or <C>NULL</C> (doubly lists only). Assign to relink.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span> = <span className="tok-param">p</span>.next</td>
                        <td>Moves a pointer variable; its tag moves on screen and the followed arrow lights up.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">NEW_NODE</span>(<span className="tok-param">list, value</span>)</td>
                        <td>Allocates an unlinked node in the list’s heap memory and returns it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">FREE</span> <span className="tok-param">p</span></td>
                        <td>Releases the node’s memory. Unlink it first — freeing a linked node warns about dangling pointers.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">LENGTH</span>(<span className="tok-param">list</span>), <span className="tok-param">list</span>[i]</td>
                        <td>Node count, and the node <C>i</C> hops from the head (found by walking the list).</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>

                  <h3 className="docs-h3">Built-in operations</h3>
                  <p className="docs-p">The built-ins update both <em>next</em> and <em>prev</em> for you, animating every pointer they change.</p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">list value</span></td>
                        <td>Same as singly, plus the old head’s <em>prev</em> is pointed back at the new node.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">list value</span></td>
                        <td>Walks to the last node, links the new node after it and points its <em>prev</em> back.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">list</span></td>
                        <td>As singly, and clears the new head’s <em>prev</em>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">list</span></td>
                        <td>As singly (the new tail’s <em>next</em> becomes <C>NULL</C>).</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT</span> <span className="tok-param">list[i] value</span></td>
                        <td>Walks to position <C>i - 1</C> and links a new node after it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE</span> <span className="tok-param">list[i]</span></td>
                        <td>Walks to position <C>i - 1</C>, unlinks the next node and frees it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">UPDATE</span> <span className="tok-param">list[i] value</span></td>
                        <td>Walks to position <C>i</C> and changes its value.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SEARCH</span> <span className="tok-param">list value</span></td>
                        <td>Follows <em>next</em> from the head comparing values until found or the end.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">REVERSE</span> <span className="tok-param">list</span></td>
                        <td>In-place reversal with prev / curr / next pointers (also swaps every <em>prev</em>).</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">target</span></td>
                        <td>Highlights a node: <C>list[i]</C>, a pointer variable such as <C>curr</C>, or an expression such as <C>curr.next</C>.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="dl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>
                  <h3 className="docs-h3">Example 1 — Both directions</h3>
                  <CodeBlock code={`SCENE DoublyBothWays\n\nDECLARE\n  DOUBLY LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  curr = list.head\n  tail = NULL\n  WHILE curr != NULL\n    PRINT "Forward:" curr.val\n    tail = curr\n    curr = curr.next\n  END\n  curr = tail\n  WHILE curr != NULL\n    PRINT "Backward:" curr.val\n    curr = curr.prev\n  END\nEND`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> Forward 10, 20, 30 then Backward 30, 20, 10 — the backward pass follows (and lights up) the <em>prev</em> arrows.
                  </p>
                  <h3 className="docs-h3">Example 2 — Unlink a node in both directions</h3>
                  <CodeBlock code={`SCENE DoublyUnlink\n\nDECLARE\n  DOUBLY LINKEDLIST list = [10, 20, 30, 40]\n\nSEQUENCE\n  curr = list.head\n  WHILE curr != NULL AND curr.val != 30\n    curr = curr.next\n  END\n  curr.prev.next = curr.next\n  curr.next.prev = curr.prev\n  FREE curr\n  curr = NULL\n  PRINT "List:" list\nEND`} />
                </section>

                <section id="dl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="NULL pointer dereference">
                    Reading <C>p.next</C> or <C>p.val</C> when <C>p</C> is <C>NULL</C> stops the program with a clear error. Guard loops with <C>WHILE p != NULL</C>; <C>AND</C> / <C>OR</C> short-circuit, so <C>p != NULL AND p.next != NULL</C> is safe.
                  </Alert>
                  <Alert kind="warn" title="Use after free / double free">
                    After <C>FREE p</C> the node is gone: reading through <C>p</C> again, or freeing it twice, is a runtime error. Set <C>p = NULL</C> when you are done with it.
                  </Alert>
                  <Alert kind="tip" title="Variables inside loops are local">
                    A variable first assigned inside a <C>WHILE</C> / <C>IF</C> body only exists inside it. Assign pointers you need afterwards (e.g. <C>tail = NULL</C>) before the loop.
                  </Alert>
                  <Alert kind="warn" title="Index out of range">
                    <C>list[i]</C> must be between <C>0</C> and <C>LENGTH(list) - 1</C>; it is found by walking <C>i</C> nodes from the head.
                  </Alert>
                  <Alert kind="tip" title="Four pointers per insertion">
                    Inserting between two nodes changes four pointers: the new node's <C>prev</C> and <C>next</C>, the right neighbour's <C>prev</C> and the left neighbour's <C>next</C>. Update the neighbours last.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                CIRCULAR LINKED LIST PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'circular-linked-list' && (
              <>
                <PageHero group="Linked lists" title="Circular Linked List">
                  The last node wraps back to the first, creating a loop with no <C>NULL</C> at the end. Declared with the <span className="tok-circular">CIRCULAR</span> keyword.
                </PageHero>

                <section id="cl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Circular Linked List is a singly linked list whose last node's <em>next</em> points back to the head instead of <C>NULL</C>. It suits round-robin scheduling, buffers, and anything that wraps around.
                  </p>
                  <Alert kind="note" title="Visualization">
                    The wrap-around pointer from the tail back to the head is drawn as a curved arrow beneath the row, so the circle is visible at a glance.
                  </Alert>
                </section>

                <section id="cl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Circular Linked List</h2>
                  <CodeBlock label="Syntax" code={`CIRCULAR LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">
                    The initial nodes are linked into a circle. From then on, keeping it closed is up to your code (or the built-ins): when you add or remove at either end, re-point the tail's <C>next</C> at the head.
                  </p>
                </section>

                <section id="cl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <h3 className="docs-h3">Pointer code</h3>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-param">list</span>.head</td>
                        <td>The first node (or <C>NULL</C> when the list is empty). Assignable: <C>list.head = newNode</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">list</span>.tail</td>
                        <td>The last node, found by following <em>next</em> from the head (read-only).</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span>.val</td>
                        <td>The node's value. Assignable: <C>p.val = 25</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span>.next</td>
                        <td>The next node, or <C>NULL</C>. Assign to relink: <C>prev.next = curr.next</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-param">p</span> = <span className="tok-param">p</span>.next</td>
                        <td>Moves a pointer variable; its tag moves on screen and the followed arrow lights up.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">NEW_NODE</span>(<span className="tok-param">list, value</span>)</td>
                        <td>Allocates an unlinked node in the list’s heap memory and returns it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">FREE</span> <span className="tok-param">p</span></td>
                        <td>Releases the node’s memory. Unlink it first — freeing a linked node warns about dangling pointers.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">LENGTH</span>(<span className="tok-param">list</span>), <span className="tok-param">list</span>[i]</td>
                        <td>Node count, and the node <C>i</C> hops from the head (found by walking the list).</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>

                  <h3 className="docs-h3">Built-in operations</h3>
                  <p className="docs-p">The built-ins keep the circle closed, animating the walk to the tail when they need it.</p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">list value</span></td>
                        <td>Same as singly, plus the tail is found and its <em>next</em> re-pointed at the new head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">list value</span></td>
                        <td>Walks to the last node; the new node’s <em>next</em> wraps around to the head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">list</span></td>
                        <td>Re-points the tail past the old head so the circle stays closed, then moves <C>head</C> and frees the old head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">list</span></td>
                        <td>Walks to the second-to-last node and points it at the head, then frees the old tail.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT</span> <span className="tok-param">list[i] value</span></td>
                        <td>Walks to position <C>i - 1</C> and links a new node after it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE</span> <span className="tok-param">list[i]</span></td>
                        <td>Walks to position <C>i - 1</C>, unlinks the next node and frees it.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">UPDATE</span> <span className="tok-param">list[i] value</span></td>
                        <td>Walks to position <C>i</C> and changes its value.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SEARCH</span> <span className="tok-param">list value</span></td>
                        <td>Follows <em>next</em> from the head comparing values until found or the end.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">REVERSE</span> <span className="tok-param">list</span></td>
                        <td>In-place reversal with prev / curr / next pointers (and re-closes the circle).</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">target</span></td>
                        <td>Highlights a node: <C>list[i]</C>, a pointer variable such as <C>curr</C>, or an expression such as <C>curr.next</C>.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="cl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>
                  <h3 className="docs-h3">Example 1 — One lap around the circle</h3>
                  <CodeBlock code={`SCENE CircularLap\n\nDECLARE\n  CIRCULAR LINKEDLIST clist = [10, 20, 30]\n\nSEQUENCE\n  curr = clist.head\n  PRINT "Visit" curr.val\n  curr = curr.next\n  WHILE curr != clist.head\n    PRINT "Visit" curr.val\n    curr = curr.next\n  END\nEND`} />
                  <p className="docs-p">
                    There is no <C>NULL</C> to stop at, so the loop ends when <C>curr</C> is back at the head.
                  </p>
                  <h3 className="docs-h3">Example 2 — Append and keep the circle closed</h3>
                  <CodeBlock code={`SCENE CircularAppend\n\nDECLARE\n  CIRCULAR LINKEDLIST clist = [1, 2, 3]\n\nSEQUENCE\n  tail = clist.head\n  WHILE tail.next != clist.head\n    tail = tail.next\n  END\n  newNode = NEW_NODE(clist, 4)\n  newNode.next = clist.head   // the new tail wraps around\n  tail.next = newNode\n  PRINT "List:" clist\nEND`} />
                </section>

                <section id="cl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Infinite loop risk">
                    <C>WHILE curr != NULL</C> never ends on a circular list. Stop when you are back at the head (<C>WHILE curr != list.head</C>) instead.
                  </Alert>
                  <Alert kind="warn" title="NULL pointer dereference">
                    Reading <C>p.next</C> or <C>p.val</C> when <C>p</C> is <C>NULL</C> stops the program with a clear error. Guard loops with <C>WHILE p != NULL</C>; <C>AND</C> / <C>OR</C> short-circuit, so <C>p != NULL AND p.next != NULL</C> is safe.
                  </Alert>
                  <Alert kind="warn" title="Use after free / double free">
                    After <C>FREE p</C> the node is gone: reading through <C>p</C> again, or freeing it twice, is a runtime error. Set <C>p = NULL</C> when you are done with it.
                  </Alert>
                  <Alert kind="tip" title="Variables inside loops are local">
                    A variable first assigned inside a <C>WHILE</C> / <C>IF</C> body only exists inside it. Assign pointers you need afterwards (e.g. <C>tail = NULL</C>) before the loop.
                  </Alert>
                  <Alert kind="warn" title="Index out of range">
                    <C>list[i]</C> must be between <C>0</C> and <C>LENGTH(list) - 1</C>; it is found by walking <C>i</C> nodes from the head.
                  </Alert>
                </section>
              </>
            )}
            {/* ══════════════════════════════════════════════
                TREES PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'trees' && (
              <>
                <PageHero group="Data structures" title="Trees">
                  Binary trees and binary search trees you program the way you would in C: node pointers, loops, recursion and explicit memory — every step animated and explained.
                </PageHero>
                <section id="tr-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">A tree is made of nodes. In a binary tree each node holds a value (<C>val</C>) and two pointers, <C>left</C> and <C>right</C>; <C>NULL</C> means “no child”. The tree itself holds one pointer, <C>root</C>.</p>
                  <p className="docs-p">You write tree algorithms with real code — <C>curr = curr.left</C>, <C>parent.right = n</C>, recursive <C>FUNCTION</C>s, a <C>QUEUE</C> or <C>STACK</C> of node pointers — and AQVL animates every pointer move, pointer change, call and return, with a console line for each. Pointer variables appear as tags on the node they point to, the node at the top is tagged <C>ROOT</C>, and the running recursion is shown as a call stack beside the tree.</p>
                </section>
                <section id="tr-overview-general" className="docs-section">
                  <h2 className="docs-h2">General Tree</h2>
                  <p className="docs-p">A tree whose nodes can have any number of children, built with the <C>ROOT</C> and <C>CHILD</C> commands.</p>
                  <button className="docs-overview-link" onClick={() => goToPage('general-tree')}>
                    → Open full General Tree documentation
                  </button>
                </section>
                <section id="tr-overview-binary" className="docs-section">
                  <h2 className="docs-h2">Binary Tree</h2>
                  <CodeBlock label="Syntax" code={`BINARY_TREE t = [1, 2, 3, NULL, 5]`} />
                  <p className="docs-p">Values are given in level order, left to right; <C>NULL</C> leaves a child empty. <C>BINARY_TREE t = []</C> starts empty.</p>
                  <button className="docs-overview-link" onClick={() => goToPage('binary-tree')}>
                    → Open full Binary Tree documentation
                  </button>
                </section>
                <section id="tr-overview-bst" className="docs-section">
                  <h2 className="docs-h2">Binary Search Tree</h2>
                  <CodeBlock label="Syntax" code={`BST t = [50, 30, 70, 20, 40]`} />
                  <p className="docs-p">The values are inserted in order: smaller keys go left, larger keys go right. Everything that works on a binary tree works on a BST.</p>
                  <button className="docs-overview-link" onClick={() => goToPage('bst')}>
                    → Open full Binary Search Tree documentation
                  </button>
                </section>
              </>
            )}
            {activePage === 'general-tree' && (
              <>
                <PageHero group="Trees" title="General Tree">
                  A hierarchical structure where nodes can have multiple children. Build the tree, modify it, and visualize traversals and searches.
                </PageHero>

                <section id="gt-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A General Tree implies a hierarchical structure. In AQVL, you can directly build and interact with trees in the <C>SEQUENCE</C> block by designating a <C>ROOT</C> and adding nodes as a <C>CHILD</C>.
                  </p>
                  <p className="docs-p">
                    AQVL handles the complex 3D layout of the tree automatically, ensuring that parent-child relationships are clearly visible as expanding branches.
                  </p>
                </section>

                <section id="gt-declaration" className="docs-section">
                  <h2 className="docs-h2">Building a General Tree</h2>
                  <p className="docs-p">
                    General tree operations can be invoked directly in the sequence. You start by setting a <C>ROOT</C> node and then defining relationships using <C>CHILD</C>.
                  </p>
                  <CodeBlock label="Syntax" code={`ROOT <value>\nCHILD <parentValue> <childValue>`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE MyTree\n\nSEQUENCE\n  ROOT A\n  CHILD A B\n  CHILD A C\nEND`} />
                </section>

                <section id="gt-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    Tree commands inside the <C>SEQUENCE</C> block allow you to manipulate structure, traverse, and query relationships.
                  </p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">ROOT</span> <span className="tok-param">value</span></td>
                        <td>Initializes the tree with a root node of <C>value</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">CHILD</span> <span className="tok-param">parentValue childValue</span></td>
                        <td>Adds a new node <C>childValue</C> under the existing <C>parentValue</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT</span> <span className="tok-param">childValue</span> <span className="tok-keyword">INTO</span> <span className="tok-param">parentValue</span></td>
                        <td>Dynamically inserts a new child node to an existing parent, adjusting the layout.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE</span> <span className="tok-param">value</span></td>
                        <td>Removes the node with the specified value and all its descendants.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SEARCH</span> <span className="tok-param">targetValue</span></td>
                        <td>Searches the tree for the target, highlighting nodes as they are visited.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">PREORDER</span> / <span className="tok-keyword">LEVELORDER</span> / <span className="tok-keyword">DFS</span> / <span className="tok-keyword">BFS</span></td>
                        <td>Animates a specific tree traversal step-by-step.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">HEIGHT</span> / <span className="tok-keyword">SIZE</span> / <span className="tok-keyword">LEAVES</span></td>
                        <td>Tree queries that compute properties of the tree.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">ANCESTORS</span> <span className="tok-param">value</span> / <span className="tok-keyword">PATH</span> <span className="tok-param">val1 val2</span></td>
                        <td>Relationship queries that trace and highlight connections in the tree.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="gt-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Comprehensive Tree Operations</h3>
                  <p className="docs-p">
                    Build a tree, traverse it, search for a node, perform queries, and modify it.
                  </p>
                  <CodeBlock code={`SCENE TreeOperations\n\nSEQUENCE\n    // 1. Create a tree and root node\n    ROOT A\n    \n    // 2. Add children\n    CHILD A B\n    CHILD A C\n    CHILD B D\n    CHILD B E\n    \n    // 3. Tree Traversals\n    PREORDER\n    LEVELORDER\n    DFS\n    BFS\n    \n    // 4. Searches\n    SEARCH E\n    \n    // 5. Tree Queries\n    HEIGHT\n    SIZE\n    LEAVES\n    \n    // 6. Modifications\n    INSERT F INTO B\n    DELETE D\n    \n    // 7. Relationships\n    ANCESTORS F\n    PATH A F\nEND`} />
                </section>

                <section id="gt-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Unique Values">
                    The value of each node is used to identify it. Adding a <C>CHILD</C> with a value that already exists will cause unexpected behavior or an error.
                  </Alert>
                  <Alert kind="tip" title="Use the Console">
                    Traversals and searches output a detailed log in the Playground Output Console, allowing you to follow the algorithm's decisions textually while watching the animation.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                BINARY TREE PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'binary-tree' && (
              <>
                <PageHero group="Trees" title="Binary Tree">
                  Every node has a value and two pointers, left and right. Build, walk and change the tree with pointer code, loops and recursion.
                </PageHero>
                <section id="bt-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">A binary tree node has at most two children. AQVL lays the tree out automatically — one column per node in inorder position, one row per level, so subtrees never overlap — and keeps nodes still while your code is in the middle of restructuring the tree.</p>
                  <p className="docs-p">Nodes that are not part of the tree — just created with <C>NEW_NODE</C>, or cut out by a pointer change — wait in the <b>heap memory</b> box below the tree until <C>FREE</C> releases them. A node that nothing points to any more is flagged <C>LEAKED</C>.</p>
                </section>
                <section id="bt-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Binary Tree</h2>
                  <CodeBlock label="Syntax" code={`BINARY_TREE <name> = [values in level order, NULL for an empty child]`} />
                  <CodeBlock code={`SCENE BuildATree\nDECLARE\n  BINARY_TREE t = []\nSEQUENCE\n  root = NEW_NODE(t, 10)\n  t.root = root\n  root.left = NEW_NODE(t, 20)\n  root.right = NEW_NODE(t, 30)\n  PRINT t\nEND`} />
                  <p className="docs-p"><C>BINARY_TREE t = [1, NULL, 2, 3]</C> gives 1 with no left child, 2 as its right child, and 3 as the left child of 2.</p>
                </section>
                <section id="bt-commands" className="docs-section">
                  <h2 className="docs-h2">Pointer Code Reference</h2>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
                    <tbody>
                      <tr><td><C>t.root</C></td><td>The top node, or NULL for an empty tree. Assignable: <C>t.root = n</C>.</td></tr>
                      <tr><td><C>node.val</C></td><td>The node's value (<C>node.value</C> also works). Assignable.</td></tr>
                      <tr><td><C>node.left / node.right</C></td><td>The child pointers (NULL = no child). Assignable: <C>parent.left = n</C>.</td></tr>
                      <tr><td><C>n = NEW_NODE(t, 42)</C></td><td>Allocate a new node (left and right NULL). It waits in heap memory until linked in.</td></tr>
                      <tr><td><C>FREE n</C></td><td>Release a node's memory. Unlink it first; free children before their parent.</td></tr>
                      <tr><td><C>FUNCTION f(node) ... END</C></td><td>A function; it may call itself. Its body accepts every statement plus <C>RETURN value</C>.</td></tr>
                      <tr><td><C>QUEUE q = [] / STACK s = []</C></td><td>Hold values or node pointers: <C>ENQUEUE q node.left</C>, <C>node = DEQUEUE(q)</C>, <C>PUSH s curr</C>, <C>curr = POP(s)</C>, <C>FRONT(q)</C>, <C>PEEK(s)</C>, <C>LENGTH(q)</C>, <C>IS_EMPTY(s)</C>.</td></tr>
                      <tr><td><C>MAX(a, b) / MIN(a, b) / ABS(x)</C></td><td>Arithmetic helpers, e.g. <C>RETURN 1 + MAX(lh, rh)</C>.</td></tr>
                      <tr><td><C>PRINT t</C></td><td>Prints the tree level by level: <C>Level 0: 1 | Level 1: 2 3</C>.</td></tr>
                      <tr><td><C>LENGTH(t)</C></td><td>Number of nodes reachable from the root.</td></tr>
                      <tr><td><C>HIGHLIGHT node 'SUCCESS'</C></td><td>Mark a node (a lasting color) — e.g. the nodes on a found path.</td></tr>
                    </tbody>
                  </table>
                  </div>
                  <p className="docs-p">Words such as <C>node</C>, <C>root</C>, <C>height</C>, <C>size</C>, <C>level</C>, <C>sum</C>, <C>min</C> and <C>max</C> can be used as variable and function names.</p>
                  <p className="docs-p">One-line built-ins also exist and animate the same walk: <C>INORDER t</C>, <C>PREORDER t</C>, <C>POSTORDER t</C>, <C>LEVELORDER t</C>, <C>HEIGHT t</C>, <C>SIZE t</C>, <C>LEAVES t</C>, <C>MIN t</C>, <C>MAX t</C>, <C>MIRROR t</C>, <C>SEARCH t 42</C>, <C>INSERT t 42</C> (first free spot in level order), <C>CLEAR t</C>.</p>
                </section>
                <section id="bt-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>
                  <p className="docs-p">Recursive inorder traversal — every call and return is a step, and the call stack is shown beside the tree:</p>
                  <CodeBlock code={`SCENE Inorder\nDECLARE\n  BINARY_TREE t = [1, 2, 3, 4, 5]\n  FUNCTION inorder(node)\n    IF node == NULL\n      RETURN\n    END\n    inorder(node.left)\n    PRINT node.val\n    inorder(node.right)\n  END\nSEQUENCE\n  inorder(t.root)\nEND`} />
                  <p className="docs-p">Level-order (breadth-first) traversal with a queue of node pointers:</p>
                  <CodeBlock code={`SCENE LevelOrder\nDECLARE\n  BINARY_TREE t = [8, 3, 10, 1, 6]\n  QUEUE q = []\nSEQUENCE\n  ENQUEUE q t.root\n  WHILE LENGTH(q) > 0\n    node = DEQUEUE(q)\n    PRINT node.val\n    IF node.left != NULL\n      ENQUEUE q node.left\n    END\n    IF node.right != NULL\n      ENQUEUE q node.right\n    END\n  END\nEND`} />
                  <p className="docs-p">The Playground has twelve complete tree programs: traversals, height and size, views, path sum, mirroring, BST search / insert / delete, validation and lowest common ancestor.</p>
                </section>
                <section id="bt-errors" className="docs-section">
                  <h2 className="docs-h2">Errors & Tips</h2>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead><tr><th>Message</th><th>What to do</th></tr></thead>
                    <tbody>
                      <tr><td><C>NULL pointer dereference</C></td><td>Reading <C>node.left</C> when <C>node</C> is NULL. Check <C>IF node == NULL</C> first — in recursion this is the base case.</td></tr>
                      <tr><td><C>Use after free / Double free</C></td><td>The node's memory was already released.</td></tr>
                      <tr><td><C>node.parent does not exist</C></td><td>Nodes have only left and right pointers. Keep the parent in a variable as you walk down.</td></tr>
                      <tr><td><C>DEQUEUE / POP on an empty container</C></td><td>Loop with <C>WHILE LENGTH(q) &gt; 0</C>.</td></tr>
                      <tr><td><C>RETURN can only be used inside a FUNCTION</C></td><td>The SEQUENCE block is not a function.</td></tr>
                    </tbody>
                  </table>
                  </div>
                  <p className="docs-p">Variables assigned inside a function are local to that call — return results with <C>RETURN</C>. Short-circuit <C>AND</C> / <C>OR</C> make <C>WHILE curr != NULL AND curr.val != key</C> safe.</p>
                </section>
              </>
            )}
            {activePage === 'stacks' && (
              <>
                <PageHero group="Data structures" title="Stacks">
                  A last-in, first-out pile of values. AQVL renders a stack as a vertical column of boxes that grows upward on <C>PUSH</C> and shrinks on <C>POP</C>.
                </PageHero>

                <section id="sk-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>STACK</C> is a LIFO (last-in, first-out) collection: the only element you can read or remove is
                    the one most recently added — the <em>top</em>. Stacks are the backbone of recursion, undo history,
                    expression evaluation, and iterative depth-first search.
                  </p>
                  <p className="docs-p">
                    Unlike an <C>ARRAY</C>, a stack has no indexing commands in its everyday vocabulary. You interact
                    with it entirely through <C>PUSH</C>, <C>POP</C>, and <C>PEEK</C>, which is exactly what makes the
                    animation readable: every frame shows one element entering or leaving at a single point.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Stack elements are laid out as a vertical column (bottom-up), with the top element tagged <C>TOP</C>.
                    A pushed element grows in on top and a popped element shrinks away, so the LIFO order is visible
                    rather than implied. The console prints the whole stack (bottom → top) after every change.
                  </Alert>
                </section>

                <section id="sk-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Stack</h2>
                  <p className="docs-p">
                    Declare a stack inside the <C>DECLARE</C> block. The initializer is optional — a stack may start
                    empty and be filled entirely from the <C>SEQUENCE</C> block.
                  </p>
                  <CodeBlock label="Syntax" code={`STACK <name>
STACK <name> = [<value>, <value>, ...]`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE StackIntro

DECLARE
  STACK s = [10, 20]

SEQUENCE
  PUSH s 30
  PEEK s
  POP s
END`} />
                  <p className="docs-p">
                    On load the visualizer shows a two-box column with <em>20</em> on top. The sequence then pushes
                    <em> 30</em>, flashes it as the current top, and removes it again.
                  </p>
                  <Alert kind="tip" title="Empty stacks are allowed">
                    Unlike <C>ARRAY</C>, which requires an initializer, <C>STACK s</C> on its own is valid. The listed
                    values are pushed bottom-to-top, so <C>STACK s = [10, 20]</C> leaves <C>20</C> on top.
                  </Alert>
                </section>

                <section id="sk-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    Every stack command takes the stack's name as its first argument, so a scene can animate several
                    stacks side by side.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">PUSH</span> <span className="tok-param">name value</span></td>
                          <td>Creates a new element carrying <C>value</C> and drops it onto the top of the stack. The column grows by one.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">POP</span> <span className="tok-param">name</span></td>
                          <td>Removes the top element and animates it lifting away. Popping an empty stack is a runtime underflow error.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">PEEK</span> <span className="tok-param">name</span></td>
                          <td>Highlights the top element without removing it. The stack is left unchanged.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SIZE</span> <span className="tok-param">name</span></td>
                          <td>Reports the current element count to the output console.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IS_EMPTY</span> <span className="tok-param">name</span></td>
                          <td>Reports whether the stack currently holds zero elements.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CLEAR</span> <span className="tok-param">name</span></td>
                          <td>Removes every element at once, returning the stack to its empty state.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">WAIT</span></td>
                          <td>Pauses one animation beat — useful between a <C>PEEK</C> and the <C>POP</C> that follows it.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Using a Stack Inside Expressions</h3>
                  <p className="docs-p">
                    Real stack algorithms need the value that comes off the stack. These forms work anywhere an
                    expression is allowed — assignments, <C>IF</C> and <C>WHILE</C> conditions, array indexes,
                    function arguments:
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Expression</th><th>Value</th></tr>
                      </thead>
                      <tbody>
                        <tr><td><C>x = POP(s)</C></td><td>Removes the top element and returns it.</td></tr>
                        <tr><td><C>x = PEEK(s)</C></td><td>Returns the top element without removing it.</td></tr>
                        <tr><td><C>IS_EMPTY(s)</C></td><td>True when the stack holds nothing.</td></tr>
                        <tr><td><C>LENGTH(s)</C></td><td>The number of elements currently on the stack.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    A stack holds numbers or text (<C>PUSH s "("</C>, <C>PUSH s arr[i]</C>, <C>PUSH s total + 1</C>).
                    <C>AND</C> / <C>OR</C> short-circuit, so the standard guard is safe:
                    <C>WHILE LENGTH(s) &gt; 0 AND PEEK(s) &lt; x</C> never peeks at an empty stack.
                  </p>
                </section>

                <section id="sk-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Every Stack Operation</h3>
                  <p className="docs-p">Each command in turn, so you can watch what every one of them looks like.</p>
                  <CodeBlock code={`SCENE StackOps

DECLARE
  STACK s

SEQUENCE
  PUSH s 10
  PUSH s 20
  PUSH s 30

  // Look at the top without removing it
  PEEK s
  WAIT

  // Remove the top element
  POP s
  SIZE s
  IS_EMPTY s

  CLEAR s
  IS_EMPTY s
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the column builds up to <C>10, 20, 30</C> (30 on top),
                    <C>PEEK</C> flashes 30, <C>POP</C> removes it leaving size 2, and <C>CLEAR</C> empties the column so
                    the final <C>IS_EMPTY</C> reports true.
                  </p>

                  <h3 className="docs-h3">Example 2 — Reversing an Array With a Stack</h3>
                  <p className="docs-p">
                    The canonical use of LIFO order: push every element in order, then pop them back into the array
                    from index 0. The last element pushed is the first one popped, so the array ends up reversed.
                  </p>
                  <CodeBlock code={`SCENE ReverseWithStack

DECLARE
  ARRAY arr = [1, 2, 3, 4]
  STACK s

SEQUENCE
  // Push left to right
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    PUSH s arr[i]
  END

  // Pop back into the array: the top (4) goes to index 0
  LOOP i FROM 0 TO LENGTH(arr) - 1
    value = POP(s)
    UPDATE arr[i] value
  END
  PRINT "Reversed:" arr
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the column fills bottom-up with 1, 2, 3, 4 and then unwinds
                    4, 3, 2, 1 into the array; the console prints <C>Reversed: [4, 3, 2, 1]</C>.
                  </p>

                  <h3 className="docs-h3">Example 3 — Balanced Brackets</h3>
                  <p className="docs-p">
                    Every opening bracket is pushed; every closing bracket must match the top of the stack. At the
                    end the stack must be empty.
                  </p>
                  <CodeBlock code={`SCENE Brackets

DECLARE
  ARRAY expr = ["(", "[", "]", ")"]
  STACK pending

SEQUENCE
  isBalanced = 1
  LOOP i FROM 0 TO LENGTH(expr) - 1
    ch = expr[i]
    IF ch == "(" OR ch == "["
      PUSH pending ch
    ELSE IF IS_EMPTY(pending)
      isBalanced = 0
    ELSE
      last = POP(pending)
      IF (ch == ")" AND last != "(") OR (ch == "]" AND last != "[")
        isBalanced = 0
      END
    END
  END

  IF isBalanced == 1 AND IS_EMPTY(pending)
    PRINT "Balanced"
  ELSE
    PRINT "Not balanced"
  END
END`} />
                  <p className="docs-p">
                    The Playground's <strong>Stacks</strong> category has fifteen worked examples, including a stack built
                    on an array with overflow checks, postfix evaluation, infix-to-postfix, next greater element,
                    stock span, min stack, undo / redo and more.
                  </p>
                </section>

                <section id="sk-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Stack underflow">
                    <C>POP</C> or <C>PEEK</C> on an empty stack raises a stack-underflow error and halts the sequence.
                    Check first: <C>IF IS_EMPTY(s)</C> … <C>ELSE x = POP(s)</C>, or loop with <C>WHILE LENGTH(s) &gt; 0</C>.
                    Guard long pop loops with <C>IS_EMPTY</C>, or bound the loop by the number of elements you pushed.
                  </Alert>

                  <Alert kind="warn" title="The stack name is required">
                    Write <C>PUSH s 10</C>, not <C>PUSH 10</C>. The first argument of every stack command names the
                    target stack; omitting it makes the value itself get read as the stack name.
                  </Alert>

                  <Alert kind="warn" title="Avoid reserved words as names">
                    Keyword matching is case-insensitive, so <C>STACK size</C> or <C>STACK head</C> fail to parse —
                    <C>SIZE</C> and <C>HEAD</C> are language keywords. Prefer names like <C>s</C>, <C>callStack</C>,
                    or <C>inbox</C>.
                  </Alert>

                  <Alert kind="tip" title="Stacks are not indexable by convention">
                    Reaching into the middle of a stack defeats the abstraction the visualization is teaching. Use
                    <C>PEEK</C> for the top, and reach for an <C>ARRAY</C> when you genuinely need random access.
                  </Alert>

                  <Alert kind="note" title="Changing the layout">
                    A stack defaults to a vertical column. <C>LAYOUT s AS LINE(axis=horizontal)</C> lays it out as a row
                    instead — see the Layout &amp; Camera page.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                QUEUES PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'queues' && (
              <>
                <PageHero group="Data structures" title="Queues">
                  A first-in, first-out line of values. Elements join at the rear and leave from the front, rendered as a horizontal row that advances as it drains.
                </PageHero>

                <section id="qu-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>QUEUE</C> is a FIFO (first-in, first-out) collection. New elements are added at the <em>rear</em>
                    with <C>ENQUEUE</C>; elements leave from the <em>front</em> with <C>DEQUEUE</C>. It is the structure
                    behind breadth-first search, level-order tree traversal, scheduling, and buffering.
                  </p>
                  <p className="docs-p">
                    Queues are the mirror image of stacks, and AQVL keeps that contrast visual: a stack is a vertical
                    column that grows and shrinks at one end, while a queue is a horizontal row with two distinct ends.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Queue elements are laid out left to right, front-most first. <C>FRONT</C> and <C>REAR</C> highlight
                    the two ends without modifying the queue.
                  </Alert>
                </section>

                <section id="qu-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Queue</h2>
                  <p className="docs-p">
                    As with stacks, the initializer is optional. Listed values are enqueued left to right, so the first
                    value is the front of the queue.
                  </p>
                  <CodeBlock label="Syntax" code={`QUEUE <name>
QUEUE <name> = [<value>, <value>, ...]`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE QueueIntro

DECLARE
  QUEUE q = [1, 2, 3]

SEQUENCE
  ENQUEUE q 4
  FRONT q
  DEQUEUE q
END`} />
                  <p className="docs-p">
                    The row starts as <C>1, 2, 3</C>, gains a <C>4</C> at the rear, flashes <C>1</C> as the front, then
                    removes it — leaving <C>2, 3, 4</C>.
                  </p>
                </section>

                <section id="qu-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">ENQUEUE</span> <span className="tok-param">name value</span></td>
                          <td>Adds a new element carrying <C>value</C> at the rear of the queue.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">DEQUEUE</span> <span className="tok-param">name</span></td>
                          <td>Removes the front element; the remaining elements slide forward to close the gap.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">FRONT</span> <span className="tok-param">name</span></td>
                          <td>Highlights the front element (the next one to leave) without removing it.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">REAR</span> <span className="tok-param">name</span></td>
                          <td>Highlights the rear element (the most recently added) without removing it.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SIZE</span> <span className="tok-param">name</span></td>
                          <td>Reports the current element count to the output console.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IS_EMPTY</span> <span className="tok-param">name</span></td>
                          <td>Reports whether the queue currently holds zero elements.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CLEAR</span> <span className="tok-param">name</span></td>
                          <td>Removes every element at once.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="qu-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Every Queue Operation</h3>
                  <CodeBlock code={`SCENE QueueOps

DECLARE
  QUEUE q

SEQUENCE
  ENQUEUE q 10
  ENQUEUE q 20
  ENQUEUE q 30

  // Inspect both ends
  FRONT q
  WAIT
  REAR q
  WAIT

  DEQUEUE q
  SIZE q
  IS_EMPTY q

  CLEAR q
  IS_EMPTY q
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the row builds to <C>10, 20, 30</C>; <C>FRONT</C> flashes 10 and
                    <C>REAR</C> flashes 30; <C>DEQUEUE</C> removes 10 and the rest slide left.
                  </p>

                  <h3 className="docs-h3">Example 2 — Feeding a Queue From an Array</h3>
                  <p className="docs-p">
                    A loop that enqueues each array element, then drains the queue in the same order it was filled —
                    FIFO preserves order, unlike the stack version on the Stacks page.
                  </p>
                  <CodeBlock code={`SCENE QueueFromArray

DECLARE
  ARRAY arr = [5, 6, 7, 8]
  QUEUE q

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    ENQUEUE q arr[i]
    WAIT
  END

  LOOP i FROM 0 TO LENGTH(arr) - 1
    FRONT q
    DEQUEUE q
    WAIT
  END

  IS_EMPTY q
END`} />

                  <h3 className="docs-h3">Example 3 — A BFS Frontier</h3>
                  <p className="docs-p">
                    Breadth-first search is a queue with a graph attached. Here the queue is driven by hand alongside a
                    graph so the frontier and the traversal are visible at the same time.
                  </p>
                  <CodeBlock code={`SCENE BFSFrontier

DECLARE
  GRAPH g = ["A->B", "A->C", "B->D"]
  QUEUE frontier

SEQUENCE
  // Visit A, then queue its neighbours
  HIGHLIGHT g["A"]
  ENQUEUE frontier 1
  ENQUEUE frontier 2
  WAIT

  // Dequeue B, visit it, queue D
  DEQUEUE frontier
  HIGHLIGHT g["B"]
  ENQUEUE frontier 3
  WAIT

  // Dequeue C, then D
  DEQUEUE frontier
  HIGHLIGHT g["C"]
  WAIT
  DEQUEUE frontier
  HIGHLIGHT g["D"]

  IS_EMPTY frontier
END`} />
                </section>

                <section id="qu-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Dequeuing an empty queue">
                    <C>DEQUEUE</C>, <C>FRONT</C>, and <C>REAR</C> on an empty queue have nothing to act on and report an
                    error to the console. Check with <C>IS_EMPTY</C> first when the count is not obvious.
                  </Alert>

                  <Alert kind="warn" title="ENQUEUE takes a name and a value">
                    <C>ENQUEUE q 4</C> — the queue first, the value second. <C>ENQUEUE 4</C> is parsed as a queue named
                    <C>4</C> with no value.
                  </Alert>

                  <Alert kind="tip" title="FRONT before DEQUEUE reads better">
                    Highlighting the element you are about to remove, waiting a beat, then removing it makes the FIFO
                    rule obvious to a viewer in a way that a bare <C>DEQUEUE</C> does not.
                  </Alert>

                  <Alert kind="note" title="Queues vs. stacks">
                    Both hold a pending collection; only the exit rule differs. Swapping <C>PUSH</C>/<C>POP</C> for
                    <C>ENQUEUE</C>/<C>DEQUEUE</C> turns a depth-first algorithm into a breadth-first one.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                GRAPHS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'graphs' && (
              <>
                <PageHero group="Data structures" title="Graphs">
                  Vertices joined by edges. Write BFS, DFS, shortest paths and spanning trees with loops, queues, stacks and recursion, and watch every step on the graph.
                </PageHero>

                <section id="gp-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>GRAPH</C> is a set of <b>vertices</b> joined by <b>edges</b>: people and friendships, airports and
                    flights, web pages and links. Arrays, lists and trees are all special cases of it. AQVL spreads the
                    vertices out with a force-directed layout that keeps connected vertices close.
                  </p>
                  <p className="docs-p">
                    You write graph algorithms the way a textbook does. A variable can hold a vertex
                    (<C>v = VERTEX(g, "A")</C>); you walk its neighbours with <C>DEGREE(v)</C> and <C>NEIGHBOR(v, i)</C>;
                    and you store what the algorithm needs in fields of your own, such as <C>v.visited</C>,
                    <C>v.dist</C> and <C>v.parent</C>. Queues, stacks and recursive functions work with vertices too.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Every step is animated and logged: each field change, each <C>w = NEIGHBOR(v, i)</C> (the edge it
                    follows lights up), each call and each return.
                    <ul>
                      <li>Variables are tags above their vertex, and fields are shown under it (<C>dist=4  parent=A</C>).</li>
                      <li>Visited vertices turn green; vertices waiting on the call stack are purple.</li>
                      <li>The edge to each vertex's <C>parent</C> turns green, so a BFS tree, shortest-path tree or spanning tree appears while it is built.</li>
                    </ul>
                  </Alert>
                </section>

                <section id="gp-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Graph</h2>
                  <CodeBlock label="Syntax" code={`GRAPH <name> = ["A-B", "B-C", ...]        // undirected
GRAPH <name> = ["A->B", "B->C", ...]      // directed (one-way)
GRAPH <name> = ["A-B:4", "B-C:1", ...]    // weighted (weight after the colon)
GRAPH <name> = ["A-B", "D"]               // "D" = a vertex with no edges`} />
                  <p className="docs-p">
                    Every vertex named in an edge is created automatically. All edges of one graph are either
                    undirected or directed. An edge without a weight has weight 1, and in a weighted graph the weights
                    are drawn on the edges.
                  </p>
                  <p className="docs-p">
                    Vertices are numbered in the order they first appear and edges in the order they are listed.
                    <C>NEIGHBOR(v, 0)</C>, <C>NEIGHBOR(v, 1)</C> and so on follow that order.
                  </p>
                  <CodeBlock code={`SCENE GraphIntro
DECLARE
  GRAPH friends = ["Asha-Ben", "Asha-Chen", "Ben-Dev", "Chen-Dev"]
SEQUENCE
  PRINT friends                       // Asha: Ben Chen | Ben: Asha Dev | ...
  asha = VERTEX(friends, "Asha")
  PRINT asha.name "has" DEGREE(asha) "friends"
  ADD_EDGE friends "Dev" "Esha"       // graphs can change while the program runs
END`} />
                </section>

                <section id="gp-commands" className="docs-section">
                  <h2 className="docs-h2">Graph Code Reference</h2>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
                    <tbody>
                      <tr><td><C>VERTEX(g, "A")</C></td><td>The vertex named A.</td></tr>
                      <tr><td><C>VERTEX_AT(g, i)</C></td><td>The i-th vertex, counting from 0. Loop over every vertex with <C>LOOP i FROM 0 TO VERTEX_COUNT(g) - 1</C>.</td></tr>
                      <tr><td><C>VERTEX_COUNT(g)</C> / <C>LENGTH(g)</C></td><td>Number of vertices.</td></tr>
                      <tr><td><C>EDGE_COUNT(g)</C> / <C>EDGE_AT(g, i)</C></td><td>Number of edges / the i-th edge. An edge has <C>e.from</C>, <C>e.to</C> and <C>e.weight</C>.</td></tr>
                      <tr><td><C>DEGREE(v)</C></td><td>How many neighbours v has (in a directed graph: edges leaving v).</td></tr>
                      <tr><td><C>IN_DEGREE(v)</C></td><td>Edges coming into v.</td></tr>
                      <tr><td><C>NEIGHBOR(v, i)</C></td><td>v's i-th neighbour, counting from 0.</td></tr>
                      <tr><td><C>WEIGHT(u, w)</C> / <C>HAS_EDGE(u, w)</C></td><td>Weight of the edge u → w / whether that edge exists.</td></tr>
                      <tr><td><C>v.name</C></td><td>The vertex's name.</td></tr>
                      <tr><td><C>v.visited</C>, <C>v.dist</C>, <C>v.parent</C>, ...</td><td>Fields of your own, on vertices and edges. <C>visited</C> starts as FALSE; every other field must be set before it is read.</td></tr>
                      <tr><td><C>v.color = "GRAY"</C></td><td>Paints the vertex (<C>WHITE</C>, <C>GRAY</C>, <C>BLACK</C>, <C>RED</C>, <C>BLUE</C>, ... or a number 0, 1, 2, ...).</td></tr>
                      <tr><td><C>TRUE</C>, <C>FALSE</C>, <C>INFINITY</C></td><td>Literals: <C>v.visited = TRUE</C>, <C>v.dist = INFINITY</C>.</td></tr>
                      <tr><td><C>ADD_VERTEX g "E"</C></td><td>Add a vertex.</td></tr>
                      <tr><td><C>ADD_EDGE g "A" "B" 4</C></td><td>Add an edge (the weight is optional). The ends can be names or vertex variables; a new name adds that vertex.</td></tr>
                      <tr><td><C>REMOVE_EDGE g "A" "B"</C> / <C>REMOVE_VERTEX g "C"</C></td><td>Remove an edge / a vertex together with its edges.</td></tr>
                      <tr><td><C>QUEUE q = [] / STACK s = []</C></td><td>Hold vertices: <C>ENQUEUE q v</C>, <C>v = DEQUEUE(q)</C>, <C>PUSH s v</C>, <C>v = POP(s)</C>.</td></tr>
                      <tr><td><C>PRINT g</C></td><td>Prints the adjacency lists: <C>A: B(4) C(1) | B: A(4) | ...</C></td></tr>
                    </tbody>
                  </table>
                  </div>
                  <p className="docs-p">
                    Loop over a vertex's neighbours like this. It also works for a vertex with no neighbours:
                  </p>
                  <CodeBlock code={`i = 0
WHILE i < DEGREE(v)
  w = NEIGHBOR(v, i)
  // ... use w ...
  i = i + 1
END`} />
                  <p className="docs-p">
                    Each whole algorithm is also available as a single command that animates it in one go:
                    <C>DFS g FROM A</C>, <C>BFS g FROM A</C>, <C>DIJKSTRA g FROM A</C>, <C>BELLMAN_FORD g FROM A</C>,
                    <C>ASTAR g FROM A TO C</C>, <C>PRIM g FROM A</C>, <C>KRUSKAL g</C> and <C>TOPO_SORT g</C>. Writing the
                    algorithm yourself shows much more of how it works.
                  </p>
                </section>

                <section id="gp-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>
                  <h3 className="docs-h3">Breadth-first search with a queue</h3>
                  <CodeBlock code={`SCENE BFS
DECLARE
  GRAPH g = ["A-B", "A-C", "B-D", "C-D", "D-E"]
  QUEUE q = []
SEQUENCE
  start = VERTEX(g, "A")
  start.visited = TRUE
  start.dist = 0
  ENQUEUE q start
  WHILE LENGTH(q) > 0
    v = DEQUEUE(q)
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF w.visited == FALSE
        w.visited = TRUE
        w.dist = v.dist + 1
        w.parent = v
        ENQUEUE q w
      END
      i = i + 1
    END
  END
  PRINT "E is" VERTEX(g, "E").dist "steps from A"
END`} />
                  <h3 className="docs-h3">Recursive depth-first search</h3>
                  <CodeBlock code={`SCENE DFS
DECLARE
  GRAPH g = ["A-B", "A-C", "B-D", "C-D", "D-E"]
  FUNCTION dfs(v)
    v.visited = TRUE
    PRINT "Visit" v.name
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF w.visited == FALSE
        dfs(w)
      END
      i = i + 1
    END
  END
SEQUENCE
  dfs(VERTEX(g, "A"))
END`} />
                  <h3 className="docs-h3">Dijkstra's shortest paths</h3>
                  <CodeBlock code={`SCENE Dijkstra
DECLARE
  GRAPH g = ["A-B:4", "A-C:1", "C-B:2", "B-D:1", "C-D:5"]
SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(g) - 1
    p = VERTEX_AT(g, k)
    p.dist = INFINITY
  END
  start = VERTEX(g, "A")
  start.dist = 0
  LOOP round FROM 1 TO VERTEX_COUNT(g)
    // the closest vertex not finished yet
    u = NULL
    LOOP k FROM 0 TO VERTEX_COUNT(g) - 1
      p = VERTEX_AT(g, k)
      IF p.visited == FALSE
        IF u == NULL
          u = p
        ELSE
          IF p.dist < u.dist
            u = p
          END
        END
      END
    END
    u.visited = TRUE
    // relax its edges
    i = 0
    WHILE i < DEGREE(u)
      w = NEIGHBOR(u, i)
      IF u.dist + WEIGHT(u, w) < w.dist
        w.dist = u.dist + WEIGHT(u, w)
        w.parent = u
      END
      i = i + 1
    END
  END
  PRINT "A to D:" VERTEX(g, "D").dist
END`} />
                  <p className="docs-p">
                    The Playground has 19 complete graph programs:
                  </p>
                  <ul>
                    <li>graph basics, directed and weighted graphs, and the adjacency matrix;</li>
                    <li>BFS, fewest-stop routes, and iterative and recursive DFS;</li>
                    <li>connected components, cycle detection and the bipartite check;</li>
                    <li>topological sort, both Kahn's algorithm and the DFS version;</li>
                    <li>Dijkstra, Bellman-Ford, Prim and Kruskal;</li>
                    <li>listing every route by backtracking, and greedy colouring.</li>
                  </ul>
                </section>

                <section id="gp-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead><tr><th>Message</th><th>What to do</th></tr></thead>
                    <tbody>
                      <tr><td><C>graph 'g' has no vertex named "Z"</C></td><td>Vertex names are exactly the strings used in the edge list, including case. The message lists the real names.</td></tr>
                      <tr><td><C>A has 2 neighbours — valid indexes are 0 to 1</C></td><td>Loop with <C>WHILE i &lt; DEGREE(v)</C>. Note that <C>LOOP i FROM 0 TO DEGREE(v) - 1</C> counts down to -1 when the degree is 0.</td></tr>
                      <tr><td><C>v.dist has not been set yet</C></td><td>Give every vertex a starting value first, for example <C>p.dist = INFINITY</C> in a loop over <C>VERTEX_AT</C>.</td></tr>
                      <tr><td><C>there is no edge from A to C</C></td><td>Check <C>HAS_EDGE(u, w)</C> before <C>WEIGHT(u, w)</C>.</td></tr>
                      <tr><td><C>DEGREE(x): x is not a vertex</C></td><td>The variable holds a number or a name, not a vertex. Get the vertex with <C>VERTEX(g, "A")</C>.</td></tr>
                      <tr><td><C>mixes directed and undirected edges</C></td><td>Use either <C>A-B</C> or <C>A-&gt;B</C> for every edge of one graph.</td></tr>
                    </tbody>
                  </table>
                  </div>
                  <Alert kind="tip" title="Functions return their results">
                    Variables assigned inside a <C>FUNCTION</C> are local to that call. To count or collect things
                    in a recursive search, <C>RETURN</C> the result. Fields such as <C>v.visited</C> belong to the
                    graph, so every call sees them.
                  </Alert>
                  <Alert kind="note" title="Reserved words">
                    <C>from</C>, <C>to</C> and <C>link</C> are keywords and cannot be variable names. Use names like
                    <C>src</C>, <C>dst</C> and <C>next</C> instead. Field names such as <C>e.from</C> are fine.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                BINARY SEARCH TREE PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'bst' && (
              <>
                <PageHero group="Trees" title="Binary Search Tree">
                  A binary tree kept in order: every key in the left subtree is smaller, every key in the right subtree is larger — so search, insert and delete follow one path from the root.
                </PageHero>
                <section id="bst-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">Because of the ordering rule, each comparison discards a whole subtree: compare the key with <C>curr.val</C>, then go left or right. An inorder traversal of a BST lists its keys in sorted order.</p>
                  <p className="docs-p">A BST is a binary tree, so all of the pointer code, recursion, queues and stacks from the Binary Tree page work on it too.</p>
                </section>
                <section id="bst-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a BST</h2>
                  <CodeBlock label="Syntax" code={`BST <name> = [keys, inserted in this order]`} />
                  <p className="docs-p"><C>BST t = [50, 30, 70]</C> builds 50 with 30 on its left and 70 on its right. Keys must be unique. <C>BST t</C> or <C>BST t = []</C> starts empty.</p>
                </section>
                <section id="bst-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">Write the operations as pointer code (see Examples), or use the one-line built-ins — they walk and relink the tree node by node exactly the same way:</p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead><tr><th>Command</th><th>What it does</th></tr></thead>
                    <tbody>
                      <tr><td><C>INSERT t 65</C></td><td>Walk down comparing, link a new node where the walk falls off the tree. A key already present is not inserted again.</td></tr>
                      <tr><td><C>SEARCH t 65</C></td><td>Follow one path from the root until the key is found or a NULL is reached.</td></tr>
                      <tr><td><C>DELETE t 30</C></td><td>The three cases: a leaf is unlinked; a node with one child is replaced by it; a node with two children takes its inorder successor's key, then the successor is removed. The removed node is freed.</td></tr>
                      <tr><td><C>MIN t / MAX t</C></td><td>Keep going left / right until there is no child.</td></tr>
                      <tr><td><C>INORDER t, PREORDER t, POSTORDER t, LEVELORDER t</C></td><td>Traversals (inorder gives sorted order).</td></tr>
                      <tr><td><C>HEIGHT t, SIZE t, LEAVES t</C></td><td>Tree measurements.</td></tr>
                      <tr><td><C>ROTATE t 30 "LEFT"</C></td><td>A left (or "RIGHT") rotation at node 30, as used by self-balancing trees.</td></tr>
                      <tr><td><C>MIRROR t, CLEAR t</C></td><td>Swap every left/right pair; free every node in postorder.</td></tr>
                    </tbody>
                  </table>
                  </div>
                  <p className="docs-p">The tree name may be left out when the program has only one tree: <C>INSERT 65</C>.</p>
                </section>
                <section id="bst-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>
                  <p className="docs-p">Search by following one path:</p>
                  <CodeBlock code={`SCENE BSTSearch\nDECLARE\n  BST t = [50, 30, 70, 20, 40, 60, 80]\nSEQUENCE\n  key = 60\n  curr = t.root\n  WHILE curr != NULL AND curr.val != key\n    IF key < curr.val\n      curr = curr.left\n    ELSE\n      curr = curr.right\n    END\n  END\n  IF curr != NULL\n    PRINT "Found" curr.val\n  END\nEND`} />
                  <p className="docs-p">Insert: the new node hangs off the last node visited.</p>
                  <CodeBlock code={`  // insert key: walk down remembering the parent\n  parent = NULL\n  curr = t.root\n  WHILE curr != NULL\n    parent = curr\n    IF key < curr.val\n      curr = curr.left\n    ELSE\n      curr = curr.right\n    END\n  END\n  n = NEW_NODE(t, key)\n  IF parent == NULL\n    t.root = n\n  ELSE IF key < parent.val\n    parent.left = n\n  ELSE\n    parent.right = n\n  END`} />
                  <p className="docs-p">The built-ins:</p>
                  <CodeBlock code={`SCENE BSTBuiltins\nDECLARE\n  BST t = [50, 30, 70]\nSEQUENCE\n  INSERT t 65\n  SEARCH t 65\n  DELETE t 30\n  INORDER t\nEND`} />
                </section>
                <section id="bst-errors" className="docs-section">
                  <h2 className="docs-h2">Errors & Tips</h2>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead><tr><th>Message</th><th>What to do</th></tr></thead>
                    <tbody>
                      <tr><td><C>BST t lists 50 twice</C></td><td>Keys in a BST are unique.</td></tr>
                      <tr><td><C>DELETE by value is defined for a BST</C></td><td>On a plain BINARY_TREE, unlink the node with pointer code and FREE it.</td></tr>
                      <tr><td><C>X is not a built-in for the tree</C></td><td>Only the commands above exist as built-ins; everything else is written as pointer code.</td></tr>
                    </tbody>
                  </table>
                  </div>
                  <p className="docs-p">Deleting a node with two children: copy the successor's value into the node (<C>curr.val = succ.val</C>), then unlink the successor — it never has a left child.</p>
                </section>
              </>
            )}
            {activePage === 'heaps' && (
              <>
                <PageHero group="Data structures" title="Heaps">
                  A complete binary tree with a priority rule at every parent-child pair, written as real code over the array that stores it — shown as both a tree and that array, so sift-up and sift-down become concrete.
                </PageHero>

                <section id="hp-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>HEAP</C> is a complete binary tree (every level full except the last, which fills from the left)
                    with one rule at every parent: in a <b>min-heap</b> a parent is never bigger than its children, in a
                    <b> max-heap</b> never smaller. So the smallest (or largest) value is always at the root, which is why
                    heaps power priority queues, scheduling, Dijkstra's algorithm and heap sort.
                  </p>
                  <p className="docs-p">
                    A heap is stored in a plain array. There are no pointers: the index alone says who is related.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Relative of index i</th><th>AQVL expression</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>Left child</td><td><C>2 * i + 1</C></td></tr>
                        <tr><td>Right child</td><td><C>2 * i + 2</C></td></tr>
                        <tr><td>Parent (i &gt; 0)</td><td><C>(i - 1 - (i - 1) % 2) / 2</C> — that is (i - 1) / 2 rounded down</td></tr>
                        <tr><td>Last node with a child</td><td><C>(n - 2 - (n - 2) % 2) / 2</C> where <C>n = LENGTH(h)</C></td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    A heap is only partially ordered — siblings have no order between them. After a change the rule is
                    restored by <em>sifting up</em> (a value too small for its place swaps with its parent) or <em>sifting
                    down</em> (a value too big swaps with its smaller child). You write both as ordinary loops.
                  </p>
                  <Alert kind="note" title="Visualization">
                    A heap is drawn twice: as a tree on top and as the array underneath, both placed by index. Every
                    <C> SWAP</C>, comparison and assignment lights up the same index in both views, so the index arithmetic
                    becomes visible.
                  </Alert>
                </section>

                <section id="hp-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Heap</h2>
                  <CodeBlock label="Syntax" code={`HEAP <name> = [<value>, <value>, ...]
HEAP <name> = []`} />
                  <p className="docs-p">
                    The values are stored exactly in the order given — the declaration does not rearrange them. Either list
                    them already in heap order, or start from any order and build the heap with code (see Example 4).
                  </p>
                  <CodeBlock code={`SCENE HeapIntro

DECLARE
  HEAP h = [10, 20, 15, 40, 50]

SEQUENCE
  PRINT "Root (smallest):" h[0]
  PRINT "Size:" LENGTH(h)
  PRINT "Children of the root:" h[1] h[2]
END`} />
                </section>

                <section id="hp-commands" className="docs-section">
                  <h2 className="docs-h2">Heap Code Reference</h2>
                  <p className="docs-p">
                    A heap is used like an array whose shape must stay a complete tree, so it only grows or shrinks at the end.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Code</th><th>Meaning</th></tr>
                      </thead>
                      <tbody>
                        <tr><td><C>h[i]</C></td><td>The value at index i, inside any expression: <C>IF h[child] &lt; h[parent]</C>.</td></tr>
                        <tr><td><C>LENGTH(h)</C></td><td>How many values the heap holds right now.</td></tr>
                        <tr><td><C>SWAP h[i] h[j]</C></td><td>Exchanges two values (both views animate).</td></tr>
                        <tr><td><C>COMPARE h[i] h[j]</C></td><td>Highlights a comparison and prints its result.</td></tr>
                        <tr><td><C>h[i] = value</C></td><td>Overwrites a value (same as <C>UPDATE h[i] value</C>).</td></tr>
                        <tr><td><C>INSERT h value</C></td><td>Adds a new last cell, the next free spot of the tree. Sift it up afterwards.</td></tr>
                        <tr><td><C>DELETE h[LENGTH(h) - 1]</C></td><td>Removes the last cell. Only the last cell can be deleted.</td></tr>
                        <tr><td><C>HIGHLIGHT h[i] 'SUCCESS'</C></td><td>Marks a cell (<C>'NEUTRAL'</C> clears the mark).</td></tr>
                        <tr><td><C>PRINT h</C></td><td>Prints the array, e.g. <C>[10, 20, 15]</C>.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    The older one-line shortcuts still work on a min-heap (<C>HEAP_INSERT h 5</C>, <C>HEAP_EXTRACT h</C>,
                    <C> HEAP_DECREASE h index newValue</C>, <C>BUILD_HEAP h</C>, <C>HEAPIFY h index</C>), but they hide the
                    algorithm. The examples below, and all 16 Heaps examples in the Playground, write it out.
                  </p>
                </section>

                <section id="hp-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Insert and Sift Up</h3>
                  <p className="docs-p">
                    Add the value at the end (the next free spot of the tree), then swap it with its parent while it is smaller.
                  </p>
                  <CodeBlock code={`SCENE MinHeapInsert

DECLARE
  HEAP h = []
  ARRAY arrivals = [35, 33, 42, 10, 14]

  FUNCTION siftUp(start)
    child = start
    keepClimbing = 1
    WHILE keepClimbing == 1
      IF child == 0
        keepClimbing = 0
      ELSE
        parent = (child - 1 - (child - 1) % 2) / 2
        IF h[child] < h[parent]
          SWAP h[child] h[parent]
          child = parent
        ELSE
          keepClimbing = 0
        END
      END
    END
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(arrivals) - 1
    INSERT h arrivals[k]
    siftUp(LENGTH(h) - 1)
    PRINT "After inserting " + arrivals[k] + ":" h
  END
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> the last line is <C>After inserting 14: [10, 14, 42, 35, 33]</C>.
                  </p>

                  <h3 className="docs-h3">Example 2 — Extract the Minimum</h3>
                  <p className="docs-p">
                    Take the root, copy the last value onto the root, delete the last cell, then sift the root down,
                    always swapping with the <em>smaller</em> child.
                  </p>
                  <CodeBlock code={`SCENE ExtractMin

DECLARE
  HEAP h = [5, 9, 8, 17, 12, 11, 20, 25]

  FUNCTION siftDown(start)
    parent = start
    size = LENGTH(h)
    keepSifting = 1
    WHILE keepSifting == 1
      smallest = parent
      left = 2 * parent + 1
      right = 2 * parent + 2
      IF left < size
        IF h[left] < h[smallest]
          smallest = left
        END
      END
      IF right < size
        IF h[right] < h[smallest]
          smallest = right
        END
      END
      IF smallest == parent
        keepSifting = 0
      ELSE
        SWAP h[parent] h[smallest]
        parent = smallest
      END
    END
  END

  FUNCTION extractMin()
    smallestValue = h[0]
    last = LENGTH(h) - 1
    h[0] = h[last]
    DELETE h[last]
    IF LENGTH(h) > 1
      siftDown(0)
    END
    RETURN smallestValue
  END

SEQUENCE
  LOOP round FROM 1 TO 3
    taken = extractMin()
    PRINT "Extracted" taken
  END
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>5</C>, <C>8</C>, <C>9</C> — values leave a heap smallest first.
                  </p>

                  <h3 className="docs-h3">Example 3 — Max-Heap</h3>
                  <p className="docs-p">
                    A max-heap is the same code with the comparisons flipped: <C>IF h[child] &gt; h[parent]</C> in sift up,
                    and sift down picks the <em>larger</em> child. See <em>Max-Heap: Auction Bids</em> in the Playground.
                  </p>

                  <h3 className="docs-h3">Example 4 — Build a Heap Bottom-Up (Floyd)</h3>
                  <p className="docs-p">
                    Every leaf is already a heap, so sift down each parent from the last one back to the root. This is
                    O(n), faster than n inserts. <C>siftDown</C> is the function from Example 2.
                  </p>
                  <CodeBlock code={`SEQUENCE
  n = LENGTH(h)
  i = (n - 2 - (n - 2) % 2) / 2
  WHILE i >= 0
    siftDown(i)
    i = i - 1
  END
  PRINT "Heap:" h`} />
                </section>

                <section id="hp-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Only the last cell can be deleted">
                    <C>DELETE h[0]</C> stops with <em>Only the last cell of heap 'h' (index 4) can be deleted</em>: removing
                    any other cell would leave a hole in the tree. Copy the last value into the cell first
                    (<C>h[0] = h[last]</C>), then <C>DELETE h[last]</C>, then sift.
                  </Alert>

                  <Alert kind="warn" title="Index out of bounds">
                    Reading <C>h[left]</C> for a node without a left child stops with <em>Index 7 is out of bounds for heap
                    'h'</em>. Check <C>IF left &lt; LENGTH(h)</C> before reading a child.
                  </Alert>

                  <Alert kind="tip" title="Rounding down the parent index">
                    Division keeps decimals (<C>5 / 2 = 2.5</C>), so the parent is written
                    <C> (i - 1 - (i - 1) % 2) / 2</C>: subtract the remainder, then divide.
                  </Alert>

                  <Alert kind="tip" title="Set a variable before an IF that assigns it">
                    A variable first created inside an IF or ELSE belongs to that block. Write <C>median = 0</C> before the
                    IF, then assign it in either branch, to use it afterwards.
                  </Alert>

                  <Alert kind="tip" title="Return results from functions">
                    Assigning a SEQUENCE variable inside a FUNCTION creates a new local instead. Return the value,
                    e.g. <C>swaps = swaps + siftDown(i)</C> with <C>RETURN swapsMade</C> in the function.
                  </Alert>

                  <Alert kind="note" title="Two heaps need two sets of functions">
                    <C>h[i]</C> in a function always means the heap named <C>h</C>. With two heaps (e.g. the running median's
                    <C> low</C> and <C>high</C>) write one sift function per heap.
                  </Alert>

                  <Alert kind="warn" title="A heap is not sorted">
                    Only parent-child pairs are ordered: <C>[1, 5, 2, 7, 6]</C> is a valid min-heap. Extracting repeatedly
                    (or heap sort) gives sorted order.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                TRIES PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'tries' && (
              <>
                <PageHero group="Data structures" title="Tries">
                  A prefix tree written as real code — walk it with <C>GET_CHILD</C>, grow it with <C>ADD_CHILD</C>, mark words with <C>node.isEnd = TRUE</C> — with every step drawn as it happens.
                </PageHero>

                <section id="tri-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>TRIE</C> stores words letter by letter. Every edge holds one character, so the path from the root
                    down to a node spells a <em>prefix</em>, and words that begin the same way share the nodes of that
                    beginning: <C>car</C>, <C>cart</C> and <C>care</C> all go through <C>c → a → r</C>.
                  </p>
                  <p className="docs-p">
                    A path alone does not make a word. Each node has a flag, <C>isEnd</C>, that is <C>TRUE</C> only where
                    a stored word ends. In a trie holding <C>car</C> and <C>cat</C> the node <C>ca</C> exists, but no word
                    ends there, so <C>ca</C> is a prefix, not a word.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Operation</th><th>Cost</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>Insert a word of length L</td><td>O(L): one step per letter, however many words are stored.</td></tr>
                        <tr><td>Search a word / check a prefix</td><td>O(L): one step per letter, stopping early at a missing edge.</td></tr>
                        <tr><td>List the words with a prefix</td><td>O(L) to reach the prefix, then only the subtree below it.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <Alert kind="note" title="Visualization">
                    Every node shows the prefix it stands for underneath and the variables pointing at it above. Children
                    are drawn in alphabetical order, word ends are green, and nodes held by recursive calls that are still
                    waiting turn purple. Each pointer move, <C>HAS_CHILD</C> / <C>isEnd</C> check, new node and removed
                    node is its own step with a console line.
                  </Alert>
                </section>

                <section id="tri-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Trie</h2>
                  <CodeBlock label="Syntax" code={`TRIE <name>
TRIE <name> = ["<word>", "<word>", ...]`} />
                  <p className="docs-p">
                    <C>TRIE t</C> starts with just the root. Words listed in the declaration are inserted before the
                    program starts. Words are case-sensitive: <C>"Cat"</C> and <C>"cat"</C> are different.
                  </p>
                  <p className="docs-p">A complete program that inserts and searches by hand:</p>
                  <CodeBlock code={`SCENE TrieIntro

DECLARE
  TRIE t = ["car"]

  FUNCTION insert(word)
    node = t.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      ch = CHAR_AT(word, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
      END
      node = GET_CHILD(node, ch)
    END
    node.isEnd = TRUE
  END

  FUNCTION search(word)
    node = t.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      node = GET_CHILD(node, CHAR_AT(word, i))
      IF node == NULL
        RETURN FALSE
      END
    END
    RETURN node.isEnd
  END

SEQUENCE
  insert("cat")
  insert("cart")
  PRINT "Words:" t
  IF search("cat")
    PRINT "cat is stored"
  END
  IF search("ca") == FALSE
    PRINT "ca is only a prefix"
  END
  PRINT "Nodes: " + NODE_COUNT(t)
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>Words: [car, cart, cat]</C>, <C>cat is stored</C>,
                    <C> ca is only a prefix</C> and <C>Nodes: 6</C> (the root, c, ca, car, cart, cat).
                  </p>
                </section>

                <section id="tri-commands" className="docs-section">
                  <h2 className="docs-h2">Trie Code Reference</h2>
                  <p className="docs-p">
                    A trie is used through <em>nodes</em>. A variable holds a node the way it holds a vertex of a graph or a
                    node of a linked list; start from the root and move from node to node.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Code</th><th>Meaning</th></tr>
                      </thead>
                      <tbody>
                        <tr><td><C>node = t.root</C></td><td>The root: the empty prefix, where every walk starts.</td></tr>
                        <tr><td><C>GET_CHILD(node, ch)</C></td><td>The child along the edge <C>ch</C>, or <C>NULL</C> when there is none.</td></tr>
                        <tr><td><C>HAS_CHILD(node, ch)</C></td><td><C>TRUE</C> when the edge <C>ch</C> exists.</td></tr>
                        <tr><td><C>ADD_CHILD node ch</C></td><td>Creates the child along <C>ch</C> (it must not exist yet).</td></tr>
                        <tr><td><C>REMOVE_CHILD node ch</C></td><td>Removes the child along <C>ch</C>; only a child with no children of its own can be removed.</td></tr>
                        <tr><td><C>node.isEnd</C></td><td><C>TRUE</C> when a stored word ends at this node. Set it with <C>node.isEnd = TRUE</C> / <C>FALSE</C>.</td></tr>
                        <tr><td><C>node.char</C></td><td>The character on the edge into the node (<C>""</C> for the root).</td></tr>
                        <tr><td><C>node.count = 0</C></td><td>Any other field the algorithm needs (a counter, a frequency, a meaning). Set it before reading it.</td></tr>
                        <tr><td><C>CHILD_COUNT(node)</C></td><td>How many children the node has.</td></tr>
                        <tr><td><C>CHILD_AT(node, i)</C></td><td>The i-th child in alphabetical order, 0 to <C>CHILD_COUNT(node) - 1</C>.</td></tr>
                        <tr><td><C>WORD_COUNT(t)</C></td><td>How many words are stored.</td></tr>
                        <tr><td><C>NODE_COUNT(t)</C></td><td>How many nodes the trie has, the root included.</td></tr>
                        <tr><td><C>PRINT t</C></td><td>Prints the stored words in alphabetical order, e.g. <C>[car, cart, cat]</C>.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    A character is one-letter text such as <C>"a"</C> or <C>CHAR_AT(word, i)</C>; the digits <C>0</C> to
                    <C> 9</C> may also be given as numbers, so a trie can store bits. The text helpers <C>TEXT_LENGTH(s)</C>,
                    <C> CHAR_AT(s, i)</C> and <C>CHAR_CODE(s, i)</C> walk a word letter by letter. The older one-line
                    shortcuts (<C>TRIE_INSERT t "word"</C>, <C>TRIE_SEARCH</C>, <C>TRIE_STARTSWITH</C>,
                    <C> TRIE_AUTOCOMPLETE</C>, <C>TRIE_DELETE</C>) still work but hide the logic; the examples below, and all
                    18 Tries examples in the Playground, write it out.
                  </p>
                </section>

                <section id="tri-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Autocomplete</h3>
                  <p className="docs-p">
                    Walk down to the node of the prefix, then collect every word below it with a recursive depth-first
                    walk. Visiting children a to z gives the suggestions in dictionary order.
                  </p>
                  <CodeBlock code={`SCENE TrieAutocomplete

DECLARE
  TRIE t = ["car", "card", "care", "cat", "dog"]

  FUNCTION collect(node, text)
    IF node.isEnd
      PRINT "  " + text
    END
    i = 0
    WHILE i < CHILD_COUNT(node)
      child = CHILD_AT(node, i)
      collect(child, text + child.char)
      i = i + 1
    END
  END

SEQUENCE
  prefix = "car"
  node = t.root
  i = 0
  WHILE i < TEXT_LENGTH(prefix) AND node != NULL
    node = GET_CHILD(node, CHAR_AT(prefix, i))
    i = i + 1
  END
  IF node == NULL
    PRINT "No words start with " + prefix
  ELSE
    PRINT "Words starting with " + prefix + ":"
    collect(node, prefix)
  END
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>Words starting with car:</C> then <C>car</C>, <C>card</C>, <C>care</C>.
                    <C> cat</C> and <C>dog</C> are never visited.
                  </p>

                  <h3 className="docs-h3">Example 2 — Counting Words by Prefix</h3>
                  <p className="docs-p">
                    Store on every node how many words pass through it. Then "how many words start with ...?" is a single
                    walk down the prefix.
                  </p>
                  <CodeBlock code={`SCENE PrefixCount

DECLARE
  TRIE t
  ARRAY names = ["sam", "sara", "sarah", "tom"]

SEQUENCE
  LOOP k FROM 0 TO LENGTH(names) - 1
    word = names[k]
    node = t.root
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      ch = CHAR_AT(word, i)
      IF HAS_CHILD(node, ch) == FALSE
        ADD_CHILD node ch
        child = GET_CHILD(node, ch)
        child.count = 0
      END
      node = GET_CHILD(node, ch)
      node.count = node.count + 1
    END
    node.isEnd = TRUE
  END
  node = GET_CHILD(GET_CHILD(t.root, "s"), "a")
  PRINT "Names starting with sa: " + node.count
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>Names starting with sa: 3</C>.
                  </p>

                  <h3 className="docs-h3">Example 3 — Deleting a Word</h3>
                  <p className="docs-p">
                    Unmark the word's last node, then on the way back up remove every node that no longer ends a word and
                    has no children. Nodes that other words still use stay.
                  </p>
                  <CodeBlock code={`SCENE TrieDelete

DECLARE
  TRIE t = ["bat", "batch", "bad"]

  FUNCTION removeWord(node, word, depth)
    IF depth == TEXT_LENGTH(word)
      node.isEnd = FALSE
    ELSE
      ch = CHAR_AT(word, depth)
      unused = removeWord(GET_CHILD(node, ch), word, depth + 1)
      IF unused
        REMOVE_CHILD node ch
      END
    END
    RETURN node.isEnd == FALSE AND CHILD_COUNT(node) == 0
  END

SEQUENCE
  removeWord(t.root, "batch", 0)
  PRINT "Words:" t
  PRINT "Nodes: " + NODE_COUNT(t)
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>Words: [bad, bat]</C> and <C>Nodes: 5</C>: only the <C>c</C> and
                    <C> h</C> nodes of <C>batch</C> are removed.
                  </p>
                </section>

                <section id="tri-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="GET_CHILD can return NULL">
                    When there is no edge for the character, <C>GET_CHILD</C> gives <C>NULL</C>, and reading
                    <C> node.isEnd</C> of <C>NULL</C> stops with a <em>NULL pointer dereference</em>. Check
                    <C> IF node == NULL</C> (or <C>HAS_CHILD</C>) before going on.
                  </Alert>

                  <Alert kind="warn" title="One character per edge">
                    <C>ADD_CHILD node "ab"</C> stops: an edge holds exactly one character. Walk the word with
                    <C> CHAR_AT(word, i)</C>. <C>ADD_CHILD</C> on a child that already exists stops too — check
                    <C> HAS_CHILD</C> first.
                  </Alert>

                  <Alert kind="warn" title="Remove from the bottom up">
                    <C>REMOVE_CHILD</C> refuses a child that still has children, because that would cut off every word
                    below it. Recursion removes the deepest node first and works back up.
                  </Alert>

                  <Alert kind="warn" title="Loop over children with WHILE">
                    <C>LOOP i FROM 0 TO CHILD_COUNT(node) - 1</C> counts <em>down</em> (0, -1) at a leaf, where
                    <C> CHILD_COUNT</C> is 0, and <C>CHILD_AT(node, 0)</C> then stops. Use
                    <C> WHILE i &lt; CHILD_COUNT(node)</C>.
                  </Alert>

                  <Alert kind="tip" title="A new node's fields start unset">
                    Fields such as <C>count</C> must be set before they are read: right after <C>ADD_CHILD node ch</C>,
                    write <C>child = GET_CHILD(node, ch)</C> and <C>child.count = 0</C>. Only <C>isEnd</C> (FALSE) and
                    <C> char</C> exist from the start.
                  </Alert>

                  <Alert kind="tip" title="Choose overlapping words">
                    A trie of unrelated words is just separate chains. Words like <C>car</C>, <C>card</C> and <C>care</C>
                    show the shared prefixes, which is the whole point of the structure.
                  </Alert>

                  <Alert kind="note" title="Fields are case-insensitive">
                    <C>node.isEnd</C>, <C>node.isend</C> and <C>node.ISEND</C> are the same field, as with the fields of
                    graph vertices and tree nodes.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                HASH MAPS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'hashmaps' && (
              <>
                <PageHero group="Data structures" title="Hash Maps">
                  Key-value storage written as real code — <C>m[key] = value</C>, <C>m[key]</C>, <C>CONTAINS</C> — with every hash, bucket, collision chain and resize drawn as it happens.
                </PageHero>

                <section id="hm-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>HASH_MAP</C> stores key-value pairs and finds a key in roughly constant time. Instead of
                    searching, it <em>computes</em> where the key lives: a hash function turns the key into a bucket index,
                    and the key is stored in that bucket.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Key</th><th>Hash (bucket index)</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>A whole number, e.g. <C>21</C></td><td><C>key % capacity</C>: with 8 buckets, <C>21 % 8 = 5</C>.</td></tr>
                        <tr><td>Text, e.g. <C>"cat"</C></td><td>Add up the character codes, then <C>% capacity</C>: <C>(99 + 97 + 116) % 8 = 312 % 8 = 0</C>.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    Two different keys can land in the same bucket: a <em>collision</em>. AQVL uses <em>separate
                    chaining</em>: each bucket holds a chain of keys, and a lookup compares only the keys of that one chain.
                    A map starts with 8 buckets; when one more key would make <C>size / capacity</C> (the <em>load
                    factor</em>) go above 0.75, the bucket row doubles and every key is hashed again.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Buckets are laid out in a row and each key hangs in a chain under its bucket. Storing, reading and
                    deleting all show the same steps: the hash is worked out in the console, the bucket lights up, and the
                    chain is walked key by key until the key is found (green) or the chain ends (red).
                  </Alert>
                </section>

                <section id="hm-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Hash Map</h2>
                  <CodeBlock label="Syntax" code={`HASH_MAP <name>
HASH_MAP <name> = { <key>: <value>, <key>: <value>, ... }`} />
                  <p className="docs-p">
                    Keys are numbers or text. In a declaration a bare word is text, so <C>apple: 5</C> and
                    <C> "apple": 5</C> mean the same. Keys keep their type: <C>7</C> and <C>"7"</C> are different keys.
                  </p>
                  <CodeBlock code={`SCENE HashMapIntro

DECLARE
  HASH_MAP stock = {apple: 5, banana: 3}

SEQUENCE
  stock["cherry"] = 9
  stock["apple"] = stock["apple"] + 1
  PRINT "Apples: " + stock["apple"]
  IF CONTAINS(stock, "mango")
    PRINT "Mangoes: " + stock["mango"]
  ELSE
    PRINT "No mangoes"
  END
  PRINT "Items: " + LENGTH(stock)
  PRINT "Stock:" stock
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>Apples: 6</C>, <C>No mangoes</C>, <C>Items: 3</C> and the whole map,
                    printed bucket by bucket.
                  </p>
                </section>

                <section id="hm-commands" className="docs-section">
                  <h2 className="docs-h2">Hash Map Code Reference</h2>
                  <p className="docs-p">
                    A hash map is used the way Python dictionaries and Java HashMaps are: index it with a key.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Code</th><th>Meaning</th></tr>
                      </thead>
                      <tbody>
                        <tr><td><C>m[key] = value</C></td><td>Stores a key. A new key is added to its bucket's chain; an existing key only gets its value replaced.</td></tr>
                        <tr><td><C>m[key]</C></td><td>The key's value, inside any expression: <C>m[w] = m[w] + 1</C>. A missing key stops the program.</td></tr>
                        <tr><td><C>CONTAINS(m, key)</C></td><td><C>TRUE</C> when the key is stored. Check it before reading a key that may be missing.</td></tr>
                        <tr><td><C>DELETE m[key]</C></td><td>Removes the key and its value; the rest of its chain moves up.</td></tr>
                        <tr><td><C>LENGTH(m)</C></td><td>How many keys the map holds.</td></tr>
                        <tr><td><C>KEY_AT(m, i)</C></td><td>The i-th key (0 to <C>LENGTH(m) - 1</C>), walking bucket 0, 1, 2, ... and each chain top to bottom. Use it to visit every key.</td></tr>
                        <tr><td><C>BUCKET_OF(m, key)</C></td><td>The bucket the key hashes to (works for keys not stored yet).</td></tr>
                        <tr><td><C>CAPACITY(m)</C></td><td>The number of buckets (8, then 16, 32, ... after resizes).</td></tr>
                        <tr><td><C>HIGHLIGHT m[key] 'SUCCESS'</C></td><td>Marks a key (<C>'NEUTRAL'</C> clears the mark).</td></tr>
                        <tr><td><C>PRINT m</C></td><td>Prints the map, e.g. <C>{`{apple: 6, banana: 3}`}</C>, in bucket order.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    For working with text (counting letters, splitting words, writing a hash function yourself):
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Code</th><th>Meaning</th></tr>
                      </thead>
                      <tbody>
                        <tr><td><C>TEXT_LENGTH(s)</C></td><td>Number of characters: <C>TEXT_LENGTH("cat")</C> is 3.</td></tr>
                        <tr><td><C>CHAR_AT(s, i)</C></td><td>The character at position i (from 0): <C>CHAR_AT("cat", 1)</C> is <C>"a"</C>.</td></tr>
                        <tr><td><C>CHAR_CODE(s, i)</C></td><td>That character's code: <C>CHAR_CODE("cat", 0)</C> is 99.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    Reading <C>m[key]</C> or <C>CONTAINS</C> in an assignment, an IF / WHILE condition, a function argument
                    or a RETURN animates the lookup. The older one-line shortcuts (<C>HASHMAP_INSERT m "k" 1</C>,
                    <C> HASHMAP_LOOKUP</C>, <C>HASHMAP_DELETE</C>) still work but hide the logic; the examples below, and
                    all 17 Hash Maps examples in the Playground, write it out.
                  </p>
                </section>

                <section id="hm-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Counting Words</h3>
                  <p className="docs-p">
                    The most common hash map pattern: the first time a key is seen its count starts at 1, after that it goes up by 1.
                  </p>
                  <CodeBlock code={`SCENE WordCount

DECLARE
  HASH_MAP freq
  ARRAY words = ["the", "cat", "sat", "on", "the", "mat", "the", "cat"]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(words) - 1
    word = words[i]
    IF CONTAINS(freq, word)
      freq[word] = freq[word] + 1
    ELSE
      freq[word] = 1
    END
  END
  PRINT "the: " + freq["the"]
  PRINT "cat: " + freq["cat"]
  PRINT "Different words: " + LENGTH(freq)
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>the: 3</C>, <C>cat: 2</C>, <C>Different words: 5</C>.
                  </p>

                  <h3 className="docs-h3">Example 2 — Two Sum in One Pass</h3>
                  <p className="docs-p">
                    For every number, look up the partner it needs among the numbers already seen. One pass, O(n), instead
                    of trying every pair, O(n²).
                  </p>
                  <CodeBlock code={`SCENE TwoSum

DECLARE
  ARRAY nums = [4, 9, 12, 2, 15, 7]
  HASH_MAP seen

SEQUENCE
  target = 22
  found = 0
  i = 0
  WHILE found == 0 AND i < LENGTH(nums)
    need = target - nums[i]
    IF CONTAINS(seen, need)
      PRINT "Indices " + seen[need] + " and " + i
      found = 1
    ELSE
      seen[nums[i]] = i
    END
    i = i + 1
  END
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>Indices 4 and 5</C> (15 + 7 = 22).
                  </p>

                  <h3 className="docs-h3">Example 3 — The Hash Function by Hand</h3>
                  <p className="docs-p">
                    Adding up character codes gives anagrams the same sum, so <C>"cat"</C> and <C>"act"</C> collide.
                  </p>
                  <CodeBlock code={`SCENE HashByHand

DECLARE
  HASH_MAP m
  ARRAY words = ["cat", "dog", "act"]

  FUNCTION hashOf(word, buckets)
    total = 0
    LOOP i FROM 0 TO TEXT_LENGTH(word) - 1
      total = total + CHAR_CODE(word, i)
    END
    RETURN total % buckets
  END

SEQUENCE
  LOOP k FROM 0 TO LENGTH(words) - 1
    b = hashOf(words[k], CAPACITY(m))
    PRINT words[k] + " -> bucket " + b
    m[words[k]] = k
  END
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>cat -&gt; bucket 0</C>, <C>dog -&gt; bucket 2</C>, <C>act -&gt; bucket 0</C>,
                    and <C>act</C> is chained under <C>cat</C>.
                  </p>
                </section>

                <section id="hm-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Reading a key that is not there">
                    <C>m["mango"]</C> for a missing key stops with <em>the key "mango" is not in hash map 'm'</em>. Guard the
                    read with <C>IF CONTAINS(m, "mango")</C>, or store the key first. <C>DELETE m[key]</C> of a missing key
                    stops the same way.
                  </Alert>

                  <Alert kind="warn" title="KEY_AT index out of range">
                    <C>KEY_AT(m, i)</C> needs <C>0 &lt;= i &lt; LENGTH(m)</C>. <C>LOOP k FROM 0 TO LENGTH(m) - 1</C> counts
                    <em> down</em> (0, -1) when the map is empty, so walk a map that may be empty with
                    <C> WHILE k &lt; LENGTH(m)</C>.
                  </Alert>

                  <Alert kind="warn" title="Hash map values are not array cells">
                    <C>SWAP</C> and <C>COMPARE</C> work on array cells. Copy a value into a variable first
                    (<C>x = m[key]</C>).
                  </Alert>

                  <Alert kind="tip" title="Order is by bucket, not by insertion">
                    <C>PRINT m</C> and <C>KEY_AT</C> go bucket by bucket, so keys come out in hash order, and the order can
                    change after a resize. When order matters (the first unique character), walk the original text or array
                    instead of the map.
                  </Alert>

                  <Alert kind="tip" title="Don't add keys while walking the map">
                    A new key can trigger a resize that rehashes every key, changing what <C>KEY_AT(m, i)</C> returns.
                    Update the values of existing keys freely; collect new keys in another map.
                  </Alert>

                  <Alert kind="tip" title="Set a variable before an IF that assigns it">
                    A variable first created inside an IF or ELSE belongs to that block. Write <C>result = n</C> before
                    the IF, then change it inside, to use it afterwards.
                  </Alert>

                  <Alert kind="note" title="Maps are shared with functions">
                    A FUNCTION can read and change a declared map directly (<C>countWord(word)</C> updating <C>freq</C>),
                    which makes a map a good place for results a function must keep, such as a memo table.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                CONTROL FLOW & EXPRESSIONS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'control-flow' && (
              <>
                <PageHero group="Language" title="Loops & Control Flow">
                  <C>LOOP</C>, <C>WHILE</C>, <C>IF</C> / <C>ELSE IF</C> / <C>ELSE</C>, variables and operators: the general-purpose half of AQVL that turns a list of animation commands into an algorithm.
                </PageHero>

                <section id="cf-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    Every AQVL program is a <C>SCENE</C> with a <C>DECLARE</C> block (what exists: arrays, other
                    structures and <C>FUNCTION</C>s) and a <C>SEQUENCE</C> block (what happens), closed by <C>END</C>.
                    Inside the sequence and inside functions you write ordinary code, the way you would in C or Java:
                    counters, flags, loops and conditions. Every block, <C>LOOP</C>, <C>WHILE</C>, <C>IF</C> and
                    <C>FUNCTION</C>, is closed by its own <C>END</C>.
                  </p>
                  <CodeBlock code={`SCENE LoopsAtAGlance

DECLARE
  ARRAY marks = [72, 85, 64, 90, 58]

SEQUENCE
  passed = 0
  LOOP i FROM 0 TO LENGTH(marks) - 1
    IF marks[i] >= 60
      passed = passed + 1
      HIGHLIGHT marks[i] 'SUCCESS'
    ELSE
      HIGHLIGHT marks[i] 'DISCARDED'
    END
  END
  PRINT passed + " of " + LENGTH(marks) + " students passed"
END`} />
                  <Alert kind="note" title="Write it the long way">
                    The Loops &amp; Control examples in the Playground use no shortcut built-ins. The largest value is
                    found with a loop and an <C>IF</C>, not with <C>MAX</C>; a search stops through a flag in the
                    <C>WHILE</C> condition. Every decision is visible in the code and in the animation.
                  </Alert>
                </section>

                <section id="cf-declaration" className="docs-section">
                  <h2 className="docs-h2">Variables &amp; Literals</h2>
                  <p className="docs-p">
                    Variables are never declared. Assigning to a name creates it, with the value of the right-hand
                    expression. A variable can hold a number, text, <C>TRUE</C> / <C>FALSE</C> or <C>NULL</C>.
                  </p>
                  <CodeBlock label="Syntax" code={`<name> = <expression>`} />
                  <CodeBlock code={`total = 0
count = count + 1
name = "loops"
found = FALSE
average = total / count`} />
                  <p className="docs-p">
                    Literals: numbers (<C>42</C>, <C>3.5</C>, <C>-1</C>), text in either quote style (<C>"hello"</C>,
                    <C>'SUCCESS'</C>), <C>TRUE</C>, <C>FALSE</C>, <C>NULL</C> and <C>INFINITY</C>. A text literal is always
                    that text: <C>"i"</C> is the letter i even inside <C>LOOP i</C>. Comments run from <C>//</C> to the end
                    of the line.
                  </p>
                  <Alert kind="warn" title="Where a variable lives (scope)">
                    A variable first assigned <em>inside</em> a <C>LOOP</C>, <C>WHILE</C> or <C>IF</C> body only exists
                    inside that body, and a <C>LOOP</C> variable only exists inside its loop. Create counters, totals and
                    results <em>before</em> the loop; assigning to them inside the loop then updates that outer variable.
                    Inside a <C>FUNCTION</C>, assigning to a name always creates a local variable, so send results back
                    with <C>RETURN</C>.
                  </Alert>
                  <Alert kind="warn" title="Negation only applies to number literals">
                    <C>-5</C> is a negative number, but there is no minus in front of an expression: write <C>0 - x</C>
                    rather than <C>-x</C>.
                  </Alert>
                </section>

                <section id="cf-commands" className="docs-section">
                  <h2 className="docs-h2">Statements &amp; Operators</h2>

                  <h3 className="docs-h3">Loops and Conditions</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Construct</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">LOOP</span> <span className="tok-param">i</span> <span className="tok-keyword">FROM</span> <span className="tok-param">a</span> <span className="tok-keyword">TO</span> <span className="tok-param">b</span> … <span className="tok-keyword">END</span></td>
                          <td>The "for loop": runs the body once for every value of <C>i</C> from <C>a</C> to <C>b</C>, <strong>both included</strong>. Counts down by itself when <C>b</C> is smaller than <C>a</C>. Use it when the number of rounds is known.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">WHILE</span> <span className="tok-param">condition</span> … <span className="tok-keyword">END</span></td>
                          <td>Checks the condition before every round and repeats while it is true. If it is false at the start, the body runs zero times. Use it when you do not know how many rounds you need.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IF</span> <span className="tok-param">condition</span> … <span className="tok-keyword">END</span></td>
                          <td>Runs the body only when the condition is true.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IF</span> … <span className="tok-keyword">ELSE</span> … <span className="tok-keyword">END</span></td>
                          <td>Exactly one of the two bodies runs.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IF</span> … <span className="tok-keyword">ELSE IF</span> … <span className="tok-keyword">ELSE</span> … <span className="tok-keyword">END</span></td>
                          <td>A ladder: the conditions are checked from top to bottom and only the <strong>first</strong> true branch runs. <C>ELSE IF</C> is written on one line, and the whole chain shares one <C>END</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">FUNCTION</span> <span className="tok-param">name(a, b)</span> … <span className="tok-keyword">RETURN</span> <span className="tok-param">x</span> … <span className="tok-keyword">END</span></td>
                          <td>Declared in <C>DECLARE</C>, called from the sequence or from other functions. <C>RETURN</C> leaves the function at once, even from inside a loop.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">PRINT</span> <span className="tok-param">expr</span> [<span className="tok-param">array</span>]</td>
                          <td>Writes a line to the output console. Join text and numbers with <C>+</C>; an array name after the text prints the whole array: <C>PRINT "Sorted:" arr</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">WAIT</span></td>
                          <td>Pauses one beat so the current state can be read before the next step.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">BREAK and CONTINUE, written out</h3>
                  <p className="docs-p">
                    AQVL has no <C>BREAK</C> or <C>CONTINUE</C>. Both are written with the constructs above, which also
                    makes the reason a loop stops visible in its condition.
                  </p>
                  <CodeBlock label="Stop early (break)" code={`found = FALSE
i = 0
WHILE i < LENGTH(arr) AND found == FALSE
  IF arr[i] == target
    found = TRUE
  ELSE
    i = i + 1
  END
END`} />
                  <CodeBlock label="Skip an item (continue)" code={`LOOP i FROM 0 TO LENGTH(readings) - 1
  IF readings[i] < 0
    PRINT "skipped " + readings[i]
  ELSE
    total = total + readings[i]
  END
END`} />
                  <CodeBlock label="Run at least once (do-while)" code={`again = TRUE
WHILE again == TRUE
  // ... the body always runs the first time ...
  again = tries < 3 AND loggedIn == FALSE
END`} />

                  <h3 className="docs-h3">Operators</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Operator</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-operator">+ - * /</span></td>
                          <td>Arithmetic. <C>/</C> is real division (<C>7 / 2</C> is <C>3.5</C>). <C>+</C> also joins text: <C>"Day " + 3</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-operator">%</span></td>
                          <td>Remainder: <C>17 % 5</C> is <C>2</C>. <C>n % 2 == 0</C> tests for even, <C>n % 10</C> is the last digit.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-operator">&gt; &lt; &gt;= &lt;= == !=</span></td>
                          <td>Comparisons, giving <C>TRUE</C> or <C>FALSE</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">AND</span> <span className="tok-keyword">OR</span></td>
                          <td>Combine conditions. They short-circuit: in <C>i &lt; n AND arr[i] &gt; 0</C> the right side is only read while <C>i</C> is a valid index. Use brackets to group: <C>(a AND b) OR c</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-operator">=</span></td>
                          <td>Assignment. It binds looser than every other operator, so <C>total = total + i</C> means <C>total = (total + i)</C>, and <C>ok = a &gt; 0 AND b &gt; 0</C> stores the whole condition.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-builtin">LENGTH</span>(<span className="tok-param">arr</span>)</td>
                          <td>The number of elements, so the last index is <C>LENGTH(arr) - 1</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-builtin">TEXT_LENGTH</span>(<span className="tok-param">s</span>), <span className="tok-builtin">CHAR_AT</span>(<span className="tok-param">s, i</span>), <span className="tok-builtin">CHAR_CODE</span>(<span className="tok-param">s, i</span>)</td>
                          <td>Loop over text: its length, the character at position <C>i</C> (from 0), and that character's code (<C>"a"</C> is 97).</td>
                        </tr>
                        <tr>
                          <td><span className="tok-param">arr</span>[<span className="tok-param">expr</span>]</td>
                          <td>Element access; the index may be any expression (<C>arr[j + 1]</C>). Change a cell with <C>UPDATE arr[i] value</C>, add one with <C>INSERT arr[i] value</C>.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Universal Actions</h3>
                  <p className="docs-p">
                    These work across structures rather than belonging to one of them.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">target [color]</span></td>
                          <td>Pulses an element. A colour such as <C>'SUCCESS'</C> (green), <C>'MARKED'</C> (purple) or <C>'DISCARDED'</C> (grey) stays until changed; <C>'NEUTRAL'</C> resets it.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">COMPARE</span> <span className="tok-param">a b</span></td>
                          <td>Highlights two elements as being evaluated against each other. Neither is modified.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SWAP</span> <span className="tok-param">a b</span></td>
                          <td>Exchanges two elements, animating them along an arc.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SET</span> <span className="tok-param">target</span> <span className="tok-keyword">STATE</span> <span className="tok-param">name</span></td>
                          <td>Applies a named visual state (e.g. <C>active</C>, <C>visited</C>) that persists until changed.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-param">a</span> <span className="tok-operator">-&gt;</span> <span className="tok-param">b</span>, <span className="tok-param">a</span> <span className="tok-operator">&lt;-&gt;</span> <span className="tok-param">b</span>, <span className="tok-keyword">LINK</span> <span className="tok-param">a</span> <span className="tok-keyword">TO</span> <span className="tok-param">b</span></td>
                          <td>Draw a directed or undirected relationship between two declared objects.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="cf-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>
                  <p className="docs-p">
                    The Playground has 23 Loops &amp; Control examples: loop basics, WHILE, counting down, grade ladders,
                    leap years, accumulators, best-so-far, early exit, skipping, do-while, FizzBuzz, tables, star
                    patterns, pairs, text, Fibonacci, primes, the sieve, GCD, binary, Armstrong numbers and Collatz.
                    Four of them follow.
                  </p>

                  <h3 className="docs-h3">Example 1 — IF / ELSE IF / ELSE Ladder</h3>
                  <CodeBlock code={`SCENE GradeLadder

DECLARE
  ARRAY marks = [92, 67, 78, 31]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(marks) - 1
    grade = ""
    IF marks[i] >= 90
      grade = "A"
    ELSE IF marks[i] >= 75
      grade = "B"
    ELSE IF marks[i] >= 60
      grade = "C"
    ELSE
      grade = "F"
    END
    PRINT marks[i] + " -> " + grade
  END
END`} />
                  <p className="docs-p">
                    <strong>Output:</strong> <C>92 -&gt; A</C>, <C>67 -&gt; C</C>, <C>78 -&gt; B</C>, <C>31 -&gt; F</C>.
                    92 is also at least 75, but the ladder stops at the first true branch.
                  </p>

                  <h3 className="docs-h3">Example 2 — WHILE Over the Digits of a Number</h3>
                  <CodeBlock code={`SCENE DigitSum

DECLARE
  ARRAY digits = []

SEQUENCE
  remaining = 90417
  digitSum = 0
  WHILE remaining > 0
    lastDigit = remaining % 10
    INSERT digits[0] lastDigit
    digitSum = digitSum + lastDigit
    remaining = (remaining - lastDigit) / 10
  END
  PRINT "Digits:" digits
  PRINT "Sum of digits: " + digitSum
END`} />
                  <p className="docs-p">
                    <strong>Output:</strong> <C>Digits: [9, 0, 4, 1, 7]</C> and <C>Sum of digits: 21</C>. Removing the last
                    digit before dividing keeps the division whole.
                  </p>

                  <h3 className="docs-h3">Example 3 — Nested Loops: a Pyramid</h3>
                  <CodeBlock code={`SCENE Pyramid

DECLARE
  ARRAY starsPerRow = []

SEQUENCE
  rows = 4
  LOOP r FROM 1 TO rows
    line = ""
    spaces = 0
    WHILE spaces < rows - r
      line = line + " "
      spaces = spaces + 1
    END
    LOOP s FROM 1 TO 2 * r - 1
      line = line + "*"
    END
    INSERT starsPerRow[LENGTH(starsPerRow)] 2 * r - 1
    PRINT line
  END
END`} />
                  <p className="docs-p">
                    The spaces use <C>WHILE</C> because the last row needs zero of them, and <C>LOOP s FROM 1 TO 0</C>
                    would count down and run twice.
                  </p>

                  <h3 className="docs-h3">Example 4 — A Helper FUNCTION with an Early RETURN</h3>
                  <CodeBlock code={`SCENE PrimeCheck

DECLARE
  ARRAY candidates = [2, 9, 17, 21]

  FUNCTION isPrime(n)
    IF n < 2
      RETURN FALSE
    END
    d = 2
    WHILE d * d <= n
      IF n % d == 0
        RETURN FALSE
      END
      d = d + 1
    END
    RETURN TRUE
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(candidates) - 1
    IF isPrime(candidates[i]) == TRUE
      HIGHLIGHT candidates[i] 'SUCCESS'
    ELSE
      HIGHLIGHT candidates[i] 'DISCARDED'
    END
  END
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> 2 and 17 turn green, 9 and 21 grey. For 9 the <C>WHILE</C> loop
                    stops at <C>d = 3</C> because <C>RETURN</C> leaves the function immediately.
                  </p>
                </section>

                <section id="cf-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Message or symptom</th><th>Cause and fix</th></tr>
                      </thead>
                      <tbody>
                        <tr><td><C>Index 5 is out of bounds for array 'arr' (valid indices are 0 to 4)</C></td><td>The loop went one step too far. Loop bounds are inclusive: use <C>TO LENGTH(arr) - 1</C>, not <C>TO LENGTH(arr)</C>.</td></tr>
                        <tr><td><C>Execution exceeded the maximum allowed iteration count</C></td><td>A <C>WHILE</C> loop never ended: nothing in its body moves the condition towards false. Make sure the counter changes on every path through the body (including the <C>ELSE</C>).</td></tr>
                        <tr><td><C>Undeclared identifier 'total'</C></td><td>The variable was first assigned inside a loop or <C>IF</C> body and is used after it. Assign it (e.g. <C>total = 0</C>) before the loop.</td></tr>
                        <tr><td><C>Expected END to close LOOP block</C></td><td>Every <C>LOOP</C>, <C>WHILE</C>, <C>IF</C> chain and <C>FUNCTION</C> needs its own <C>END</C>. The error often points at the line after the problem.</td></tr>
                        <tr><td><C>ELSE without a matching IF</C></td><td>An extra <C>END</C> closed the <C>IF</C> before its <C>ELSE</C>. An <C>IF</C> / <C>ELSE IF</C> / <C>ELSE</C> chain has one <C>END</C> at the very end.</td></tr>
                        <tr><td><C>RETURN can only be used inside a FUNCTION</C></td><td>To stop a loop in the sequence, use a flag in a <C>WHILE</C> condition instead.</td></tr>
                        <tr><td>Division by zero</td><td>Guard averages: <C>IF count &gt; 0</C> before <C>total / count</C>.</td></tr>
                        <tr><td>A name such as <C>size</C>, <C>path</C>, <C>position</C>, <C>level</C> is rejected</td><td>It is a keyword. Pick another name, e.g. <C>mySize</C>, <C>trail</C>, <C>foundAt</C>.</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <Alert kind="warn" title="LOOP 1 TO 0 runs twice, not zero times">
                    <C>LOOP</C> counts down when <C>TO</C> is smaller than <C>FROM</C>, so an "empty" range such as
                    <C>LOOP s FROM 1 TO 0</C> runs with <C>s = 1</C> and <C>s = 0</C>. When a range can be empty, use
                    <C>WHILE s &lt; limit</C>, which correctly runs zero times.
                  </Alert>

                  <Alert kind="warn" title="Changing the loop variable changes the loop">
                    Assigning to <C>i</C> inside <C>LOOP i</C> moves the loop: <C>i = i + 1</C> in the body makes it skip
                    every other value. If you need to control the step yourself, use a <C>WHILE</C> loop.
                  </Alert>

                  <Alert kind="warn" title="Order the ELSE IF branches from most to least specific">
                    In FizzBuzz, <C>n % 3 == 0 AND n % 5 == 0</C> must come before <C>n % 3 == 0</C>, otherwise 15 takes
                    the "Fizz" branch and the "FizzBuzz" branch never runs.
                  </Alert>

                  <Alert kind="tip" title="Start 'best so far' from a real element">
                    Initialise <C>largest = arr[0]</C> and loop from index 1, instead of starting from a guess like
                    <C>0</C>, which fails when every value is negative.
                  </Alert>

                  <Alert kind="tip" title="Whole-number division">
                    <C>/</C> gives decimals. To drop the last digit, write <C>(n - n % 10) / 10</C>; to halve an odd
                    number downwards, <C>(n - n % 2) / 2</C>.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                FUNCTIONS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'functions' && (
              <>
                <PageHero group="Language" title="Functions & Recursion">
                  Named functions with parameters and <C>RETURN</C> values, guard clauses, and recursion with a visible call stack, from factorial to backtracking.
                </PageHero>

                <section id="fn-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>FUNCTION</C> is a named piece of work. It takes <strong>parameters</strong> (its inputs), does
                    one job and hands back one answer with <C>RETURN</C>. You write it once in <C>DECLARE</C> and call it
                    as often as you like, from <C>SEQUENCE</C> or from another function. A function that calls
                    <em> itself</em> on a smaller input is <strong>recursive</strong>.
                  </p>
                  <p className="docs-p">
                    Every example in the Playground&apos;s Recursion &amp; Functions category is written out the long way:
                    guard clauses, <C>IF</C> / <C>ELSE IF</C> / <C>ELSE</C> ladders, <C>WHILE</C> loops and recursive
                    calls with a clear base case. Nothing is hard-coded, so you can change the numbers in <C>DECLARE</C>
                    or the arguments in <C>SEQUENCE</C> and the run is still correct.
                  </p>
                  <Alert kind="note" title="Where functions live">
                    Functions are declared in the <C>DECLARE</C> block, next to the arrays and stacks they work on, and
                    called from <C>SEQUENCE</C>. A call is an ordinary expression: <C>x = f(3)</C>, <C>PRINT f(3)</C>,
                    <C>f(g(2))</C> and <C>IF isPrime(n)</C> all work.
                  </Alert>
                </section>

                <section id="fn-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Function</h2>
                  <CodeBlock label="Syntax" code={`FUNCTION name(param1, param2, ...)
  statements            // any SEQUENCE statement: IF, WHILE, LOOP, PRINT, HIGHLIGHT, UPDATE, PUSH ...
  RETURN expression     // hands the answer back and leaves the function at once
END`} />
                  <p className="docs-p">
                    The body accepts every statement the <C>SEQUENCE</C> block accepts. A brace form,
                    <C>FUNCTION name(n) &#123; ... &#125;</C> with <C>IF cond &#123; &#125; ELSE &#123; &#125;</C>,
                    is also accepted; the Playground examples use the <C>END</C> form so that function bodies look
                    exactly like the rest of the program.
                  </p>

                  <h3 className="docs-h3">Parameters are copies</h3>
                  <p className="docs-p">
                    When you call <C>addBonus(marksNow)</C>, the function gets a <em>copy</em> of the value. Changing the
                    parameter inside the function never changes the caller&apos;s variable, so the answer has to come
                    back with <C>RETURN</C> and be stored: <C>marksNow = addBonus(marksNow)</C>.
                  </p>

                  <h3 className="docs-h3">Local and shared data</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead><tr><th>Inside a function you can ...</th><th>Result</th></tr></thead>
                      <tbody>
                        <tr><td>assign <C>total = 0</C></td><td>a <strong>local</strong> variable of this call only; it disappears when the call returns.</td></tr>
                        <tr><td>assign to a parameter</td><td>changes only this call&apos;s copy.</td></tr>
                        <tr><td>read a <C>SEQUENCE</C> variable</td><td>works (<C>shopName + &quot; welcomes &quot; + name</C>).</td></tr>
                        <tr><td>assign to a <C>SEQUENCE</C> variable</td><td>creates a <em>new local</em> with the same name; the outer one is unchanged.</td></tr>
                        <tr><td><C>UPDATE</C>, <C>SWAP</C>, <C>PUSH</C>, <C>POP</C> a structure from <C>DECLARE</C></td><td><strong>shared</strong>: the caller sees the change.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    That is why every counter that must survive a call lives in a one-cell array:
                    <C>UPDATE calls[0] calls[0] + 1</C>.
                  </p>
                </section>

                <section id="fn-recursion" className="docs-section">
                  <h2 className="docs-h2">Recursion</h2>
                  <p className="docs-p">Every recursive function has two parts:</p>
                  <ul>
                    <li><strong>Base case</strong>: a small input answered directly, with no further call (<C>IF n &lt;= 1</C> … <C>RETURN 1</C>).</li>
                    <li><strong>Recursive case</strong>: the same problem on a <em>smaller</em> input, plus one step of work (<C>RETURN n * factorial(n - 1)</C>).</li>
                  </ul>
                  <p className="docs-p">
                    Each call waits on the <strong>call stack</strong> until the call it made returns. Going down
                    (&quot;winding&quot;) the calls pile up; once the base case answers, they finish one by one in reverse
                    order (&quot;unwinding&quot;). The examples make this visible in three ways:
                  </p>
                  <CodeBlock code={`PUSH calls n                        // a STACK named calls grows when a call starts
PRINT pad(depth) + "factorial(" + n + ") called"   // deeper calls print further right
done = POP(calls)                   // ... and shrinks when the call returns
UPDATE counter[0] counter[0] + 1    // count the calls to measure the cost`} />
                  <p className="docs-p">
                    Work written <em>before</em> the recursive call happens on the way down; work written <em>after</em>
                    it happens on the way back up, in reverse order. <strong>Backtracking</strong> uses exactly that:
                    make a choice, recurse, then undo the choice after the call returns.
                  </p>
                </section>

                <section id="fn-commands" className="docs-section">
                  <h2 className="docs-h2">Patterns Reference</h2>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead><tr><th>Pattern</th><th>What it looks like</th><th>Examples</th></tr></thead>
                      <tbody>
                        <tr><td>Helper function</td><td>One job, one <C>RETURN</C>, called in a loop</td><td>Canteen Bill, Class Report</td></tr>
                        <tr><td>Yes / no function</td><td><C>RETURN TRUE</C> / <C>RETURN FALSE</C>, used as <C>IF isValid(m)</C></td><td>Grade Calculator, Prime Toolkit</td></tr>
                        <tr><td>Guard clauses</td><td>Check each rule first and <C>RETURN</C> early when it is broken</td><td>ATM Withdrawal</td></tr>
                        <tr><td>Linear recursion</td><td>One call per step on <C>n - 1</C> or <C>i + 1</C></td><td>Factorial, Digits, Array, Palindrome</td></tr>
                        <tr><td>Accumulator</td><td>An extra parameter carries the answer so far</td><td><C>reverseDigits(n, built)</C></td></tr>
                        <tr><td>Divide and conquer</td><td>Halve the input on each call</td><td>Fast Power, Binary conversion, GCD</td></tr>
                        <tr><td>Tree recursion</td><td>Two or more calls per call</td><td>Naive Fibonacci, Hanoi, Coin Change</td></tr>
                        <tr><td>Memoisation</td><td>An array of answers, <C>-1</C> while unknown; look it up before computing</td><td>Fibonacci, Stairs, Coin Change</td></tr>
                        <tr><td>Backtracking</td><td>Choose, recurse, undo; stop early when a branch cannot work</td><td>Subsets, Permutations, N-Queens</td></tr>
                        <tr><td>Mutual recursion</td><td>Two functions that call each other</td><td><C>isEven</C> / <C>isOdd</C></td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead><tr><th>Recursion</th><th>Calls</th><th>Measured in the examples</th></tr></thead>
                      <tbody>
                        <tr><td><C>factorial(n)</C>, <C>slowPower(b, e)</C></td><td>n + 1</td><td>2^10: 11 calls</td></tr>
                        <tr><td><C>fastPower(b, e)</C>, <C>gcd(a, b)</C></td><td>about log n</td><td>2^10: 5 calls</td></tr>
                        <tr><td><C>fibNaive(n)</C></td><td>grows like 1.6^n</td><td>fib(15): 1973 calls</td></tr>
                        <tr><td><C>fibMemo(n)</C></td><td>about 2n</td><td>fib(16): 31 calls, then 1</td></tr>
                        <tr><td><C>hanoi(n)</C></td><td>2^n - 1 moves</td><td>3 disks: 7 moves</td></tr>
                        <tr><td>subsets / permutations</td><td>2^n / n!</td><td>16 subsets, 6 seatings</td></tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="fn-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Functions that build on each other</h3>
                  <p className="docs-p">
                    Each function does one job; <C>finalBill</C> is built by calling <C>discountOn</C> and
                    <C>gstOn</C>, and the same functions then work for a different amount.
                  </p>
                  <CodeBlock code={`SCENE FunctionBasics

DECLARE
  ARRAY price = [40, 25, 60, 50]
  ARRAY qty = [2, 4, 2, 4]

  FUNCTION lineTotal(i)
    total = price[i] * qty[i]
    RETURN total
  END

  FUNCTION discountOn(amount)
    IF amount >= 300
      RETURN amount * 10 / 100
    ELSE
      RETURN 0
    END
  END

  FUNCTION gstOn(amount)
    RETURN amount * 5 / 100
  END

  FUNCTION finalBill(subtotal)
    afterDiscount = subtotal - discountOn(subtotal)
    RETURN afterDiscount + gstOn(afterDiscount)
  END

SEQUENCE
  subtotal = 0
  LOOP i FROM 0 TO LENGTH(price) - 1
    HIGHLIGHT price[i]
    line = lineTotal(i)
    PRINT "Item " + i + ": " + qty[i] + " x " + price[i] + " = " + line
    subtotal = subtotal + line
    HIGHLIGHT price[i] 'SUCCESS'
  END

  PRINT "Subtotal: " + subtotal
  PRINT "Discount: " + discountOn(subtotal)
  PRINT "GST: " + gstOn(subtotal - discountOn(subtotal))
  PRINT "Amount to pay: " + finalBill(subtotal)

  PRINT "A bill of 120 pays " + finalBill(120) + " (no discount below 300)"
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>Subtotal: 500</C>, <C>Discount: 50</C>, <C>GST: 22.5</C>,
                    <C>Amount to pay: 472.5</C> and <C>A bill of 120 pays 126</C>.
                  </p>

                  <h3 className="docs-h3">Example 2 — Parameters are copies, arrays are shared</h3>
                  <CodeBlock code={`SCENE ParametersAreCopies

DECLARE
  ARRAY score = [10, 20]

  FUNCTION trySwap(a, b)
    temp = a
    a = b
    b = temp
    PRINT "  inside trySwap: a=" + a + " b=" + b
  END

  FUNCTION swapCells(i, j)
    temp = score[i]
    UPDATE score[i] score[j]
    UPDATE score[j] temp
  END

  FUNCTION addBonus(points)
    points = points + 5
    RETURN points
  END

SEQUENCE
  x = 1
  y = 2
  trySwap(x, y)
  PRINT "after trySwap: x=" + x + " y=" + y + " (unchanged: the function got copies)"

  PRINT "before swapCells:" score
  swapCells(0, 1)
  PRINT "after swapCells:" score
  HIGHLIGHT score[0] 'SUCCESS'
  HIGHLIGHT score[1] 'SUCCESS'

  marksNow = 70
  addBonus(marksNow)
  PRINT "addBonus(marksNow) alone: marksNow is still " + marksNow
  marksNow = addBonus(marksNow)
  PRINT "marksNow = addBonus(marksNow): marksNow is now " + marksNow
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>x=1 y=2</C> after <C>trySwap</C>, <C>score</C> becomes
                    <C>[20, 10]</C> after <C>swapCells</C>, and <C>marksNow</C> only changes to 75 once the returned
                    value is stored.
                  </p>

                  <h3 className="docs-h3">Example 3 — Factorial with a visible call stack</h3>
                  <CodeBlock code={`SCENE FactorialRecursion

DECLARE
  STACK calls = []

  FUNCTION pad(depth)
    s = ""
    k = 0
    WHILE k < depth
      s = s + "  "
      k = k + 1
    END
    RETURN s
  END

  FUNCTION factorial(n, depth)
    PUSH calls n
    PRINT pad(depth) + "factorial(" + n + ") called"
    IF n <= 1
      PRINT pad(depth) + "base case: factorial(" + n + ") = 1"
      done = POP(calls)
      RETURN 1
    END
    smaller = factorial(n - 1, depth + 1)
    result = n * smaller
    PRINT pad(depth) + "factorial(" + n + ") = " + n + " * " + smaller + " = " + result
    done = POP(calls)
    RETURN result
  END

  FUNCTION factorialLoop(n)
    result = 1
    k = 2
    WHILE k <= n
      result = result * k
      k = k + 1
    END
    RETURN result
  END

SEQUENCE
  answer = factorial(5, 0)
  PRINT "factorial(5) = " + answer + ", the loop version gives " + factorialLoop(5)

  zero = factorial(0, 0)
  PRINT "factorial(0) = " + zero
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> five <C>called</C> lines, each indented further, the base case, then the
                    products <C>2</C>, <C>6</C>, <C>24</C>, <C>120</C> coming back up while the <C>calls</C> stack empties.
                  </p>

                  <h3 className="docs-h3">Example 4 — Fibonacci: naive, memoised and a loop</h3>
                  <CodeBlock code={`SCENE FibonacciThreeWays

DECLARE
  ARRAY memo = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
  ARRAY calls = [0, 0]

  FUNCTION fibNaive(n)
    UPDATE calls[0] calls[0] + 1
    IF n <= 1
      RETURN n
    END
    RETURN fibNaive(n - 1) + fibNaive(n - 2)
  END

  FUNCTION fibMemo(n)
    UPDATE calls[1] calls[1] + 1
    IF memo[n] != -1
      RETURN memo[n]
    END
    value = n
    IF n > 1
      value = fibMemo(n - 1) + fibMemo(n - 2)
    END
    UPDATE memo[n] value
    HIGHLIGHT memo[n] 'SUCCESS'
    RETURN value
  END

  FUNCTION fibLoop(n)
    IF n <= 1
      RETURN n
    END
    prev = 0
    curr = 1
    k = 2
    WHILE k <= n
      next = prev + curr
      prev = curr
      curr = next
      k = k + 1
    END
    RETURN curr
  END

SEQUENCE
  LOOP n FROM 5 TO 15
    UPDATE calls[0] 0
    value = fibNaive(n)
    IF n % 5 == 0
      PRINT "naive fib(" + n + ") = " + value + " needed " + calls[0] + " calls"
    END
  END

  UPDATE calls[1] 0
  PRINT "memo fib(16) = " + fibMemo(16) + " needed " + calls[1] + " calls"
  UPDATE calls[1] 0
  again = fibMemo(16)
  PRINT "asking for fib(16) again: " + again + " in " + calls[1] + " call (a table lookup)"
  PRINT "loop fib(16) = " + fibLoop(16)
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> <C>naive fib(15) = 610 needed 1973 calls</C>, while the memo version needs
                    31 calls for fib(16) and the <C>memo</C> array fills in green.
                  </p>

                  <h3 className="docs-h3">Example 5 — Tower of Hanoi on three stacks</h3>
                  <CodeBlock code={`SCENE TowerOfHanoi

DECLARE
  STACK pegA = [3, 2, 1]
  STACK pegB = []
  STACK pegC = []
  ARRAY moveCount = [0]

  FUNCTION nameOf(peg)
    IF peg == 1
      RETURN "A"
    ELSE IF peg == 2
      RETURN "B"
    ELSE
      RETURN "C"
    END
  END

  FUNCTION takeFrom(peg)
    IF peg == 1
      RETURN POP(pegA)
    ELSE IF peg == 2
      RETURN POP(pegB)
    ELSE
      RETURN POP(pegC)
    END
  END

  FUNCTION putOn(peg, disk)
    IF peg == 1
      PUSH pegA disk
    ELSE IF peg == 2
      PUSH pegB disk
    ELSE
      PUSH pegC disk
    END
  END

  FUNCTION moveDisk(src, dst)
    disk = takeFrom(src)
    putOn(dst, disk)
    UPDATE moveCount[0] moveCount[0] + 1
    PRINT "Move " + moveCount[0] + ": disk " + disk + " from " + nameOf(src) + " to " + nameOf(dst)
  END

  FUNCTION hanoi(n, src, dst, spare)
    IF n == 0
      RETURN 0
    END
    hanoi(n - 1, src, spare, dst)
    moveDisk(src, dst)
    hanoi(n - 1, spare, dst, src)
  END

SEQUENCE
  disks = LENGTH(pegA)
  hanoi(disks, 1, 3, 2)
  PRINT "Peg C (bottom to top):" pegC
  PRINT disks + " disks moved in " + moveCount[0] + " moves (2^n - 1)"
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> 7 moves, starting <C>Move 1: disk 1 from A to C</C>, and every disk ends
                    on peg C: <C>[3, 2, 1]</C>.
                  </p>

                  <h3 className="docs-h3">Example 6 — Backtracking: subsets within a budget</h3>
                  <CodeBlock code={`SCENE SubsetsWithinBudget

DECLARE
  ARRAY cost = [40, 30, 50, 20]
  ARRAY chosen = [0, 0, 0, 0]
  ARRAY counts = [0, 0]

  FUNCTION describe()
    text = ""
    total = 0
    LOOP k FROM 0 TO LENGTH(cost) - 1
      IF chosen[k] == 1
        text = text + cost[k] + " "
        total = total + cost[k]
      END
    END
    IF total == 0
      RETURN "plain pizza (0)"
    END
    RETURN text + "(" + total + ")"
  END

  FUNCTION explore(i, spent, budget)
    IF spent > budget
      RETURN 0
    END
    IF i == LENGTH(cost)
      UPDATE counts[0] counts[0] + 1
      PRINT "  " + describe()
      RETURN 0
    END
    explore(i + 1, spent, budget)
    UPDATE chosen[i] 1
    HIGHLIGHT cost[i] 'MARKED'
    explore(i + 1, spent + cost[i], budget)
    UPDATE chosen[i] 0
    HIGHLIGHT cost[i] 'NEUTRAL'
  END

SEQUENCE
  PRINT "Topping combinations within 100:"
  explore(0, 0, 100)
  PRINT counts[0] + " combinations fit the budget (out of 2^" + LENGTH(cost) + " = 16)"
  PRINT "chosen is back to all zeros:" chosen
END`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> 13 combinations are listed (the three over 100 are cut off early) and
                    <C>chosen</C> is back to all zeros because every choice was undone.
                  </p>

                  <p className="docs-p">
                    The Playground has 24 complete Recursion &amp; Functions programs:
                  </p>
                  <ul>
                    <li>functions: a canteen bill, a grade calculator, parameters as copies, local and global scope, a prime toolkit, a class report and an ATM with guard clauses;</li>
                    <li>recursion basics: factorial with its call stack, printing before vs after the call, digits, slow vs fast power, GCD and LCM;</li>
                    <li>Fibonacci three ways, recursion on an array, reversing an array, palindrome words, binary / octal / hex and mutual recursion;</li>
                    <li>tree recursion and backtracking: the Tower of Hanoi, subsets within a budget, seating permutations, N-Queens, climbing stairs and coin change.</li>
                  </ul>
                </section>

                <section id="fn-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead><tr><th>Problem</th><th>What to do</th></tr></thead>
                    <tbody>
                      <tr><td><C>Call stack exceeded 1000 frames</C></td><td>The base case is never reached. Check that every call moves towards it (<C>n - 1</C>, <C>i + 1</C>, a smaller amount) and that the test catches every stopping value (<C>n &lt;= 1</C>, not only <C>n == 1</C>).</td></tr>
                      <tr><td><C>Execution exceeded the maximum allowed iteration count</C></td><td>A tree recursion is recomputing the same answers (a fewest-coins recursion without a table took hundreds of thousands of steps). Remember answers in a memo array.</td></tr>
                      <tr><td><C>Undeclared identifier &apos;value&apos;</C></td><td>A variable first set inside the branches of an <C>IF</C> / <C>ELSE</C> is not known after the <C>END</C>. Give it a value before the <C>IF</C> (<C>value = n</C>), then change it inside.</td></tr>
                      <tr><td><C>&quot;from&quot; is a reserved word</C></td><td><C>FROM</C>, <C>TO</C> and <C>INTO</C> are keywords, so they cannot be parameter names. Use <C>src</C>, <C>dst</C>, <C>spare</C>.</td></tr>
                      <tr><td>A counter stays 0 after the calls</td><td>Assigning to an outer variable inside a function creates a local. <C>RETURN</C> the new value, or keep the counter in an array cell and <C>UPDATE</C> it.</td></tr>
                      <tr><td>The indentation is wrong at depth 0</td><td><C>LOOP k FROM 1 TO 0</C> counts down and runs twice. When a count can be 0, use <C>WHILE k &lt; depth</C>.</td></tr>
                    </tbody>
                  </table>
                  </div>

                  <Alert kind="warn" title="Every path should RETURN">
                    A function whose <C>IF</C> returns but whose other path falls off the end gives back nothing on that
                    path. Give every branch a <C>RETURN</C>, or put one after the <C>IF</C>.
                  </Alert>

                  <Alert kind="tip" title="Undo what you changed when backtracking">
                    A choice stored in a shared array (<C>UPDATE chosen[i] 1</C>, <C>SWAP seat[pos] seat[k]</C>) must be
                    undone after the recursive call returns, otherwise the next branch starts from the wrong state.
                  </Alert>

                  <Alert kind="tip" title="Store a half, do not compute it twice">
                    <C>half = fastPower(b, e / 2)</C> followed by <C>half * half</C> makes one call per level. Writing
                    <C>fastPower(b, e / 2) * fastPower(b, e / 2)</C> makes two and loses the whole speed-up.
                  </Alert>

                  <Alert kind="note" title="Negative numbers as arguments">
                    <C>UPDATE col[row] -1</C> stores -1: a <C>-</C> with a space before it and a digit right after it
                    starts a new argument. <C>col[row] - 1</C> and <C>col[row]-1</C> subtract.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                SORTING PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'sorting' && (
              <>
                <PageHero group="Algorithms" title="Sorting Algorithms">
                  Run a sort as a single built-in keyword, or write the comparisons and swaps yourself — AQVL supports both, and they teach different things.
                </PageHero>

                <section id="so-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    Sorting is what AQVL was built to show. A sort is a long sequence of comparisons and swaps, and
                    watching which pairs an algorithm chooses to compare is the difference between memorising a sort and
                    understanding it.
                  </p>
                  <p className="docs-p">
                    Every sorting example on this page operates on an <C>ARRAY</C>, using <C>COMPARE</C> to show the pair
                    under consideration and <C>SWAP</C> to exchange them.
                  </p>
                </section>

                <section id="so-declaration" className="docs-section">
                  <h2 className="docs-h2">Two Ways to Sort</h2>
                  <p className="docs-p">
                    <strong>Built-in.</strong> One keyword runs a complete, correct sort and animates every step it takes.
                    Use it when the array is the subject and the sort is just the thing happening to it.
                  </p>
                  <CodeBlock label="Syntax" code={`BUBBLE_SORT <name>`} />
                  <CodeBlock code={`SCENE OneShotSort

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  BUBBLE_SORT arr
END`} />

                  <p className="docs-p">
                    <strong>By hand.</strong> Writing the loops yourself puts you in control of exactly what is compared
                    and when, and lets you add <C>HIGHLIGHT</C> and <C>WAIT</C> to narrate the algorithm's reasoning.
                  </p>
                  <CodeBlock code={`SCENE ManualSort

DECLARE
  ARRAY arr = [64, 34, 25, 12]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    LOOP j FROM 0 TO LENGTH(arr) - i - 2
      COMPARE arr[j] arr[j+1]
      IF arr[j] > arr[j+1]
        SWAP arr[j] arr[j+1]
      END
    END
  END
END`} />
                  <Alert kind="tip" title="Start built-in, then rebuild it">
                    Playing <C>BUBBLE_SORT arr</C> first and then walking through the hand-written version is an
                    effective way to teach: the goal is established before the mechanics.
                  </Alert>
                </section>

                <section id="so-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>

                  <h3 className="docs-h3">Built-in Sorts</h3>
                  <p className="docs-p">Each takes the name of an array and animates a full run.</p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">BUBBLE_SORT</span> <span className="tok-param">name</span></td>
                          <td>Repeatedly compares adjacent pairs, letting the largest remaining value rise to the end of each pass. O(n²).</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SELECTION_SORT</span> <span className="tok-param">name</span></td>
                          <td>Finds the smallest value in the unsorted region and moves it into place. O(n²), with the fewest swaps.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">INSERTION_SORT</span> <span className="tok-param">name</span></td>
                          <td>Grows a sorted prefix by inserting each next element into its correct spot. O(n²), near-linear on nearly-sorted input.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">MERGE_SORT</span> <span className="tok-param">name</span></td>
                          <td>Splits, sorts each half, and merges them back. O(n log n) and stable.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">QUICK_SORT</span> <span className="tok-param">name</span></td>
                          <td>Partitions around a pivot and recurses into each side. O(n log n) on average.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Building Blocks</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">COMPARE</span> <span className="tok-param">arr[i] arr[j]</span></td>
                          <td>Shows the pair being evaluated. Purely visual — it does not branch on its own.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SWAP</span> <span className="tok-param">arr[i] arr[j]</span></td>
                          <td>Exchanges two elements along an animated arc.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IF</span> <span className="tok-param">arr[i] &gt; arr[j]</span></td>
                          <td>The decision that follows a comparison. Closed with <C>END</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">arr[i] ['SUCCESS']</span></td>
                          <td>Marks an element as settled into its final position.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="so-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Bubble Sort with Early Exit</h3>
                  <p className="docs-p">
                    Each pass drives the largest remaining value to the right end, which turns green. A <C>swapped</C> flag in the <C>WHILE</C> condition stops the sort as soon as a pass makes no swap.
                  </p>
                  <CodeBlock code={`SCENE BubbleSort

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  n = LENGTH(arr)
  pass = 0
  swapped = 1

  WHILE swapped == 1 AND pass < n - 1
    swapped = 0
    LOOP j FROM 0 TO n - pass - 2
      COMPARE arr[j] arr[j + 1]
      IF arr[j] > arr[j + 1]
        SWAP arr[j] arr[j + 1]
        swapped = 1
      END
    END
    HIGHLIGHT arr[n - pass - 1] 'SUCCESS'
    pass = pass + 1
    PRINT "After pass " + pass + ":" arr
  END

  IF swapped == 0
    PRINT "Pass " + pass + " made no swaps, so the array is already sorted"
  END

  k = 0
  WHILE k < n - pass
    HIGHLIGHT arr[k] 'SUCCESS'
    k = k + 1
  END
  PRINT "Sorted:" arr
END`} />

                  <h3 className="docs-h3">Example 2 — Selection Sort</h3>
                  <p className="docs-p">
                    The inner loop remembers the index of the smallest value seen so far (purple); only when the scan is finished is it swapped into position <C>i</C> — at most one swap per pass.
                  </p>
                  <CodeBlock code={`SCENE SelectionSort

DECLARE
  ARRAY arr = [64, 25, 12, 22, 11]

SEQUENCE
  n = LENGTH(arr)
  swaps = 0

  LOOP i FROM 0 TO n - 2
    minIndex = i
    HIGHLIGHT arr[i] 'MARKED'

    LOOP j FROM i + 1 TO n - 1
      COMPARE arr[minIndex] arr[j]
      IF arr[j] < arr[minIndex]
        IF minIndex != i
          HIGHLIGHT arr[minIndex] 'NEUTRAL'
        END
        minIndex = j
        HIGHLIGHT arr[minIndex] 'MARKED'
      END
    END

    IF minIndex != i
      PRINT "Smallest of the rest is " + arr[minIndex] + " at index " + minIndex + ", swap it into index " + i
      SWAP arr[i] arr[minIndex]
      HIGHLIGHT arr[minIndex] 'NEUTRAL'
      swaps = swaps + 1
    ELSE
      PRINT arr[i] + " is already the smallest of the rest, no swap needed"
    END
    HIGHLIGHT arr[i] 'SUCCESS'
  END

  HIGHLIGHT arr[n - 1] 'SUCCESS'
  PRINT "Sorted with " + swaps + " swaps:" arr
END`} />

                  <h3 className="docs-h3">Example 3 — Insertion Sort</h3>
                  <p className="docs-p">
                    The key is saved in a variable, larger values are shifted one place right with <C>UPDATE</C> inside a <C>WHILE</C> loop, and the key is written into the gap that opens up.
                  </p>
                  <CodeBlock code={`SCENE InsertionSort

DECLARE
  ARRAY arr = [12, 11, 13, 5, 6]

SEQUENCE
  n = LENGTH(arr)
  shifts = 0

  LOOP i FROM 1 TO n - 1
    key = arr[i]
    HIGHLIGHT arr[i] 'MARKED'
    PRINT "Insert key " + key
    j = i - 1

    keepShifting = 1
    WHILE keepShifting == 1
      IF j < 0
        keepShifting = 0
      ELSE
        HIGHLIGHT arr[j]
        IF arr[j] > key
          UPDATE arr[j + 1] arr[j]
          shifts = shifts + 1
          j = j - 1
        ELSE
          keepShifting = 0
        END
      END
    END

    UPDATE arr[j + 1] key
    HIGHLIGHT arr[i] 'NEUTRAL'
    HIGHLIGHT arr[j + 1]
    PRINT "  placed at index " + (j + 1) + ":" arr
  END

  LOOP k FROM 0 TO n - 1
    HIGHLIGHT arr[k] 'SUCCESS'
  END
  PRINT "Sorted with " + shifts + " shifts:" arr
END`} />

                  <h3 className="docs-h3">Example 4 — Recursive Quick Sort</h3>
                  <p className="docs-p">
                    Declare <C>FUNCTION</C>s in <C>DECLARE</C> and call them from <C>SEQUENCE</C>. <C>partition</C> returns the pivot’s final index; <C>quickSort</C> calls itself on each side. Every function call has its own local variables, so recursion works exactly as in any other language.
                  </p>
                  <CodeBlock code={`SCENE QuickSort

DECLARE
  ARRAY arr = [10, 80, 30, 90, 40, 50, 70]

  FUNCTION partition(low, high)
    pivot = arr[high]
    HIGHLIGHT arr[high] 'MARKED'
    PRINT "Partition [" + low + ".." + high + "] around pivot " + pivot
    wall = low - 1

    LOOP j FROM low TO high - 1
      COMPARE arr[j] arr[high]
      IF arr[j] < pivot
        wall = wall + 1
        IF wall != j
          SWAP arr[wall] arr[j]
        END
      END
    END

    pivotIndex = wall + 1
    IF pivotIndex != high
      SWAP arr[pivotIndex] arr[high]
      HIGHLIGHT arr[high] 'NEUTRAL'
    END
    HIGHLIGHT arr[pivotIndex] 'SUCCESS'
    PRINT "  pivot " + pivot + " is now fixed at index " + pivotIndex + ":" arr
    RETURN pivotIndex
  END

  FUNCTION quickSort(low, high)
    IF low < high
      p = partition(low, high)
      quickSort(low, p - 1)
      quickSort(p + 1, high)
    ELSE IF low == high
      HIGHLIGHT arr[low] 'SUCCESS'
    END
  END

SEQUENCE
  quickSort(0, LENGTH(arr) - 1)
  PRINT "Sorted:" arr
END`} />

                  <h3 className="docs-h3">Example 5 — Every Built-in Back to Back</h3>
                  <p className="docs-p">
                    Running the same array through several built-ins in one scene is the fastest way to compare how much
                    work each algorithm does.
                  </p>
                  <CodeBlock code={`SCENE SortShowcase

DECLARE
  ARRAY arr = [5, 2, 9, 1, 7]

SEQUENCE
  BUBBLE_SORT arr
  WAIT

  SELECTION_SORT arr
  WAIT

  INSERTION_SORT arr
  WAIT

  MERGE_SORT arr
  WAIT

  QUICK_SORT arr
END`} />
                </section>

                <section id="so-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Off-by-one in the bounds">
                    An outer bubble-sort loop ends at <C>LENGTH(arr) - 2</C> and the inner one at
                    <C>LENGTH(arr) - i - 2</C>, because the inner body reads <C>arr[j+1]</C>. Bounds that ignore the
                    <C>+1</C> index past the end of the array.
                  </Alert>

                  <Alert kind="warn" title="COMPARE does not branch">
                    <C>COMPARE</C> only draws the comparison. The decision has to be written as an <C>IF</C>; a
                    <C>COMPARE</C> with no following <C>IF</C> animates a comparison that never acts on its result.
                  </Alert>

                  <Alert kind="warn" title="Built-ins take an array name">
                    <C>BUBBLE_SORT arr</C>, not <C>BUBBLE_SORT arr[0]</C>. The built-in sorts operate on a whole
                    structure.
                  </Alert>

                  <Alert kind="warn" title="Division is real division">
                    <C>7 / 2</C> is <C>3.5</C>, and an index must be a whole number. Write the middle of a range as
                    <C>mid = (total - total % 2) / 2</C> with <C>total = low + high</C>, as the Merge Sort example does.
                  </Alert>

                  <Alert kind="warn" title="LOOP counts down when the end is smaller">
                    <C>LOOP i FROM 0 TO -1</C> runs for <C>i = 0</C> and <C>i = -1</C>. When a range can be empty (the
                    unsorted window of a cocktail shaker sort, the leftovers of a merge), use
                    <C>WHILE i &lt;= finish</C> instead, which runs zero times.
                  </Alert>

                  <Alert kind="tip" title="Use small, shuffled arrays">
                    Five to eight elements is enough to show an algorithm's behaviour and short enough that a viewer can
                    follow every swap. Sorting twenty elements produces a blur.
                  </Alert>

                  <Alert kind="note" title="Marking sorted regions">
                    A <C>HIGHLIGHT</C> at the end of each outer pass, on the element that just reached its final place,
                    turns an undifferentiated flurry of swaps into visible progress.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                SEARCHING PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'searching' && (
              <>
                <PageHero group="Algorithms" title="Searching Algorithms">
                  Linear, binary, jump, exponential, ternary and interpolation search written out with loops, IFs and recursive functions, plus searches on trees and graphs.
                </PageHero>

                <section id="se-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    Searching is about the elements an algorithm <em>doesn't</em> look at. A linear search inspects every
                    element; a binary search throws away half of the remaining candidates at each step; a BST search
                    follows a single root-to-leaf path. Animating them side by side makes that difference obvious.
                  </p>
                  <p className="docs-p">
                    Every Searching example in the Playground is the real algorithm: the loop bounds come from
                    <C>LENGTH(...)</C>, the middle is computed from <C>low</C> and <C>high</C>, and each decision is
                    made on the live values. Change the array or the target and the run is still correct, including the
                    case where the target is missing. Each search is a <C>FUNCTION</C> that <C>RETURN</C>s the index it
                    found, or <C>-1</C> for &quot;not found&quot;, the same convention as C, Java and Python.
                  </p>
                </section>

                <section id="se-declaration" className="docs-section">
                  <h2 className="docs-h2">The Search Window</h2>
                  <p className="docs-p">
                    Every array search keeps a <strong>window</strong> <C>[low .. high]</C> of cells that can still hold
                    the target. Each step shrinks it; when <C>low &gt; high</C> the window is empty and the target is not
                    there. Colours show the window as it shrinks:
                  </p>
                  <CodeBlock label="Syntax" code={`HIGHLIGHT arr[i]              // amber: checking this cell right now
HIGHLIGHT arr[i] 'MARKED'     // purple: the middle / probe / block end
HIGHLIGHT arr[i] 'DISCARDED'  // grey: ruled out, never looked at again
HIGHLIGHT arr[i] 'SUCCESS'    // green: found it
HIGHLIGHT arr[i] 'NEUTRAL'    // back to blue before the next search`} />
                  <p className="docs-p">
                    The middle of the window must be a whole number, and <C>/</C> is real division (<C>7 / 2</C> is
                    <C>3.5</C>), so it is written the long way:
                  </p>
                  <CodeBlock code={`size = high - low
mid = low + (size - size % 2) / 2   // same as (low + high) / 2 in C or Java`} />
                </section>

                <section id="se-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Algorithm</th><th>Needs</th><th>Idea</th><th>Time</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>Linear</td><td>any array</td><td>Check every cell from left to right, stop at the first match.</td><td>O(n)</td></tr>
                        <tr><td>Sentinel linear</td><td>any array</td><td>Put the target in the last cell so the loop needs one check per step.</td><td>O(n)</td></tr>
                        <tr><td>Binary</td><td>sorted</td><td>Compare with the middle and keep the half that can hold the target.</td><td>O(log n)</td></tr>
                        <tr><td>First / last occurrence</td><td>sorted</td><td>Binary search that keeps going left (or right) after a match.</td><td>O(log n)</td></tr>
                        <tr><td>Jump</td><td>sorted</td><td>Jump in blocks of sqrt(n), then scan one block.</td><td>O(sqrt n)</td></tr>
                        <tr><td>Exponential</td><td>sorted</td><td>Double a bound until it passes the target, then binary search.</td><td>O(log i)</td></tr>
                        <tr><td>Ternary</td><td>sorted</td><td>Two probes; keep one third of the window.</td><td>O(log n)</td></tr>
                        <tr><td>Interpolation</td><td>sorted, evenly spread</td><td>Guess the position from the value.</td><td>O(log log n) avg, O(n) worst</td></tr>
                        <tr><td>On the answer</td><td>a yes/no test that flips once</td><td>Binary search the answer itself (square root, truck capacity).</td><td>O(log range) tests</td></tr>
                        <tr><td>BST search</td><td><C>BST</C></td><td>Smaller goes left, larger goes right.</td><td>O(height)</td></tr>
                        <tr><td>DFS / BFS</td><td><C>GRAPH</C></td><td>Explore with recursion (or a <C>STACK</C>) / a <C>QUEUE</C> until the goal is reached.</td><td>O(V + E)</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="docs-p">
                    One-line built-ins still exist and animate a search in one go: <C>SEARCH t 60</C> on a tree or BST,
                    <C>DFS g FROM A</C> / <C>BFS g FROM A</C> on a graph, <C>TRIE_SEARCH</C> and <C>HASHMAP_LOOKUP</C>.
                    The Playground examples write the algorithm out instead, because that is what shows how it works.
                  </p>
                </section>

                <section id="se-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Linear Search with an Early Stop</h3>
                  <p className="docs-p">
                    The <C>WHILE</C> has two reasons to stop: the cells ran out, or the target was found. The second
                    search is for a roll number that is not there, which is the worst case: every cell is checked.
                  </p>
                  <CodeBlock code={`SCENE LinearSearch

DECLARE
  ARRAY rollNo = [104, 117, 109, 123, 131, 112, 140]

  FUNCTION linearSearch(target)
    n = LENGTH(rollNo)
    foundAt = -1
    comparisons = 0
    i = 0

    WHILE i < n AND foundAt == -1
      HIGHLIGHT rollNo[i]
      comparisons = comparisons + 1
      IF rollNo[i] == target
        foundAt = i
        HIGHLIGHT rollNo[i] 'SUCCESS'
      ELSE
        HIGHLIGHT rollNo[i] 'DISCARDED'
      END
      i = i + 1
    END

    IF foundAt != -1
      PRINT "Roll no " + target + " found at index " + foundAt + " after " + comparisons + " comparisons"
    ELSE
      PRINT "Roll no " + target + " is absent: all " + comparisons + " cells were checked"
    END
    RETURN foundAt
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(rollNo) - 1
      HIGHLIGHT rollNo[k] 'NEUTRAL'
    END
  END

SEQUENCE
  present = linearSearch(123)
  resetColours()
  absent = linearSearch(150)

  IF present != -1 AND absent == -1
    PRINT "Best case: 1 comparison, worst case: " + LENGTH(rollNo) + " comparisons (O(n))"
  END
END`} />

                  <h3 className="docs-h3">Example 2 — Binary Search</h3>
                  <p className="docs-p">
                    Each step compares the middle cell with the target and greys out the half that cannot hold it. Three
                    searches show a hit, a hit at the very edge, and a miss where the window becomes empty. The last loop
                    counts how many times the list can be halved: the worst case.
                  </p>
                  <CodeBlock code={`SCENE BinarySearch

DECLARE
  ARRAY price = [11, 12, 22, 25, 34, 64, 90, 105, 120]

  FUNCTION binarySearch(target)
    low = 0
    high = LENGTH(price) - 1
    step = 0

    WHILE low <= high
      step = step + 1
      size = high - low
      mid = low + (size - size % 2) / 2
      HIGHLIGHT price[mid] 'MARKED'
      PRINT "Step " + step + ": low=" + low + " high=" + high + " mid=" + mid + " (value " + price[mid] + ")"

      IF price[mid] == target
        HIGHLIGHT price[mid] 'SUCCESS'
        PRINT "Found " + target + " at index " + mid + " in " + step + " steps"
        RETURN mid
      ELSE IF price[mid] < target
        k = low
        WHILE k <= mid
          HIGHLIGHT price[k] 'DISCARDED'
          k = k + 1
        END
        low = mid + 1
      ELSE
        k = mid
        WHILE k <= high
          HIGHLIGHT price[k] 'DISCARDED'
          k = k + 1
        END
        high = mid - 1
      END
    END

    PRINT target + " is not in the list (window empty after " + step + " steps)"
    RETURN -1
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(price) - 1
      HIGHLIGHT price[k] 'NEUTRAL'
    END
  END

SEQUENCE
  binarySearch(90)
  resetColours()
  binarySearch(11)
  resetColours()
  binarySearch(50)

  size = LENGTH(price)
  maxSteps = 0
  WHILE size > 0
    maxSteps = maxSteps + 1
    size = (size - size % 2) / 2
  END
  PRINT "Never more than " + maxSteps + " steps for " + LENGTH(price) + " prices (O(log n)); linear search may need " + LENGTH(price)
END`} />

                  <h3 className="docs-h3">Example 3 — Recursive Binary Search</h3>
                  <p className="docs-p">
                    The same decisions, written as a <C>FUNCTION</C> that calls itself on the half that is left.
                    <C>low &gt; high</C> is the base case for &quot;not found&quot;.
                  </p>
                  <CodeBlock code={`SCENE BinarySearchRecursive

DECLARE
  ARRAY chapterStart = [1, 15, 32, 47, 60, 78, 95, 110, 126, 140]

  FUNCTION search(target, low, high, depth)
    IF low > high
      PRINT "  depth " + depth + ": empty window, " + target + " is not a chapter start"
      RETURN -1
    END

    size = high - low
    mid = low + (size - size % 2) / 2
    HIGHLIGHT chapterStart[mid] 'MARKED'
    PRINT "  depth " + depth + ": window [" + low + ".." + high + "], middle page " + chapterStart[mid]

    IF chapterStart[mid] == target
      HIGHLIGHT chapterStart[mid] 'SUCCESS'
      RETURN mid
    ELSE IF chapterStart[mid] < target
      HIGHLIGHT chapterStart[mid] 'DISCARDED'
      RETURN search(target, mid + 1, high, depth + 1)
    ELSE
      HIGHLIGHT chapterStart[mid] 'DISCARDED'
      RETURN search(target, low, mid - 1, depth + 1)
    END
  END

  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(chapterStart) - 1
      HIGHLIGHT chapterStart[k] 'NEUTRAL'
    END
  END

SEQUENCE
  PRINT "Does a chapter start on page 110?"
  index = search(110, 0, LENGTH(chapterStart) - 1, 1)
  IF index != -1
    PRINT "Yes, chapter " + (index + 1) + " starts on page 110"
  END

  resetColours()
  PRINT "Does a chapter start on page 50?"
  index = search(50, 0, LENGTH(chapterStart) - 1, 1)
  IF index == -1
    PRINT "No, page 50 is in the middle of a chapter"
  END
END`} />

                  <h3 className="docs-h3">Example 4 — Binary Search on the Answer</h3>
                  <p className="docs-p">
                    Binary search also works when there is no array to search, only a yes/no question whose answer flips
                    once. Here the question is &quot;can a truck of this capacity ship everything in 3 days?&quot;.
                  </p>
                  <CodeBlock code={`SCENE DeliveryTruckCapacity

DECLARE
  ARRAY parcels = [3, 2, 2, 4, 1, 4]

  FUNCTION daysNeeded(capacity)
    days = 1
    load = 0
    LOOP i FROM 0 TO LENGTH(parcels) - 1
      IF load + parcels[i] > capacity
        days = days + 1
        load = 0
      END
      load = load + parcels[i]
    END
    RETURN days
  END

SEQUENCE
  allowedDays = 3

  heaviest = 0
  total = 0
  LOOP i FROM 0 TO LENGTH(parcels) - 1
    total = total + parcels[i]
    IF parcels[i] > heaviest
      heaviest = parcels[i]
    END
  END

  low = heaviest
  high = total
  best = total
  WHILE low <= high
    size = high - low
    mid = low + (size - size % 2) / 2
    need = daysNeeded(mid)
    IF need <= allowedDays
      PRINT "capacity " + mid + " kg -> " + need + " days: fits, try smaller"
      best = mid
      high = mid - 1
    ELSE
      PRINT "capacity " + mid + " kg -> " + need + " days: too slow, go bigger"
      low = mid + 1
    END
  END
  PRINT "Smallest truck for " + allowedDays + " days: " + best + " kg"
END`} />

                  <h3 className="docs-h3">Example 5 — Nearest Hospital with BFS</h3>
                  <p className="docs-p">
                    On a graph there is no order to exploit, so the search explores. BFS explores in rings, so the first
                    hospital it takes out of the queue is the nearest one.
                  </p>
                  <CodeBlock code={`SCENE NearestHospitalBFS

DECLARE
  GRAPH city = ["Home-Market", "Home-School", "Market-Station", "School-Park", "Park-Lake", "Station-Fort", "Lake-Fort", "Station-Airport"]
  QUEUE q = []

SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(city) - 1
    area = VERTEX_AT(city, k)
    area.hospital = FALSE
  END
  fort = VERTEX(city, "Fort")
  fort.hospital = TRUE
  park = VERTEX(city, "Park")
  park.hospital = TRUE

  home = VERTEX(city, "Home")
  home.visited = TRUE
  home.dist = 0
  home.parent = NULL
  ENQUEUE q home
  nearest = NULL

  WHILE LENGTH(q) > 0 AND nearest == NULL
    area = DEQUEUE(q)
    PRINT "Check " + area.name + " (" + area.dist + " road(s) from Home)"
    IF area.hospital
      nearest = area
    ELSE
      i = 0
      WHILE i < DEGREE(area)
        next = NEIGHBOR(area, i)
        IF next.visited == FALSE
          next.visited = TRUE
          next.dist = area.dist + 1
          next.parent = area
          ENQUEUE q next
        END
        i = i + 1
      END
    END
  END

  IF nearest == NULL
    PRINT "No hospital can be reached from Home"
  ELSE
    route = nearest.name
    curr = nearest.parent
    WHILE curr != NULL
      route = curr.name + " -> " + route
      curr = curr.parent
    END
    PRINT "Nearest hospital: " + nearest.name + ", " + nearest.dist + " road(s) away"
    PRINT "Route: " + route
  END
END`} />

                  <p className="docs-p">
                    The Playground has 21 complete Searching programs:
                  </p>
                  <ul>
                    <li>linear search, all occurrences and sentinel search;</li>
                    <li>iterative and recursive binary search, first and last occurrence, search insert position;</li>
                    <li>jump, exponential, ternary and interpolation search;</li>
                    <li>a rotated sorted array, the peak of a trail, the integer square root;</li>
                    <li>a cinema seat map, the missing roll number, delivery truck capacity, a contact book;</li>
                    <li>BST search, a maze exit with DFS and the nearest hospital with BFS.</li>
                  </ul>
                </section>

                <section id="se-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead><tr><th>Problem</th><th>What to do</th></tr></thead>
                    <tbody>
                      <tr><td><C>Undeclared identifier 'pos'</C></td><td>A variable set only inside the branches of an <C>IF</C> / <C>ELSE</C> is not known after it. Give it a value before the <C>IF</C> (<C>pos = low</C>), then change it inside.</td></tr>
                      <tr><td>Index out of range on <C>arr[mid]</C></td><td><C>mid</C> is not a whole number, or the loop kept going with an empty window. Use <C>mid = low + (size - size % 2) / 2</C> and <C>WHILE low &lt;= high</C>.</td></tr>
                      <tr><td>The loop never ends</td><td>Each step must move <C>low</C> past <C>mid</C> (<C>low = mid + 1</C>) or <C>high</C> below it (<C>high = mid - 1</C>). Setting <C>low = mid</C> can repeat the same window forever.</td></tr>
                      <tr><td><C>Expected array name</C></td><td>The array's name is a keyword (for example <C>height</C>, which is a tree command). Pick another name such as <C>elevation</C>.</td></tr>
                      <tr><td><C>Unexpected token &quot;VERTEX&quot;</C></td><td>Set a field on a variable, not on a call: <C>fort = VERTEX(city, &quot;Fort&quot;)</C> then <C>fort.hospital = TRUE</C>.</td></tr>
                    </tbody>
                  </table>
                  </div>

                  <Alert kind="warn" title="Binary search needs sorted input">
                    Run it on an unsorted array and it will confidently throw away the half that holds the target. Sort
                    first, or use linear search. Interpolation search also needs the values to be spread evenly to be
                    fast.
                  </Alert>

                  <Alert kind="warn" title="Guard against dividing by zero">
                    Interpolation search divides by <C>arr[high] - arr[low]</C>. When every value in the window is equal
                    that is zero, so check it before dividing.
                  </Alert>

                  <Alert kind="tip" title="Always test a miss">
                    Searching for a value that isn&apos;t there is where the stopping rule lives. Every example runs at
                    least one hit and one miss, and resets the colours with <C>'NEUTRAL'</C> in between.
                  </Alert>

                  <Alert kind="note" title="Functions return their results">
                    Variables assigned inside a <C>FUNCTION</C> are local to that call, but the arrays in
                    <C>DECLARE</C> are shared, so a search function can colour them and <C>RETURN</C> the index.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                LAYOUT & CAMERA PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'layout-camera' && (
              <>
                <PageHero group="Spatial syntax" title="Layout & Camera">
                  Take control of where things sit and where the camera looks — arrangement strategies, camera modes, and per-element position pins.
                </PageHero>

                <section id="lc-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    Every structure already gets a sensible arrangement and the camera already follows the action, so a
                    program that never mentions layout still looks right. <C>LAYOUT</C>, <C>CAMERA</C>, and
                    <C>POSITION</C> are overrides for when the default is not what a particular explanation needs.
                  </p>
                  <p className="docs-p">
                    All three are ordinary <C>SEQUENCE</C> statements. They can be issued once up front, or mid-animation
                    to re-arrange a structure or move the camera at a specific beat — a graph can be force-simulated
                    while it's built and then frozen into a clean ring for the explanation.
                  </p>
                  <Alert kind="note" title="Additive by design">
                    Omitting these statements reproduces the default behaviour exactly. Nothing about an existing program
                    changes because the feature exists.
                  </Alert>
                </section>

                <section id="lc-declaration" className="docs-section">
                  <h2 className="docs-h2">LAYOUT Strategies</h2>
                  <p className="docs-p">
                    <C>LAYOUT</C> sets the arrangement strategy for one named structure. Arguments are named and all
                    optional — anything you leave out keeps the strategy's default.
                  </p>
                  <CodeBlock label="Syntax" code={`LAYOUT <target> AS <STRATEGY>(<name>=<value>, ...)`} />

                  <h3 className="docs-h3">LINE — evenly spaced row or column</h3>
                  <p className="docs-p">
                    The default for arrays, linked lists, stacks, and queues. Parameters: <C>spacing</C>,
                    <C>axis</C> (<C>horizontal</C> or <C>vertical</C>), and <C>origin</C>.
                  </p>
                  <CodeBlock code={`LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)`} />

                  <h3 className="docs-h3">HIERARCHY — depth-leveled tree</h3>
                  <p className="docs-p">
                    The default for trees, BSTs, heaps, and tries. Parameters: <C>levelGap</C> (vertical distance between
                    depths, default 2.0), <C>siblingGap</C> (minimum horizontal distance between sibling subtrees,
                    default 1.5), and <C>origin</C>.
                  </p>
                  <CodeBlock code={`LAYOUT myTree AS HIERARCHY(levelGap=2, siblingGap=1)`} />

                  <h3 className="docs-h3">CIRCULAR — evenly spaced ring</h3>
                  <p className="docs-p">
                    Opt-in; nothing defaults to it. Parameters: <C>radius</C> (default 2.0), <C>startAngle</C> in degrees,
                    and <C>origin</C>. Ideal for ring buffers and for making a graph cycle obvious.
                  </p>
                  <CodeBlock code={`LAYOUT ring AS CIRCULAR(radius=4, startAngle=0)`} />

                  <h3 className="docs-h3">FORCE_DIRECTED — physics simulation</h3>
                  <p className="docs-p">
                    The default for graphs. Parameters: <C>repulsion</C> (default 5.0), <C>springLength</C> (2.0),
                    <C>springTension</C> (0.1), <C>gravity</C> (0.05), and <C>iterations</C> (100).
                  </p>
                  <CodeBlock code={`LAYOUT g AS FORCE_DIRECTED(repulsion=50, iterations=100)`} />

                  <h3 className="docs-h3">GRID — row and column matrix</h3>
                  <p className="docs-p">
                    Parameters: <C>columns</C>, <C>spacingX</C> (1.5), <C>spacingY</C> (1.5), and <C>origin</C>. Turns a
                    flat array into a matrix view.
                  </p>
                  <CodeBlock code={`LAYOUT matrix AS GRID(columns=3, spacingX=1.5, spacingY=1.5)`} />

                  <h3 className="docs-h3">CUSTOM — manual placement only</h3>
                  <p className="docs-p">
                    Takes no parameters and disables automatic placement entirely. Every element must then get its own
                    <C>POSITION</C> statement.
                  </p>
                  <CodeBlock code={`LAYOUT pts AS CUSTOM()`} />
                </section>

                <section id="lc-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>

                  <h3 className="docs-h3">CAMERA</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">CAMERA</span> <span className="tok-keyword">FOCUS</span>(<span className="tok-param">target</span>)</td>
                          <td>Soft-follows one structure or one element (<C>arr[2]</C> works) instead of the whole scene. The way to direct attention when several structures share a scene.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CAMERA</span> <span className="tok-keyword">AUTO_FIT</span></td>
                          <td>The default: reactive follow that keeps the whole scene framed. Write it explicitly to return to it after a focus or a fixed position.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CAMERA</span> <span className="tok-keyword">ORBIT</span>(<span className="tok-param">speed</span>)</td>
                          <td>Rotates continuously around the current target at <C>speed</C> degrees per second. Reactive follow is suspended while orbiting.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CAMERA</span> <span className="tok-keyword">POSITION</span>(<span className="tok-param">x, y, z</span>)</td>
                          <td>Pins the camera at an absolute world position and disables all automation until a later camera statement re-enables it.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">POSITION</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">POSITION</span> <span className="tok-param">target</span> <span className="tok-keyword">AT</span> (<span className="tok-param">x=, y=, z=</span>)</td>
                          <td>Pins one element to explicit coordinates, overriding its layout strategy. Each axis is optional — omitted axes stay where the strategy puts them.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">POSITION</span> <span className="tok-param">target</span> <span className="tok-keyword">AT</span> ()</td>
                          <td>Releases a previous pin, returning the element to strategy-computed placement.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <Alert kind="note" title="Pins are sticky">
                    A pinned element is excluded from later layout recomputation until it is released, removed, or given
                    new coordinates.
                  </Alert>
                </section>

                <section id="lc-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Tightening an Array's Spacing</h3>
                  <CodeBlock code={`SCENE ArrayLayoutDemo

DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  HIGHLIGHT arr[2]
  WAIT
END`} />

                  <h3 className="docs-h3">Example 2 — A Horizontal Stack</h3>
                  <p className="docs-p">
                    Stacks default to a vertical column. Switching the axis lays one out as a row instead — useful when a
                    tall structure is already using the vertical space.
                  </p>
                  <CodeBlock code={`SCENE HorizontalStackDemo

DECLARE
  STACK s

SEQUENCE
  LAYOUT s AS LINE(spacing=1.2, axis=horizontal, origin=(0, 1, 0))
  PUSH s 10
  PUSH s 20
  PUSH s 30
  WAIT
END`} />

                  <h3 className="docs-h3">Example 3 — Re-laying Out a Graph Mid-Sequence</h3>
                  <p className="docs-p">
                    Build the graph under physics, then freeze the cycle into a ring for the explanation beat. Existing
                    vertices animate to their new positions.
                  </p>
                  <CodeBlock code={`SCENE RelayoutDemo

DECLARE
  GRAPH g = ["A->B", "B->C", "C->A"]

SEQUENCE
  LAYOUT g AS FORCE_DIRECTED(iterations=60)
  WAIT

  // Freeze the now-visible cycle into a clean ring
  LAYOUT g AS CIRCULAR(radius=3)
  WAIT
END`} />

                  <h3 className="docs-h3">Example 4 — Focusing the Camera on One Structure</h3>
                  <p className="docs-p">
                    With two structures on screen, an explicit focus tells the viewer which one the current step is about.
                  </p>
                  <CodeBlock code={`SCENE MultiStructureDemo

DECLARE
  ARRAY nums = [4, 2, 7]
  BST myTree

SEQUENCE
  CAMERA FOCUS(myTree)
  INSERT 40
  INSERT 20
  INSERT 60
  WAIT

  CAMERA FOCUS(nums)
  COMPARE nums[0] nums[1]
  WAIT

  // Back to framing the whole scene
  CAMERA AUTO_FIT
END`} />

                  <h3 className="docs-h3">Example 5 — Pinning and Releasing an Element</h3>
                  <p className="docs-p">
                    Lifting one element out of the row singles it out without any colour change at all.
                  </p>
                  <CodeBlock code={`SCENE PinnedElementDemo

DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  CAMERA POSITION(0, 6, 14)
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)

  // Lift the third element out of the row
  POSITION arr[2] AT (x=5, y=2, z=0)
  HIGHLIGHT arr[2]
  WAIT

  // Drop it back into place
  POSITION arr[2] AT ()
  WAIT
END`} />

                  <h3 className="docs-h3">Example 6 — Fully Manual Placement</h3>
                  <CodeBlock code={`SCENE CustomLayoutDemo

DECLARE
  ARRAY pts = [1, 2, 3]

SEQUENCE
  LAYOUT pts AS CUSTOM()
  POSITION pts[0] AT (x=-3, y=0, z=0)
  POSITION pts[1] AT (x=0, y=2, z=0)
  POSITION pts[2] AT (x=3, y=0, z=0)
  WAIT
END`} />

                  <h3 className="docs-h3">Example 7 — A Slow Orbit for a Presentation</h3>
                  <CodeBlock code={`SCENE OrbitPresentationDemo

DECLARE
  BST myTree = [50, 30, 70]

SEQUENCE
  CAMERA ORBIT(15)
  INSERT 20
  WAIT
  INSERT 60
  WAIT

  CAMERA AUTO_FIT
END`} />
                </section>

                <section id="lc-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="The target must be declared">
                    <C>LAYOUT</C> names a structure from the <C>DECLARE</C> block. A typo is reported as an undeclared
                    structure, usually with a suggestion for the name you meant.
                  </Alert>

                  <Alert kind="warn" title="Only six strategies exist">
                    <C>LINE</C>, <C>HIERARCHY</C>, <C>CIRCULAR</C>, <C>FORCE_DIRECTED</C>, <C>GRID</C>, and
                    <C>CUSTOM</C>. Anything else after <C>AS</C> is rejected at compile time.
                  </Alert>

                  <Alert kind="warn" title="Named arguments, not positional">
                    Strategy arguments are written <C>spacing=1.5</C>, never bare values. <C>LINE(1.5)</C> is a parse
                    error.
                  </Alert>

                  <Alert kind="warn" title="CUSTOM needs a POSITION for every element">
                    Under <C>CUSTOM</C> an element that never receives a <C>POSITION</C> falls back to the origin, which
                    stacks elements on top of each other.
                  </Alert>

                  <Alert kind="tip" title="Use origin to separate structures">
                    Structures are already separated in depth, but an explicit <C>origin=(x, y, z)</C> is the direct way
                    to place two structures exactly where a side-by-side comparison needs them.
                  </Alert>

                  <Alert kind="note" title="Manual dragging wins">
                    Dragging in the viewport cancels automatic camera follow, exactly as it does without any
                    <C>CAMERA</C> statement. A later <C>CAMERA AUTO_FIT</C> hands control back to the automation.
                  </Alert>
                </section>
              </>
            )}

        </motion.div>
      </div>

      {/* ── On this page ───────────────────────────── */}
      <aside className="docs-toc" aria-label="On this page">
        <p className="docs-nav__label mono">On this page</p>
        <ul role="list" className="docs-toc__list">
          {TOC_ITEMS.map(({ id, label }) => (
            <li key={id}>
              <button
                type="button"
                className={`docs-toc__btn${activeId === id ? ' is-active' : ''}`}
                aria-current={activeId === id ? 'location' : undefined}
                onClick={() => scrollTo(id)}
              >
                {activeId === id && <motion.span layoutId="docs-toc-on" className="docs-toc__mark" transition={spring.layout} />}
                {label}
              </button>
            </li>
          ))}
        </ul>
        <a href="#/playground" className="ulink mono mt-8 inline-block text-[0.8125rem]">
          Try it in the playground
        </a>
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            id="docs-drawer"
            className="docs-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Documentation contents"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDrawerOpen(false);
            }}
          >
            <motion.div
              className="docs-drawer__panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0, transition: spring.layout }}
              exit={{ x: '-100%', transition: { duration: 0.18 } }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="title">Contents</span>
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => setDrawerOpen(false)} autoFocus>
                  Close
                </button>
              </div>
              <SideNav activePage={activePage} onPick={goToPage} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
