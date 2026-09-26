/**
 * HashMapVisualizer — Animation handler for hash map operations.
 *
 * Registered with AlgorithmRegistry for:
 *   HASHMAP_INIT, HASHMAP_INSERT, HASHMAP_LOOKUP, HASHMAP_DELETE
 *
 * Like HeapEngine/BSTAlgorithms, the scene graph is the source of truth: on
 * every call the current bucket count and stored entries are read back from
 * HASHMAP_BUCKET / HASHMAP_ENTRY scene objects, replayed through the pure
 * HashMap (../../data-structures/HashMap) to get a correct result (real
 * separate-chaining, real resize-at-load-factor-0.75, real rehashing), and
 * the diff is animated back into the scene.
 *
 * Scene shape:
 *  - HASHMAP_BUCKET: one per bucket index 0..capacity-1, laid out in a row.
 *  - HASHMAP_ENTRY: one per stored key, tagged with the bucket index it
 *    lives in and a chainIndex (its position within that bucket's chain).
 *    Entries are positioned directly beneath their bucket (manually, not
 *    through LayoutManager) so a chain visibly stacks under one bucket.
 */

import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { AnticipationAnimation } from '../animations';
import { HashMap } from '../../data-structures/HashMap';

const CHAIN_SPACING = 1.1;

export class HashMapVisualizer implements AlgorithmHandler {
  static readonly BUCKET_COLOR = '#455a64';
  static readonly ENTRY_COLOR = '#26a69a';
  static readonly NEUTRAL_EMISSIVE = '#000000';

  /** An entry's label, `key: value`, with TRUE / FALSE / NULL written as in AQVL. */
  static label(key: unknown, value: unknown): string {
    const show = (v: unknown) => (v === true ? 'TRUE' : v === false ? 'FALSE' : v === null || v === undefined ? 'NULL' : typeof v === 'number' && !Number.isInteger(v) ? String(Number(v.toFixed(4))) : String(v));
    return `${show(key)}: ${show(value)}`;
  }

  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const action = instruction.actionName.toUpperCase();

    if (action === 'HASHMAP_INIT') {
      this.hashMapInit(context, instruction);
    } else if (action === 'HASHMAP_INSERT') {
      this.hashMapInsert(context, instruction);
    } else if (action === 'HASHMAP_LOOKUP') {
      this.hashMapLookup(context, instruction);
    } else if (action === 'HASHMAP_DELETE') {
      this.hashMapDelete(context, instruction);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene helpers
  // ─────────────────────────────────────────────────────────────────────────

  private getBuckets(context: AlgorithmContext, name: string): any[] {
    return context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === name && el.originalType === 'HASHMAP_BUCKET' && !el.pendingRemoval)
      .sort((a: any, b: any) => a.logicalIndex - b.logicalIndex);
  }

  private getEntries(context: AlgorithmContext, name: string): any[] {
    return context.sceneManager
      .getSceneGraph()
      .filter((el: any) => el.logicalParent === name && el.originalType === 'HASHMAP_ENTRY' && !el.pendingRemoval);
  }

  private getEntriesInBucket(context: AlgorithmContext, name: string, bucketIndex: number): any[] {
    return this.getEntries(context, name)
      .filter((el: any) => el.bucketIndex === bucketIndex)
      .sort((a: any, b: any) => a.chainIndex - b.chainIndex);
  }

