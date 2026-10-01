import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { spring, waveDelay } from '../../lib/motion';
import type { ExampleCategory } from '../../examples/registry';

interface Row {
  category: ExampleCategory;
  count: number;
  sample: string;
}

/** One plain sentence per topic, matching what the docs cover. */
const GLOSS: Record<ExampleCategory, string> = {
  Arrays: 'highlight, compare, swap, insert, delete',
  Sorting: 'bubble to radix, step by step',
  'Linked Lists': 'singly, doubly and circular, with real pointers',
  Trees: 'general, binary and search trees',
  Searching: 'linear, binary, jump, interpolation and more',
  'Loops & Control': 'LOOP, WHILE, IF, variables and operators',
  Stacks: 'push, pop and peek, with the top marked',
  Queues: 'enqueue, dequeue, front and rear',
  Graphs: 'BFS, DFS, Dijkstra, MST and topological sort',
  Heaps: 'insert, extract, heapify, build',
  'Hash Maps': 'buckets, collisions and lookups',
  Tries: 'insert, search, prefixes, autocomplete',
  'Recursion & Functions': 'FUNCTION, RETURN and the call stack',
};

/**
 * An editorial index of what ships with AQVL. Counts come from the example
 * registry at runtime, so they are always the real number.
 */
export function StructureIndex() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    import('../../examples/registry').then(({ EXAMPLES, EXAMPLE_CATEGORIES }) => {
      if (!alive) return;
      setRows(
        EXAMPLE_CATEGORIES.map((category) => {
          const list = EXAMPLES.filter((e) => e.category === category);
          return { category, count: list.length, sample: list[0]?.id ?? '' };
        }),
      );
      setTotal(EXAMPLES.length);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section aria-labelledby="index-title" className="py-24 md:py-36">
      <div className="page grid gap-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="md:sticky md:top-28">
            <span className="margin-num">04</span>
            <h2 id="index-title" className="headline mt-3">
              What it already knows.
            </h2>
            <p className="prose mt-6">
              {total !== null ? (
                <>
                  The playground ships with <span className="text-cream">{total} example programs</span> across these
                  topics. Each one opens in the editor, ready to run and change.
                </>
              ) : (
                'The playground ships with example programs across these topics. Each one opens in the editor, ready to run and change.'
              )}
            </p>
          </div>
        </div>

        <ol role="list" className="md:col-span-8 md:col-start-5" aria-busy={rows === null}>
          {(rows ?? []).map((row, i) => (
            <motion.li
              key={row.category}
              className="overflow-hidden border-b border-[var(--line)] first:border-t"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -8% 0px' }}
              transition={{ ...spring.gentle, delay: waveDelay(i % 6, 6, 0.22) }}
            >
              <a
                href={`#/examples?category=${encodeURIComponent(row.category)}`}
                className="index-row group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-x-4 px-3 py-5 md:grid-cols-[2.75rem_minmax(0,1fr)_auto] md:py-6"
              >
                <span className="margin-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="block font-serif text-[1.55rem] leading-tight md:text-[2rem]">{row.category}</span>
                  <span className="mono muted mt-1 block">{GLOSS[row.category]}</span>
                </span>
                <span className="mono whitespace-nowrap text-cream">
                  {row.count}
                  <span className="muted"> programs</span>
                  <span className="index-arrow ml-2 inline-block" aria-hidden="true">
                    →
                  </span>
                </span>
              </a>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
