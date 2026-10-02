/**
 * LinkedListEngine — animation handler for the built-in linked-list
 * operations: INSERT_HEAD, INSERT_TAIL, DELETE_HEAD, DELETE_TAIL, REVERSE,
 * SEARCH and INSERT / DELETE / UPDATE list[i], plus SWAP of two list nodes.
 *
 * Every operation runs on the pure LinkedList
 * (../../data-structures/LinkedList.ts), rehydrated from the list's scene
 * (its anchor, node spheres and pointer edges), and the steps it records are
 * replayed one beat each: CREATE allocates the node, LINK / UNLINK write the
 * pointers, SET writes a value, FREE releases a node, and every step's beat
 * (highlights, pointer-variable tags, console line) is committed through
 * LinkedListProgramEngine's scene primitives — the same ones a program's own
 * pointer code (`curr = curr.next`, `prev.next = ...`, NEW_NODE, FREE) uses,
 * so a built-in looks exactly like the code it stands for.
 *
 * Not registered with AlgorithmRegistry: INSERT / DELETE / UPDATE / SEARCH
 * are shared with arrays and trees, so AnimationController routes here every
 * GENERIC_ACTION whose payload names a linked list.
 */
import { AlgorithmContext, AlgorithmHandler } from './AlgorithmContext';
import { GenericActionInstruction, getSemanticColorToken } from '@aqvl/shared';
import { LinkedList, LinkedListStep, ListBeat, ListPositionError, ListRef } from '../../data-structures/LinkedList';
import { FrameOptions, LinkedListContext, LinkedListError, LinkedListProgramEngine } from './LinkedListProgramEngine';

const program = new LinkedListProgramEngine();

/** `{ k: v }` -> `{ key(k): value(v) }`, in the same key order. */
function remap<V, W>(o: Record<string, V>, key: (k: string) => string, value: (v: V) => W): Record<string, W> {
  const out: Record<string, W> = {};
  for (const k of Object.keys(o)) out[key(k)] = value(o[k]);
  return out;
}

/** Without a running program (no VM): operands are taken as they are, and no pointer variables are in scope. */
function withHost(context: AlgorithmContext): LinkedListContext {
  if ((context as LinkedListContext).host) return context as LinkedListContext;
  return { ...context, host: { evaluate: (expr) => expr, setVariable: () => {}, visibleVariables: () => ({}) } };
}

export class LinkedListEngine implements AlgorithmHandler {
  /** @throws LinkedListError for an operation lists do not support, or a position outside the list. */
  execute(context: AlgorithmContext, instruction: GenericActionInstruction): void {
    const ctx = withHost(context);
    const action = instruction.actionName.toUpperCase();
    const name = String((instruction as any).payload?.logicalParent);
    const index: number | undefined = (instruction as any).payload?.logicalIndex;
    const args = instruction.args ?? [];
    const valueArg = () => ctx.host.evaluate(args[args.length - 1]);

    const list = this.rehydrate(ctx, name);
    try {
      switch (action) {
        case 'INSERT_HEAD': list.insertHead(valueArg()); break;
        case 'INSERT_TAIL': list.insertTail(valueArg()); break;
        case 'DELETE_HEAD': list.deleteHead(); break;
        case 'DELETE_TAIL': list.deleteTail(); break;
        case 'REVERSE': list.reverse(); break;
        case 'SEARCH': list.search(valueArg()); break;
        case 'INSERT':
          if (index === undefined) throw new LinkedListError(`INSERT on a linked list needs a position, e.g. INSERT ${name}[2] 25.`);
          list.insertAt(index, valueArg());
          break;
        case 'DELETE':
          if (index === undefined) throw new LinkedListError(`DELETE on a linked list needs a position, e.g. DELETE ${name}[2].`);
          list.deleteAt(index);
          break;
        case 'UPDATE':
          if (index === undefined) throw new LinkedListError(`UPDATE on a linked list needs a position, e.g. UPDATE ${name}[2] 25.`);
          list.updateAt(index, valueArg());
          break;
        default:
          throw new LinkedListError(
            `${action} is not a linked-list operation. Linked lists support INSERT_HEAD, INSERT_TAIL, DELETE_HEAD, DELETE_TAIL, REVERSE, SEARCH, INSERT/DELETE/UPDATE ${name}[i], and pointer code (curr = curr.next, prev.next = ..., NEW_NODE, FREE).`
          );
      }
    } catch (e) {
      if (e instanceof ListPositionError) throw new LinkedListError(e.message);
      throw e;
    }
    this.replaySteps(ctx, name, list.steps);
  }

