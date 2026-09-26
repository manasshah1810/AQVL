/**
 * HashMap — a real separate-chaining hash map (buckets are arrays of
 * [key, value] pairs), backing AQVL's HASH_MAP declarations and the
 * HASHMAP_INIT / HASHMAP_INSERT / HASHMAP_LOOKUP / HASHMAP_DELETE runtime
 * ops (see ../core/algorithms/HashMapVisualizer.ts).
 *
 * The hash function is deliberately simple (sum of character codes mod
 * capacity) so that collisions are easy to produce and animate on purpose —
 * this is a teaching visualization, not a production hash map.
 */

export type HashEntry<K, V> = [K, V];

export class HashMap<K = string, V = any> {
  table: HashEntry<K, V>[][];
  size: number = 0;
  capacity: number;
  readonly loadFactor: number;

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

  /** Inserts a new key or updates an existing one's value, resizing first if the load factor would be exceeded. */
  set(key: K, value: V): void {
    const bucket = this.bucketFor(key);
    const existing = bucket.find(([k]) => k === key);
    if (existing) {
      existing[1] = value;
      return;
    }

    if ((this.size + 1) / this.capacity > this.loadFactor) {
      this.resize();
    }

    this.bucketFor(key).push([key, value]);
    this.size++;
  }

  /** Returns the value for `key`, or undefined if it isn't present. */
  get(key: K): V | undefined {
    const entry = this.bucketFor(key).find(([k]) => k === key);
    return entry ? entry[1] : undefined;
  }

  has(key: K): boolean {
    return this.bucketFor(key).some(([k]) => k === key);
  }

  /** Removes `key`, returning whether it was present. */
  delete(key: K): boolean {
    const bucket = this.bucketFor(key);
    const idx = bucket.findIndex(([k]) => k === key);
    if (idx === -1) return false;
    bucket.splice(idx, 1);
    this.size--;
    return true;
  }

  /** Doubles capacity and rehashes every existing entry into the new bucket array. */
  resize(): void {
    const oldEntries = this.entries();
    this.capacity *= 2;
    this.table = HashMap.makeBuckets(this.capacity);
    this.size = 0;
    for (const [key, value] of oldEntries) {
      this.bucketFor(key).push([key, value]);
      this.size++;
    }
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
