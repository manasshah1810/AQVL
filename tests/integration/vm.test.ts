/**
 * Phase 1 end-to-end integration tests: source -> compile() -> AQIR -> VM.
 *
 * Exercises the real pipeline (lexer -> parser -> semantic validation ->
 * optimizer -> AQIR generator) feeding the real AQVLVirtualMachine (PC, call
 * stack, lexical scopes) - no mocking of either side.
 *
 * Two AQVL language constraints shape a few tests below (there is no
 * workaround - these are current grammar limits, not test bugs):
 *  - No BREAK/CONTINUE and no WHILE - only `LOOP i FROM a TO b`, a bounded
 *    counting loop. "Break early" is therefore simulated with a guard
 *    condition inside the loop body rather than a real break statement.
 *  - No AND/OR/&&/|| operators. A "complex condition" is built by composing
 *    boolean comparison results arithmetically (multiplication for AND-like,
 *    addition for OR-like), since comparisons evaluate to real JS booleans.
 *  - ELSE is only available in FUNCTION-body IF (brace-delimited); the
 *    legacy top-level SEQUENCE/LOOP IF is END-delimited with no ELSE.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import {
  compile,
  UndeclaredFunctionError,
  SemanticError,
  OutOfBoundsError,
} from '../../packages/compiler/src';
import { createVM, StackOverflowError, type ExecutionResult } from '../../packages/runtime/src';

// compile() logs the full token/AST/AQIR dump on every call for debugging;
// silence it so `vitest run` output stays readable across many compiles.
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

/** Compiles and runs `source` on a real VM, returning the final execution result. */
async function executeAQVL(source: string): Promise<ExecutionResult> {
  const aqir = compile(source);
  const vm = createVM(aqir.instructions, aqir.functionTable);
  return vm.run();
}

describe('1. Variable scoping', () => {
  it("a function's locals don't leak into globals", async () => {
    const source = `SCENE LocalLeak
DECLARE
  FUNCTION compute() {
    localOnly = 99
    RETURN localOnly
  }
SEQUENCE
  result = compute()
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(99);
    expect(result.finalState.globals.localOnly).toBeUndefined();
  });

  it('a function reads globals set before it is called', async () => {
    const source = `SCENE ReadGlobal
DECLARE
  FUNCTION readIt() {
    RETURN sharedValue
  }
SEQUENCE
  sharedValue = 77
  result = readIt()
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(77);
  });

  it('a parameter shadows a global of the same name without mutating it', async () => {
    const source = `SCENE ParamShadow
DECLARE
  FUNCTION shadowTest(x) {
    RETURN x + 1
  }
SEQUENCE
  x = 100
  result = shadowTest(5)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(6);
    expect(result.finalState.globals.x).toBe(100);
  });

  it('two functions with locals of the same name stay independent', async () => {
    const source = `SCENE IndependentLocals
DECLARE
  FUNCTION setLocalTo1() {
    local = 1
    RETURN local
  }
  FUNCTION setLocalTo2() {
    local = 2
    RETURN local
  }
SEQUENCE
  r1 = setLocalTo1()
  r2 = setLocalTo2()
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.r1).toBe(1);
    expect(result.finalState.globals.r2).toBe(2);
    expect(result.finalState.globals.local).toBeUndefined();
  });
});

