/**
 * HashMap — a real separate-chaining hash map (buckets are arrays of
 * [key, value] pairs), backing AQVL's HASH_MAP declarations and the
 * HASHMAP_INIT / HASHMAP_INSERT / HASHMAP_LOOKUP / HASHMAP_DELETE runtime
 * ops (see ../core/algorithms/HashMapEngine.ts).
 *
 * The hash function is deliberately simple (sum of character codes mod
 * capacity) so that collisions are easy to produce and animate on purpose —
 * this is a teaching visualization, not a production hash map.
 *
 * `set`, `lookup`, `delete` and `resize` reset `steps` and record what they
 * did, one step per visualizable micro-action; HashMapEngine replays them.
 * `get` / `has` are plain reads that record nothing.
 */
import type { StepPrimitives } from './steps';

export type HashEntry<K, V> = [K, V];

/** Which operation a HASH step starts (each shows its bucket in its own way). */
export type HashMapOperation = 'SET' | 'LOOKUP' | 'DELETE';

export type HashMapStep<K = unknown, V = unknown> =
  /** `key` hashed to `bucket`, at the capacity in force when the key is placed. */
  | { type: 'HASH'; op: HashMapOperation; key: K; bucket: number; capacity: number }
  /** The table doubled from `from` to `to` buckets; `entries` is where every key already stored now sits. */
  | { type: 'RESIZE'; from: number; to: number; entries: { key: K; value: V; bucket: number; chainIndex: number }[] }
  /** `bucket` already chains `chainLength` keys: the key being added collides with them. */
  | { type: 'COLLISION'; bucket: number; chainLength: number }
  /** A new key was appended to `bucket`'s chain at `chainIndex`. */
  | { type: 'APPEND'; key: K; value: V; bucket: number; chainIndex: number }
  /** An existing key's value was overwritten in place. */
  | { type: 'UPDATE'; key: K; value: V; bucket: number; chainIndex: number }
  /** The chain entry at `chainIndex` (holding `key`) was compared with the key looked up; `match` when it is that key. */
  | { type: 'COMPARE'; key: K; bucket: number; chainIndex: number; match: boolean }
  /** The key is not in `bucket`. */
  | { type: 'MISS'; bucket: number }
  /** The entry for `key` at `chainIndex` was unlinked from `bucket`; later entries move up one slot. */
  | { type: 'REMOVE'; key: K; bucket: number; chainIndex: number }
  /** The operation is done with `bucket`. */
  | { type: 'RELEASE'; bucket: number };

/** The AQIR primitive each hash-map step realises (see ./steps.ts). */
export const HASHMAP_STEP_PRIMITIVES: StepPrimitives<HashMapStep> = {
  HASH: { kind: 'ANNOTATE', verb: 'focus' },
  RESIZE: { kind: 'MUTATE', verb: 'create' },
  COLLISION: { kind: 'ANNOTATE', verb: 'contrast' },
  APPEND: { kind: 'MUTATE', verb: 'create' },
  UPDATE: { kind: 'MUTATE', verb: 'set' },
  COMPARE: { kind: 'ANNOTATE', verb: 'contrast' },
  MISS: { kind: 'ANNOTATE', verb: 'state' },
  REMOVE: { kind: 'MUTATE', verb: 'destroy' },
  RELEASE: { kind: 'ANNOTATE', verb: 'state' },
};

export class HashMap<K = string, V = any> {
  table: HashEntry<K, V>[][];
  size: number = 0;
  capacity: number;
  readonly loadFactor: number;

  /** Steps recorded by the most recent set / lookup / delete / resize call. */
  steps: HashMapStep<K, V>[] = [];

  static readonly DEFAULT_CAPACITY = 8;
  static readonly DEFAULT_LOAD_FACTOR = 0.75;

  constructor(capacity: number = HashMap.DEFAULT_CAPACITY, loadFactor: number = HashMap.DEFAULT_LOAD_FACTOR) {
    this.capacity = Math.max(1, capacity);
    this.loadFactor = loadFactor;
    this.table = HashMap.makeBuckets(this.capacity);
  }

  private static makeBuckets<K, V>(capacity: number): HashEntry<K, V>[][] {
    return Array.from({ length: capacity }, () => []);
  }

