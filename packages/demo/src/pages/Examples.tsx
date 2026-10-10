import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { EXAMPLES, EXAMPLE_CATEGORIES, type Example, type ExampleCategory } from '../examples/registry';
import { CodeBlock } from '../components/code/CodeBlock';
import { spring } from '../lib/motion';
import { parseHash, replaceHash } from '../lib/router';

type Difficulty = Example['difficulty'];
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

/** The Challenges topic that practises each category (categories with no challenges are left out). */
const CHALLENGE_TOPIC: Partial<Record<ExampleCategory, string>> = {
  Arrays: 'Arrays',
  Sorting: 'Sorting',
  Searching: 'Searching',
  'Recursion & Functions': 'Recursion',
  Stacks: 'Stacks',
  Queues: 'Queues',
  'Linked Lists': 'Linked Lists',
  Trees: 'Trees',
  Graphs: 'Graphs',
  Heaps: 'Heaps',
  'Hash Maps': 'Hash Maps',
  Tries: 'Tries',
};

function initialCategory(): ExampleCategory | 'All' {
  const c = parseHash(window.location.hash).params.get('category');
  return c && (EXAMPLE_CATEGORIES as string[]).includes(c) ? (c as ExampleCategory) : 'All';
}

/** First lines of a program, enough to recognise it. */
function excerpt(src: string, lines = 22) {
  const all = src.split('\n');
  return all.length > lines ? `${all.slice(0, lines).join('\n')}\n  …` : src;
}

export default function Examples() {
  const [category, setCategory] = useState<ExampleCategory | 'All'>(initialCategory);
  const [difficulty, setDifficulty] = useState<Difficulty | 'Any'>('Any');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [previewId, setPreviewId] = useState<string>(() => EXAMPLES.find((e) => category === 'All' || e.category === category)?.id ?? EXAMPLES[0].id);
  const searchRef = useRef<HTMLInputElement>(null);

  const q = deferredQuery.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      EXAMPLES.filter(
        (e) =>
          (category === 'All' || e.category === category) &&
          (difficulty === 'Any' || e.difficulty === difficulty) &&
          (!q || e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)),
      ),
    [category, difficulty, q],
  );

  const groups = useMemo(() => {
    const map = new Map<ExampleCategory, Example[]>();
    for (const e of filtered) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return EXAMPLE_CATEGORIES.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [filtered]);

  const preview = EXAMPLES.find((e) => e.id === previewId) ?? filtered[0] ?? EXAMPLES[0];

  const chooseCategory = (c: ExampleCategory | 'All') => {
    setCategory(c);
    replaceHash(c === 'All' ? '/examples' : `/examples?category=${encodeURIComponent(c)}`);
    const first = EXAMPLES.find((e) => c === 'All' || e.category === c);
    if (first) setPreviewId(first.id);
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of EXAMPLES) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, []);

  return (
    <div className="pb-24">
      <header className="page grid gap-8 pt-14 pb-12 md:grid-cols-12 md:pt-24 md:pb-16">
        <div className="md:col-span-8">
          <h1 className="display">
            {EXAMPLES.length} programs, <span className="italic text-cream">ready to run.</span>
          </h1>
        </div>
        <p className="lede md:col-span-4 md:self-end">
          Every example that ships with the playground. Open one, change a number, run it again.
        </p>
      </header>

      {/* Filters */}
      <div className="sticky top-0 z-30 border-y border-[var(--line)] bg-ink">
        <div className="page flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:gap-6">
          <label className="relative flex min-w-0 items-center lg:w-[300px] lg:shrink-0">
            <span className="sr-only">Search examples</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or idea"
              className="search-input w-full"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <div className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="Topic">
            <LayoutGroup id="cat">
              {(['All', ...EXAMPLE_CATEGORIES] as const).map((c) => {
                const on = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => chooseCategory(c)}
                    className={`relative shrink-0 rounded-ctl px-3 py-2 whitespace-nowrap transition-colors duration-300 ${on ? 'text-cream' : 'text-peach hover:text-cream'}`}
                  >
                    {on && <motion.span layoutId="cat-on" className="absolute inset-0 rounded-ctl bg-dusk-deep" transition={spring.layout} />}
                    <span className="mono relative">
                      {c}
                      <span className="muted ml-1.5">{c === 'All' ? EXAMPLES.length : counts.get(c)}</span>
                    </span>
                  </button>
                );
              })}
            </LayoutGroup>
          </div>
          <div className="flex shrink-0 gap-1" role="group" aria-label="Difficulty">
            {(['Any', ...DIFFICULTIES] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={difficulty === d}
                onClick={() => setDifficulty(d)}
                className={`mono rounded-ctl px-2.5 py-2 transition-colors duration-300 ${difficulty === d ? 'bg-panel text-cream' : 'text-peach-muted hover:text-cream'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page mt-10 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="sr-only" role="status">
            {filtered.length} programs match.
          </p>
          {groups.length === 0 && (
            <div className="py-16">
              <p className="title">Nothing matches “{query}”.</p>
              <p className="muted mt-3">Try a shorter word, or clear the topic and difficulty filters.</p>
              <button
                type="button"
                className="btn btn--quiet mt-6"
                onClick={() => {
                  setQuery('');
                  setDifficulty('Any');
                  chooseCategory('All');
                  searchRef.current?.focus();
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          <AnimatePresence initial={false} mode="popLayout">
            {groups.map((g) => (
              <motion.section
                key={g.category}
                layout="position"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={spring.gentle}
                aria-labelledby={`g-${g.category}`}
                className="mb-14"
              >
                <h2 id={`g-${g.category}`} className="mb-3 flex items-baseline justify-between gap-4 border-b border-[var(--line-strong)] pb-3">
                  <span className="title">{g.category}</span>
                  <span className="mono muted">{g.items.length}</span>
                </h2>
                <ul role="list">
                  {g.items.map((e) => (
                    <li key={e.id} className="border-b border-[var(--line)]">
                      <a
                        href={`#/playground?example=${encodeURIComponent(e.id)}`}
                        className="index-row group grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 px-3 py-4"
                        onMouseEnter={() => setPreviewId(e.id)}
                        onFocus={() => setPreviewId(e.id)}
                        aria-describedby={`d-${e.id}`}
                      >
                        <span className="font-serif text-[1.25rem] leading-snug">{e.title}</span>
                        <span className="mono self-baseline text-peach-muted">{e.difficulty}</span>
                        <span id={`d-${e.id}`} className="muted col-span-2 text-[0.98rem] leading-snug">
                          {e.description}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>

        <aside className="hidden lg:col-span-5 lg:block" aria-label="Source preview">
          <div className="sticky top-[84px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={preview.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: spring.snappy }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <p className="title">{preview.title}</p>
                  <span className="mono muted shrink-0">{preview.category}</span>
                </div>
                <CodeBlock code={excerpt(preview.source)} label={`${preview.id}.aqvl`} lineNumbers copy={false} className="max-h-[62vh] overflow-hidden" />
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <a href={`#/playground?example=${encodeURIComponent(preview.id)}`} className="btn">
                    Run this in the playground
                    <span className="arrow" aria-hidden="true">
                      →
                    </span>
                  </a>
                  {CHALLENGE_TOPIC[preview.category] && (
                    <a href={`#/challenges/complete?topic=${encodeURIComponent(CHALLENGE_TOPIC[preview.category]!)}`} className="ulink mono">
                      Practise {CHALLENGE_TOPIC[preview.category]!.toLowerCase()} as challenges
                    </a>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </div>
  );
}
