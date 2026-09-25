/**
 * Unit tests for the AQVL lexer: token types, whitespace/comment handling,
 * line/column tracking, and error reporting on invalid input.
 */
import { describe, expect, it } from 'vitest';
import { lex, TokenType } from '../utils/testHelpers';
import { TokenError } from '../../packages/compiler/src';

describe('Lexer', () => {
  it('tokenizes an identifier', () => {
    const tokens = lex('myVariable');
    expect(tokens[0]).toMatchObject({ type: TokenType.Identifier, value: 'myVariable' });
  });

  it('tokenizes a number', () => {
    const tokens = lex('42');
    expect(tokens[0]).toMatchObject({ type: TokenType.Number, value: '42' });
  });

  it('tokenizes a decimal number', () => {
    const tokens = lex('3.14');
    expect(tokens[0]).toMatchObject({ type: TokenType.Number, value: '3.14' });
  });

  it('tokenizes a keyword', () => {
    const tokens = lex('SCENE');
    expect(tokens[0]).toMatchObject({ type: TokenType.Keyword, value: 'SCENE' });
  });

  it('tokenizes single-character and two-character operators/symbols', () => {
    expect(lex('+')[0]).toMatchObject({ type: TokenType.Symbol, value: '+' });
    expect(lex('<=')[0]).toMatchObject({ type: TokenType.Symbol, value: '<=' });
    expect(lex('==')[0]).toMatchObject({ type: TokenType.Symbol, value: '==' });
    expect(lex('->')[0]).toMatchObject({ type: TokenType.Symbol, value: '->' });
  });

  it('skips whitespace and single-line comments between tokens', () => {
    const tokens = lex('  \t 42  \n // a comment\n  43');
    const nonEOF = tokens.filter((t) => t.type !== TokenType.EOF);
    expect(nonEOF.map((t) => t.value)).toEqual(['42', '43']);
  });

  it('includes line and column position on each token', () => {
    const tokens = lex('a\nbb');
    expect(tokens[0].pos).toEqual({ line: 1, column: 1 });
    expect(tokens[1].pos).toEqual({ line: 2, column: 1 });
  });

  it('always terminates the stream with an EOF token', () => {
    const tokens = lex('a');
    expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
  });

  it('throws TokenError on an unexpected character', () => {
    expect(() => lex('@')).toThrow(TokenError);
  });

  it('throws TokenError with a suggestion on an unterminated string', () => {
    try {
      lex('"unterminated');
      throw new Error('expected lex() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TokenError);
      expect((e as InstanceType<typeof TokenError>).suggestion).toBeDefined();
    }
  });
});
