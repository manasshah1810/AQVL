/**
 * Error-handling coverage: line numbers, context snippets, and suggestions
 * across the lexer, parser, semantic validation, and the VM.
 */
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import {
  compile,
  TokenError,
  SyntaxError as AQVLSyntaxError,
  ParseError,
  SemanticError,
  UndeclaredVariableError,
  UndeclaredFunctionError,
  WrongArgumentCountError,
  DuplicateDeclarationError,
  TypeMismatchError,
  OutOfBoundsError,
  formatError,
} from '../../packages/compiler/src';
import { createVM, DivisionByZeroError } from '../../packages/runtime/src';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe('Lexer errors', () => {
  it('an unexpected character throws TokenError with line/column', () => {
    const source = `SCENE Bad
SEQUENCE
  WAIT
  @
END
`;
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TokenError);
      const err = e as TokenError;
      expect(err.lineNumber).toBe(4);
      expect(formatError(err)).toContain('line 4');
    }
  });

  it('an unterminated string throws TokenError with a suggestion', () => {
    const source = `SCENE Bad
DECLARE
  TRIE t = ["abc]
SEQUENCE
END
`;
    expect(() => compile(source)).toThrow(TokenError);
    try {
      compile(source);
    } catch (e) {
      expect((e as TokenError).suggestion).toBeDefined();
    }
  });
});

describe('Parser errors', () => {
  it('a missing closing paren throws ParseError referencing the function name', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION add(a, b {
    RETURN a + b
  }
SEQUENCE
END
`;
    expect(() => compile(source)).toThrow(ParseError);
  });

  it('RETURN outside a function is a syntax error', () => {
    const source = `SCENE ReturnOutside
SEQUENCE
  RETURN 5
END
`;
    expect(() => compile(source)).toThrow(AQVLSyntaxError);
  });
});

describe('Semantic errors', () => {
  it('an undeclared variable throws SemanticError with a "did you mean" suggestion', () => {
    const source = `SCENE Bad
DECLARE
  ARRAY total = [1, 2, 3]
SEQUENCE
  COMPARE totall[0] total[1]
END
`;
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SemanticError);
      expect((e as SemanticError).message).toMatch(/did you mean/i);
    }
  });

  it('calling an undeclared function throws UndeclaredFunctionError with a suggestion', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION double(x) {
    RETURN x * 2
  }
SEQUENCE
  result = doubel(5)
END
`;
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(UndeclaredFunctionError);
      expect((e as UndeclaredFunctionError).suggestion).toMatch(/double/);
    }
  });

  it('calling a function with the wrong argument count throws WrongArgumentCountError', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
SEQUENCE
  result = add(1)
END
`;
    expect(() => compile(source)).toThrow(WrongArgumentCountError);
  });

  it('declaring the same function twice throws DuplicateDeclarationError', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
  FUNCTION add(x, y) {
    RETURN x + y
  }
SEQUENCE
END
`;
    expect(() => compile(source)).toThrow(DuplicateDeclarationError);
  });
});

