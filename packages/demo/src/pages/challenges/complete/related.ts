import type { Kernel, Topic } from './types';

/**
 * The worked example in the Examples library closest to a challenge's
 * algorithm, so a learner can study it (narrated, step by step) before or
 * after trying it. The library is loaded only when asked for.
 */

/** The library's category for each challenge topic. */
export const EXAMPLE_CATEGORY: Record<Topic, string> = {
  Arrays: 'Arrays',
  Sorting: 'Sorting',
  Searching: 'Searching',
  Recursion: 'Recursion & Functions',
  Stacks: 'Stacks',
  Queues: 'Queues',
  'Linked Lists': 'Linked Lists',
  Trees: 'Trees',
  Graphs: 'Graphs',
  Heaps: 'Heaps',
  'Hash Maps': 'Hash Maps',
  Tries: 'Tries',
};

const STOP = new Set(['the', 'and', 'from', 'into', 'with', 'array', 'list', 'tree', 'graph', 'heap', 'stack', 'queue', 'trie', 'map', 'hash', 'sort', 'search', 'linked']);

function words(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)));
}

export interface RelatedExample {
  id: string;
  title: string;
}

const cache = new Map<string, Promise<RelatedExample | null>>();

export function relatedExample(kernel: Kernel): Promise<RelatedExample | null> {
  let found = cache.get(kernel.id);
  if (!found) {
    found = import('../../../examples/registry').then(({ EXAMPLES }) => {
      const pool = EXAMPLES.filter((e) => e.category === EXAMPLE_CATEGORY[kernel.topic]);
      if (pool.length === 0) return null;
      const want = words(`${kernel.title} ${kernel.id.split('-').slice(1).join(' ')}`);
      // Kind-of-structure words ("sort", "tree") are left out above, so a title match means the same algorithm.
      const sameKind = /sort/i.test(kernel.title) ? /sort/i : null;
      let best = pool[0];
      let bestScore = -1;
      for (const e of pool) {
        const title = words(`${e.title} ${e.id}`);
        const desc = words(e.description);
        let score = 0;
        for (const w of want) {
          if (title.has(w)) score += 3;
          else if (desc.has(w)) score += 1;
        }
        if (sameKind && !sameKind.test(e.title)) score -= 1;
        if (score > bestScore) {
          best = e;
          bestScore = score;
        }
      }
      return { id: best.id, title: best.title };
    });
    cache.set(kernel.id, found);
  }
  return found;
}
