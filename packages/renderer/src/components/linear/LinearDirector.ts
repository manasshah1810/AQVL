/**
 * LinearDirector — turns a Stack / Queue / Linked List program's engine
 * events into what the linear visual family shows on top of the scene:
 *
 * - a ROLE per element (see linearStates.ts): the stack's top, the queue's
 *   front, the node a traversal pointer is on, what was just inserted, what
 *   is being removed;
 * - the ACTIVE END of each structure, marked in the scene and followed by the
 *   camera (LinearCameraChoreographer);
 * - one narrator line per operation, spoken while the character points AT
 *   the element the line is about ("this is what gets popped next").
 *
 * It only reads the scene snapshots and console lines the runtime already
 * produces (the runtime's TreeEngine / LinkedListEngine tag items TOP /
 * FRONT and nodes with their pointer variables), so nothing about how these
 * programs execute changes. Framework-agnostic (no React / three.js import),
 * like IterationDirector, so it's directly unit-testable.
 */
import type { CharacterEmotion } from '../character/CharacterController';
import type { LinearRole } from './linearStates';
import type { LinearSignificance } from './LinearCameraChoreographer';

export interface LinearEngineSource {
  eventDispatcher: {
    on(event: string, handler: (payload: any) => void): void;
    off(event: string, handler: (payload: any) => void): void;
  };
  /** The loaded scene, read on SCENE_LOADED as the baseline the first step is compared against. */
  stateManager?: { getCurrentState(): any };
}

export interface LinearNarrator {
  say(text: string, options?: { emotion?: CharacterEmotion; pointAt?: unknown; durationMs?: number }): void;
  clear(): void;
}

export interface LinearCamera {
  registerInstruction(instruction: {
    type: string;
    significance: LinearSignificance;
    participants: { x: number; y: number; z: number }[];
    durationMs?: number;
  }): void;
}

export type LinearKind = 'STACK' | 'QUEUE' | 'LIST';

/** Where the next operation happens on one structure. */
export interface LinearActiveEnd {
  structureId: string;
  kind: LinearKind;
  elementId: string;
  role: LinearRole;
  label: string;
}

export interface LinearOverlayState {
  /** element id -> role; elements not listed are 'default'. */
  roles: Record<string, LinearRole>;
  ends: LinearActiveEnd[];
}

/** What the character's `pointAt` carries: the scene element to gesture at. */
export interface ElementPointAt {
  elementId: string;
}

type Listener = (state: LinearOverlayState) => void;

interface Snapshot {
  byId: Map<string, any>;
  containers: { name: string; kind: 'STACK' | 'QUEUE'; items: any[] }[];
  lists: { name: string; anchor: any; nodes: any[] }[];
  /** pointer edge id (`node>next`) -> target id */
  pointers: Map<string, string>;
  /** pointer variable name -> node id it's on */
  vars: Map<string, string>;
}

/** Tags the runtime puts on nodes / items that are NOT pointer variables. */
const STRUCTURAL_TAGS = new Set(['HEAD', 'TAIL', 'LEAKED', 'TOP', 'FRONT', 'REAR', 'ROOT']);
const LINE_MS = 3200;

