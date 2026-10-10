/**
 * Getting around Complete the Algorithm: the hub keeps its search and
 * filters in the address, and a challenge's "back" link returns to them.
 */

let lastQuery = '';
const KEY = 'aqvl-challenges-hub';

export function hubPath(query: string): string {
  return query ? `/challenges/complete?${query}` : '/challenges/complete';
}

export function rememberHubQuery(query: string) {
  lastQuery = query;
  try {
    sessionStorage.setItem(KEY, query);
  } catch {
    /* this visit only */
  }
}

/** The hub as it was last left (search and filters included). */
export function lastHubPath(): string {
  if (!lastQuery) {
    try {
      lastQuery = sessionStorage.getItem(KEY) ?? '';
    } catch {
      /* none */
    }
  }
  return hubPath(lastQuery);
}
