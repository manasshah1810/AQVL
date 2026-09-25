/**
 * Coverage for the "final polish" pass: negative number literals (vs the
 * subtraction operator), static type checking, and the shape of every
 * generated error message (line:col, source snippet, caret, suggestion).
 */
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { lex, parseSource, TokenType } from '../utils/testHelpers';
import {
  compile,
  TypeMismatchError,
  SemanticError,
  UndeclaredFunctionError,
  WrongArgumentCountError,
  OutOfBoundsError,
  SyntaxError as AQVLSyntaxError,
  generateErrorMessage,
} from '../../packages/compiler/src';
import type { BinaryOpNode, LiteralNode, ExpressionStatementNode } from '../../packages/compiler/src/ast/types';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe('Negative numbers vs subtraction', () => {
  it('lexes -5 as a single negative number literal', () => {
    const tokens = lex('-5');
    expect(tokens[0]).toMatchObject({ type: TokenType.Number, value: '-5' });
  });

  it('lexes a negative float literal', () => {
    const tokens = lex('-3.14');
    expect(tokens[0]).toMatchObject({ type: TokenType.Number, value: '-3.14' });
  });

  it('lexes x - 5 as three tokens: identifier, "-" operator, number', () => {
    const tokens = lex('x - 5');
    const nonEOF = tokens.filter((t) => t.type !== TokenType.EOF);
    expect(nonEOF).toMatchObject([
      { type: TokenType.Identifier, value: 'x' },
      { type: TokenType.Symbol, value: '-' },
      { type: TokenType.Number, value: '5' },
    ]);
  });

  it('lexes 5 - -3 as subtraction followed by a negative literal (double negation)', () => {
    const tokens = lex('5 - -3');
    const nonEOF = tokens.filter((t) => t.type !== TokenType.EOF);
    expect(nonEOF).toMatchObject([
      { type: TokenType.Number, value: '5' },
      { type: TokenType.Symbol, value: '-' },
      { type: TokenType.Number, value: '-3' },
    ]);
  });

  it('parses a negative number in an array literal', () => {
    const source = `SCENE Neg
DECLARE
  ARRAY arr = [-5, 2, 3]
SEQUENCE
END
`;
    expect(() => compile(source)).not.toThrow();
  });

  it('parses "arr[0] - arr[1]" as subtraction, not a negative index', () => {
    const ast = parseSource(`SCENE S
SEQUENCE
  COMPARE arr[0] - arr[1] 0
END
`);
    const compareNode = ast.scenes[0].sequence.statements[0] as any;
    const left = compareNode.left as BinaryOpNode;
    expect(left.type).toBe('BinaryOpNode');
    expect(left.operator).toBe('-');
  });

  it('parses "result = 5 - -3" as (5 - (-3))', () => {
    const ast = parseSource(`SCENE S
SEQUENCE
  result = 5 - -3
END
`);
    const stmt = ast.scenes[0].sequence.statements[0] as ExpressionStatementNode;
    const assignment = stmt.expression as BinaryOpNode;
    const subtraction = assignment.right as BinaryOpNode;
    expect(subtraction.operator).toBe('-');
    expect((subtraction.left as LiteralNode).value).toBe(5);
    expect((subtraction.right as LiteralNode).value).toBe(-3);
  });
});

describe('Type checking', () => {
  it('detects a type mismatch between a string and a number under subtraction', () => {
    const source = `SCENE Bad
SEQUENCE
  result = "hello" - 5
END
`;
    expect(() => compile(source)).toThrow(TypeMismatchError);
  });

  it('reports a clear message naming the offending types and operator', () => {
    const source = `SCENE Bad
SEQUENCE
  result = "hello" * 2
END
`;
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TypeMismatchError);
      expect((e as TypeMismatchError).message).toMatch(/'\*'/);
      expect((e as TypeMismatchError).message).toMatch(/STRING/);
    }
  });

  it('allows string concatenation with + (no false positive)', () => {
    const source = `SCENE Ok
SEQUENCE
  result = "count: " + 5
END
`;
    expect(() => compile(source)).not.toThrow();
  });

  it('allows arithmetic between numbers (no false positive)', () => {
    const source = `SCENE Ok
SEQUENCE
  result = 5 - -3 * 2
END
`;
    expect(() => compile(source)).not.toThrow();
  });
});

describe('Error message quality', () => {
  it('an undeclared variable suggests the closest declared name', () => {
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

  it('calling an undeclared function suggests a similarly named function', () => {
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

  it('a wrong argument count reports both expected and actual counts', () => {
    const source = `SCENE Bad
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
SEQUENCE
  result = add(1, 2, 3)
END
`;
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(WrongArgumentCountError);
      expect((e as WrongArgumentCountError).message).toContain('2');
      expect((e as WrongArgumentCountError).message).toContain('3');
    }
  });

  it('an out-of-bounds array index reports the array length', () => {
    const source = `SCENE Bad
DECLARE
  ARRAY arr = [1, 2, 3]
SEQUENCE
  COMPARE arr[0] arr[10]
END
`;
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OutOfBoundsError);
      expect((e as OutOfBoundsError).message).toContain('3');
      expect((e as OutOfBoundsError).message).toContain('10');
    }
  });

  it('RETURN outside of a function is rejected', () => {
    const source = `SCENE Bad
SEQUENCE
  RETURN 5
END
`;
    expect(() => compile(source)).toThrow(AQVLSyntaxError);
  });

  it('generateErrorMessage renders the type, location, source snippet, and caret', () => {
    const source = `SCENE Bad
SEQUENCE
  result = "hello" - 5
END
`;
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e) {
      const rendered = generateErrorMessage(e as TypeMismatchError);
      expect(rendered).toContain('TypeMismatchError');
      expect(rendered).toMatch(/line \d+, col \d+/);
      expect(rendered).toContain('^');
    }
  });
});