function show(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

function restingPosition(el: any): { x: number; y: number; z: number } | null {
  return el?.worldTarget ?? el?.position ?? null;
}

function takeSnapshot(state: any): Snapshot {
  const values: any[] = state?.elements ? Array.from(state.elements.values()) : [];
  const byId = new Map(values.map((el) => [el.id, el]));
  const containers = values
    .filter((el) => el.originalType === 'CONTAINER' && (el.kind === 'STACK' || el.kind === 'QUEUE'))
    .map((anchor) => ({
      name: anchor.logicalParent as string,
      kind: anchor.kind as 'STACK' | 'QUEUE',
      items: values
        .filter((el) => el.originalType === 'CONTAINER_ITEM' && el.logicalParent === anchor.logicalParent)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }));
  const lists = values
    .filter((el) => el.originalType === 'LINKEDLIST')
    .map((anchor) => ({
      name: anchor.logicalParent as string,
      anchor,
      nodes: values.filter((el) => el.originalType === 'LINKEDLIST_NODE' && el.logicalParent === anchor.logicalParent),
    }));
  const pointers = new Map<string, string>();
  const vars = new Map<string, string>();
  for (const list of lists) {
    for (const node of list.nodes) {
      for (const tag of node.tags ?? []) if (!STRUCTURAL_TAGS.has(tag)) vars.set(tag, node.id);
    }
  }
  for (const el of values) {
    if (el.type === 'edge' && (el.pointer === 'next' || el.pointer === 'prev') && byId.get(el.sourceId)?.originalType === 'LINKEDLIST_NODE') {
      pointers.set(el.id, el.targetId);
    }
  }
  return { byId, containers, lists, pointers, vars };
}

const EMPTY: Snapshot = { byId: new Map(), containers: [], lists: [], pointers: new Map(), vars: new Map() };

export class LinearDirector {
  private listeners: Listener[] = [];
  private overlay: LinearOverlayState = { roles: {}, ends: [] };
  private prev: Snapshot = EMPTY;
  private now: Snapshot = EMPTY;
  private hasScene = false;
  /** Counts operations (console lines like PUSH / POINTER); an element keeps its 'inserted' look until the next one. */
  private opSerial = 0;
  private opSinceState = false;
  private insertedAt = new Map<string, number>();
  private removing = new Set<string>();
  /** The pointer variable that moved last — its node is the list's current node. */
  private lastMovedVar: string | null = null;

  private onState = (state: any) => this.handleState(state);
  private onLog = (entry: any) => this.handleLog(entry);
  private onLoaded = () => {
    this.reset();
    const loaded = this.engine.stateManager?.getCurrentState();
    if (loaded) {
      this.now = takeSnapshot(loaded);
      this.hasScene = true;
    }
  };

  constructor(
    private readonly engine: LinearEngineSource,
    private readonly narrator?: LinearNarrator,
    private readonly camera?: LinearCamera
  ) {
    engine.eventDispatcher.on('STATE_UPDATED', this.onState);
    engine.eventDispatcher.on('RUNTIME_LOG', this.onLog);
    engine.eventDispatcher.on('SCENE_LOADED', this.onLoaded);
  }

  dispose(): void {
    this.engine.eventDispatcher.off('STATE_UPDATED', this.onState);
    this.engine.eventDispatcher.off('RUNTIME_LOG', this.onLog);
    this.engine.eventDispatcher.off('SCENE_LOADED', this.onLoaded);
    this.listeners = [];
  }

  getOverlay(): LinearOverlayState {
    return this.overlay;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.overlay);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private reset(): void {
    this.prev = EMPTY;
    this.now = EMPTY;
    this.hasScene = false;
    this.opSerial = 0;
    this.opSinceState = false;
    this.insertedAt.clear();
    this.removing.clear();
    this.lastMovedVar = null;
    this.publish({ roles: {}, ends: [] });
  }

  // ---------------------------------------------------------------------
  // Scene snapshots -> roles and active ends
  // ---------------------------------------------------------------------

  private handleState(state: any): void {
    this.prev = this.now;
    this.now = takeSnapshot(state);
    const first = !this.hasScene;
    this.hasScene = true;

    if (this.opSinceState) {
      this.opSerial++;
      this.opSinceState = false;
    }
    for (const id of this.now.byId.keys()) {
      const el = this.now.byId.get(id);
      const isMember = el.originalType === 'CONTAINER_ITEM' || el.originalType === 'LINKEDLIST_NODE';
      if (isMember && !this.prev.byId.has(id) && !first) this.insertedAt.set(id, this.opSerial);
    }
    for (const [name, node] of this.now.vars) {
      if (this.prev.vars.get(name) !== node) this.lastMovedVar = name;
    }
    if (this.lastMovedVar && !this.now.vars.has(this.lastMovedVar)) this.lastMovedVar = null;

    // Items a POP / DEQUEUE / CLEAR is taking out: marked MODIFYING while still in place.
    for (const c of this.now.containers) {
      for (const item of c.items) {
        if (item.state === 'MODIFYING' && this.prev.byId.has(item.id)) this.removing.add(item.id);
      }
    }
    for (const id of [...this.removing]) if (!this.now.byId.has(id)) this.removing.delete(id);
    for (const id of [...this.insertedAt.keys()]) if (!this.now.byId.has(id)) this.insertedAt.delete(id);

    this.publish(this.computeOverlay());
  }

  private isInserted(id: string): boolean {
    return this.insertedAt.get(id) === this.opSerial;
  }

  private computeOverlay(): LinearOverlayState {
    const roles: Record<string, LinearRole> = {};
    const ends: LinearActiveEnd[] = [];
    for (const c of this.now.containers) {
      const end = c.kind === 'STACK' ? c.items[c.items.length - 1] : c.items[0];
      if (!end) continue;
      const role: LinearRole = c.kind === 'STACK' ? 'top' : 'front';
      roles[end.id] = role;
      ends.push({
        structureId: c.name,
        kind: c.kind,
        elementId: end.id,
        role,
        label: c.kind === 'STACK' ? 'next POP' : 'next out',
      });
    }
    const currentVar = this.lastMovedVar;
    const currentNode = currentVar ? this.now.vars.get(currentVar) : undefined;
    if (currentVar && currentNode) {
      const node = this.now.byId.get(currentNode);
      roles[currentNode] = 'current';
      ends.push({ structureId: node.logicalParent, kind: 'LIST', elementId: currentNode, role: 'current', label: `${currentVar} is here` });
    }
    for (const id of this.insertedAt.keys()) if (this.isInserted(id)) roles[id] = 'inserted';
    for (const id of this.removing) roles[id] = 'removed';
    return { roles, ends };
  }

  private publish(state: LinearOverlayState): void {
    this.overlay = state;
    this.listeners.forEach((l) => l(state));
  }

  // ---------------------------------------------------------------------
  // Console lines -> narration and camera
  // ---------------------------------------------------------------------

  private handleLog(entry: any): void {
    const keyword = String(entry?.keyword ?? '').toUpperCase();
    const source = String(entry?.message ?? '').split('⟹')[0].trim();
    if (keyword !== 'PRINT') this.opSinceState = true;
    switch (keyword) {
      case 'PUSH':
      case 'ENQUEUE':
        return this.narrateAdd(keyword);
      case 'POP':
      case 'DEQUEUE':
        return this.narrateTake(keyword);
      case 'PEEK':
      case 'FRONT':
      case 'REAR':
        return this.narratePeek(keyword);
      case 'POINTER':
        return this.narratePointer(source);
      case 'NEW_NODE':
        return this.narrateNewNode();
      case 'FREE':
        return this.narrateFree();
      default:
        return;
    }
  }

  private say(text: string, elementId: string | null, emotion: CharacterEmotion, type: string, significance: LinearSignificance): void {
    const pointAt: ElementPointAt | undefined = elementId ? { elementId } : undefined;
    this.narrator?.say(text, { emotion, pointAt, durationMs: LINE_MS });
    const at = elementId ? restingPosition(this.now.byId.get(elementId)) : null;
    if (at) this.camera?.registerInstruction({ type, significance, participants: [at], durationMs: 700 });
  }

  private narrateAdd(op: 'PUSH' | 'ENQUEUE'): void {
    const kind = op === 'PUSH' ? 'STACK' : 'QUEUE';
    for (const c of this.now.containers) {
      if (c.kind !== kind) continue;
      const added = c.items.find((it) => !this.prev.byId.has(it.id));
      if (!added) continue;
      if (kind === 'STACK') {
        this.say(`${show(added.value)} lands on top of ${c.name}. It's the top now: the next POP takes it.`, added.id, 'pointing', op, 'operation');
      } else {
        const front = c.items[0];
        const text =
          front.id === added.id
            ? `${show(added.value)} joins ${c.name}. It's the only one in line, so it's also the front: next out.`
            : `${show(added.value)} joins the rear of ${c.name}. ${show(front.value)} is still at the front: it leaves first.`;
        this.say(text, front.id, 'pointing', op, 'operation');
      }
      return;
    }
  }

  private narrateTake(op: 'POP' | 'DEQUEUE'): void {
    for (const c of this.now.containers) {
      const leaving = c.items.find((it) => this.removing.has(it.id));
      if (!leaving) continue;
      const rest = c.items.filter((it) => it.id !== leaving.id);
      const next = c.kind === 'STACK' ? rest[rest.length - 1] : rest[0];
      const took = c.kind === 'STACK' ? `POP takes ${show(leaving.value)} off the top of ${c.name}.` : `${show(leaving.value)} leaves from the front of ${c.name}.`;
      const after = !next
        ? ` ${c.name} is empty now.`
        : c.kind === 'STACK'
          ? ` Now ${show(next.value)} is on top: this is what gets popped next.`
          : ` ${show(next.value)} moves up to the front: it's next out.`;
      this.say(took + after, next ? next.id : leaving.id, next ? 'pointing' : 'thinking', op, 'pivotal');
      return;
    }
  }

  private narratePeek(op: 'PEEK' | 'FRONT' | 'REAR'): void {
    for (const c of this.now.containers) {
      const read = c.items.find((it) => it.state === 'EVALUATING');
      if (!read) continue;
      const text =
        op === 'PEEK'
          ? `PEEK reads ${show(read.value)} on top without removing it. It's still what gets popped next.`
          : op === 'FRONT'
            ? `FRONT reads ${show(read.value)}: first in line, and the next to leave.`
            : `REAR reads ${show(read.value)}: the last one in line.`;
      this.say(text, read.id, 'thinking', op, 'operation');
      return;
    }
  }

  private narratePointer(source: string): void {
    // A pointer field rewritten (`prev.next = temp.next`): the arrow itself changes.
    for (const [edgeId, target] of this.now.pointers) {
      const before = this.prev.pointers.get(edgeId);
      if (before === target) continue;
      const [nodeId, field] = edgeId.split('>');
      const node = this.now.byId.get(nodeId);
      const to = this.now.byId.get(target);
      const was = before ? this.now.byId.get(before) ?? this.prev.byId.get(before) : null;
      const text = was
        ? `${source}: node ${show(node?.value)}'s ${field} now points to ${show(to?.value)} instead of ${show(was.value)}.`
        : `${source}: node ${show(node?.value)}'s ${field} now points to ${show(to?.value)}.`;
      this.say(text, nodeId, 'pointing', 'RELINK', 'operation');
      return;
    }
    for (const [edgeId, before] of this.prev.pointers) {
      if (this.now.pointers.has(edgeId)) continue;
      const [nodeId, field] = edgeId.split('>');
      if (!this.now.byId.has(nodeId)) continue;
      const was = this.now.byId.get(before) ?? this.prev.byId.get(before);
      this.say(`${source}: node ${show(this.now.byId.get(nodeId).value)}'s ${field} no longer points to ${show(was?.value)}: it's NULL.`, nodeId, 'pointing', 'RELINK', 'operation');
      return;
    }
    // The list's head moved.
    for (const list of this.now.lists) {
      const before = this.prev.lists.find((l) => l.name === list.name)?.anchor.headId;
      if (before === list.anchor.headId) continue;
      const head = list.anchor.headId ? this.now.byId.get(list.anchor.headId) : null;
      this.say(
        head ? `${source}: ${list.name}.head now points to node ${show(head.value)}. The list starts there.` : `${source}: ${list.name}.head is NULL: the list is empty.`,
        head ? head.id : null,
        'pointing',
        'HEAD',
        'operation'
      );
      return;
    }
    // A pointer variable stepped.
    for (const [name, nodeId] of this.now.vars) {
      if (this.prev.vars.get(name) === nodeId) continue;
      const node = this.now.byId.get(nodeId);
      this.say(`${source}: ${name} is on node ${show(node.value)} now.`, nodeId, 'pointing', 'TRAVERSE', 'step');
      return;
    }
    for (const [name, was] of this.prev.vars) {
      if (this.now.vars.has(name) || !this.now.byId.has(was)) continue;
      this.say(`${source}: ${name} is NULL — it walked past the last node.`, was, 'thinking', 'TRAVERSE', 'step');
      return;
    }
  }

  private narrateNewNode(): void {
    for (const list of this.now.lists) {
      const node = list.nodes.find((n) => !this.prev.byId.has(n.id));
      if (!node) continue;
      this.say(`NEW_NODE: node ${show(node.value)} is allocated in heap memory. Nothing points to it yet.`, node.id, 'pointing', 'NEW_NODE', 'operation');
      return;
    }
  }

  private narrateFree(): void {
    for (const list of this.now.lists) {
      const node = list.nodes.find((n) => n.state === 'MODIFYING');
      if (!node) continue;
      this.removing.add(node.id);
      this.publish(this.computeOverlay());
      this.say(`FREE releases node ${show(node.value)}'s memory.`, node.id, 'pointing', 'FREE', 'operation');
      return;
    }
  }
}
