/**
 * Unit tests for HashMap (packages/runtime/src/data-structures/HashMap.ts) —
 * a separate-chaining hash map backing HASH_MAP declarations and the
 * HASHMAP_INIT / HASHMAP_INSERT / HASHMAP_LOOKUP / HASHMAP_DELETE runtime
 * ops (see ../../packages/runtime/src/core/algorithms/HashMapVisualizer).
 */
import { describe, expect, it } from 'vitest';
import { HashMap } from '../../packages/runtime/src/data-structures/HashMap';

describe('HashMap', () => {
  it('set/get/delete basic operations round-trip correctly', () => {
    const map = new HashMap<string, number>();
    map.set('a', 1);
    map.set('b', 2);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
    expect(map.delete('a')).toBe(true);
    expect(map.get('a')).toBeUndefined();
    expect(map.get('b')).toBe(2);
  });

  it('get(nonexistent) returns undefined', () => {
    const map = new HashMap<string, number>();
    map.set('a', 1);
    expect(map.get('nope')).toBeUndefined();
  });

  it('delete(nonexistent) returns false and does not change size', () => {
    const map = new HashMap<string, number>();
    map.set('a', 1);
    expect(map.delete('nope')).toBe(false);
    expect(map.size).toBe(1);
  });

  it('set on an existing key updates the value instead of duplicating it', () => {
    const map = new HashMap<string, number>();
    map.set('a', 1);
    map.set('a', 2);
    expect(map.size).toBe(1);
    expect(map.get('a')).toBe(2);
  });

  it('collision: two keys hashing to the same bucket are both stored via chaining', () => {
    const map = new HashMap<string, number>(4);
    // Find two distinct keys that collide under the sum-of-char-codes hash at this capacity.
    const k1 = 'a';
    // 'a' = 97, 97 % 4 = 1. Look for another short key with the same hash.
    let k2: string | undefined;
    for (let i = 0; i < 200; i++) {
      const candidate = String.fromCharCode(98 + i);
      if (candidate !== k1 && map.hash(candidate) === map.hash(k1)) {
        k2 = candidate;
        break;
      }
    }
    expect(k2).toBeDefined();

    map.set(k1, 1);
    map.set(k2!, 2);
    expect(map.table[map.hash(k1)].length).toBeGreaterThanOrEqual(2);
    expect(map.get(k1)).toBe(1);
    expect(map.get(k2!)).toBe(2);
    expect(map.size).toBe(2);
  });

  it('resize: exceeding a load factor of 0.75 doubles capacity', () => {
    const map = new HashMap<string, number>(4, 0.75);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3); // 3/4 = 0.75, not > 0.75 yet
    expect(map.capacity).toBe(4);
    map.set('d', 4); // (3+1)/4 = 1 > 0.75 -> resize before inserting
    expect(map.capacity).toBe(8);
    expect(map.size).toBe(4);
  });

  it('rehashing after resize preserves every key/value correctly', () => {
    const map = new HashMap<string, number>(2, 0.75);
    const entries: [string, number][] = Array.from({ length: 20 }, (_, i) => [`key${i}`, i]);
    entries.forEach(([k, v]) => map.set(k, v));

    expect(map.capacity).toBeGreaterThan(2);
    expect(map.size).toBe(20);
    entries.forEach(([k, v]) => {
      expect(map.get(k)).toBe(v);
    });
    // Every entry must now live in the bucket its key actually hashes to at the new capacity.
    entries.forEach(([k]) => {
      const idx = map.hash(k);
      expect(map.table[idx].some(([bk]) => bk === k)).toBe(true);
    });
  });

  it('keys(), values(), and entries() reflect the current contents', () => {
    const map = new HashMap<string, number>();
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);

    expect(map.keys().sort()).toEqual(['a', 'b', 'c']);
    expect(map.values().sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(map.entries().sort((a, b) => a[0].localeCompare(b[0]))).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  it('clear() empties the map without changing capacity', () => {
    const map = new HashMap<string, number>();
    map.set('a', 1);
    map.set('b', 2);
    const capacityBefore = map.capacity;
    map.clear();
    expect(map.size).toBe(0);
    expect(map.capacity).toBe(capacityBefore);
    expect(map.entries()).toEqual([]);
    expect(map.get('a')).toBeUndefined();
  });

  it('handles a realistic sequence of set/get/delete/set operations', () => {
    const map = new HashMap<string, number>();
    map.set('x', 1);
    map.set('y', 2);
    expect(map.delete('x')).toBe(true);
    map.set('x', 10);
    expect(map.get('x')).toBe(10);
    expect(map.get('y')).toBe(2);
    expect(map.size).toBe(2);
  });

  it('edge case: an empty map has size 0 and returns undefined/false for every op', () => {
    const map = new HashMap<string, number>();
    expect(map.size).toBe(0);
    expect(map.get('anything')).toBeUndefined();
    expect(map.delete('anything')).toBe(false);
    expect(map.keys()).toEqual([]);
    expect(map.values()).toEqual([]);
  });

  it('edge case: a "full" table (load factor exceeded repeatedly) keeps resizing and stays correct', () => {
    const map = new HashMap<string, number>(2);
    const n = 100;
    for (let i = 0; i < n; i++) map.set(`k${i}`, i);

    expect(map.size).toBe(n);
    expect(map.currentLoadFactor).toBeLessThanOrEqual(map.loadFactor);
    for (let i = 0; i < n; i++) {
      expect(map.get(`k${i}`)).toBe(i);
    }
  });

  it('supports numeric keys via the string-sum hash the same way as string keys', () => {
    const map = new HashMap<number, string>();
    map.set(1, 'one');
    map.set(2, 'two');
    expect(map.get(1)).toBe('one');
    expect(map.get(2)).toBe('two');
    expect(map.delete(1)).toBe(true);
    expect(map.get(1)).toBeUndefined();
  });

  it('hash() distributes keys across the full [0, capacity) range, not just index 0', () => {
    const map = new HashMap<string, number>(16);
    const seen = new Set<number>();
    for (let i = 0; i < 16; i++) {
      seen.add(map.hash(`item-${i}-${String.fromCharCode(65 + i)}`));
    }
    expect(seen.size).toBeGreaterThan(1);
    seen.forEach((idx) => {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(16);
    });
  });

  it('average-case get/set stay fast (O(1)-shaped): a large map does not degrade to a long single chain', () => {
    const map = new HashMap<string, number>();
    const n = 2000;
    for (let i = 0; i < n; i++) map.set(`user-${i}`, i);

    const maxChainLength = Math.max(...map.table.map((bucket) => bucket.length));
    // With resizing keeping load factor <= 0.75, no bucket should hold anywhere
    // near all n entries -- a real O(1) average case, not degenerate chaining.
    expect(maxChainLength).toBeLessThan(n / 4);
    expect(map.get('user-1999')).toBe(1999);
  });
});