  /** Integer keys: key mod capacity. Anything else: sums the char codes of `String(key)` and reduces mod capacity. */
  hash(key: K): number {
    if (typeof key === 'number' && Number.isInteger(key)) {
      return ((key % this.capacity) + this.capacity) % this.capacity;
    }
    const str = String(key);
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
      sum += str.charCodeAt(i);
    }
    return sum % this.capacity;
  }

  private bucketFor(key: K): HashEntry<K, V>[] {
    return this.table[this.hash(key)];
  }

  /**
   * Inserts a new key or updates an existing one's value, resizing first if
   * the load factor would be exceeded. Records UPDATE for a key already
   * present; otherwise [RESIZE,] HASH, [COLLISION,] APPEND.
   */
  set(key: K, value: V): void {
    this.steps = [];
    const bucket = this.bucketFor(key);
    const existing = bucket.findIndex(([k]) => k === key);
    if (existing !== -1) {
      bucket[existing][1] = value;
      this.steps.push({ type: 'UPDATE', key, value, bucket: this.hash(key), chainIndex: existing });
      return;
    }

    if ((this.size + 1) / this.capacity > this.loadFactor) {
      this.rehash();
    }

    const index = this.hash(key);
    const chain = this.table[index];
    this.steps.push({ type: 'HASH', op: 'SET', key, bucket: index, capacity: this.capacity });
    if (chain.length > 0) this.steps.push({ type: 'COLLISION', bucket: index, chainLength: chain.length });
    chain.push([key, value]);
    this.size++;
    this.steps.push({ type: 'APPEND', key, value, bucket: index, chainIndex: chain.length - 1 });
  }

  /**
   * Looks `key` up the way a real lookup does — hash it, then compare the
   * keys of its bucket's chain in order — recording HASH, one COMPARE per key
   * compared, [MISS,] RELEASE. Returns the value, or undefined.
   */
  lookup(key: K): V | undefined {
    this.steps = [];
    const index = this.hash(key);
    this.steps.push({ type: 'HASH', op: 'LOOKUP', key, bucket: index, capacity: this.capacity });
    let found: HashEntry<K, V> | undefined;
    for (const [chainIndex, entry] of this.table[index].entries()) {
      const match = entry[0] === key;
      this.steps.push({ type: 'COMPARE', key: entry[0], bucket: index, chainIndex, match });
      if (match) {
        found = entry;
        break;
      }
    }
    if (!found) this.steps.push({ type: 'MISS', bucket: index });
    this.steps.push({ type: 'RELEASE', bucket: index });
    return found ? found[1] : undefined;
  }

  /** Returns the value for `key`, or undefined if it isn't present. */
  get(key: K): V | undefined {
    const entry = this.bucketFor(key).find(([k]) => k === key);
    return entry ? entry[1] : undefined;
  }

  has(key: K): boolean {
    return this.bucketFor(key).some(([k]) => k === key);
  }

  /** Removes `key`, returning whether it was present. Records HASH, then REMOVE or MISS, then RELEASE. */
  delete(key: K): boolean {
    this.steps = [];
    const index = this.hash(key);
    const bucket = this.table[index];
    this.steps.push({ type: 'HASH', op: 'DELETE', key, bucket: index, capacity: this.capacity });
    const idx = bucket.findIndex(([k]) => k === key);
    if (idx === -1) {
      this.steps.push({ type: 'MISS', bucket: index }, { type: 'RELEASE', bucket: index });
      return false;
    }
    bucket.splice(idx, 1);
    this.size--;
    this.steps.push({ type: 'REMOVE', key, bucket: index, chainIndex: idx }, { type: 'RELEASE', bucket: index });
    return true;
  }

  /** Doubles capacity and rehashes every existing entry into the new bucket array. Records RESIZE. */
  resize(): void {
    this.steps = [];
    this.rehash();
  }

  private rehash(): void {
    const from = this.capacity;
    const oldEntries = this.entries();
    this.capacity *= 2;
    this.table = HashMap.makeBuckets(this.capacity);
    this.size = 0;
    for (const [key, value] of oldEntries) {
      this.bucketFor(key).push([key, value]);
      this.size++;
    }
    const entries: { key: K; value: V; bucket: number; chainIndex: number }[] = [];
    this.table.forEach((chain, bucket) => chain.forEach(([key, value], chainIndex) => entries.push({ key, value, bucket, chainIndex })));
    this.steps.push({ type: 'RESIZE', from, to: this.capacity, entries });
  }

  entries(): HashEntry<K, V>[] {
    const out: HashEntry<K, V>[] = [];
    for (const bucket of this.table) {
      for (const entry of bucket) out.push(entry);
    }
    return out;
  }

  keys(): K[] {
    return this.entries().map(([k]) => k);
  }

  values(): V[] {
    return this.entries().map(([, v]) => v);
  }

  clear(): void {
    this.table = HashMap.makeBuckets(this.capacity);
    this.size = 0;
  }

  get currentLoadFactor(): number {
    return this.size / this.capacity;
  }
}
