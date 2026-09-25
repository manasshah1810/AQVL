export const StackScripts = {
  StackFoundation: `SCENE StackFoundation

DECLARE
  STACK s = [1, 2, 3]

SEQUENCE
  // 1. Push a new value onto the top
  PUSH s 4
  WAIT

  // 2. Peek at the top without removing it
  PEEK s
  WAIT

  // 3. Pop the top value off
  POP s
  WAIT

  // 4. Push again, LIFO order preserved
  PUSH s 10
  PEEK s
END
`,

  BalancedParentheses: `SCENE BalancedParentheses

DECLARE
  STACK brackets = []

SEQUENCE
  // Expression to check: ( ( ) ( ) )
  // Push on every open bracket, pop on every matching close bracket.

  PUSH brackets 1
  WAIT

  PUSH brackets 1
  WAIT

  // Closing bracket found -> pop the most recent open
  POP brackets
  WAIT

  PUSH brackets 1
  WAIT

  // Closing bracket found -> pop
  POP brackets
  WAIT

  // Final closing bracket -> pop
  POP brackets
  WAIT

  // Stack is empty -> the expression is balanced
END
`,

  ReverseStringWithStack: `SCENE ReverseStringWithStack

DECLARE
  STACK letters = []
  ARRAY word = [72, 69, 76, 76, 79]

SEQUENCE
  // Push every character (as its code) onto the stack
  LOOP i FROM 0 TO LENGTH(word) - 1
    PUSH letters word[i]
    WAIT
  END

  // Popping now yields the characters in reverse order
  LOOP i FROM 0 TO LENGTH(word) - 1
    PEEK letters
    POP letters
    WAIT
  END
END
`,

  ReverseArrayWithStack: `SCENE ReverseArrayWithStack

DECLARE
  ARRAY arr = [10, 20, 30, 40, 50]
  STACK helper = []

SEQUENCE
  // Push every element onto the stack, left to right
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    PUSH helper arr[i]
    WAIT
  END

  // Popping now returns the elements in reverse order
  LOOP i FROM 0 TO LENGTH(arr) - 1
    PEEK helper
    POP helper
    WAIT
  END
END
`,

  NextGreaterElement: `SCENE NextGreaterElement

DECLARE
  ARRAY arr = [4, 5, 2, 25]
  STACK candidates = []

SEQUENCE
  // Classic monotonic-stack pattern: for each element, pop every
  // stacked index whose value is smaller — the current element is
  // their "next greater element".

  HIGHLIGHT arr[0]
  PUSH candidates arr[0]
  WAIT

  HIGHLIGHT arr[1]
  COMPARE arr[1] arr[0]
  // arr[1] > arr[0] -> arr[0]'s next greater is arr[1]
  POP candidates
  PUSH candidates arr[1]
  WAIT

  HIGHLIGHT arr[2]
  COMPARE arr[2] arr[1]
  // arr[2] < arr[1] -> keep both on the stack
  PUSH candidates arr[2]
  WAIT

  HIGHLIGHT arr[3]
  COMPARE arr[3] arr[2]
  // arr[3] > arr[2] -> arr[2]'s next greater is arr[3]
  POP candidates
  COMPARE arr[3] arr[1]
  // arr[3] > arr[1] -> arr[1]'s next greater is also arr[3]
  POP candidates
  PUSH candidates arr[3]
  WAIT
END
`,

  EvaluatePostfixExpression: `SCENE EvaluatePostfixExpression

DECLARE
  STACK operands = []

SEQUENCE
  // Postfix expression: 2 3 4 * +  (means 2 + (3 * 4) = 14)

  PUSH operands 2
  WAIT

  PUSH operands 3
  WAIT

  PUSH operands 4
  WAIT

  // Operator '*' -> pop two operands, push their product
  PEEK operands
  POP operands
  PEEK operands
  POP operands
  PUSH operands 12
  WAIT

  // Operator '+' -> pop two operands, push their sum
  PEEK operands
  POP operands
  PEEK operands
  POP operands
  PUSH operands 14
  WAIT

  // Final result left on the stack: 14
  PEEK operands
END
`
};
