/**
 * HashMapProgramEngine — a HASH_MAP driven by real code instead of the
 * one-line built-ins (HASHMAP_INSERT, HASHMAP_LOOKUP, ... stay with
 * HashMapVisualizer, which also builds a declared map).
 *
 * The map is a row of buckets; each key lives in the bucket its hash picks,
 * in a chain under that bucket (separate chaining):
 *   number key: key % capacity
 *   text key:   (sum of its character codes) % capacity
 * When a new key would push size / capacity above 0.75 the bucket row
 * doubles and every key is rehashed into its new bucket.
 *
 * Supported code on a map `m`:
 *   m[key] = value            insert a new key or overwrite its value
 *   m[key]                    read a value (a missing key stops the program)
 *   CONTAINS(m, key)          TRUE / FALSE
 *   DELETE m[key]             remove a key (a missing key stops the program)
 *   LENGTH(m)                 number of keys stored
 *   KEY_AT(m, i)              the i-th key, walking bucket 0, 1, 2, ... and
 *                             each chain top to bottom (0 <= i < LENGTH(m))
 *   BUCKET_OF(m, key)         the bucket index the map uses for `key`
 *   CAPACITY(m)               the number of buckets
 *   HIGHLIGHT m[key] 'SUCCESS'
 *   PRINT m                   {key: value, ...} in bucket order
 * Reading `m[key]` or CONTAINS in an assignment, IF / WHILE condition, call
 * argument or RETURN animates the lookup (hash, bucket, walk the chain).
 */

import { getSemanticColorToken } from '@aqvl/shared';
import { AlgorithmContext } from './AlgorithmContext';
import { AnticipationAnimation } from '../animations';
import { HashMapVisualizer } from './HashMapVisualizer';
import { HashMap } from '../../data-structures/HashMap';

export class HashMapKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HashMapKeyError';
  }
}

export class HashMapProgramEngine {
  /** Reads compiled to `{ gfn, args }` whose first argument is the map. */
  static readonly READS = new Set(['MAP_GET', 'CONTAINS', 'KEY_AT', 'BUCKET_OF', 'CAPACITY']);

  /** Vertical gap between chained entries, as in HashMapVisualizer. */
  static readonly CHAIN_SPACING = 1.1;

  private visualizer = new HashMapVisualizer();

  // ─────────────────────────────────────────────────────────────────────────
  // Reading the scene
  // ─────────────────────────────────────────────────────────────────────────

