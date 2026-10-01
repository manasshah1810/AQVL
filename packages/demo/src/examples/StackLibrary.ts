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

DECLARE
  STACK plates = []
  ARRAY incoming = [10, 20, 30, 40]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(incoming) - 1
    value = incoming[i]
    PUSH plates value
    PRINT "Pushed" value "- size is now" LENGTH(plates)
  END

  topValue = PEEK(plates)
  PRINT "Top of the stack:" topValue "- size is still" LENGTH(plates)

  WHILE LENGTH(plates) > 0
    removed = POP(plates)
    PRINT "Popped" removed "- size is now" LENGTH(plates)
  END

  IF IS_EMPTY(plates)
    PRINT "The stack is empty: popping now would be a STACK UNDERFLOW, so we stop."
  ELSE
    removed = POP(plates)
  END
END
`,

  StackUsingArray: `SCENE StackUsingArray

DECLARE
  ARRAY slots = [0, 0, 0, 0, 0]
  ARRAY toPush = [7, 3, 9, 4, 8, 6]

SEQUENCE
  capacity = LENGTH(slots)
  top = -1
  PRINT "Empty stack: top =" top "capacity =" capacity

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

  HIGHLIGHT slots[top]
  PRINT "peek -> top element is" slots[top] "at index" top

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

DECLARE
  ARRAY arr = [10, 20, 30, 40, 50]
  STACK helper = []

SEQUENCE
  PRINT "Before:" arr

  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    PUSH helper arr[i]
  END

  LOOP i FROM 0 TO LENGTH(arr) - 1
    value = POP(helper)
    UPDATE arr[i] value
    HIGHLIGHT arr[i] 'SUCCESS'
  END

  PRINT "After: " arr
END
`,

  ReverseStringWithStack: `SCENE ReverseStringWithStack

DECLARE
  ARRAY word = ["H", "E", "L", "L", "O"]
  STACK letters = []

SEQUENCE
  LOOP i FROM 0 TO LENGTH(word) - 1
    HIGHLIGHT word[i]
    PUSH letters word[i]
  END

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
      PUSH pending ch
    ELSE
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
      PUSH operands token
    END
  END

  IF isValid == 1 AND LENGTH(operands) == 1
    answer = POP(operands)
    PRINT "Answer:" answer
  ELSE
    PRINT "Invalid expression: the stack should hold exactly one number, it holds" operands
  END
END
`,

  InfixToPostfix: `SCENE InfixToPostfix

DECLARE
  ARRAY tokens = ["A", "*", "(", "B", "+", "C", ")", "-", "D", "/", "E"]
  STACK operators = []

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
      postfix = postfix + token + " "
    END
    PRINT "Output so far:" postfix
  END

  WHILE LENGTH(operators) > 0
    op = POP(operators)
    postfix = postfix + op + " "
  END

  PRINT "Postfix:" postfix
END
`,

  NextGreaterElement: `SCENE NextGreaterElement

DECLARE
  ARRAY arr = [4, 5, 2, 25, 7, 8]
  ARRAY answer = [0, 0, 0, 0, 0, 0]
  STACK waiting = []

SEQUENCE
  NONE = -1
  LOOP i FROM 0 TO LENGTH(arr) - 1
    UPDATE answer[i] NONE
  END

  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    WHILE LENGTH(waiting) > 0 AND arr[PEEK(waiting)] < arr[i]
      j = POP(waiting)
      UPDATE answer[j] arr[i]
      HIGHLIGHT answer[j] 'SUCCESS'
      PRINT "Next greater of" arr[j] "is" arr[i]
    END
    PUSH waiting i
  END

  WHILE LENGTH(waiting) > 0
    j = POP(waiting)
    PRINT "Nothing greater comes after" arr[j]
  END

  PRINT "Array:  " arr
  PRINT "Answer: " answer
END
`,

  StockSpan: `SCENE StockSpan

DECLARE
  ARRAY prices = [100, 80, 60, 70, 60, 75, 85]
  ARRAY spans = [0, 0, 0, 0, 0, 0, 0]
  STACK higherDays = []

SEQUENCE
  span = 0
  LOOP i FROM 0 TO LENGTH(prices) - 1
    HIGHLIGHT prices[i]
    WHILE LENGTH(higherDays) > 0 AND prices[PEEK(higherDays)] <= prices[i]
      dropped = POP(higherDays)
    END

    IF IS_EMPTY(higherDays)
      span = i + 1
    ELSE
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

DECLARE
  STACK input = [34, 3, 31, 98, 92, 23]
  STACK sorted = []

SEQUENCE
  WHILE LENGTH(input) > 0
    current = POP(input)
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

DECLARE
  STACK calls = []

SEQUENCE
  n = 5

  k = n
  WHILE k > 1
    PRINT "factorial" k "must wait for factorial" k - 1
    PUSH calls k
    k = k - 1
  END
  PRINT "factorial 1 = 1   (the base case: it waits for nothing)"

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
