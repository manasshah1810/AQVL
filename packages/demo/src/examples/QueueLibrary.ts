export const QueueScripts = {
  QueueFoundation: `SCENE QueueFoundation

DECLARE
  QUEUE q = [1, 2, 3]

SEQUENCE
  // 1. Enqueue adds to the rear
  ENQUEUE q 4
  WAIT

  // 2. Front / Rear inspection
  FRONT q
  REAR q
  WAIT

  // 3. Dequeue removes from the front (FIFO order)
  DEQUEUE q
  WAIT

  FRONT q
END
`,

  CircularQueueSimulation: `SCENE CircularQueueSimulation

DECLARE
  QUEUE ring = [10, 20, 30]

SEQUENCE
  // A circular queue reuses freed slots at the front as new
  // items are enqueued at the rear, instead of shifting memory.

  DEQUEUE ring
  WAIT

  ENQUEUE ring 40
  WAIT

  DEQUEUE ring
  WAIT

  ENQUEUE ring 50
  WAIT

  FRONT ring
  REAR ring
END
`,

  GenerateBinaryNumbers: `SCENE GenerateBinaryNumbers

DECLARE
  QUEUE binaries = [1]

SEQUENCE
  // Classic BFS-with-a-queue trick: dequeue "n", generate "n0"
  // and "n1" by enqueuing, and repeat to produce 1, 10, 11, 100, ...

  FRONT binaries
  DEQUEUE binaries
  ENQUEUE binaries 10
  ENQUEUE binaries 11
  WAIT

  FRONT binaries
  DEQUEUE binaries
  ENQUEUE binaries 100
  ENQUEUE binaries 101
  WAIT

  FRONT binaries
  DEQUEUE binaries
  ENQUEUE binaries 110
  ENQUEUE binaries 111
  WAIT
END
`,

  ReverseQueueWithStack: `SCENE ReverseQueueWithStack

DECLARE
  QUEUE q = [1, 2, 3, 4]
  STACK helper = []

SEQUENCE
  // Move every element from the queue onto a stack...
  FRONT q
  PUSH helper 1
  DEQUEUE q
  WAIT

  FRONT q
  PUSH helper 2
  DEQUEUE q
  WAIT

  FRONT q
  PUSH helper 3
  DEQUEUE q
  WAIT

  FRONT q
  PUSH helper 4
  DEQUEUE q
  WAIT

  // ...then pop the stack back into the queue, reversing the order: 4, 3, 2, 1
  PEEK helper
  ENQUEUE q 4
  POP helper
  WAIT

  PEEK helper
  ENQUEUE q 3
  POP helper
  WAIT

  PEEK helper
  ENQUEUE q 2
  POP helper
  WAIT

  PEEK helper
  ENQUEUE q 1
  POP helper
  WAIT
END
`,

  RoundRobinScheduling: `SCENE RoundRobinScheduling

DECLARE
  QUEUE processes = [1, 2, 3]

SEQUENCE
  // Each process gets one time slice at the front, then is
  // sent back to the rear of the queue if it isn't finished.

  FRONT processes
  DEQUEUE processes
  ENQUEUE processes 1
  WAIT

  FRONT processes
  DEQUEUE processes
  ENQUEUE processes 2
  WAIT

  FRONT processes
  DEQUEUE processes
  // Process 3 finishes this slice and is not re-enqueued
  WAIT
END
`,

  QueueUsingTwoStacks: `SCENE QueueUsingTwoStacks

DECLARE
  STACK inStack = []
  STACK outStack = []

SEQUENCE
  // Enqueue: always push onto inStack
  PUSH inStack 1
  PUSH inStack 2
  PUSH inStack 3
  WAIT

  // Dequeue: if outStack is empty, drain inStack into it
  // (reversing the order), then pop from outStack
  PEEK inStack
  POP inStack
  PUSH outStack 1
  WAIT

  PEEK inStack
  POP inStack
  PUSH outStack 2
  WAIT

  PEEK inStack
  POP inStack
  PUSH outStack 3
  WAIT

  // outStack now pops in the original FIFO order: 1, 2, 3
  PEEK outStack
  POP outStack
END
`
};