  /** Rebuilds a pure HashMap from the scene's current bucket count and stored entries. */
  private reconstruct(context: AlgorithmContext, name: string): HashMap<any, any> {
    const buckets = this.getBuckets(context, name);
    const capacity = buckets.length || HashMap.DEFAULT_CAPACITY;
    const hm = new HashMap<any, any>(capacity);
    // Insert directly into buckets (bypassing set()'s resize check) since we
    // already know this exact entry set fit at this exact capacity.
    this.getEntries(context, name).forEach((el: any) => {
      hm.table[hm.hash(el.key)].push([el.key, el.value]);
      hm.size++;
    });
    return hm;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HASHMAP_INIT
  // ─────────────────────────────────────────────────────────────────────────

  private hashMapInit(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    if (!name) {
      this.log(context, 'ERROR', 'HASHMAP_INIT requires a hash map name.', 'warning');
      return;
    }
    if (this.getBuckets(context, name).length > 0) return; // already initialized

    this.log(context, 'HASHMAP_INIT', `Creating hash map "${name}" with ${HashMap.DEFAULT_CAPACITY} buckets...`, 'operation');
    this.createBuckets(context, name, HashMap.DEFAULT_CAPACITY);
  }

  private createBuckets(context: AlgorithmContext, name: string, capacity: number): any[] {
    const buckets: any[] = [];
    for (let i = 0; i < capacity; i++) {
      const el: any = {
        id: `hashmap_bucket_${name}_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'box',
        originalType: 'HASHMAP_BUCKET',
        logicalParent: name,
        logicalIndex: i,
        value: undefined,
        label: `${name}[${i}]`,
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 0, y: 0, z: 0 },
        color: HashMapVisualizer.BUCKET_COLOR,
        emissiveColor: HashMapVisualizer.NEUTRAL_EMISSIVE,
        emissiveIntensity: 0,
        visible: true,
        opacity: 1,
      };
      context.sceneManager.addElement(el);
      buckets.push(el);
    }

    context.layoutManager.updateLayout(buckets);
    buckets.forEach((el) => {
      if (el.worldTarget) {
        el.position.x = el.worldTarget.x;
        el.position.z = el.worldTarget.z;
        el.position.y = el.worldTarget.y;
      }
      context.scheduler.enqueue({ targets: el.scale, x: 1, y: 1, z: 1, duration: 350, easing: 'easeOutBack' });
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(350);

    return buckets;
  }

  /** Removes every bucket/entry element belonging to `name` from the scene (used before a resize rebuild). */
  private clearScene(context: AlgorithmContext, name: string): void {
    (context.sceneManager.getSceneGraph() as any[])
      .filter((el: any) => el.logicalParent === name && el.pendingRemoval && (el.originalType === 'HASHMAP_BUCKET' || el.originalType === 'HASHMAP_ENTRY'))
      .forEach((el: any) => {
      context.sceneManager.removeElement(el.id);
    });
  }

  /** Puts every bucket and entry of `name` exactly on its final place, full size. */
  settle(context: AlgorithmContext, name: string): void {
    const buckets = this.getBuckets(context, name);
    for (const el of [...buckets, ...this.getEntries(context, name)]) {
      const bucket = el.originalType === 'HASHMAP_ENTRY' ? buckets[el.bucketIndex] : undefined;
      if (bucket) this.placeEntry(context, bucket, el, el.chainIndex);
      if (el.worldTarget) {
        el.position.x = el.worldTarget.x;
        el.position.y = el.worldTarget.y;
        el.position.z = el.worldTarget.z;
      }
      el.scale.x = el.scale.y = el.scale.z = 1;
    }
  }

  /** Positions an entry element directly beneath its bucket, `chainIndex` slots down. */
  private placeEntry(context: AlgorithmContext, bucket: any, entry: any, chainIndex: number): void {
    const bx = bucket.worldTarget?.x ?? bucket.position.x;
    const by = bucket.worldTarget?.y ?? bucket.position.y;
    const bz = bucket.worldTarget?.z ?? bucket.position.z;
    entry.worldTarget = { x: bx, y: by - (chainIndex + 1) * CHAIN_SPACING, z: bz };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HASHMAP_INSERT
  // ─────────────────────────────────────────────────────────────────────────

  private hashMapInsert(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const key = instruction.args?.[1];
    const value = instruction.args?.[2];

    if (!name || key === undefined) {
      this.log(context, 'ERROR', 'HASHMAP_INSERT requires a hash map name and a key.', 'warning');
      return;
    }

    if (this.getBuckets(context, name).length === 0) {
      this.createBuckets(context, name, HashMap.DEFAULT_CAPACITY);
    }

    const hm = this.reconstruct(context, name);
    // Keys keep their type: 7 and "7" are different keys (both hash alike).
    const keyStr: any = key;
    const isUpdate = hm.has(keyStr);
    const beforeCapacity = hm.capacity;
    const willResize = !isUpdate && (hm.size + 1) / hm.capacity > hm.loadFactor;
    const preHashIndex = hm.hash(keyStr);
    const collisionsBefore = isUpdate ? 0 : hm.table[preHashIndex].length;

    this.log(context, 'HASHMAP_INSERT', `hash("${keyStr}") = ${preHashIndex} (capacity ${beforeCapacity})`, 'step');

    if (willResize) {
      this.log(context, 'HASHMAP_RESIZE', `Load factor would exceed ${hm.loadFactor}. Resizing ${beforeCapacity} -> ${beforeCapacity * 2}...`, 'operation');
    }

    hm.set(keyStr, value);

    if (willResize) {
      this.visualizeResize(context, name, beforeCapacity, hm.capacity, hm, keyStr);
    } else if (isUpdate) {
      this.visualizeUpdate(context, name, keyStr, value);
    } else {
      this.visualizeInsert(context, name, keyStr, value, preHashIndex, collisionsBefore);
    }

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'HASHMAP_INSERT', `Set "${keyStr}" -> ${value}. size=${hm.size}, capacity=${hm.capacity}`, 'result');
        // Every entry of the map ends exactly in its chain slot under its bucket.
        this.settle(context, name);
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `HashMap set ${keyStr}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  /** Shows the hash computation and target bucket, highlighting any existing chain entries as collisions, then appends the new entry. */
  visualizeInsert(context: AlgorithmContext, name: string, key: any, value: any, hashIndex: number, collisions: number): void {
    const buckets = this.getBuckets(context, name);
    const bucket = buckets[hashIndex];
    if (!bucket) return;

    const evaluatingToken = getSemanticColorToken('EVALUATING');
    context.scheduler.enqueue({ targets: bucket, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
    context.scheduler.enqueue({ targets: bucket.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(300);

    const chain = this.getEntriesInBucket(context, name, hashIndex);
    if (collisions > 0) {
      this.log(context, 'HASHMAP_COLLISION', `Collision at bucket ${hashIndex}: ${collisions} existing key(s) chained here.`, 'step');
      const modifyingToken = getSemanticColorToken('MODIFYING');
      chain.forEach((existing) => {
        context.scheduler.enqueue({ targets: existing, color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.7, duration: 200 });
      });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(200);
      chain.forEach((existing) => {
        context.scheduler.enqueue({ targets: existing, color: HashMapVisualizer.ENTRY_COLOR, emissiveIntensity: 0, duration: 200 });
      });
      context.scheduler.commitGroup(true);
    }

    const entryEl: any = {
      id: `hashmap_entry_${name}_${key}_${Date.now()}`,
      type: 'box',
      originalType: 'HASHMAP_ENTRY',
      logicalParent: name,
      bucketIndex: hashIndex,
      chainIndex: chain.length,
      key,
      value,
      label: HashMapVisualizer.label(key, value),
      position: { x: bucket.position.x, y: bucket.position.y, z: bucket.position.z },
      scale: { x: 0, y: 0, z: 0 },
      color: HashMapVisualizer.ENTRY_COLOR,
      emissiveColor: HashMapVisualizer.NEUTRAL_EMISSIVE,
      emissiveIntensity: 0,
      visible: true,
      opacity: 1,
    };
    context.sceneManager.addElement(entryEl);
    this.placeEntry(context, bucket, entryEl, chain.length);
    if (entryEl.worldTarget) {
      entryEl.position.x = entryEl.worldTarget.x;
      entryEl.position.z = entryEl.worldTarget.z;
    }

    const successToken = getSemanticColorToken('SUCCESS');
    context.scheduler.enqueue({ targets: entryEl.position, y: entryEl.worldTarget?.y ?? entryEl.position.y, duration: 400, easing: 'easeOutBack' });
    context.scheduler.enqueue({ targets: entryEl.scale, x: 1, y: 1, z: 1, duration: 400, easing: 'easeOutBack' });
    context.scheduler.enqueue({ targets: entryEl, color: successToken.color, emissiveColor: successToken.emissiveColor, emissiveIntensity: 0.9, duration: 350 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(350);

    context.scheduler.enqueue({ targets: [bucket, entryEl], color: HashMapVisualizer.ENTRY_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.enqueue({ targets: bucket.scale, x: 1, y: 1, z: 1, duration: 250 });
    context.scheduler.enqueue({ targets: bucket, color: HashMapVisualizer.BUCKET_COLOR, duration: 250 });
    context.scheduler.commitGroup(true);
  }

  private visualizeUpdate(context: AlgorithmContext, name: string, key: any, value: any): void {
    const entries = this.getEntries(context, name);
    const entry = entries.find((el: any) => el.key === key);
    if (!entry) return;

    const modifyingToken = getSemanticColorToken('MODIFYING');
    context.scheduler.enqueue({ targets: entry, color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
    context.scheduler.commitGroup(true);

    entry.value = value;
    entry.label = HashMapVisualizer.label(key, value);

    context.scheduler.enqueue({ targets: entry, color: HashMapVisualizer.ENTRY_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resize
  // ─────────────────────────────────────────────────────────────────────────

  /** Fades out the old bucket row and rebuilds every bucket + entry at the doubled capacity, then re-inserts the triggering key. */
  visualizeResize(context: AlgorithmContext, name: string, oldCapacity: number, newCapacity: number, hm: HashMap<any, any>, insertedKey?: unknown): void {
    const oldElements = [...this.getBuckets(context, name), ...this.getEntries(context, name)];
    // The old row stays on screen while it fades out, but is no longer the map.
    oldElements.forEach((el) => { el.pendingRemoval = true; });
    const errorToken = getSemanticColorToken('DISCARDED');
    oldElements.forEach((el) => {
      context.scheduler.enqueue({ targets: el, color: errorToken.color, emissiveColor: errorToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
    });
    context.scheduler.commitGroup(true);
    oldElements.forEach((el) => {
      context.scheduler.enqueue({ targets: el.scale, x: 0, y: 0, z: 0, duration: 300 });
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(300);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.clearScene(context, name);
      }
    });
    context.scheduler.commitGroup(true);

    const newBuckets = this.createBuckets(context, name, newCapacity);

    // Rehash: place every entry the map now holds (excluding the one still being inserted, if any) under its new bucket.
    const rehashed = hm.entries().filter(([k]) => k !== insertedKey);
    const perBucket = new Map<number, number>();
    rehashed.forEach(([k, v]) => {
      const idx = hm.hash(k);
      const chainIndex = perBucket.get(idx) ?? 0;
      perBucket.set(idx, chainIndex + 1);

      const bucket = newBuckets[idx];
      const entryEl: any = {
        id: `hashmap_entry_${name}_${k}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'box',
        originalType: 'HASHMAP_ENTRY',
        logicalParent: name,
        bucketIndex: idx,
        chainIndex,
        key: k,
        value: v,
        label: HashMapVisualizer.label(k, v),
        position: { x: bucket.position.x, y: bucket.position.y, z: bucket.position.z },
        scale: { x: 1, y: 1, z: 1 },
        color: HashMapVisualizer.ENTRY_COLOR,
        emissiveColor: HashMapVisualizer.NEUTRAL_EMISSIVE,
        emissiveIntensity: 0,
        visible: true,
        opacity: 1,
      };
      context.sceneManager.addElement(entryEl);
      this.placeEntry(context, bucket, entryEl, chainIndex);
      if (entryEl.worldTarget) {
        entryEl.position.x = entryEl.worldTarget.x;
        entryEl.position.y = entryEl.worldTarget.y;
        entryEl.position.z = entryEl.worldTarget.z;
      }
    });

    this.log(context, 'HASHMAP_RESIZE', `Rehashed ${rehashed.length} entr${rehashed.length === 1 ? 'y' : 'ies'} into ${newCapacity} buckets.`, 'result');

    if (insertedKey !== undefined) {
      const idx = hm.hash(insertedKey);
      const chainIndex = perBucket.get(idx) ?? 0;
      const value = hm.get(insertedKey);
      this.visualizeInsert(context, name, insertedKey, value, idx, chainIndex);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HASHMAP_LOOKUP
  // ─────────────────────────────────────────────────────────────────────────

  private hashMapLookup(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const key = instruction.args?.[1];
    if (!name || key === undefined) {
      this.log(context, 'ERROR', 'HASHMAP_LOOKUP requires a hash map name and a key.', 'warning');
      return;
    }

    const hm = this.reconstruct(context, name);
    // Keys keep their type: 7 and "7" are different keys (both hash alike).
    const keyStr: any = key;
    const hashIndex = hm.hash(keyStr);
    const found = hm.has(keyStr);
    const value = hm.get(keyStr);

    this.log(context, 'HASHMAP_LOOKUP', `hash("${keyStr}") = ${hashIndex}. Searching bucket ${hashIndex}...`, 'step');
    this.visualizeLookup(context, name, keyStr, hashIndex, found);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'HASHMAP_LOOKUP', found ? `Found "${keyStr}" -> ${value}` : `"${keyStr}" not found.`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  /** Walks the target bucket's chain entry by entry, highlighting each as it's compared, ending on a green hit or a red miss. */
  visualizeLookup(context: AlgorithmContext, name: string, key: any, hashIndex: number, found: boolean): void {
    const buckets = this.getBuckets(context, name);
    const bucket = buckets[hashIndex];
    if (!bucket) return;

    const traversingToken = getSemanticColorToken('TRAVERSING');
    context.scheduler.enqueue({ targets: bucket, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.8, duration: 250 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(250);

    const chain = this.getEntriesInBucket(context, name, hashIndex);
    const evaluatingToken = getSemanticColorToken('EVALUATING');
    const successToken = getSemanticColorToken('SUCCESS');
    const missToken = getSemanticColorToken('DISCARDED');

    for (const entry of chain) {
      AnticipationAnimation.applyAnticipation(context.scheduler, [entry], 'TRAVERSAL');
      const isMatch = entry.key === key;
      const token = isMatch ? successToken : evaluatingToken;
      context.scheduler.enqueue({ targets: entry, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: 0.9, duration: 250 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(250);

      if (!isMatch) {
        context.scheduler.enqueue({ targets: entry, color: HashMapVisualizer.ENTRY_COLOR, emissiveIntensity: 0, duration: 200 });
        context.scheduler.commitGroup(true);
      } else {
        break;
      }
    }

    if (!found) {
      context.scheduler.enqueue({ targets: bucket, color: missToken.color, emissiveColor: missToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(300);
    }

    context.scheduler.enqueue({ targets: bucket, color: HashMapVisualizer.BUCKET_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.commitGroup(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HASHMAP_DELETE
  // ─────────────────────────────────────────────────────────────────────────

  private hashMapDelete(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const key = instruction.args?.[1];
    if (!name || key === undefined) {
      this.log(context, 'ERROR', 'HASHMAP_DELETE requires a hash map name and a key.', 'warning');
      return;
    }

    const hm = this.reconstruct(context, name);
    // Keys keep their type: 7 and "7" are different keys (both hash alike).
    const keyStr: any = key;
    const hashIndex = hm.hash(keyStr);
    const existed = hm.has(keyStr);

    this.visualizeDelete(context, name, keyStr, hashIndex);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'HASHMAP_DELETE', existed ? `Deleted "${keyStr}".` : `"${keyStr}" not found; nothing deleted.`, 'result');
        if (context.stateManager) {
          context.stateManager.saveState(context.sceneManager.getSceneGraph(), `HashMap delete ${keyStr}`, context.scheduler.getCurrentTime());
          context.eventDispatcher.dispatch('STATE_UPDATED', context.stateManager.getCurrentState());
        }
      }
    });
    context.scheduler.commitGroup(true);
  }

  /** Highlights the target bucket/entry, fades the entry out, then closes the gap by shifting the rest of the chain up one slot. */
  visualizeDelete(context: AlgorithmContext, name: string, key: any, hashIndex: number): void {
    const buckets = this.getBuckets(context, name);
    const bucket = buckets[hashIndex];
    const chain = this.getEntriesInBucket(context, name, hashIndex);
    const target = chain.find((el: any) => el.key === key);

    if (bucket) {
      const traversingToken = getSemanticColorToken('TRAVERSING');
      context.scheduler.enqueue({ targets: bucket, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: 0.7, duration: 200 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(200);
    }

    if (!target) {
      const missToken = getSemanticColorToken('DISCARDED');
      if (bucket) {
        context.scheduler.enqueue({ targets: bucket, color: missToken.color, emissiveColor: missToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
        context.scheduler.commitGroup(true);
        context.scheduler.advanceCursor(300);
        context.scheduler.enqueue({ targets: bucket, color: HashMapVisualizer.BUCKET_COLOR, emissiveIntensity: 0, duration: 250 });
        context.scheduler.commitGroup(true);
      }
      return;
    }

    const discardedToken = getSemanticColorToken('DISCARDED');
    context.scheduler.enqueue({ targets: target, color: discardedToken.color, emissiveColor: discardedToken.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
    context.scheduler.enqueue({ targets: target.scale, x: 0, y: 0, z: 0, duration: 300 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(300);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.sceneManager.removeElement(target.id);
      }
    });
    context.scheduler.commitGroup(true);

    // Close the gap: entries after the deleted one shift up one chain slot.
    const remaining = chain.filter((el: any) => el.id !== target.id);
    remaining.forEach((el: any, i: number) => {
      if (el.chainIndex > target.chainIndex) {
        el.chainIndex = i;
        if (bucket) this.placeEntry(context, bucket, el, el.chainIndex);
        if (el.worldTarget) {
          context.scheduler.enqueue({ targets: el.position, x: el.worldTarget.x, y: el.worldTarget.y, z: el.worldTarget.z, duration: 300, easing: 'easeInOutSine' });
        }
      }
    });
    context.scheduler.commitGroup(true);

    if (bucket) {
      context.scheduler.enqueue({ targets: bucket, color: HashMapVisualizer.BUCKET_COLOR, emissiveIntensity: 0, duration: 250 });
      context.scheduler.commitGroup(true);
    }
  }

  private log(context: AlgorithmContext, keyword: string, message: string, kind: string = 'operation'): void {
    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        context.eventDispatcher.dispatch('RUNTIME_LOG', { keyword, message, kind, timestamp: Date.now() });
      }
    });
    context.scheduler.commitGroup(true);
  }
}
