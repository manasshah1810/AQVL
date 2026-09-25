import { expect } from 'vitest';
import { Lexer, TokenType, type Token } from '../../packages/compiler/src/lexer';
import { Parser } from '../../packages/compiler/src/parser';
import type { ProgramNode } from '../../packages/compiler/src/ast/types';
import { compile as compileAQVL } from '../../packages/compiler/src';
import type { VMInstruction } from '../../packages/compiler/src/aqir/types';
import { createVM } from '../../packages/runtime/src';
import type { ExecutionResult } from '../../packages/runtime/src';

export { TokenType };
export type { Token };

/** Lexes AQVL source into a token stream (Lexer.tokenize()). */
export function lex(source: string): Token[] {
  return new Lexer(source).tokenize();
}

/** Parses a token stream into an AST (Parser.parse()). `source` is optional and only used to render error snippets. */
export function parse(tokens: Token[], source?: string): ProgramNode {
  return new Parser(tokens, source).parse();
}

/** Lexes then parses `source` in one step, for tests that don't care about the intermediate token stream. */
export function parseSource(source: string): ProgramNode {
  return parse(lex(source), source);
}

/** Runs the full compiler pipeline (lex -> parse -> validate -> optimize -> generate) and returns the AQIR instruction list. */
export function compile(source: string): VMInstruction[] {
  return compileAQVL(source).instructions;
}

/** Compiles and runs `source` on a real VM, returning the final execution result. */
export async function executeAQVL(source: string): Promise<ExecutionResult> {
  const aqir = compileAQVL(source);
  const vm = createVM(aqir.instructions, aqir.functionTable);
  return vm.run();
}

/** Asserts that calling `fn` throws an instance of `ErrorType`. */
export function expectError(fn: () => unknown, ErrorType: new (...args: any[]) => Error): void {
  expect(fn).toThrow(ErrorType);
}

/**
 * Walks an AST (or any plain object/array) and returns a flat list of dotted
 * paths annotated with each node's `type`, e.g. "scenes[0]:SceneNode",
 * "scenes[0].declarations.functions[0]:FunctionDeclNode". Useful for
 * asserting an AST's overall shape without hand-writing a full deep-equal
 * fixture.
 */
export function getASTPaths(ast: unknown): string[] {
  const paths: string[] = [];

  function walk(node: unknown, path: string): void {
    if (node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }

    const type = (node as Record<string, unknown>).type;
    if (path) paths.push(type ? `${path}:${type}` : path);

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'type' || key === 'pos') continue;
      walk(value, path ? `${path}.${key}` : key);
    }
  }

  walk(ast, '');
  return paths;
}
