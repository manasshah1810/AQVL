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

DECLARE
  QUEUE ticketLine = []
  ARRAY arriving = [10, 20, 30, 40]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arriving) - 1
    value = arriving[i]
    ENQUEUE ticketLine value
    PRINT "Enqueued" value "- size is now" LENGTH(ticketLine)
  END

  firstValue = FRONT(ticketLine)
  lastValue = REAR(ticketLine)
  PRINT "Front:" firstValue "- Rear:" lastValue "- size is still" LENGTH(ticketLine)

  WHILE LENGTH(ticketLine) > 0
    removed = DEQUEUE(ticketLine)
    PRINT "Dequeued" removed "- size is now" LENGTH(ticketLine)
  END

  IF IS_EMPTY(ticketLine)
    PRINT "The queue is empty: dequeuing now would be a QUEUE UNDERFLOW, so we stop."
  ELSE
    removed = DEQUEUE(ticketLine)
  END
END
`,

  QueueUsingArray: `SCENE QueueUsingArray

DECLARE
  ARRAY slots = [0, 0, 0, 0, 0]
  ARRAY toEnqueue = [10, 20, 30, 40, 50, 60]

SEQUENCE
  capacity = LENGTH(slots)
  front = 0
  rear = -1
  PRINT "Empty queue: front =" front "rear =" rear "capacity =" capacity

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

DECLARE
  ARRAY slots = [0, 0, 0, 0, 0]
  ARRAY firstBatch = [10, 20, 30, 40, 50, 60]
  ARRAY secondBatch = [60, 70, 80]

SEQUENCE
  capacity = LENGTH(slots)
  front = 0
  rear = -1
  count = 0

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
    WHILE nextToArrive < customers AND arrival[nextToArrive] == minute
      ENQUEUE waitingLine names[nextToArrive]
      PRINT "Minute" minute ":" names[nextToArrive] "joins the line"
      nextToArrive = nextToArrive + 1
    END

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

DECLARE
  ARRAY names = ["P1", "P2", "P3", "P4"]
  ARRAY burst = [5, 3, 1, 4]
  ARRAY remaining = [5, 3, 1, 4]
  ARRAY completion = [0, 0, 0, 0]
  QUEUE readyQueue = []

SEQUENCE
  quantum = 2
  clock = 0

  LOOP i FROM 0 TO LENGTH(names) - 1
    ENQUEUE readyQueue names[i]
  END

  WHILE LENGTH(readyQueue) > 0
    current = DEQUEUE(readyQueue)

    p = -1
    LOOP k FROM 0 TO LENGTH(names) - 1
      IF names[k] == current
        p = k
      END
    END

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

DECLARE
  QUEUE q = [1, 2, 3, 4, 5]
  STACK helper = []

SEQUENCE
  PRINT "Before:" q

  WHILE LENGTH(q) > 0
    value = DEQUEUE(q)
    PUSH helper value
  END

  WHILE LENGTH(helper) > 0
    value = POP(helper)
    ENQUEUE q value
  END

  PRINT "After: " q
END
`,

  ReverseFirstK: `SCENE ReverseFirstK

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
    moved = 0
    WHILE moved < k
      value = DEQUEUE(q)
      PUSH helper value
      moved = moved + 1
    END

    WHILE LENGTH(helper) > 0
      value = POP(helper)
      ENQUEUE q value
    END

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

DECLARE
  QUEUE deck = [1, 2, 3, 4, 5, 6, 7, 8]
  QUEUE firstHalf = []

SEQUENCE
  size = LENGTH(deck)
  IF size % 2 != 0
    PRINT "The queue needs an even number of elements, it has" size
  ELSE
    half = size / 2

    moved = 0
    WHILE moved < half
      card = DEQUEUE(deck)
      ENQUEUE firstHalf card
      moved = moved + 1
    END

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

DECLARE
  QUEUE circle = ["Ana", "Bo", "Cy", "Dev", "Eva", "Fay"]
  ARRAY eliminated = []

SEQUENCE
  passes = 3
  round = 1
  outCount = 0

  WHILE LENGTH(circle) > 1
    LOOP p FROM 1 TO passes
      holder = DEQUEUE(circle)
      ENQUEUE circle holder
    END

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

DECLARE
  ARRAY stream = ["a", "a", "b", "c", "b", "d", "c"]
  ARRAY answers = ["", "", "", "", "", "", ""]
  QUEUE candidates = []

SEQUENCE
  LOOP i FROM 0 TO LENGTH(stream) - 1
    ch = stream[i]
    HIGHLIGHT stream[i]
    ENQUEUE candidates ch

    searching = 1
    WHILE searching == 1 AND LENGTH(candidates) > 0
      candidate = FRONT(candidates)

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
