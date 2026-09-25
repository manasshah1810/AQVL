/**
 * Stack examples. Every one is written the way it would be in C / Java /
 * Python: a loop walks the input, IFs decide, and the stack is used only
 * through its real operations —
 *
 *   PUSH s value      put a value on the top
 *   x = POP(s)        remove the top value and keep it in x
 *   x = PEEK(s)       read the top value without removing it
 *   IS_EMPTY(s)       is there nothing on the stack?
 *   LENGTH(s)         how many values are on the stack?
 *
 * Nothing is scripted: change the input arrays in DECLARE and every example
 * still gives the right answer. Each PUSH / POP / PEEK is its own animated
 * step, and the console shows the stack (bottom → top) after every change.
 */
export const StackScripts = {
  StackFoundation: `SCENE StackFoundation
// A stack is like a pile of plates: you can only put a plate on the TOP
// (PUSH) or take the plate from the TOP (POP).
// Last In, First Out (LIFO): the last plate put on is the first one taken off.

DECLARE
  STACK plates = []
  ARRAY incoming = [10, 20, 30, 40]

SEQUENCE
  // 1. PUSH every value, one at a time, onto the top of the stack
  LOOP i FROM 0 TO LENGTH(incoming) - 1
    value = incoming[i]
    PUSH plates value
    PRINT "Pushed" value "- size is now" LENGTH(plates)
  END

  // 2. PEEK: look at the top value WITHOUT removing it
  topValue = PEEK(plates)
  PRINT "Top of the stack:" topValue "- size is still" LENGTH(plates)

  // 3. POP until the stack is empty: values come out in REVERSE order
  WHILE LENGTH(plates) > 0
    removed = POP(plates)
    PRINT "Popped" removed "- size is now" LENGTH(plates)
  END

  // 4. A safe POP always checks IS_EMPTY first.
  //    Popping an empty stack is an error called STACK UNDERFLOW.
  IF IS_EMPTY(plates)
    PRINT "The stack is empty: popping now would be a STACK UNDERFLOW, so we stop."
  ELSE
    removed = POP(plates)
  END
END
`,

  StackUsingArray: `SCENE StackUsingArray
// How a stack is built inside a computer: a fixed-size array plus an
// integer 'top' that remembers the index of the top element.
//   top == -1            -> the stack is empty
//   top == capacity - 1  -> the stack is full
// push = move top up, then store.   pop = read, then move top down.

DECLARE
  ARRAY slots = [0, 0, 0, 0, 0]
  ARRAY toPush = [7, 3, 9, 4, 8, 6]

SEQUENCE
  capacity = LENGTH(slots)
  top = -1
  PRINT "Empty stack: top =" top "capacity =" capacity

  // PUSH six values into five slots: the sixth one must be refused
  LOOP i FROM 0 TO LENGTH(toPush) - 1
    value = toPush[i]
    IF top == capacity - 1
      PRINT "STACK OVERFLOW: cannot push" value "- all" capacity "slots are full"
    ELSE
      top = top + 1
      UPDATE slots[top] value
      HIGHLIGHT slots[top] 'SUCCESS'
      PRINT "push" value "-> stored at index" top
    END
  END

  // PEEK: the top element is simply slots[top]
  HIGHLIGHT slots[top]
  PRINT "peek -> top element is" slots[top] "at index" top

  // POP every element, and then try one more time
  count = capacity + 1
  LOOP k FROM 1 TO count
    IF top == -1
      PRINT "STACK UNDERFLOW: nothing left to pop (top = -1)"
    ELSE
      value = slots[top]
      UPDATE slots[top] 0
      HIGHLIGHT slots[top] 'DISCARDED'
      top = top - 1
      PRINT "pop ->" value "- top is now" top
    END
  END
END
`,

  ReverseArrayWithStack: `SCENE ReverseArrayWithStack
// Reverse an array in place using a stack.
// Pass 1 pushes the elements left to right, so the LAST element ends up on top.
// Pass 2 pops them back into the array left to right: top first.

DECLARE
  ARRAY arr = [10, 20, 30, 40, 50]
  STACK helper = []

SEQUENCE
  PRINT "Before:" arr

  // Pass 1: push every element
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    PUSH helper arr[i]
  END

  // Pass 2: pop back into the array, starting at index 0
  LOOP i FROM 0 TO LENGTH(arr) - 1
    value = POP(helper)
    UPDATE arr[i] value
    HIGHLIGHT arr[i] 'SUCCESS'
  END

  PRINT "After: " arr
END
`,

  ReverseStringWithStack: `SCENE ReverseStringWithStack
// Reverse a word one character at a time.
// Every character goes onto the stack; popping gives them back last-first.

DECLARE
  ARRAY word = ["H", "E", "L", "L", "O"]
  STACK letters = []

SEQUENCE
  // Push every character of the word
  LOOP i FROM 0 TO LENGTH(word) - 1
    HIGHLIGHT word[i]
    PUSH letters word[i]
  END

  // Pop them all, gluing each one onto the end of the result
  reversed = ""
  WHILE LENGTH(letters) > 0
    ch = POP(letters)
    reversed = reversed + ch
    PRINT "Reversed so far:" reversed
  END

  PRINT "Original word:" word
  PRINT "Reversed word:" reversed
END
`,

  PalindromeCheck: `SCENE PalindromeCheck
// A palindrome reads the same forwards and backwards (RADAR, LEVEL, MADAM).
// Push every character; popping then reads the word BACKWARDS, so compare
// each popped character with the word read FORWARDS.

DECLARE
  ARRAY word = ["R", "A", "D", "A", "R"]
  STACK letters = []

SEQUENCE
  LOOP i FROM 0 TO LENGTH(word) - 1
    PUSH letters word[i]
  END

  isPalindrome = 1
  i = 0
  WHILE i < LENGTH(word) AND isPalindrome == 1
    fromBack = POP(letters)
    fromFront = word[i]
    IF fromBack == fromFront
      HIGHLIGHT word[i] 'SUCCESS'
      PRINT "Index" i ": front" fromFront "== back" fromBack "- still matching"
    ELSE
      HIGHLIGHT word[i] 'DISCARDED'
      PRINT "Index" i ": front" fromFront "!= back" fromBack "- mismatch"
      isPalindrome = 0
    END
    i = i + 1
  END

  IF isPalindrome == 1
    PRINT "Result: the word IS a palindrome"
  ELSE
    PRINT "Result: the word is NOT a palindrome"
  END
END
`,

  BalancedParentheses: `SCENE BalancedParentheses
// Are the brackets of an expression balanced?  { ( [ ] ) ( ) }  -> yes
// Rule: every OPENING bracket is pushed. Every CLOSING bracket must match
// the most recent unmatched opening bracket - which is exactly the top of
// the stack. At the end, the stack must be empty.
// Try other inputs, e.g. ["(", "]"]  or  ["(", "(", ")"]  or  [")"].

DECLARE
  ARRAY expr = ["{", "(", "[", "]", ")", "(", ")", "}"]
  STACK pending = []

SEQUENCE
  isBalanced = 1
  i = 0
  WHILE i < LENGTH(expr) AND isBalanced == 1
    ch = expr[i]
    HIGHLIGHT expr[i]

    IF ch == "(" OR ch == "[" OR ch == "{"
      // Opening bracket: remember it until its partner arrives
      PUSH pending ch
    ELSE
      // Closing bracket: there must be an opening bracket waiting
      IF IS_EMPTY(pending)
        PRINT "Closing" ch "at index" i "has no opening bracket"
        HIGHLIGHT expr[i] 'DISCARDED'
        isBalanced = 0
      ELSE
        last = POP(pending)
        IF (ch == ")" AND last == "(") OR (ch == "]" AND last == "[") OR (ch == "}" AND last == "{")
          PRINT "Matched" last "with" ch
          HIGHLIGHT expr[i] 'SUCCESS'
        ELSE
          PRINT "Mismatch:" last "cannot be closed by" ch
          HIGHLIGHT expr[i] 'DISCARDED'
          isBalanced = 0
        END
      END
    END
    i = i + 1
  END

  IF isBalanced == 1 AND IS_EMPTY(pending)
    PRINT "Result: BALANCED"
  ELSE IF isBalanced == 1
    PRINT "Result: NOT balanced - these brackets were never closed:" pending
  ELSE
    PRINT "Result: NOT balanced"
  END
END
`,

  EvaluatePostfixExpression: `SCENE EvaluatePostfixExpression
// Postfix (Reverse Polish) notation puts the operator AFTER its operands:
//   5 1 2 + 4 * + 3 -    means    5 + ((1 + 2) * 4) - 3  =  14
// A calculator evaluates it with one stack:
//   number   -> push it
//   operator -> pop two numbers, apply the operator, push the result

DECLARE
  ARRAY tokens = [5, 1, 2, "+", 4, "*", "+", 3, "-"]
  STACK operands = []

SEQUENCE
  isValid = 1
  result = 0
  LOOP i FROM 0 TO LENGTH(tokens) - 1
    token = tokens[i]
    HIGHLIGHT tokens[i]

    IF token == "+" OR token == "-" OR token == "*" OR token == "/"
      IF LENGTH(operands) < 2
        PRINT "Invalid expression: operator" token "needs two numbers"
        isValid = 0
      ELSE
        // The top of the stack is the SECOND operand (it was pushed last)
        secondOperand = POP(operands)
        firstOperand = POP(operands)
        IF token == "+"
          result = firstOperand + secondOperand
        ELSE IF token == "-"
          result = firstOperand - secondOperand
        ELSE IF token == "*"
          result = firstOperand * secondOperand
        ELSE
          result = firstOperand / secondOperand
        END
        PRINT firstOperand token secondOperand "=" result
        PUSH operands result
      END
    ELSE
      // A number: just keep it until an operator needs it
      PUSH operands token
    END
  END

  // A valid expression leaves exactly one number: the answer
  IF isValid == 1 AND LENGTH(operands) == 1
    answer = POP(operands)
    PRINT "Answer:" answer
  ELSE
    PRINT "Invalid expression: the stack should hold exactly one number, it holds" operands
  END
END
`,

  InfixToPostfix: `SCENE InfixToPostfix
// Convert an infix expression (the way humans write it) into postfix
// (the way a calculator evaluates it) - the Shunting-Yard algorithm.
//   A * ( B + C ) - D / E    ->    A B C + * D E / -
// operand          -> goes straight to the output
// "("              -> push
// ")"              -> pop operators to the output until the matching "("
// operator         -> first pop every operator of higher or EQUAL
//                     precedence, then push this one

DECLARE
  ARRAY tokens = ["A", "*", "(", "B", "+", "C", ")", "-", "D", "/", "E"]
  STACK operators = []

  // How strongly an operator binds: * and / before + and -
  FUNCTION precedence(op)
    IF op == "*" OR op == "/"
      RETURN 2
    ELSE IF op == "+" OR op == "-"
      RETURN 1
    END
    RETURN 0
  END

SEQUENCE
  postfix = ""
  LOOP i FROM 0 TO LENGTH(tokens) - 1
    token = tokens[i]
    HIGHLIGHT tokens[i]

    IF token == "("
      PUSH operators token
    ELSE IF token == ")"
      // Everything since the matching "(" belongs to this bracket
      WHILE LENGTH(operators) > 0 AND PEEK(operators) != "("
        op = POP(operators)
        postfix = postfix + op + " "
      END
      discarded = POP(operators)
    ELSE IF precedence(token) > 0
      WHILE LENGTH(operators) > 0 AND precedence(PEEK(operators)) >= precedence(token)
        op = POP(operators)
        postfix = postfix + op + " "
      END
      PUSH operators token
    ELSE
      // An operand (a letter or a number)
      postfix = postfix + token + " "
    END
    PRINT "Output so far:" postfix
  END

  // Whatever operators are left go to the output, top first
  WHILE LENGTH(operators) > 0
    op = POP(operators)
    postfix = postfix + op + " "
  END

  PRINT "Postfix:" postfix
END
`,

  NextGreaterElement: `SCENE NextGreaterElement
// For every element, find the first element to its RIGHT that is bigger.
//   [4, 5, 2, 25, 7, 8]  ->  [5, 25, 25, -1, 8, -1]    (-1 = none)
// Monotonic stack: the stack holds the INDEXES of elements still waiting
// for their answer. A new element answers every waiting element smaller
// than it. Every index is pushed and popped once: O(n) instead of O(n^2).

DECLARE
  ARRAY arr = [4, 5, 2, 25, 7, 8]
  ARRAY answer = [0, 0, 0, 0, 0, 0]
  STACK waiting = []

SEQUENCE
  // Start with "no greater element" (-1) everywhere
  NONE = -1
  LOOP i FROM 0 TO LENGTH(arr) - 1
    UPDATE answer[i] NONE
  END

  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    // arr[i] is the answer for every waiting element that is smaller
    WHILE LENGTH(waiting) > 0 AND arr[PEEK(waiting)] < arr[i]
      j = POP(waiting)
      UPDATE answer[j] arr[i]
      HIGHLIGHT answer[j] 'SUCCESS'
      PRINT "Next greater of" arr[j] "is" arr[i]
    END
    // Now arr[i] waits for its own answer
    PUSH waiting i
  END

  // Whoever is still waiting has no greater element to the right
  WHILE LENGTH(waiting) > 0
    j = POP(waiting)
    PRINT "Nothing greater comes after" arr[j]
  END

  PRINT "Array:  " arr
  PRINT "Answer: " answer
END
`,

  StockSpan: `SCENE StockSpan
// Stock span: for each day, how many consecutive days (ending today) had a
// price less than or equal to today's price?
//   prices [100, 80, 60, 70, 60, 75, 85]  ->  spans [1, 1, 1, 2, 1, 4, 6]
// The stack keeps the INDEXES of earlier days with a HIGHER price - those
// are the only days that can stop a future span.

DECLARE
  ARRAY prices = [100, 80, 60, 70, 60, 75, 85]
  ARRAY spans = [0, 0, 0, 0, 0, 0, 0]
  STACK higherDays = []

SEQUENCE
  span = 0
  LOOP i FROM 0 TO LENGTH(prices) - 1
    HIGHLIGHT prices[i]
    // Days with a price <= today's are covered by today's span: drop them
    WHILE LENGTH(higherDays) > 0 AND prices[PEEK(higherDays)] <= prices[i]
      dropped = POP(higherDays)
    END

    IF IS_EMPTY(higherDays)
      // No earlier day was higher: the span reaches back to day 0
      span = i + 1
    ELSE
      // The span stops just after the nearest higher day
      span = i - PEEK(higherDays)
    END
    UPDATE spans[i] span
    HIGHLIGHT spans[i] 'SUCCESS'
    PRINT "Day" i "price" prices[i] "-> span" span

    PUSH higherDays i
  END

  PRINT "Prices:" prices
  PRINT "Spans: " spans
END
`,

  MinStack: `SCENE MinStack
// A stack that can also report its MINIMUM in O(1) time.
// A second stack, 'minimums', always has the current minimum on its top:
//   push x -> also push x onto minimums if x <= the current minimum
//   pop  x -> also pop minimums if x was the current minimum

DECLARE
  STACK values = []
  STACK minimums = []
  ARRAY toPush = [5, 3, 7, 3, 8, 1]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(toPush) - 1
    x = toPush[i]
    PUSH values x
    IF IS_EMPTY(minimums) OR x <= PEEK(minimums)
      PUSH minimums x
    END
    currentMin = PEEK(minimums)
    PRINT "push" x "-> minimum is" currentMin
  END

  // Pop everything and watch the minimum go back up
  WHILE LENGTH(values) > 0
    x = POP(values)
    IF x == PEEK(minimums)
      POP minimums
    END
    IF IS_EMPTY(values)
      PRINT "pop" x "-> the stack is now empty"
    ELSE
      currentMin = PEEK(minimums)
      PRINT "pop" x "-> minimum is" currentMin
    END
  END
END
`,

  SortStack: `SCENE SortStack
// Sort a stack using only one extra stack (no arrays!).
// Take the top of 'input'. Move every bigger value from 'sorted' back to
// 'input', then put the value down: 'sorted' stays in order at every step.
// At the end 'sorted' holds the values smallest (bottom) to largest (top).

DECLARE
  STACK input = [34, 3, 31, 98, 92, 23]
  STACK sorted = []

SEQUENCE
  WHILE LENGTH(input) > 0
    current = POP(input)
    // Make room: bigger values go back to input for now
    WHILE LENGTH(sorted) > 0 AND PEEK(sorted) > current
      bigger = POP(sorted)
      PUSH input bigger
    END
    PUSH sorted current
    PRINT "Placed" current "- sorted (bottom to top):" sorted
  END

  PRINT "Sorted stack (bottom to top):" sorted
END
`,

  DecimalToBinary: `SCENE DecimalToBinary
// Convert a decimal number to binary by repeated division by 2.
// The remainders come out LAST digit first, so push them on a stack and
// pop them to read the digits in the right order.
//   13 / 2 = 6 r 1,  6 / 2 = 3 r 0,  3 / 2 = 1 r 1,  1 / 2 = 0 r 1  ->  1101
// Change 'base' to 8 for octal, or to any base from 2 to 10.

DECLARE
  STACK remainders = []

SEQUENCE
  number = 13
  base = 2

  n = number
  WHILE n > 0
    digit = n % base
    PUSH remainders digit
    quotient = (n - digit) / base
    PRINT n "/" base "=" quotient "remainder" digit
    n = quotient
  END

  // Pop the digits: most significant first
  result = ""
  WHILE LENGTH(remainders) > 0
    digit = POP(remainders)
    result = result + digit
  END

  IF number == 0
    result = "0"
  END
  PRINT number "in base" base "is" result
END
`,

  UndoRedo: `SCENE UndoRedo
// How the Undo / Redo buttons of a text editor work: two stacks.
//   typing a word -> push it on 'undoStack', and clear 'redoStack'
//   UNDO          -> move the top of undoStack to redoStack
//   REDO          -> move the top of redoStack back to undoStack
// The document is simply everything on undoStack (bottom to top).

DECLARE
  ARRAY actions = ["Hello", "big", "world", "UNDO", "UNDO", "REDO", "again", "REDO"]
  STACK undoStack = []
  STACK redoStack = []

SEQUENCE
  LOOP i FROM 0 TO LENGTH(actions) - 1
    action = actions[i]
    HIGHLIGHT actions[i]

    IF action == "UNDO"
      IF IS_EMPTY(undoStack)
        PRINT "UNDO: nothing to undo"
      ELSE
        word = POP(undoStack)
        PUSH redoStack word
        PRINT "UNDO removed" word
      END
    ELSE IF action == "REDO"
      IF IS_EMPTY(redoStack)
        PRINT "REDO: nothing to redo (typing a new word clears the redo history)"
      ELSE
        word = POP(redoStack)
        PUSH undoStack word
        PRINT "REDO restored" word
      END
    ELSE
      PUSH undoStack action
      // A new edit makes the old redo history meaningless
      WHILE LENGTH(redoStack) > 0
        forgotten = POP(redoStack)
      END
      PRINT "Typed" action
    END
    PRINT "Document:" undoStack
  END
END
`,

  FactorialWithStack: `SCENE FactorialWithStack
// Recursion runs on a stack: every call waits on the CALL STACK until the
// call it made returns. This does the same work by hand:
//   phase 1 ("calling"):   push n, n-1, ..., 1   (the waiting calls)
//   phase 2 ("returning"): pop them one by one and multiply
//   factorial(5) = 5 * 4 * 3 * 2 * 1 = 120

DECLARE
  STACK calls = []

SEQUENCE
  n = 5

  // Phase 1: each call factorial(k) needs factorial(k - 1) first
  k = n
  WHILE k > 1
    PRINT "factorial" k "must wait for factorial" k - 1
    PUSH calls k
    k = k - 1
  END
  PRINT "factorial 1 = 1   (the base case: it waits for nothing)"

  // Phase 2: the most recent call returns first (LIFO)
  result = 1
  WHILE LENGTH(calls) > 0
    k = POP(calls)
    result = result * k
    PRINT "factorial" k "returns" result
  END

  PRINT "Answer: factorial of" n "=" result
END
`,
};
