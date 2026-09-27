/**
 * The Stacks / Queues / Linked Lists visual family's LinearDirector, run
 * against real examples (compile -> ExecutionEngine, headless): what the
 * character says, and which element it points at, for each operation.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../packages/compiler/src';
import { ExecutionEngine } from '../../packages/runtime/src';
import { LinearDirector } from '../../packages/renderer/src/components/linear/LinearDirector';
import { LinkedListScripts } from '../../packages/demo/src/examples/LinkedListLibrary';
import { StackScripts } from '../../packages/demo/src/examples/StackLibrary';
import { QueueScripts } from '../../packages/demo/src/examples/QueueLibrary';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

async function narrate(source: string) {
  const engine = new ExecutionEngine({ headless: true });
  const lines: { text: string; at?: string }[] = [];
  new LinearDirector(engine as any, { say: (text, o: any) => lines.push({ text, at: o?.pointAt?.elementId }), clear() {} });
  engine.loadProgram(compile(source) as any);
  await engine.execute();
  return lines;
}

describe('LinearDirector on real examples', () => {
  it('Stack: PUSH lands on top, POP points at what gets popped next', async () => {
    const lines = await narrate(StackScripts.StackFoundation);
    expect(lines.map((l) => l.text)).toEqual(expect.arrayContaining([
      "40 lands on top of plates. It's the top now: the next POP takes it.",
      'POP takes 40 off the top of plates. Now 30 is on top: this is what gets popped next.',
      'POP takes 10 off the top of plates. plates is empty now.',
    ]));
    expect(lines.find((l) => l.text.startsWith('POP takes 40'))!.at).toBe('ctr:plates:2');
  });

  it('Queue: ENQUEUE and DEQUEUE point at the front', async () => {
    const lines = await narrate(QueueScripts.QueueFoundation);
    expect(lines.find((l) => l.text.startsWith('20 joins the rear'))!.at).toBe('ctr:ticketLine:0');
    expect(lines.find((l) => l.text.startsWith('10 leaves from the front'))).toEqual({
      text: "10 leaves from the front of ticketLine. 20 moves up to the front: it's next out.",
      at: 'ctr:ticketLine:1',
    });
  });

  it('Linked list: traversal steps and a reassigned pointer', async () => {
    const lines = await narrate(LinkedListScripts.SinglyLinkedList);
    expect(lines[0]).toEqual({ text: 'curr = list.head: curr is on node 10 now.', at: 'll:list:0' });
    expect(lines.map((l) => l.text)).toContain("prev.next = temp.next: node 20's next now points to 40 instead of 30.");
    const reversed = await narrate(LinkedListScripts.ReverseSinglyLinkedList);
    expect(reversed.map((l) => l.text)).toContain("curr.next = prev: node 2's next now points to 1 instead of 3.");
  });
});
