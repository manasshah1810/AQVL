/**
 * HashMapEngine — Animation handler for hash map operations.
 *
 * Registered with AlgorithmRegistry for:
 *   HASHMAP_INIT, HASHMAP_INSERT, HASHMAP_LOOKUP, HASHMAP_DELETE
 *
 * Like HeapEngine, the scene graph is the source of truth: on every call the
 * current bucket count and stored entries are read back from HASHMAP_BUCKET /
 * HASHMAP_ENTRY scene objects into the pure HashMap
 * (../../data-structures/HashMap), the operation runs there (real
 * separate-chaining, real resize-at-load-factor-0.75, real rehashing), and
 * the steps it recorded are replayed onto the scene by `replaySteps`.
 * HashMapProgramEngine (maps used by real code) replays its steps the same way.
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
import { HashMap, HashMapStep } from '../../data-structures/HashMap';

const CHAIN_SPACING = 1.1;

export class HashMapEngine implements AlgorithmHandler {
  /** The statements registered with AlgorithmRegistry. */
  static readonly ALGORITHMS = ['HASHMAP_INIT', 'HASHMAP_INSERT', 'HASHMAP_LOOKUP', 'HASHMAP_DELETE'];

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

  /** Rebuilds a pure HashMap from the scene's current bucket count and stored entries, each chain in its drawn order. */
  private rehydrate(context: AlgorithmContext, name: string): HashMap<any, any> {
    const buckets = this.getBuckets(context, name);
    const capacity = buckets.length || HashMap.DEFAULT_CAPACITY;
    const hm = new HashMap<any, any>(capacity);
    // Insert directly into buckets (bypassing set()'s resize check) since we
    // already know this exact entry set fit at this exact capacity.
    this.getEntries(context, name)
      .sort((a: any, b: any) => a.bucketIndex - b.bucketIndex || a.chainIndex - b.chainIndex)
      .forEach((el: any) => {
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
        color: HashMapEngine.BUCKET_COLOR,
        emissiveColor: HashMapEngine.NEUTRAL_EMISSIVE,
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
  // HASHMAP_INSERT / HASHMAP_LOOKUP / HASHMAP_DELETE
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

    const hm = this.rehydrate(context, name);
    // Keys keep their type: 7 and "7" are different keys (both hash alike).
    const keyStr: any = key;
    const beforeCapacity = hm.capacity;
    const preHashIndex = hm.hash(keyStr);
    hm.set(keyStr, value);

    this.log(context, 'HASHMAP_INSERT', `hash("${keyStr}") = ${preHashIndex} (capacity ${beforeCapacity})`, 'step');
    if (hm.steps.some((step) => step.type === 'RESIZE')) {
      this.log(context, 'HASHMAP_RESIZE', `Load factor would exceed ${hm.loadFactor}. Resizing ${beforeCapacity} -> ${beforeCapacity * 2}...`, 'operation');
    }

    this.replaySteps(context, name, hm.steps);

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

  private hashMapLookup(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const key = instruction.args?.[1];
    if (!name || key === undefined) {
      this.log(context, 'ERROR', 'HASHMAP_LOOKUP requires a hash map name and a key.', 'warning');
      return;
    }

    const hm = this.rehydrate(context, name);
    // Keys keep their type: 7 and "7" are different keys (both hash alike).
    const keyStr: any = key;
    const value = hm.lookup(keyStr);
    const found = hm.steps.some((step) => step.type === 'COMPARE' && step.match);
    const hashIndex = hm.hash(keyStr);

    this.log(context, 'HASHMAP_LOOKUP', `hash("${keyStr}") = ${hashIndex}. Searching bucket ${hashIndex}...`, 'step');
    this.replaySteps(context, name, hm.steps);

    context.scheduler.enqueue({
      targets: {}, duration: 1, complete: () => {
        this.log(context, 'HASHMAP_LOOKUP', found ? `Found "${keyStr}" -> ${value}` : `"${keyStr}" not found.`, 'result');
      }
    });
    context.scheduler.commitGroup(true);
  }

  private hashMapDelete(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const name = instruction.args?.[0];
    const key = instruction.args?.[1];
    if (!name || key === undefined) {
      this.log(context, 'ERROR', 'HASHMAP_DELETE requires a hash map name and a key.', 'warning');
      return;
    }

    const hm = this.rehydrate(context, name);
    // Keys keep their type: 7 and "7" are different keys (both hash alike).
    const keyStr: any = key;
    const existed = hm.delete(keyStr);

    this.replaySteps(context, name, hm.steps);

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

  // ─────────────────────────────────────────────────────────────────────────
  // Replay
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Turns the steps a pure HashMap recorded into scheduler animation and
   * scene changes on the map `name`. Used for every operation, by this
   * engine and by HashMapProgramEngine.
   */
  replaySteps(context: AlgorithmContext, name: string, steps: HashMapStep<any, any>[]): void {
    for (const step of steps) {
      const bucket = 'bucket' in step ? this.getBuckets(context, name)[step.bucket] : undefined;
      switch (step.type) {
        case 'HASH':
          if (bucket) this.showBucket(context, bucket, step.op);
          break;
        case 'RESIZE':
          this.rebuild(context, name, step);
          break;
        case 'COLLISION':
          if (bucket) this.flashCollision(context, name, step.bucket, step.chainLength);
          break;
        case 'APPEND':
          if (bucket) this.appendEntry(context, name, bucket, step);
          break;
        case 'UPDATE':
          this.updateEntry(context, name, step.key, step.value);
          break;
        case 'COMPARE': {
          const entry = bucket ? this.getEntriesInBucket(context, name, step.bucket)[step.chainIndex] : undefined;
          if (entry) this.compareEntry(context, entry, step.match);
          break;
        }
        case 'MISS':
          if (bucket) {
            const missToken = getSemanticColorToken('DISCARDED');
            context.scheduler.enqueue({ targets: bucket, color: missToken.color, emissiveColor: missToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
            context.scheduler.commitGroup(true);
            context.scheduler.advanceCursor(300);
          }
          break;
        case 'REMOVE':
          this.removeEntry(context, name, bucket, step.key, step.bucket);
          break;
        case 'RELEASE':
          if (bucket) {
            context.scheduler.enqueue({ targets: bucket, color: HashMapEngine.BUCKET_COLOR, emissiveIntensity: 0, duration: 250 });
            context.scheduler.commitGroup(true);
          }
          break;
      }
    }
  }

  /** HASH: the bucket the key hashed to lights up — evaluated for an insert, walked for a lookup or delete. */
  private showBucket(context: AlgorithmContext, bucket: any, op: 'SET' | 'LOOKUP' | 'DELETE'): void {
    if (op === 'SET') {
      const evaluatingToken = getSemanticColorToken('EVALUATING');
      context.scheduler.enqueue({ targets: bucket, color: evaluatingToken.color, emissiveColor: evaluatingToken.emissiveColor, emissiveIntensity: 0.9, duration: 300 });
      context.scheduler.enqueue({ targets: bucket.scale, x: 1.2, y: 1.2, z: 1.2, duration: 300 });
      context.scheduler.commitGroup(true);
      context.scheduler.advanceCursor(300);
      return;
    }
    const traversingToken = getSemanticColorToken('TRAVERSING');
    const [intensity, duration] = op === 'LOOKUP' ? [0.8, 250] : [0.7, 200];
    context.scheduler.enqueue({ targets: bucket, color: traversingToken.color, emissiveColor: traversingToken.emissiveColor, emissiveIntensity: intensity, duration });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(duration);
  }

  /** COLLISION: every key already chained in the bucket flashes. */
  private flashCollision(context: AlgorithmContext, name: string, bucketIndex: number, collisions: number): void {
    const chain = this.getEntriesInBucket(context, name, bucketIndex);
    this.log(context, 'HASHMAP_COLLISION', `Collision at bucket ${bucketIndex}: ${collisions} existing key(s) chained here.`, 'step');
    const modifyingToken = getSemanticColorToken('MODIFYING');
    chain.forEach((existing) => {
      context.scheduler.enqueue({ targets: existing, color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.7, duration: 200 });
    });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(200);
    chain.forEach((existing) => {
      context.scheduler.enqueue({ targets: existing, color: HashMapEngine.ENTRY_COLOR, emissiveIntensity: 0, duration: 200 });
    });
    context.scheduler.commitGroup(true);
  }

  /** APPEND: the new entry drops in under its bucket at the end of the chain, then the bucket settles. */
  private appendEntry(context: AlgorithmContext, name: string, bucket: any, step: Extract<HashMapStep<any, any>, { type: 'APPEND' }>): void {
    const { key, value } = step;
    const entryEl: any = {
      id: `hashmap_entry_${name}_${typeof key}_${key}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'box',
      originalType: 'HASHMAP_ENTRY',
      logicalParent: name,
      bucketIndex: step.bucket,
      chainIndex: step.chainIndex,
      key,
      value,
      label: HashMapEngine.label(key, value),
      position: { x: bucket.position.x, y: bucket.position.y, z: bucket.position.z },
      scale: { x: 0, y: 0, z: 0 },
      color: HashMapEngine.ENTRY_COLOR,
      emissiveColor: HashMapEngine.NEUTRAL_EMISSIVE,
      emissiveIntensity: 0,
      visible: true,
      opacity: 1,
    };
    context.sceneManager.addElement(entryEl);
    this.placeEntry(context, bucket, entryEl, step.chainIndex);
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

    context.scheduler.enqueue({ targets: [bucket, entryEl], color: HashMapEngine.ENTRY_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.enqueue({ targets: bucket.scale, x: 1, y: 1, z: 1, duration: 250 });
    context.scheduler.enqueue({ targets: bucket, color: HashMapEngine.BUCKET_COLOR, duration: 250 });
    context.scheduler.commitGroup(true);
  }

  /** UPDATE: the entry flashes and takes its new value. */
  private updateEntry(context: AlgorithmContext, name: string, key: any, value: any): void {
    const entry = this.getEntries(context, name).find((el: any) => el.key === key);
    if (!entry) return;

    const modifyingToken = getSemanticColorToken('MODIFYING');
    context.scheduler.enqueue({ targets: entry, color: modifyingToken.color, emissiveColor: modifyingToken.emissiveColor, emissiveIntensity: 0.8, duration: 300 });
    context.scheduler.commitGroup(true);

    entry.value = value;
    entry.label = HashMapEngine.label(key, value);

    context.scheduler.enqueue({ targets: entry, color: HashMapEngine.ENTRY_COLOR, emissiveIntensity: 0, duration: 250 });
    context.scheduler.commitGroup(true);
  }

  /** COMPARE: a chain entry is compared with the key looked up — green on a hit, otherwise it settles back. */
  private compareEntry(context: AlgorithmContext, entry: any, match: boolean): void {
    const token = getSemanticColorToken(match ? 'SUCCESS' : 'EVALUATING');
    AnticipationAnimation.applyAnticipation(context.scheduler, [entry], 'TRAVERSAL');
    context.scheduler.enqueue({ targets: entry, color: token.color, emissiveColor: token.emissiveColor, emissiveIntensity: 0.9, duration: 250 });
    context.scheduler.commitGroup(true);
    context.scheduler.advanceCursor(250);
    if (!match) {
      context.scheduler.enqueue({ targets: entry, color: HashMapEngine.ENTRY_COLOR, emissiveIntensity: 0, duration: 200 });
      context.scheduler.commitGroup(true);
    }
  }

  /** REMOVE: the entry fades out, then the rest of its chain shifts up one slot to close the gap. */
  private removeEntry(context: AlgorithmContext, name: string, bucket: any, key: any, bucketIndex: number): void {
    const chain = this.getEntriesInBucket(context, name, bucketIndex);
    const target = chain.find((el: any) => el.key === key);
    if (!target) return;

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
  }

  /** RESIZE: the old bucket row fades out and every bucket + already-stored entry is rebuilt at the new capacity. */
  private rebuild(context: AlgorithmContext, name: string, step: Extract<HashMapStep<any, any>, { type: 'RESIZE' }>): void {
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

    const newBuckets = this.createBuckets(context, name, step.to);

    // Rehash: place every entry the map already held under its new bucket.
    step.entries.forEach(({ key: k, value: v, bucket: idx, chainIndex }) => {
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
        label: HashMapEngine.label(k, v),
        position: { x: bucket.position.x, y: bucket.position.y, z: bucket.position.z },
        scale: { x: 1, y: 1, z: 1 },
        color: HashMapEngine.ENTRY_COLOR,
        emissiveColor: HashMapEngine.NEUTRAL_EMISSIVE,
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

    const count = step.entries.length;
    this.log(context, 'HASHMAP_RESIZE', `Rehashed ${count} entr${count === 1 ? 'y' : 'ies'} into ${step.to} buckets.`, 'result');
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
