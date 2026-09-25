/**
 * Queue examples. Every one is written the way it would be in C / Java /
 * Python: a loop walks the input, IFs decide, and the queue is used only
 * through its real operations —
 *
 *   ENQUEUE q value     add a value at the REAR (the back of the line)
 *   x = DEQUEUE(q)      remove the value at the FRONT and keep it in x
 *   x = FRONT(q)        read the front value without removing it
 *   x = REAR(q)         read the rear value (the newest one) without removing it
 *   IS_EMPTY(q)         is the queue empty?
 *   LENGTH(q)           how many values are waiting in the queue?
 *
 * Nothing is scripted: change the input arrays in DECLARE and every example
 * still gives the right answer. Each ENQUEUE / DEQUEUE / FRONT / REAR is its
 * own animated step, and the console shows the queue (front → rear) after
 * every change.
 */
export const QueueScripts = {
  QueueFoundation: `SCENE QueueFoundation
// A queue is like the line at a ticket window: people JOIN at the REAR
// (ENQUEUE) and are SERVED from the FRONT (DEQUEUE).
// First In, First Out (FIFO): whoever came first is served first.

DECLARE
  QUEUE ticketLine = []
  ARRAY arriving = [10, 20, 30, 40]

SEQUENCE
  // 1. ENQUEUE every value, one at a time, at the rear of the queue
  LOOP i FROM 0 TO LENGTH(arriving) - 1
    value = arriving[i]
    ENQUEUE ticketLine value
    PRINT "Enqueued" value "- size is now" LENGTH(ticketLine)
  END

  // 2. FRONT and REAR: look at both ends WITHOUT removing anything
  firstValue = FRONT(ticketLine)
  lastValue = REAR(ticketLine)
  PRINT "Front:" firstValue "- Rear:" lastValue "- size is still" LENGTH(ticketLine)

  // 3. DEQUEUE until the queue is empty: values come out in the SAME order they went in
  WHILE LENGTH(ticketLine) > 0
    removed = DEQUEUE(ticketLine)
    PRINT "Dequeued" removed "- size is now" LENGTH(ticketLine)
  END

  // 4. A safe DEQUEUE always checks IS_EMPTY first.
  //    Dequeuing an empty queue is an error called QUEUE UNDERFLOW.
  IF IS_EMPTY(ticketLine)
    PRINT "The queue is empty: dequeuing now would be a QUEUE UNDERFLOW, so we stop."
  ELSE
    removed = DEQUEUE(ticketLine)
  END
END
`,

  QueueUsingArray: `SCENE QueueUsingArray
// How a simple (linear) queue is built inside a computer: a fixed-size
// array plus two integers.
//   front = index of the element that will be dequeued next
//   rear  = index of the element that was enqueued last
//   rear == capacity - 1   -> no room left at the end: QUEUE OVERFLOW
//   front > rear           -> nothing left in between: QUEUE UNDERFLOW
// Watch the last step: slots freed at the front can NEVER be reused.
// That wasted space is why the Circular Queue exists (see the next example).

DECLARE
  ARRAY slots = [0, 0, 0, 0, 0]
  ARRAY toEnqueue = [10, 20, 30, 40, 50, 60]

SEQUENCE
  capacity = LENGTH(slots)
  front = 0
  rear = -1
  PRINT "Empty queue: front =" front "rear =" rear "capacity =" capacity

  // ENQUEUE six values into five slots: the sixth one must be refused
  LOOP i FROM 0 TO LENGTH(toEnqueue) - 1
    value = toEnqueue[i]
    IF rear == capacity - 1
      PRINT "QUEUE OVERFLOW: cannot enqueue" value "- rear is already at the last index" rear
    ELSE
      rear = rear + 1
      UPDATE slots[rear] value
      HIGHLIGHT slots[rear] 'SUCCESS'
      PRINT "enqueue" value "-> stored at index" rear
    END
  END

  // DEQUEUE two values: read slots[front], then move front forward
  LOOP k FROM 1 TO 2
    IF front > rear
      PRINT "QUEUE UNDERFLOW: nothing to dequeue"
    ELSE
      value = slots[front]
      UPDATE slots[front] 0
      HIGHLIGHT slots[front] 'DISCARDED'
      front = front + 1
      PRINT "dequeue ->" value "- front is now" front
    END
  END

  // Two slots are free again (indexes 0 and 1) - but a linear queue cannot use them
  usedSlots = rear - front + 1
  freeSlots = capacity - usedSlots
  PRINT "Elements in the queue:" usedSlots "- free slots:" freeSlots
  value = 70
  IF rear == capacity - 1
    PRINT "QUEUE OVERFLOW: cannot enqueue" value "even though" freeSlots "slots are free - the linear queue wastes them"
  ELSE
    rear = rear + 1
    UPDATE slots[rear] value
  END
END
`,

  CircularQueue: `SCENE CircularQueue
// A circular queue fixes the linear queue's wasted space: when 'rear'
// reaches the end of the array it WRAPS AROUND to index 0, reusing the
// slots that dequeues freed at the front.
//   next index = (index + 1) % capacity      <- the wrap-around
//   count      = how many elements are stored right now
//   count == 0         -> empty  (QUEUE UNDERFLOW on dequeue)
//   count == capacity  -> full   (QUEUE OVERFLOW on enqueue)

DECLARE
  ARRAY slots = [0, 0, 0, 0, 0]
  ARRAY firstBatch = [10, 20, 30, 40, 50, 60]
  ARRAY secondBatch = [60, 70, 80]

SEQUENCE
  capacity = LENGTH(slots)
  front = 0
  rear = -1
  count = 0

  // 1. Fill the queue: the sixth value does not fit
  LOOP i FROM 0 TO LENGTH(firstBatch) - 1
    value = firstBatch[i]
    IF count == capacity
      PRINT "QUEUE OVERFLOW: cannot enqueue" value "- all" capacity "slots are full"
    ELSE
      rear = (rear + 1) % capacity
      UPDATE slots[rear] value
      HIGHLIGHT slots[rear] 'SUCCESS'
      count = count + 1
      PRINT "enqueue" value "-> index" rear "- count" count
    END
  END

  // 2. Serve two values from the front
  LOOP k FROM 1 TO 2
    IF count == 0
      PRINT "QUEUE UNDERFLOW: nothing to dequeue"
    ELSE
      value = slots[front]
      UPDATE slots[front] 0
      HIGHLIGHT slots[front] 'DISCARDED'
      front = (front + 1) % capacity
      count = count - 1
      PRINT "dequeue ->" value "- front moves to index" front
    END
  END

  // 3. Enqueue again: rear wraps around to index 0 and 1
  LOOP i FROM 0 TO LENGTH(secondBatch) - 1
    value = secondBatch[i]
    IF count == capacity
      PRINT "QUEUE OVERFLOW: cannot enqueue" value "- all" capacity "slots are full"
    ELSE
      rear = (rear + 1) % capacity
      UPDATE slots[rear] value
      HIGHLIGHT slots[rear] 'SUCCESS'
      count = count + 1
      PRINT "enqueue" value "-> index" rear "(wrapped around) - count" count
    END
  END

  // 4. Empty it: values still come out in FIFO order, then one more try underflows
  total = count + 1
  LOOP k FROM 1 TO total
    IF count == 0
      PRINT "QUEUE UNDERFLOW: nothing to dequeue (count = 0)"
    ELSE
      value = slots[front]
      UPDATE slots[front] 0
      HIGHLIGHT slots[front] 'DISCARDED'
      front = (front + 1) % capacity
      count = count - 1
      PRINT "dequeue ->" value
    END
  END
END
`,

  BankTellerSimulation: `SCENE BankTellerSimulation
// A bank with ONE teller. Customers walk in at different minutes and join
// the waiting line (a queue). Whenever the teller is free, the customer at
// the FRONT of the line is served. We measure how long everyone waited.
//   arrival[i] = minute customer i walks in (in increasing order)
//   service[i] = minutes the teller needs for customer i
// Because a queue is FIFO, customers are served in the order they arrived:
// the k-th person dequeued is always customer number k.

DECLARE
  ARRAY names = ["Asha", "Ben", "Chen", "Dia", "Eli"]
  ARRAY arrival = [0, 1, 2, 6, 7]
  ARRAY service = [3, 2, 4, 1, 2]
  ARRAY waited = [0, 0, 0, 0, 0]
  QUEUE waitingLine = []

SEQUENCE
  customers = LENGTH(names)
  nextToArrive = 0
  served = 0
  tellerFreeAt = 0
  totalWait = 0
  minute = 0

  WHILE served < customers
    // Everyone arriving this minute joins the rear of the line
    WHILE nextToArrive < customers AND arrival[nextToArrive] == minute
      ENQUEUE waitingLine names[nextToArrive]
      PRINT "Minute" minute ":" names[nextToArrive] "joins the line"
      nextToArrive = nextToArrive + 1
    END

    // A free teller calls the person at the front of the line
    IF minute >= tellerFreeAt AND LENGTH(waitingLine) > 0
      person = DEQUEUE(waitingLine)
      c = served
      waitTime = minute - arrival[c]
      UPDATE waited[c] waitTime
      HIGHLIGHT waited[c] 'SUCCESS'
      totalWait = totalWait + waitTime
      tellerFreeAt = minute + service[c]
      served = served + 1
      PRINT "Minute" minute ": serving" person "- waited" waitTime "min - done at minute" tellerFreeAt
    END

    minute = minute + 1
  END

  averageWait = totalWait / customers
  PRINT "Waiting times:" waited
  PRINT "Average wait:" averageWait "minutes"
END
`,

  RoundRobinScheduling: `SCENE RoundRobinScheduling
// How an operating system shares ONE CPU between several programs.
// The ready queue holds the processes. The process at the FRONT runs for at
// most 'quantum' time units. If it still has work left, it goes to the
// REAR of the queue and waits for its next turn; otherwise it is finished.
//   waiting time = completion time - burst time    (all arrive at time 0)

DECLARE
  ARRAY names = ["P1", "P2", "P3", "P4"]
  ARRAY burst = [5, 3, 1, 4]
  ARRAY remaining = [5, 3, 1, 4]
  ARRAY completion = [0, 0, 0, 0]
  QUEUE readyQueue = []

SEQUENCE
  quantum = 2
  clock = 0

  // Every process is ready at time 0
  LOOP i FROM 0 TO LENGTH(names) - 1
    ENQUEUE readyQueue names[i]
  END

  WHILE LENGTH(readyQueue) > 0
    current = DEQUEUE(readyQueue)

    // Find which process this is (its index in the arrays)
    p = -1
    LOOP k FROM 0 TO LENGTH(names) - 1
      IF names[k] == current
        p = k
      END
    END

    // Run it for one time slice (shorter if it needs less)
    slice = MIN(quantum, remaining[p])
    clock = clock + slice
    leftOver = remaining[p] - slice
    UPDATE remaining[p] leftOver
    HIGHLIGHT remaining[p]

    IF leftOver > 0
      ENQUEUE readyQueue current
      PRINT current "ran" slice "units - needs" leftOver "more - back to the rear - time is now" clock
    ELSE
      UPDATE completion[p] clock
      HIGHLIGHT completion[p] 'SUCCESS'
      PRINT current "ran" slice "units - FINISHED at time" clock
    END
  END

  // Waiting time of each process, and the average
  totalWait = 0
  LOOP i FROM 0 TO LENGTH(names) - 1
    waitTime = completion[i] - burst[i]
    totalWait = totalWait + waitTime
    PRINT names[i] "completed at" completion[i] "- waited" waitTime
  END
  averageWait = totalWait / LENGTH(names)
  PRINT "Average waiting time:" averageWait
END
`,

  GenerateBinaryNumbers: `SCENE GenerateBinaryNumbers
// Print the binary numbers from 1 to n, in order, using a queue.
// Start with "1". Each time, dequeue a number, print it, and enqueue the
// two numbers that come from it: itself + "0" and itself + "1".
//   "1" -> "10", "11"    "10" -> "100", "101"    "11" -> "110", "111" ...
// The queue hands them back in exactly increasing order.

DECLARE
  QUEUE pending = []

SEQUENCE
  n = 10
  ENQUEUE pending "1"

  LOOP count FROM 1 TO n
    current = DEQUEUE(pending)
    PRINT count "in binary is" current

    withZero = current + "0"
    withOne = current + "1"
    ENQUEUE pending withZero
    ENQUEUE pending withOne
  END

  PRINT "Still waiting in the queue (numbers above" n "):" LENGTH(pending)
END
`,

  ReverseQueueWithStack: `SCENE ReverseQueueWithStack
// Reverse the order of a queue using a stack.
// A queue gives elements back in the SAME order (FIFO); a stack gives them
// back in the OPPOSITE order (LIFO). So: queue -> stack -> queue reverses it.

DECLARE
  QUEUE q = [1, 2, 3, 4, 5]
  STACK helper = []

SEQUENCE
  PRINT "Before:" q

  // Step 1: move every element from the front of the queue onto the stack
  WHILE LENGTH(q) > 0
    value = DEQUEUE(q)
    PUSH helper value
  END

  // Step 2: pop every element back into the queue (the last one comes first)
  WHILE LENGTH(helper) > 0
    value = POP(helper)
    ENQUEUE q value
  END

  PRINT "After: " q
END
`,

  ReverseFirstK: `SCENE ReverseFirstK
// Reverse only the first k elements of a queue, keep the rest in order.
//   q = [10, 20, 30, 40, 50], k = 3   ->   [30, 20, 10, 40, 50]
// 1. Dequeue the first k elements onto a stack.
// 2. Pop them back into the queue: they join the rear, reversed.
// 3. The other (size - k) elements are now in front of them, so move each
//    one from the front to the rear once.

DECLARE
  QUEUE q = [10, 20, 30, 40, 50]
  STACK helper = []

SEQUENCE
  k = 3
  size = LENGTH(q)
  PRINT "Before:" q "- k =" k

  IF k < 0 OR k > size
    PRINT "Invalid k: it must be between 0 and" size
  ELSE
    // Step 1 (a WHILE with a counter runs zero times when k is 0;
    // LOOP i FROM 1 TO 0 would count DOWN and run twice)
    moved = 0
    WHILE moved < k
      value = DEQUEUE(q)
      PUSH helper value
      moved = moved + 1
    END

    // Step 2
    WHILE LENGTH(helper) > 0
      value = POP(helper)
      ENQUEUE q value
    END

    // Step 3
    others = size - k
    rotated = 0
    WHILE rotated < others
      value = DEQUEUE(q)
      ENQUEUE q value
      rotated = rotated + 1
    END

    PRINT "After: " q
  END
END
`,

  InterleaveHalves: `SCENE InterleaveHalves
// Interleave the first half of a queue with its second half, like
// shuffling a deck of cards:
//   [1, 2, 3, 4, 5, 6, 7, 8]   ->   [1, 5, 2, 6, 3, 7, 4, 8]
// Move the first half into a second queue, then take one from each queue
// in turn. (The queue must have an even number of elements.)

DECLARE
  QUEUE deck = [1, 2, 3, 4, 5, 6, 7, 8]
  QUEUE firstHalf = []

SEQUENCE
  size = LENGTH(deck)
  IF size % 2 != 0
    PRINT "The queue needs an even number of elements, it has" size
  ELSE
    half = size / 2

    // The first half moves to its own queue, keeping its order
    moved = 0
    WHILE moved < half
      card = DEQUEUE(deck)
      ENQUEUE firstHalf card
      moved = moved + 1
    END

    // Alternate: one card from the first half, then one from the second half
    WHILE LENGTH(firstHalf) > 0
      card = DEQUEUE(firstHalf)
      ENQUEUE deck card
      card = DEQUEUE(deck)
      ENQUEUE deck card
    END

    PRINT "Interleaved:" deck
  END
END
`,

  QueueUsingTwoStacks: `SCENE QueueUsingTwoStacks
// Build a FIFO queue from two LIFO stacks.
//   enqueue x : PUSH x onto 'inbox'
//   dequeue   : if 'outbox' is empty, POP everything from inbox and PUSH it
//               onto outbox (this reverses the order, so the OLDEST value
//               ends up on top); then POP from outbox.
// Each value is moved at most once, so every operation is O(1) on average.

DECLARE
  ARRAY operations = ["ENQUEUE", "ENQUEUE", "ENQUEUE", "DEQUEUE", "ENQUEUE", "DEQUEUE", "DEQUEUE", "DEQUEUE", "DEQUEUE"]
  ARRAY values = [1, 2, 3, 0, 4, 0, 0, 0, 0]
  STACK inbox = []
  STACK outbox = []

SEQUENCE
  LOOP i FROM 0 TO LENGTH(operations) - 1
    HIGHLIGHT operations[i]
    IF operations[i] == "ENQUEUE"
      PUSH inbox values[i]
      PRINT "enqueue" values[i]
    ELSE
      // Refill the outbox only when it has run dry
      IF IS_EMPTY(outbox)
        WHILE LENGTH(inbox) > 0
          moved = POP(inbox)
          PUSH outbox moved
        END
      END

      IF IS_EMPTY(outbox)
        PRINT "dequeue -> QUEUE UNDERFLOW: both stacks are empty"
      ELSE
        value = POP(outbox)
        PRINT "dequeue ->" value
      END
    END
  END
END
`,

  HotPotato: `SCENE HotPotato
// The Hot Potato game (the Josephus problem). Players stand in a circle
// and pass a potato. After 'passes' passes, whoever holds it is out.
// The last player left wins.
// A queue is the circle: passing the potato = the player at the FRONT
// goes to the REAR. The player at the front after the passes is out.

DECLARE
  QUEUE circle = ["Ana", "Bo", "Cy", "Dev", "Eva", "Fay"]
  ARRAY eliminated = []

SEQUENCE
  passes = 3
  round = 1
  outCount = 0

  WHILE LENGTH(circle) > 1
    // Pass the potato 'passes' times
    LOOP p FROM 1 TO passes
      holder = DEQUEUE(circle)
      ENQUEUE circle holder
    END

    // Whoever holds it now is out of the game
    out = DEQUEUE(circle)
    INSERT eliminated[outCount] out
    outCount = outCount + 1
    PRINT "Round" round ":" out "is out -" LENGTH(circle) "players left"
    round = round + 1
  END

  winner = FRONT(circle)
  PRINT "Order of elimination:" eliminated
  PRINT "Winner:" winner
END
`,

  MovingAverage: `SCENE MovingAverage
// A temperature sensor sends one reading per minute. We want the average
// of only the LAST 'windowSize' readings (a moving average), to smooth out
// noise. The queue holds exactly that window:
//   new reading    -> ENQUEUE it and add it to the sum
//   window too big -> DEQUEUE the oldest reading and subtract it
// So each update costs O(1), no matter how long the stream is.

DECLARE
  ARRAY readings = [10, 20, 30, 40, 50, 60]
  ARRAY averages = [0, 0, 0, 0, 0, 0]
  QUEUE window = []

SEQUENCE
  windowSize = 3
  sum = 0

  LOOP i FROM 0 TO LENGTH(readings) - 1
    HIGHLIGHT readings[i]
    newest = readings[i]
    ENQUEUE window newest
    sum = sum + newest

    IF LENGTH(window) > windowSize
      oldest = DEQUEUE(window)
      sum = sum - oldest
      PRINT "Dropped the oldest reading" oldest
    END

    average = sum / LENGTH(window)
    UPDATE averages[i] average
    HIGHLIGHT averages[i] 'SUCCESS'
    PRINT "Reading" newest "-> average of the last" LENGTH(window) "readings is" average
  END

  PRINT "Moving averages:" averages
END
`,

  FirstNonRepeating: `SCENE FirstNonRepeating
// Characters arrive one by one (a stream). After each one, report the
// FIRST character so far that has appeared only ONCE, or "none".
//   a a b c b  ->  a, none, b, b, c
// The queue keeps candidates in arrival order. A candidate at the front
// that has repeated can never be the answer again, so it is dequeued.

DECLARE
  ARRAY stream = ["a", "a", "b", "c", "b", "d", "c"]
  ARRAY answers = ["", "", "", "", "", "", ""]
  QUEUE candidates = []

SEQUENCE
  LOOP i FROM 0 TO LENGTH(stream) - 1
    ch = stream[i]
    HIGHLIGHT stream[i]
    ENQUEUE candidates ch

    // Drop repeated characters from the front of the queue
    searching = 1
    WHILE searching == 1 AND LENGTH(candidates) > 0
      candidate = FRONT(candidates)

      // How many times has 'candidate' appeared in stream[0..i]?
      count = 0
      LOOP j FROM 0 TO i
        IF stream[j] == candidate
          count = count + 1
        END
      END

      IF count > 1
        dropped = DEQUEUE(candidates)
      ELSE
        searching = 0
      END
    END

    answer = "none"
    IF LENGTH(candidates) > 0
      answer = FRONT(candidates)
    END
    UPDATE answers[i] answer
    PRINT "After" ch "-> first non-repeating:" answer
  END

  PRINT "Answers:" answers
END
`,
};
