/**
 * Unit tests for the AQVL parser: function declarations, RETURN, IF/ELSE,
 * LOOP, and syntax-error reporting.
 */
import { describe, expect, it } from 'vitest';
import { parseSource, getASTPaths } from '../utils/testHelpers';
import { ParseError, SyntaxError as AQVLSyntaxError } from '../../packages/compiler/src';
import type { FunctionDeclNode, IfNode, LoopNode, ReturnNode } from '../../packages/compiler/src/ast/types';

describe('Parser', () => {
  it('parses a function declaration with parameters', () => {
    const source = `SCENE Test
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
SEQUENCE
END
`;
    const ast = parseSource(source);
    const fn = ast.scenes[0].declarations.functions![0] as FunctionDeclNode;
    expect(fn.type).toBe('FunctionDeclNode');
    expect(fn.name.name).toBe('add');
    expect(fn.params.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('parses a RETURN statement with an expression value', () => {
    const source = `SCENE Test
DECLARE
  FUNCTION getValue() {
    RETURN 1 + 2
  }
SEQUENCE
END
`;
    const ast = parseSource(source);
    const fn = ast.scenes[0].declarations.functions![0] as FunctionDeclNode;
    const ret = fn.body.statements[0] as ReturnNode;
    expect(ret.type).toBe('ReturnNode');
    expect(ret.value).toMatchObject({ type: 'BinaryOpNode', operator: '+' });
  });

  it('parses IF/ELSE with both branches', () => {
    const source = `SCENE Test
DECLARE
  FUNCTION sign(x) {
    IF x > 0 {
      RETURN 1
    } ELSE {
      RETURN 0
    }
  }
SEQUENCE
END
`;
    const ast = parseSource(source);
    const fn = ast.scenes[0].declarations.functions![0] as FunctionDeclNode;
    const ifNode = fn.body.statements[0] as IfNode;
    expect(ifNode.type).toBe('IfNode');
    expect(ifNode.body).toHaveLength(1);
    expect(ifNode.elseBody).toHaveLength(1);
  });

  it('parses a LOOP statement with FROM/TO bounds', () => {
    const source = `SCENE Test
SEQUENCE
  total = 0
  LOOP i FROM 0 TO 5
    total = total + i
  END
END
`;
    const ast = parseSource(source);
    const loop = ast.scenes[0].sequence.statements[1] as LoopNode;
    expect(loop.type).toBe('LoopNode');
    expect(loop.iterator.name).toBe('i');
    expect(loop.start).toMatchObject({ value: 0 });
    expect(loop.end).toMatchObject({ value: 5 });
    expect(loop.body).toHaveLength(1);
  });

  it('produces an AST whose shape getASTPaths can enumerate', () => {
    const source = `SCENE Test
SEQUENCE
  WAIT
END
`;
    const ast = parseSource(source);
    const paths = getASTPaths(ast);
    expect(paths).toContain('scenes[0]:SceneNode');
    expect(paths).toContain('scenes[0].sequence.statements[0]:WaitNode');
  });

  it('throws a syntax error on a program missing SCENE', () => {
    expect(() => parseSource('SEQUENCE\nEND\n')).toThrow(AQVLSyntaxError);
  });

  it('throws ParseError on a missing closing paren in a function declaration', () => {
    const source = `SCENE Test
DECLARE
  FUNCTION add(a, b {
    RETURN a + b
  }
SEQUENCE
END
`;
    expect(() => parseSource(source)).toThrow(ParseError);
  });
});