describe('2. Function calls', () => {
  it('a simple function returns a computed value', async () => {
    const source = `SCENE SimpleReturn
DECLARE
  FUNCTION square(x) {
    RETURN x * x
  }
SEQUENCE
  result = square(6)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(36);
  });

  it('a function accepts and uses multiple parameters', async () => {
    const source = `SCENE MultiParam
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
SEQUENCE
  result = add(3, 4)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(7);
  });

  it('a function with no parameters returns a constant', async () => {
    const source = `SCENE NoParams
DECLARE
  FUNCTION getAnswer() {
    RETURN 42
  }
SEQUENCE
  result = getAnswer()
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(42);
  });

  it('nested calls pass one function\'s return value as another\'s argument', async () => {
    const source = `SCENE NestedCalls
DECLARE
  FUNCTION double(x) {
    RETURN x * 2
  }
  FUNCTION increment(x) {
    RETURN x + 1
  }
SEQUENCE
  result = increment(double(5))
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(11); // (5*2)+1
  });

  it('a call can appear inside a larger arithmetic expression', async () => {
    const source = `SCENE CallInExpression
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
SEQUENCE
  result = add(1, 2) + add(3, 4)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(10); // 3 + 7
  });
});

describe('3. Recursion', () => {
  it('fibonacci(5) = 5', async () => {
    const source = `SCENE Fibonacci
DECLARE
  FUNCTION fib(n) {
    IF n <= 1 {
      RETURN n
    }
    RETURN fib(n - 1) + fib(n - 2)
  }
SEQUENCE
  result = fib(5)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(5);
  });

  it('factorial(5) = 120', async () => {
    const source = `SCENE Factorial
DECLARE
  FUNCTION factorial(n) {
    IF n <= 1 {
      RETURN 1
    }
    RETURN n * factorial(n - 1)
  }
SEQUENCE
  result = factorial(5)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(120);
  });

  it('tail-recursive accumulator sums 1..10 = 55', async () => {
    const source = `SCENE TailRecursion
DECLARE
  FUNCTION sumTo(n, acc) {
    IF n <= 0 {
      RETURN acc
    }
    RETURN sumTo(n - 1, acc + n)
  }
SEQUENCE
  result = sumTo(10, 0)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(55);
  });

  it('mutual recursion: isEven/isOdd call each other correctly', async () => {
    const source = `SCENE MutualRecursion
DECLARE
  FUNCTION isEven(n) {
    IF n <= 0 {
      RETURN 1
    }
    RETURN isOdd(n - 1)
  }
  FUNCTION isOdd(n) {
    IF n <= 0 {
      RETURN 0
    }
    RETURN isEven(n - 1)
  }
SEQUENCE
  evenResult = isEven(10)
  oddResult = isOdd(10)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.evenResult).toBe(1); // 10 is even
    expect(result.finalState.globals.oddResult).toBe(0); // 10 is not odd
  });

  it('unbounded recursion is caught cleanly as StackOverflowError, not a crash', async () => {
    const source = `SCENE InfiniteRecursion
DECLARE
  FUNCTION loopForever(n) {
    RETURN loopForever(n + 1)
  }
SEQUENCE
  result = loopForever(0)
END
`;
    await expect(executeAQVL(source)).rejects.toThrow(StackOverflowError);
  });
});

describe('4. Loops', () => {
  it('LOOP with a counter accumulates a running total (AQVL has no WHILE, only bounded LOOP FROM/TO)', async () => {
    const source = `SCENE CounterLoop
SEQUENCE
  total = 0
  count = 0
  LOOP i FROM 1 TO 5
    total = total + i
    count = count + 1
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.total).toBe(15); // 1+2+3+4+5
    expect(result.finalState.globals.count).toBe(5);
  });

  it('an early-exit guard (no BREAK keyword exists) skips work once a condition is met', async () => {
    const source = `SCENE GuardedEarlyExit
SEQUENCE
  stopped = 0
  processedCount = 0
  LOOP i FROM 1 TO 10
    IF stopped = 0
      IF i = 4
        stopped = 1
      END
      processedCount = processedCount + 1
    END
  END
END
`;
    const result = await executeAQVL(source);
    // Guard lets i=1..4 through (processedCount increments before the flag
    // flips on i=4), then i=5..10 are skipped - simulating a break at i=4.
    expect(result.finalState.globals.processedCount).toBe(4);
    expect(result.finalState.globals.stopped).toBe(1);
  });

  it('nested loops multiply their iteration effects', async () => {
    const source = `SCENE NestedLoops
SEQUENCE
  total = 0
  LOOP i FROM 1 TO 3
    LOOP j FROM 1 TO 3
      product = i * j
      total = total + product
    END
  END
END
`;
    const result = await executeAQVL(source);
    // sum over i,j in 1..3 of i*j = (1+2+3) * (1+2+3) = 36
    expect(result.finalState.globals.total).toBe(36);
  });

  it('state mutated on each iteration reflects every pass (running product = factorial via LOOP)', async () => {
    const source = `SCENE MutatedRunningState
SEQUENCE
  value = 1
  LOOP i FROM 1 TO 5
    value = value * i
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.value).toBe(120); // 5!
  });

  it('a descending LOOP with literal bounds counts down', async () => {
    const source = `SCENE LiteralDescending
SEQUENCE
  count = 0
  firstValue = -1
  LOOP i FROM 5 TO 1
    IF firstValue = -1
      firstValue = i
    END
    count = count + 1
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.count).toBe(5); // 5,4,3,2,1
    expect(result.finalState.globals.firstValue).toBe(5);
  });

  it('a descending LOOP with a non-literal (runtime-only) start bound still counts down', async () => {
    // `n` is a plain SEQUENCE variable, not statically foldable by the
    // optimizer (only LENGTH(arr) and literal arithmetic are), so the
    // generator must detect descent at runtime rather than compile time.
    const source = `SCENE NonLiteralDescending
SEQUENCE
  n = 3
  count = 0
  firstValue = -1
  LOOP i FROM n TO 0
    IF firstValue = -1
      firstValue = i
    END
    count = count + 1
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.count).toBe(4); // 3,2,1,0
    expect(result.finalState.globals.firstValue).toBe(3);
  });

  it('an ascending LOOP with non-literal bounds still counts up the correct number of times', async () => {
    const source = `SCENE NonLiteralAscending
SEQUENCE
  n = 4
  count = 0
  firstValue = -1
  LOOP i FROM 0 TO n
    IF firstValue = -1
      firstValue = i
    END
    count = count + 1
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.count).toBe(5); // 0,1,2,3,4
    expect(result.finalState.globals.firstValue).toBe(0);
  });

  it('a function called inside a loop accumulates across iterations', async () => {
    const source = `SCENE CallInLoop
DECLARE
  FUNCTION square(x) {
    RETURN x * x
  }
SEQUENCE
  sumSquares = 0
  LOOP i FROM 1 TO 4
    sumSquares = sumSquares + square(i)
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.sumSquares).toBe(30); // 1+4+9+16
  });
});

describe('5. Conditionals', () => {
  it('IF with a true condition runs its body', async () => {
    const source = `SCENE IfTrue
SEQUENCE
  result = 0
  flag = 1
  IF flag > 0
    result = 42
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(42);
  });

  it('IF with a false condition skips its body', async () => {
    const source = `SCENE IfFalse
SEQUENCE
  result = 0
  flag = 0
  IF flag > 0
    result = 42
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.result).toBe(0);
  });

  it('IF/ELSE (function body) takes the correct branch both ways', async () => {
    const source = `SCENE IfElseBoth
DECLARE
  FUNCTION classify(n) {
    IF n > 0 {
      RETURN 1
    } ELSE {
      RETURN 0 - 1
    }
  }
SEQUENCE
  posResult = classify(5)
  negResult = classify(0 - 5)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.posResult).toBe(1);
    expect(result.finalState.globals.negResult).toBe(-1);
  });

  it('nested IF/ELSE resolves all three branches of a sign function', async () => {
    const source = `SCENE NestedIfElse
DECLARE
  FUNCTION sign(n) {
    IF n > 0 {
      RETURN 1
    } ELSE {
      IF n < 0 {
        RETURN 0 - 1
      } ELSE {
        RETURN 0
      }
    }
  }
SEQUENCE
  a = sign(5)
  b = sign(0 - 5)
  c = sign(0)
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.a).toBe(1);
    expect(result.finalState.globals.b).toBe(-1);
    expect(result.finalState.globals.c).toBe(0);
  });

  it('a composite AND/OR-style condition, built from arithmetic over comparisons, evaluates correctly', async () => {
    // AQVL has no AND/OR/&&/|| operators. Comparisons evaluate to real JS
    // booleans, so multiplication composes an AND (true only if both are
    // truthy) and addition composes an OR (truthy if at least one is).
    const source = `SCENE CompositeCondition
SEQUENCE
  a = 5
  b = 10
  condA = a > 0
  condB = b > 0
  condC = a > 100
  andResult = 0
  orResult = 0
  IF condA * condB
    andResult = 1
  END
  IF condA + condC
    orResult = 1
  END
END
`;
    const result = await executeAQVL(source);
    expect(result.finalState.globals.andResult).toBe(1); // both condA and condB true
    expect(result.finalState.globals.orResult).toBe(1); // condA true, condC false
  });
});

describe('6. Error handling', () => {
  it('referencing an undefined variable throws SemanticError at compile time', () => {
    const source = `SCENE UndefinedVar
SEQUENCE
  result = totallyUndefinedVariable + 1
END
`;
    expect(() => compile(source)).toThrow(SemanticError);
  });

  it('calling an undefined function throws UndeclaredFunctionError at compile time', () => {
    const source = `SCENE UndefinedFunc
SEQUENCE
  undefinedFunc()
END
`;
    expect(() => compile(source)).toThrow(UndeclaredFunctionError);
  });

  it('an out-of-bounds literal array index throws OutOfBoundsError at compile time', () => {
    const source = `SCENE OutOfBounds
DECLARE
  ARRAY arr = [1, 2, 3]

SEQUENCE
  COMPARE arr[0] arr[10]
END
`;
    expect(() => compile(source)).toThrow(OutOfBoundsError);
  });

  it('RETURN outside a function is rejected at compile time', () => {
    const source = `SCENE ReturnOutside
SEQUENCE
  RETURN 5
END
`;
    expect(() => compile(source)).toThrow();
  });

  it('unbounded recursion throws StackOverflowError instead of crashing the process', async () => {
    const source = `SCENE StackOverflowCase
DECLARE
  FUNCTION recurseForever(n) {
    RETURN recurseForever(n + 1)
  }
SEQUENCE
  result = recurseForever(0)
END
`;
    await expect(executeAQVL(source)).rejects.toThrow(StackOverflowError);
  });
});

describe('7. Mixed / backward compatibility', () => {
  // Phase 0's action-based instructions (COMPARE_OBJECTS, GENERIC_ACTION, ...)
  // are interpreted by AnimationController against a live SceneManager/3D
  // scene, out of scope for a VM-focused test - so these check what Phase 1
  // could actually break: that the legacy END-delimited grammar still
  // compiles to the same AQIR after adding FUNCTION/RETURN/IF-ELSE/CALL.
  it('BST insert/search still compiles to the legacy GENERIC_ACTION sequence', () => {
    const source = `SCENE BSTOperations
DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  SEARCH 30
END
`;
    const aqir = compile(source);
    const actionNames = aqir.instructions
      .filter((i: any) => i.action === 'GENERIC_ACTION')
      .map((i: any) => i.actionName);
    expect(actionNames).toEqual(['INSERT', 'INSERT', 'INSERT', 'SEARCH']);
  });

  it('linear search (COMPARE/HIGHLIGHT over an ARRAY) still compiles to the same animation instructions, with a backfilled default layout', () => {
    const source = `SCENE LinearSearch
DECLARE
  ARRAY arr = [12, 34, 25, 64, 22, 11, 90]

SEQUENCE
  COMPARE arr[0] arr[4]
  COMPARE arr[1] arr[4]
  COMPARE arr[2] arr[4]
  COMPARE arr[3] arr[4]
  COMPARE arr[4] arr[4]
  HIGHLIGHT arr[4] 'SUCCESS'
END
`;
    const aqir = compile(source);
    const actionTypes = aqir.instructions.map((i: any) => i.action);
    // No LAYOUT statement anywhere in source -> the generator backfills
    // "arr"'s default layout (spatial-syntax-spec.md §4) immediately after
    // its DECLARE, ahead of the animation instructions below — see
    // docs/design/aqir-geometry-spec.md §4 (backward compatibility). The
    // animation instructions themselves (COMPARE_OBJECTS/HIGHLIGHT_OBJECT)
    // are unchanged.
    expect(actionTypes).toEqual([
      'SET_LAYOUT_STRATEGY',
      'COMPUTE_LAYOUT',
      'COMPARE_OBJECTS',
      'COMPARE_OBJECTS',
      'COMPARE_OBJECTS',
      'COMPARE_OBJECTS',
      'COMPARE_OBJECTS',
      'HIGHLIGHT_OBJECT',
    ]);
  });

  it.todo('merge sort over a real FUNCTION-based recursive implementation (Phase 3)');

  it.todo('BFS graph traversal over a real FUNCTION-based implementation (Phase 4)');
});