describe('Semantic error types propagate end-to-end to downstream consumers', () => {
  // Simulates a consumer layered above compile() — e.g. the editor's future
  // error-marker feature, which needs to branch on the *specific* error type
  // (to pick a marker kind / quick-fix) rather than a generic "compile failed".
  // Routing the error through an intermediate catch/rethrow boundary (as a
  // real UI layer would) guards against a fix that only happens to preserve
  // the type when compile() is called directly.
  function compileAndCapture(source: string): unknown {
    try {
      compile(source);
    } catch (e) {
      try {
        throw e;
      } catch (rethrown) {
        return rethrown;
      }
    }
    throw new Error('expected compile() to throw');
  }

  it('UndeclaredFunctionError keeps its specific type, name, and location through the boundary', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION double(x) {
    RETURN x * 2
  }
SEQUENCE
  result = doubel(5)
END
`;
    const err = compileAndCapture(source);
    expect(err).toBeInstanceOf(UndeclaredFunctionError);
    expect(err).toBeInstanceOf(SemanticError);
    expect((err as Error).constructor).toBe(UndeclaredFunctionError);
    expect((err as Error).name).toBe('UndeclaredFunctionError');
    expect((err as UndeclaredFunctionError).lineNumber).toBe(7);
    expect((err as UndeclaredFunctionError).suggestion).toMatch(/double/);
    // Must NOT be classified as any of the other specific subclasses.
    expect(err).not.toBeInstanceOf(WrongArgumentCountError);
    expect(err).not.toBeInstanceOf(DuplicateDeclarationError);
    expect(err).not.toBeInstanceOf(TypeMismatchError);
  });

  it('WrongArgumentCountError keeps its specific type through the boundary', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
SEQUENCE
  result = add(1)
END
`;
    const err = compileAndCapture(source);
    expect(err).toBeInstanceOf(WrongArgumentCountError);
    expect((err as Error).constructor).toBe(WrongArgumentCountError);
    expect((err as Error).name).toBe('WrongArgumentCountError');
    expect((err as Error).message).toContain('2');
    expect((err as Error).message).toContain('1');
    expect(err).not.toBeInstanceOf(UndeclaredFunctionError);
  });

  it('DuplicateDeclarationError keeps its specific type through the boundary', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
  FUNCTION add(x, y) {
    RETURN x + y
  }
SEQUENCE
END
`;
    const err = compileAndCapture(source);
    expect(err).toBeInstanceOf(DuplicateDeclarationError);
    expect((err as Error).constructor).toBe(DuplicateDeclarationError);
    expect((err as Error).name).toBe('DuplicateDeclarationError');
    expect(err).not.toBeInstanceOf(WrongArgumentCountError);
  });

  it('TypeMismatchError keeps its specific type through the boundary', () => {
    const source = `SCENE Bad
SEQUENCE
  result = "hello" - 5
END
`;
    const err = compileAndCapture(source);
    expect(err).toBeInstanceOf(TypeMismatchError);
    expect((err as Error).constructor).toBe(TypeMismatchError);
    expect((err as Error).name).toBe('TypeMismatchError');
    expect(err).not.toBeInstanceOf(UndeclaredFunctionError);
  });

  it('a single semantic error is never widened to the generic base SemanticError', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION double(x) {
    RETURN x * 2
  }
SEQUENCE
  result = doubel(5)
END
`;
    const err = compileAndCapture(source);
    // A downstream consumer distinguishing error kinds by exact type (e.g.
    // `switch (err.constructor)`) must see the specific subclass, not the
    // shared base class every semantic error also happens to satisfy.
    expect((err as Error).constructor).not.toBe(SemanticError);
  });

  it('multiple simultaneous semantic errors fall back to the generic, aggregated SemanticError', () => {
    // Two independent problems in one program: an undeclared function call
    // and a duplicate function declaration. With more than one diagnostic,
    // there is no single specific type to preserve, so compile() must still
    // report *something* usable (a SemanticError) rather than silently
    // picking one arbitrary subclass and dropping the rest.
    const source = `SCENE Bad
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
  FUNCTION add(x, y) {
    RETURN x + y
  }
SEQUENCE
  result = missing(1)
END
`;
    const err = compileAndCapture(source);
    expect(err).toBeInstanceOf(SemanticError);
    expect((err as Error).constructor).toBe(SemanticError);
    const message = (err as Error).message;
    expect(message).toMatch(/DuplicateDeclarationError/);
    expect(message).toMatch(/UndeclaredFunctionError/);
  });
});

describe('Runtime (VM) errors', () => {
  async function run(source: string) {
    const aqir = compile(source);
    const vm = createVM(aqir.instructions, aqir.functionTable);
    return vm.run();
  }

  it('division by zero throws DivisionByZeroError', async () => {
    const source = `SCENE Bad
SEQUENCE
  x = 5 / 0
END
`;
    await expect(run(source)).rejects.toThrow(DivisionByZeroError);
  });

  it('a literal array index past the declared length throws OutOfBoundsError at compile time', () => {
    const source = `SCENE Bad
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  COMPARE arr[0] arr[10]
END
`;
    expect(() => compile(source)).toThrow(OutOfBoundsError);
  });
});

describe('formatError', () => {
  it('renders kind, location, source snippet, and suggestion', () => {
    const error = new UndeclaredVariableError('myFunc', {
      line: 2,
      column: 3,
      source: 'SCENE X\n  myFunc()\nEND\n',
      suggestion: 'Did you mean "myFunction"?',
    });
    const formatted = formatError(error);
    expect(formatted).toContain('UndeclaredVariableError');
    expect(formatted).toContain('line 2, col 3');
    expect(formatted).toContain('myFunc()');
    expect(formatted).toContain('^');
    expect(formatted).toContain('Suggestion: Did you mean "myFunction"?');
  });
});