  /** The pure list as the scene holds it now: the nodes reachable from the head, with their pointers. */
  private rehydrate(ctx: LinkedListContext, name: string): LinkedList {
    const anchor = program.anchor(ctx, name);
    const list = new LinkedList(name, anchor?.variant ?? 'SINGLY');
    for (const id of program.chain(ctx, name)) {
      list.nodes.set(id, {
        id,
        value: program.node(ctx, id).value,
        next: program.pointerOf(ctx, id, 'next'),
        prev: program.pointerOf(ctx, id, 'prev'),
      });
    }
    list.head = anchor?.headId ?? null;
    return list;
  }

  /**
   * Replays one operation's steps: each step's effects (allocation, pointer
   * writes, head, value) are applied to the scene, then its beat is
   * committed. Nodes the operation allocated are bound to their scene ids.
   */
  private replaySteps(ctx: LinkedListContext, name: string, steps: LinkedListStep[]): void {
    const ids = new Map<ListRef, string>();
    const ref = (r: ListRef | null): string | null => (r === null ? null : ids.get(r) ?? r);

    for (const step of steps) {
      if (step.type === 'FREE') {
        program.freeNode(ctx, ref(step.node)!, step.label, this.temp(step.temp, ref));
        continue;
      }
      if (step.type === 'CREATE') ids.set(step.node, program.createNode(ctx, name, step.value));
      if (step.type === 'VISIT' || step.type === 'LINK' || step.type === 'UNLINK') {
        for (const w of step.writes ?? []) program.setPointer(ctx, ref(w.node)!, w.field, ref(w.to));
        if (step.head) program.anchor(ctx, name).headId = ref(step.head.to);
      }
      if (step.type === 'SET') program.node(ctx, ref(step.node)).value = step.value;
      program.frame(ctx, this.frameOf(step.beat, ref));
    }
  }

  /** A recorded beat, with the nodes it names bound to scene ids. */
  private frameOf(beat: ListBeat, ref: (r: ListRef | null) => string | null): FrameOptions {
    const frame: FrameOptions = {};
    if (beat.logs) frame.logs = beat.logs as FrameOptions['logs'];
    if (beat.nodes) frame.nodes = remap(beat.nodes, (id) => ref(id)!, (state) => state);
    if (beat.edges) {
      frame.edges = remap(beat.edges, (key) => {
        const at = key.lastIndexOf('>');
        return `${ref(key.slice(0, at))}>${key.slice(at + 1)}`;
      }, (state) => state);
    }
    if (beat.temp) frame.temp = this.temp(beat.temp, ref);
    if (beat.grow) frame.grow = beat.grow.map((id) => ref(id)!);
    if (beat.bypassed) frame.bypassed = beat.bypassed.map((id) => ref(id)!);
    return frame;
  }

  private temp(temp: Record<string, ListRef | null>, ref: (r: ListRef | null) => string | null): Record<string, string | null> {
    return remap(temp, (name) => name, (id) => ref(id));
  }

  /** SWAP of two list nodes (MUTATE exchange): nodes have no slots to trade, so they exchange values. */
  swapValues(ctx: AlgorithmContext, leftEl: any, rightEl: any): void {
    const token = getSemanticColorToken('MODIFYING');
    for (const el of [leftEl, rightEl]) {
      el.isHighlighted = true;
      el.state = 'MODIFYING';
      el.color = token.color;
      el.emissiveColor = token.emissiveColor;
      el.emissiveIntensity = token.emissiveIntensity;
    }
    const [a, b] = [leftEl.value, rightEl.value];
    leftEl.value = b;
    rightEl.value = a;
    ctx.scheduler.enqueue({ targets: [leftEl.position, rightEl.position], y: '+=0.6', duration: 300, easing: 'easeOutExpo' });
    ctx.scheduler.commitGroup(true);
    ctx.scheduler.enqueue({ targets: [leftEl.position, rightEl.position], y: '-=0.6', duration: 300, easing: 'easeInQuad' });
    ctx.scheduler.commitGroup(true);
    ctx.scheduler.enqueue({
      targets: {},
      duration: 1,
      complete: () => {
        ctx.stateManager!.saveState(ctx.sceneManager.getSceneGraph(), `Swapped values ${a} and ${b}`, ctx.scheduler.getCurrentTime());
        ctx.eventDispatcher.dispatch('STATE_UPDATED', ctx.stateManager!.getCurrentState());
        ctx.eventDispatcher.dispatch('RUNTIME_LOG', {
          keyword: 'SWAP',
          message: `Swapped node values ${a} ↔ ${b}`,
          kind: 'swap',
          timestamp: Date.now(),
        });
      },
    });
    ctx.scheduler.commitSequential();
  }
}
