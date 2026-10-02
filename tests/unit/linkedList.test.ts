/**
 * Unit tests for LinkedList (packages/runtime/src/data-structures/LinkedList.ts),
 * the pure layer behind LinkedListEngine's built-in operations: pointer-level
 * singly / doubly / circular lists that record one step per visible beat.
 * No runtime context — the scene-level behaviour of the same operations is
 * covered end to end by linkedListEngine.test.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  LinkedList,
  LINKED_LIST_STEP_PRIMITIVES,
  ListPositionError,
  ListVariant,
} from '../../packages/runtime/src/data-structures/LinkedList';
import { isPrimitive } from '../../packages/runtime/src/data-structures/steps';

/** A list holding `values`, with node ids n0, n1, ... wired the way `variant` wires them. */
function listOf(values: number[], variant: ListVariant = 'SINGLY'): LinkedList<number> {
  const list = new LinkedList<number>('list', variant);
  values.forEach((value, i) => {
    list.nodes.set(`n${i}`, {
      id: `n${i}`,
      value,
      next: i + 1 < values.length ? `n${i + 1}` : variant === 'CIRCULAR' ? 'n0' : null,
      prev: variant === 'DOUBLY' && i > 0 ? `n${i - 1}` : null,
    });
  });
  list.head = values.length ? 'n0' : null;
  return list;
}

const types = (list: LinkedList) => list.steps.map((s) => s.type);

describe('LinkedList', () => {
  for (const variant of ['SINGLY', 'DOUBLY', 'CIRCULAR'] as const) {
    it(`${variant}: every built-in matches a plain-array model`, () => {
      const list = listOf([4, 8, 15], variant);
      const model = [4, 8, 15];
      const check = () => expect(list.values()).toEqual(model);

      list.insertHead(1); model.unshift(1); check();
      list.insertTail(23); model.push(23); check();
      list.insertAt(2, 9); model.splice(2, 0, 9); check();
      list.updateAt(1, 5); model[1] = 5; check();
      list.deleteAt(3); model.splice(3, 1); check();
      list.reverse(); model.reverse(); check();
      list.deleteHead(); model.shift(); check();
      list.deleteTail(); model.pop(); check();
      list.deleteTail(); list.deleteTail(); list.deleteTail(); model.length = 0; check();
      list.insertTail(2); model.push(2); check();
    });
  }

  it('DOUBLY: prev pointers mirror next pointers after every operation', () => {
    const list = listOf([1, 2, 3], 'DOUBLY');
    const assertMirrored = () => {
      const ids = list.chain();
      ids.forEach((id, i) => expect(list.nodes.get(id)!.prev).toBe(i === 0 ? null : ids[i - 1]));
    };
    list.insertHead(0); assertMirrored();
    list.insertAt(2, 9); assertMirrored();
    list.deleteAt(1); assertMirrored();
    list.reverse(); assertMirrored();
    list.deleteHead(); assertMirrored();
  });

  it('CIRCULAR: the last node always points back to the head', () => {
    const list = listOf([1, 2, 3], 'CIRCULAR');
    const assertClosed = () => {
      const ids = list.chain();
      expect(list.nodes.get(ids[ids.length - 1])!.next).toBe(list.head);
    };
    list.insertHead(0); assertClosed();
    list.insertTail(4); assertClosed();
    list.deleteHead(); assertClosed();
    list.reverse(); assertClosed();
    expect(list.format()).toBe('4 -> 3 -> 2 -> 1 -> back to 4');
  });

  it('records a walk, an allocation and the pointer writes, then frees what it unlinked', () => {
    const list = listOf([4, 8, 15]);
    list.insertAt(2, 9);
    expect(types(list)).toEqual(['NOTE', 'VISIT', 'VISIT', 'CREATE', 'LINK', 'LINK', 'NOTE']);
    const create = list.steps[3] as any;
    expect(create.node).toBe('new:0');
    expect(list.steps[4]).toMatchObject({ type: 'LINK', writes: [{ node: 'new:0', field: 'next', to: 'n2' }] });
    expect(list.steps[5]).toMatchObject({ type: 'LINK', writes: [{ node: 'n1', field: 'next', to: 'new:0' }] });

    list.deleteAt(1);
    expect(types(list)).toEqual(['NOTE', 'VISIT', 'VISIT', 'UNLINK', 'FREE']);
    expect(list.steps[4]).toEqual({ type: 'FREE', node: 'n1', label: 'temp', temp: { prev: 'n0' } });
  });

  it('narrates each beat the way the program would be written', () => {
    const list = listOf([4, 8]);
    list.insertTail(23);
    const messages = list.steps.flatMap((s) => ('beat' in s ? s.beat.logs ?? [] : [])).map((l) => l.message);
    expect(messages).toEqual([
      'INSERT_TAIL list 23: walk to the last node (O(n) without a tail pointer)',
      'curr = list.head   ⟹   node 4',
      'curr = curr.next   ⟹   node 8',
      'newNode = NEW_NODE(list, 23)   ⟹   allocated in heap memory',
      'curr.next = newNode   ⟹   node 8 → node 23',
      'Inserted at tail. list: 4 -> 8 -> 23 -> NULL',
    ]);
  });

  it('search stops at the first match, or reports reaching NULL', () => {
    const list = listOf([3, 5, 5]);
    list.search(5);
    expect(types(list)).toEqual(['NOTE', 'COMPARE', 'COMPARE', 'NOTE']);
    list.search(9);
    expect(types(list)).toEqual(['NOTE', 'COMPARE', 'COMPARE', 'COMPARE', 'NOTE']);
  });

  it('operations on an empty or too-short list only narrate', () => {
    const empty = listOf([]);
    empty.deleteHead();
    expect(types(empty)).toEqual(['NOTE']);
    const one = listOf([1]);
    one.reverse();
    expect(types(one)).toEqual(['NOTE']);
  });

  it('rejects positions outside the list', () => {
    const list = listOf([1, 2]);
    expect(() => list.insertAt(3, 0)).toThrow(ListPositionError);
    expect(() => list.deleteAt(2)).toThrow("Cannot delete list[2]: valid positions are 0 to 1.");
    expect(() => listOf([]).deleteAt(0)).toThrow('Cannot delete list[0]: the list is empty.');
    expect(() => list.updateAt(-1, 0)).toThrow(ListPositionError);
  });

  it('every step type is an AQIR primitive', () => {
    for (const p of Object.values(LINKED_LIST_STEP_PRIMITIVES)) expect(isPrimitive(p)).toBe(true);
    expect(LINKED_LIST_STEP_PRIMITIVES.LINK).toEqual({ kind: 'RELATE', verb: 'link' });
    expect(LINKED_LIST_STEP_PRIMITIVES.FREE).toEqual({ kind: 'MUTATE', verb: 'destroy' });
  });
});