  /** Whether `name` is a declared HASH_MAP (it always has its bucket row). */
  isHashMap(context: AlgorithmContext, name: unknown): boolean {
    if (typeof name !== 'string') return false;
    return context.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'HASHMAP_BUCKET' && el.logicalParent === name);
  }

  hasAnyHashMap(context: AlgorithmContext): boolean {
    return context.sceneManager.getSceneGraph().some((el: any) => el.originalType === 'HASHMAP_BUCKET');
  }

  /** Current buckets, in index order (the old row fading out during a resize is left out). */
  private buckets(context: AlgorithmContext, name: string): any[] {
    const all = (context.sceneManager.getSceneGraph() as any[]).filter(
      (el) => el.logicalParent === name && el.originalType === 'HASHMAP_BUCKET' && !el.pendingRemoval
    );
    // During a resize the new row is added before the old one is removed:
    // the newest row is the one whose indices are all present exactly once.
    const byIndex = new Map<number, any>();
    for (const el of all) byIndex.set(el.logicalIndex, el);
    return [...byIndex.values()].sort((a, b) => a.logicalIndex - b.logicalIndex);
  }

  /** Stored entries in iteration order: bucket 0, 1, 2, ..., each chain top to bottom. */
  private entries(context: AlgorithmContext, name: string): any[] {
    return (context.sceneManager.getSceneGraph() as any[])
      .filter((el) => el.logicalParent === name && el.originalType === 'HASHMAP_ENTRY' && !el.pendingRemoval)
      .sort((a, b) => a.bucketIndex - b.bucketIndex || a.chainIndex - b.chainIndex);
  }

  private entryFor(context: AlgorithmContext, name: string, key: unknown): any | undefined {
    return this.entries(context, name).find((el) => el.key === key);
  }

  capacity(context: AlgorithmContext, name: string): number {
    return this.buckets(context, name).length || HashMap.DEFAULT_CAPACITY;
  }

  length(context: AlgorithmContext, name: string): number {
    return this.entries(context, name).length;
  }

  /** The map's hash of `key` at `capacity` buckets, with the working shown for the console. */
  static hash(key: unknown, capacity: number): { index: number; working: string } {
    if (typeof key === 'number' && Number.isInteger(key)) {
      const index = ((key % capacity) + capacity) % capacity;
      return { index, working: `${key} % ${capacity} = ${index}` };
    }
    const text = String(key);
    let sum = 0;
    const codes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      codes.push(text.charCodeAt(i));
      sum += text.charCodeAt(i);
    }
    const index = sum % capacity;
    const sumText = codes.length > 1 && codes.length <= 6 ? `(${codes.join(' + ')}) = ${sum}` : `${sum}`;
    return { index, working: `character codes of ${HashMapProgramEngine.showKey(key)} add up to ${sumText}; ${sum} % ${capacity} = ${index}` };
  }

  /** A pure HashMap holding exactly what the scene holds, at the scene's capacity. */
  private model(context: AlgorithmContext, name: string): HashMap<any, any> {
    const hm = new HashMap<any, any>(this.capacity(context, name));
    for (const el of this.entries(context, name)) {
      hm.table[hm.hash(el.key)].push([el.key, el.value]);
      hm.size++;
    }
    return hm;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Expression reads: m[key], CONTAINS, KEY_AT, BUCKET_OF, CAPACITY
  // ─────────────────────────────────────────────────────────────────────────

  read(context: AlgorithmContext, fn: string, args: unknown[], text: string): unknown {
    const name = args[0];
    if (!this.isHashMap(context, name)) {
      throw new HashMapKeyError(`${text}: '${String(name)}' is not a declared HASH_MAP.`);
    }
    const map = String(name);
    switch (fn) {
      case 'MAP_GET': {
        const entry = this.entryFor(context, map, args[1]);
        if (!entry) {
          const key = HashMapProgramEngine.showKey(args[1]);
          throw new HashMapKeyError(
            `${text}: the key ${key} is not in hash map '${map}'. Check CONTAINS(${map}, ${key}) first, or store it with ${map}[${key}] = value.`
          );
        }
        return entry.value;
      }
      case 'CONTAINS':
        return this.entryFor(context, map, args[1]) !== undefined;
      case 'KEY_AT': {
        const index = Number(args[1]);
        const entries = this.entries(context, map);
        if (!Number.isInteger(index) || index < 0 || index >= entries.length) {
          throw new HashMapKeyError(
            entries.length === 0
              ? `${text}: hash map '${map}' is empty, so it has no key ${String(args[1])}.`
              : `${text}: index ${String(args[1])} is out of range for hash map '${map}' (valid indices are 0 to ${entries.length - 1}; LENGTH(${map}) is ${entries.length}).`
          );
        }
        return entries[index].key;
      }
      case 'BUCKET_OF':
        return HashMapProgramEngine.hash(args[1], this.capacity(context, map)).index;
      case 'CAPACITY':
        return this.capacity(context, map);
      default:
        throw new HashMapKeyError(`Unknown hash map read ${fn}.`);
    }
  }

  format(context: AlgorithmContext, name: string): string {
    return `{${this.entries(context, name).map((el) => `${HashMapProgramEngine.show(el.key)}: ${HashMapProgramEngine.show(el.value)}`).join(', ')}}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statements
  // ─────────────────────────────────────────────────────────────────────────

  /** `m[key] = value`: hash, walk the chain, then overwrite the key's value or add it (resizing first when needed). */
  put(context: AlgorithmContext, name: string, key: unknown, value: unknown): void {
    HashMapProgramEngine.checkKey(name, key);
    const hm = this.model(context, name);
    const capacity = hm.capacity;
    const { index, working } = HashMapProgramEngine.hash(key, capacity);
    const k = HashMapProgramEngine.showKey(key);
    this.log(context, 'HASH', `hash(${k}): ${working} -> bucket ${index}`, 'step');

    const existing = this.entryFor(context, name, key);
    const chain = hm.table[index];
    if (chain.length > 0) {
      // Walk the chain comparing keys, as a real lookup does.
      this.visualizer.visualizeLookup(context, name, key, index, existing !== undefined);
    }

    if (existing) {
      const old = existing.value;
      this.paint([existing], 'MODIFYING');
      const token = getSemanticColorToken('MODIFYING');
      context.scheduler.enqueue({ targets: existing, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: token.emissiveIntensity, duration: 280 });
      context.scheduler.enqueue({ targets: existing.scale, x: 1.2, y: 1.2, z: 1.2, duration: 280 });
      context.scheduler.commitGroup(true);
      existing.value = value;
      existing.label = HashMapVisualizer.label(key, value);
      context.scheduler.enqueue({ targets: existing.scale, x: 1, y: 1, z: 1, duration: 250 });
      context.scheduler.commitGroup(true);
      this.finish(context, 'PUT', `${name}[${k}] = ${HashMapProgramEngine.show(value)} (was ${HashMapProgramEngine.show(old)}): the key was already in bucket ${index}, so only its value changed`, 'operation');
      return;
    }

    const willResize = (hm.size + 1) / capacity > hm.loadFactor;
    if (willResize) {
      this.log(
        context,
        'RESIZE',
        `Adding a key would make the load factor ${hm.size + 1}/${capacity} = ${HashMapProgramEngine.show((hm.size + 1) / capacity)}, above ${hm.loadFactor}: doubling to ${capacity * 2} buckets and rehashing every key`,
        'operation'
      );
      hm.set(key, value);
      this.visualizer.visualizeResize(context, name, capacity, hm.capacity, hm, key);
      const moved = HashMapProgramEngine.hash(key, hm.capacity);
      this.finish(context, 'PUT', `Added ${name}[${k}] = ${HashMapProgramEngine.show(value)} into bucket ${moved.index} of ${hm.capacity} (${moved.working}); the map holds ${hm.size} keys`, 'operation', name);
      return;
    }

    this.visualizer.visualizeInsert(context, name, key, value, index, chain.length);
    const size = hm.size + 1;
    const collision = chain.length > 0 ? `, chained after ${chain.length} other key${chain.length === 1 ? '' : 's'} (a collision)` : '';
    this.finish(context, 'PUT', `Added ${name}[${k}] = ${HashMapProgramEngine.show(value)} into bucket ${index}${collision}; the map holds ${size} key${size === 1 ? '' : 's'}`, 'operation', name);
  }

  /** `DELETE m[key]`: find the key in its bucket's chain and unlink it; the rest of the chain moves up. */
  remove(context: AlgorithmContext, name: string, key: unknown): void {
    const k = HashMapProgramEngine.showKey(key);
    const entry = this.entryFor(context, name, key);
    if (!entry) {
      throw new HashMapKeyError(`Cannot DELETE ${name}[${k}]: the key ${k} is not in hash map '${name}'. Check CONTAINS(${name}, ${k}) first.`);
    }
    const { index, working } = HashMapProgramEngine.hash(key, this.capacity(context, name));
    this.log(context, 'HASH', `hash(${k}): ${working} -> bucket ${index}`, 'step');
    const value = entry.value;
    const size = this.length(context, name) - 1;
    this.visualizer.visualizeDelete(context, name, key, index);
    entry.pendingRemoval = true;
    this.finish(context, 'DELETE', `Removed ${k} (value ${HashMapProgramEngine.show(value)}) from bucket ${index}; the map holds ${size} key${size === 1 ? '' : 's'}`, 'operation', name);
  }

  /** The lookup behind a read of `m[key]` / CONTAINS(m, key): hash, go to the bucket, compare the keys of its chain. */
  lookup(context: AlgorithmContext, name: string, key: unknown): void {
    const k = HashMapProgramEngine.showKey(key);
    const { index, working } = HashMapProgramEngine.hash(key, this.capacity(context, name));
    const chain = this.entries(context, name).filter((el) => el.bucketIndex === index);
    const position = chain.findIndex((el) => el.key === key);
    this.visualizer.visualizeLookup(context, name, key, index, position >= 0);
    const compared = position >= 0 ? position + 1 : chain.length;
    const comparisons = `${compared} key comparison${compared === 1 ? '' : 's'}`;
    this.finish(
      context,
      'LOOKUP',
      position >= 0
        ? `Looked up ${k}: hash(${k}): ${working} -> bucket ${index}; found after ${comparisons}, value ${HashMapProgramEngine.show(chain[position].value)}`
        : `Looked up ${k}: hash(${k}): ${working} -> bucket ${index}; not found (${chain.length === 0 ? 'the bucket is empty' : comparisons})`,
      'compare'
    );
  }

  /** `HIGHLIGHT m[key] 'COLOR'`: mark the key's entry. */
  highlight(context: AlgorithmContext, name: string, key: unknown, color: string): void {
    const k = HashMapProgramEngine.showKey(key);
    const entry = this.entryFor(context, name, key);
    if (!entry) {
      throw new HashMapKeyError(`Cannot HIGHLIGHT ${name}[${k}]: the key ${k} is not in hash map '${name}'.`);
    }
    const token = getSemanticColorToken(color || 'SUCCESS');
    AnticipationAnimation.applyAnticipation(context.scheduler, [entry], 'SELECTION');
    entry.isHighlighted = token.name !== 'NEUTRAL';
    entry.highlightType = color;
    entry.state = token.name;
    entry.color = token.name === 'NEUTRAL' ? HashMapVisualizer.ENTRY_COLOR : token.color;
    entry.emissiveColor = token.emissiveColor;
    entry.emissiveIntensity = token.name === 'NEUTRAL' ? 0 : token.emissiveIntensity;
    context.scheduler.enqueue({ targets: entry.scale, x: 1.15, y: 1.15, z: 1.15, duration: 300, easing: 'easeOutExpo' });
    context.scheduler.commitGroup(true);
    context.scheduler.enqueue({ targets: entry.scale, x: 1, y: 1, z: 1, duration: 250, easing: 'easeInOutQuad' });
    context.scheduler.commitGroup(true);
    const value = HashMapProgramEngine.show(entry.value);
    this.finish(
      context,
      'HIGHLIGHT',
      token.name === 'NEUTRAL' ? `Cleared mark on ${name}[${k}] (value: ${value})` : `Marked ${name}[${k}] = ${value} as ${String(color || 'SUCCESS').toUpperCase()}`,
      'step'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Clears last step's lookup / update colours; marks set by HIGHLIGHT stay. */
  restoreBaseColors(context: AlgorithmContext): void {
    for (const el of context.sceneManager.getSceneGraph() as any[]) {
      if (el.originalType !== 'HASHMAP_ENTRY' && el.originalType !== 'HASHMAP_BUCKET') continue;
      if (el.state === 'EVALUATING' || el.state === 'MODIFYING' || el.state === 'TRAVERSING') {
        el.state = 'NEUTRAL';
        el.isHighlighted = false;
        el.color = el.originalType === 'HASHMAP_ENTRY' ? HashMapVisualizer.ENTRY_COLOR : HashMapVisualizer.BUCKET_COLOR;
        el.emissiveColor = '#000000';
        el.emissiveIntensity = 0;
      }
    }
  }

  /** Keys are numbers or text; anything else (a missing value, TRUE / FALSE) is almost always a slip. */
  private static checkKey(name: string, key: unknown): void {
    if (typeof key === 'number' && Number.isFinite(key)) return;
    if (typeof key === 'string') return;
    throw new HashMapKeyError(`A key of hash map '${name}' must be a number or text, not ${HashMapProgramEngine.show(key)}.`);
  }

  static showKey(key: unknown): string {
    return typeof key === 'string' ? `"${key}"` : HashMapProgramEngine.show(key);
  }

  private static show(value: unknown): string {
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
    if (value === true) return 'TRUE';
    if (value === false) return 'FALSE';
    if (value === null || value === undefined) return 'NULL';
    return String(value);
  }

  private paint(elements: any[], state: string): void {
    const token = getSemanticColorToken(state);
    for (const el of elements) {
      el.state = state;
      el.isHighlighted = true;
      el.highlightType = state;
      el.color = token.color;
      el.emissiveColor = token.emissiveColor;
      el.emissiveIntensity = token.emissiveIntensity;
    }
  }

  private log(context: AlgorithmContext, keyword: string, message: string, kind: string): void {
    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() }),
    });
    context.scheduler.commitGroup(true);
  }

  /** The step's console line and saved state, once its animation has played. */
  private finish(context: AlgorithmContext, keyword: string, message: string, kind: string, settleMap?: string): void {
    context.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        if (settleMap) {
          // Entries end exactly under their bucket (the new row after a resize), full size.
          const buckets = this.buckets(context, settleMap);
          for (const el of context.sceneManager.getSceneGraph() as any[]) {
            if (el.logicalParent !== settleMap || el.pendingRemoval) continue;
            if (el.originalType !== 'HASHMAP_ENTRY' && el.originalType !== 'HASHMAP_BUCKET') continue;
            const bucket = el.originalType === 'HASHMAP_ENTRY' ? buckets[el.bucketIndex] : undefined;
            if (bucket) {
              const b = bucket.worldTarget ?? bucket.position;
              el.worldTarget = { x: b.x, y: b.y - (el.chainIndex + 1) * HashMapProgramEngine.CHAIN_SPACING, z: b.z };
            }
            if (el.worldTarget) {
              el.position.x = el.worldTarget.x;
              el.position.y = el.worldTarget.y;
              el.position.z = el.worldTarget.z;
            }
            el.scale.x = el.scale.y = el.scale.z = 1;
          }
        }
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), message, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
        context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
      },
    });
    context.scheduler.commitSequential();
  }
}
