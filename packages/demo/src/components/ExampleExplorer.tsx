import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { EXAMPLES, EXAMPLE_CATEGORIES, type Example, type ExampleCategory } from '../examples/registry';
import { spring, stagger } from '../lib/motion';

const CATEGORY_NOTE: Record<ExampleCategory, string> = {
  Arrays: 'Contiguous blocks of memory',
  Sorting: 'Putting elements in order',
  'Linked Lists': 'Chains of nodes and pointers',
  Trees: 'Hierarchies of nodes',
  Searching: 'Finding one value among many',
  'Loops & Control': 'Iteration and branching',
  Stacks: 'Last in, first out',
  Queues: 'First in, first out',
  Graphs: 'Vertices and edges',
  Heaps: 'Priority-ordered trees',
  'Hash Maps': 'Keys mapped to buckets',
  Tries: 'Prefix trees for words',
  'Recursion & Functions': 'Functions that call themselves',
};

interface ExampleExplorerProps {
  activeSource: string;
  onSelect: (source: string, id: string) => void;
  onClose: () => void;
}

/** Modal lesson picker for the playground. */
export function ExampleExplorer({ activeSource, onSelect, onClose }: ExampleExplorerProps) {
  const [activeCategory, setActiveCategory] = useState<ExampleCategory | 'All'>(EXAMPLE_CATEGORIES[0]);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Escape clears the search first, then closes. Tab stays inside the dialog.
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (queryRef.current) setQuery('');
        else onClose();
        return;
      }
      if (e.key === 'Tab' && shellRef.current) {
        const focusables = shellRef.current.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    searchRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = EXAMPLES;
    if (activeCategory !== 'All') list = list.filter((e) => e.category === activeCategory);
    if (q) list = list.filter((e) => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    return list;
  }, [activeCategory, q]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of EXAMPLES) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, []);

  const handleQuery = (value: string) => {
    setQuery(value);
    // A search looks through every topic.
    if (value.trim() && activeCategory !== 'All') setActiveCategory('All');
  };

  const choose = useCallback((example: Example) => onSelect(example.source, example.id), [onSelect]);

  const renderTitle = (title: string) => {
    if (!q) return title;
    const idx = title.toLowerCase().indexOf(q);
    if (idx === -1) return title;
    return (
      <>
        {title.slice(0, idx)}
        <mark className="ex-match">{title.slice(idx, idx + q.length)}</mark>
        {title.slice(idx + q.length)}
      </>
    );
  };

  return (
    <motion.div
      className="ex-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a lesson"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.18 } }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
    >
      <motion.div
        ref={shellRef}
        className="ex-shell"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
        exit={{ opacity: 0, y: 10, transition: { duration: 0.14 } }}
      >
        <header className="ex-head">
          <h2 className="title">Choose a lesson</h2>
          <input
            ref={searchRef}
            type="search"
            className="search-input ex-search"
            placeholder="Search every topic"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-label="Search examples"
          />
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Close <kbd className="pg-kbd">Esc</kbd>
          </button>
        </header>

        <div className="ex-body">
          <nav className="ex-cats" aria-label="Topics">
            <LayoutGroup id="ex-cats">
              {(['All', ...EXAMPLE_CATEGORIES] as const).map((cat) => {
                const on = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`ex-cat${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      setActiveCategory(cat);
                      setQuery('');
                    }}
                  >
                    {on && <motion.span layoutId="ex-cat-on" className="ex-cat__bg" transition={spring.layout} />}
                    <span className="relative">{cat === 'All' ? 'All examples' : cat}</span>
                    <span className="ex-cat__n relative">{cat === 'All' ? EXAMPLES.length : counts.get(cat)}</span>
                  </button>
                );
              })}
            </LayoutGroup>
          </nav>

          <div className="ex-main">
            <div className="ex-main__head">
              <span className="font-serif text-[1.15rem]">{activeCategory === 'All' ? 'All examples' : activeCategory}</span>
              <span className="mono muted">
                {activeCategory === 'All' ? `${filtered.length} lessons` : CATEGORY_NOTE[activeCategory]}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="ex-none">
                <p className="title">No lessons match “{query}”.</p>
                <p className="muted mt-2">Try a shorter word, or pick a topic on the left.</p>
              </div>
            ) : (
              <ul role="list" className="ex-list" key={`${activeCategory}-${q}`}>
                {filtered.map((example, idx) => {
                  const isActive = example.source === activeSource;
                  return (
                    <motion.li
                      key={example.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: stagger(idx, 0.025, 0.35) } }}
                    >
                      <button type="button" className={`ex-row index-row${isActive ? ' is-current' : ''}`} onClick={() => choose(example)} aria-current={isActive ? 'true' : undefined}>
                        <span className="ex-row__title">{renderTitle(example.title)}</span>
                        <span className="ex-row__meta mono">
                          {isActive ? 'open now' : example.difficulty}
                        </span>
                        <span className="ex-row__desc">{example.description}</span>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
