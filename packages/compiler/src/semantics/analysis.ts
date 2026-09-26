/**
 * Function-declaration/call validation for AQVL: catches calls to undeclared
 * functions, wrong argument counts, and duplicate function declarations —
 * none of which the live `SemanticValidator` (../semantic/validator.ts)
 * checks, since it only tracks scene-level variables/objects. Without this
 * pass, a call like `add(1)` to a two-parameter function silently binds the
 * missing parameter to `undefined` instead of failing to compile.
 *
 * Wired into `compile()` in ../index.ts, run once per program.
 */

import {
  UndeclaredFunctionError,
  DuplicateDeclarationError,
  WrongArgumentCountError,
  ReturnOutsideFunctionError,
  suggestFor,
  type CompileError,
} from '@aqvl/shared';
import type {
  ProgramNode,
  SceneNode,
  StatementNode,
  ExpressionNode,
  FunctionDeclNode,
  BlockNode,
  Position,
} from '../ast/types';
import { ValidationContext } from '../validator';

interface FunctionSignature {
  name: string;
  paramCount: number;
}

/** Validates every function declaration/call in `program`, given the original `source` (for error snippets). */
export function analyzeFunctions(program: ProgramNode, source?: string): ValidationContext {
  const ctx = new ValidationContext();
  for (const scene of program.scenes) {
    analyzeScene(scene, ctx, source);
  }
  return ctx;
}

function collectFunctionSignatures(
  functions: FunctionDeclNode[],
  ctx: ValidationContext,
  source: string | undefined
): Map<string, FunctionSignature> {
  const signatures = new Map<string, FunctionSignature>();
  for (const fn of functions) {
    const name = fn.name.name;
    if (signatures.has(name)) {
      ctx.addError(new DuplicateDeclarationError('function', name, posOptions(fn.name.pos, source)));
      continue;
    }
    signatures.set(name, { name, paramCount: fn.params.length });
  }
  return signatures;
}

/** Recursively gathers every FunctionDeclNode in the program, including ones nested inside another function's body. */
function collectAllFunctions(functions: FunctionDeclNode[]): FunctionDeclNode[] {
  const all: FunctionDeclNode[] = [];
  for (const fn of functions) {
    all.push(fn);
    const nested = fn.body.statements.filter((s): s is FunctionDeclNode => s.type === 'FunctionDeclNode');
    all.push(...collectAllFunctions(nested));
  }
  return all;
}

function analyzeScene(scene: SceneNode, ctx: ValidationContext, source: string | undefined): void {
  const topLevelFunctions = scene.declarations.functions ?? [];
  const allFunctions = collectAllFunctions(topLevelFunctions);
  const signatures = collectFunctionSignatures(allFunctions, ctx, source);

  for (const fn of topLevelFunctions) {
    analyzeBlock(fn.body, signatures, ctx, source);
  }
  for (const stmt of scene.sequence.statements) {
    analyzeStatement(stmt, signatures, ctx, source, false);
  }
}

function analyzeBlock(
  block: BlockNode,
  signatures: Map<string, FunctionSignature>,
  ctx: ValidationContext,
  source: string | undefined
): void {
  for (const stmt of block.statements) {
    analyzeStatement(stmt, signatures, ctx, source);
  }
}

function analyzeStatement(
  stmt: StatementNode,
  signatures: Map<string, FunctionSignature>,
  ctx: ValidationContext,
  source: string | undefined,
  inFunction = true
): void {
  switch (stmt.type) {
    case 'ReturnNode':
      if (!inFunction) ctx.addError(new ReturnOutsideFunctionError(posOptions(stmt.pos, source)));
      if (stmt.value) analyzeExpression(stmt.value, signatures, ctx, source);
      return;
    case 'IfNode':
      analyzeExpression(stmt.condition, signatures, ctx, source);
      stmt.body.forEach((s) => analyzeStatement(s, signatures, ctx, source, inFunction));
      stmt.elseBody?.forEach((s) => analyzeStatement(s, signatures, ctx, source, inFunction));
      return;
    case 'LoopNode':
      analyzeExpression(stmt.start, signatures, ctx, source);
      analyzeExpression(stmt.end, signatures, ctx, source);
      stmt.body.forEach((s) => analyzeStatement(s, signatures, ctx, source, inFunction));
      return;
    case 'WhileNode':
      analyzeExpression(stmt.condition, signatures, ctx, source);
      stmt.body.forEach((s) => analyzeStatement(s, signatures, ctx, source, inFunction));
      return;
    case 'PrintNode':
      stmt.args.forEach((a) => analyzeExpression(a, signatures, ctx, source));
      return;
    case 'FunctionDeclNode':
      analyzeBlock(stmt.body, signatures, ctx, source);
      return;
    case 'ExpressionStatementNode':
      analyzeExpression(stmt.expression, signatures, ctx, source);
      return;
    case 'CompareNode':
      analyzeExpression(stmt.left, signatures, ctx, source);
      analyzeExpression(stmt.right, signatures, ctx, source);
      return;
    case 'SwapNode':
      analyzeExpression(stmt.left, signatures, ctx, source);
      analyzeExpression(stmt.right, signatures, ctx, source);
      return;
    case 'HighlightNode':
      analyzeExpression(stmt.target, signatures, ctx, source);
      return;
    case 'RelationshipNode':
      analyzeExpression(stmt.source, signatures, ctx, source);
      analyzeExpression(stmt.target, signatures, ctx, source);
      return;
    case 'GenericActionNode':
      stmt.args.forEach((a) => analyzeExpression(a, signatures, ctx, source));
      return;
    case 'SetStateNode':
      analyzeExpression(stmt.target, signatures, ctx, source);
      return;
    case 'WaitNode':
      return;
    default:
      return;
  }
}

/**
 * Built-in functions (not user-declared) and their argument counts:
 * `NEW_NODE(list_or_tree, value)` allocates a node; `MAX` / `MIN` / `ABS`
 * are arithmetic; `DEQUEUE(q)`, `POP(s)`, `PEEK(s)`, `FRONT(q)`, `REAR(q)` and
 * `IS_EMPTY(x)` read a queue / stack inside an expression.
 */
const BUILTIN_FUNCTIONS: Record<string, number> = {
  NEW_NODE: 2,
  MAX: 2,
  MIN: 2,
  ABS: 1,
  DEQUEUE: 1,
  POP: 1,
  PEEK: 1,
  FRONT: 1,
  REAR: 1,
  IS_EMPTY: 1,
  // Graphs: vertices and edges are references, like tree nodes.
  VERTEX: 2,
  VERTEX_AT: 2,
  VERTEX_COUNT: 1,
  EDGE_AT: 2,
  EDGE_COUNT: 1,
  DEGREE: 1,
  IN_DEGREE: 1,
  NEIGHBOR: 2,
  WEIGHT: 2,
  HAS_EDGE: 2,
  // Hash maps: the first argument is the map.
  CONTAINS: 2,
  KEY_AT: 2,
  BUCKET_OF: 2,
  CAPACITY: 1,
  // Text
  TEXT_LENGTH: 1,
  CHAR_AT: 2,
  CHAR_CODE: 2,
};

function analyzeExpression(
  expr: ExpressionNode,
  signatures: Map<string, FunctionSignature>,
  ctx: ValidationContext,
  source: string | undefined
): void {
  if (!expr) return;

  switch (expr.type) {
    case 'CallNode': {
      const name = expr.callee.name;
      const signature = signatures.get(name);
      const builtinArity = BUILTIN_FUNCTIONS[name.toUpperCase()];
      if (!signature && builtinArity !== undefined) {
        if (builtinArity !== expr.args.length) {
          ctx.addError(new WrongArgumentCountError(name, builtinArity, expr.args.length, posOptions(expr.pos, source)));
        }
      } else if (!signature) {
        ctx.addError(
          new UndeclaredFunctionError(name, posOptions(expr.callee.pos, source, suggestFor(name, signatures.keys())))
        );
      } else if (signature.paramCount !== expr.args.length) {
        ctx.addError(
          new WrongArgumentCountError(name, signature.paramCount, expr.args.length, posOptions(expr.pos, source))
        );
      }
      expr.args.forEach((a) => analyzeExpression(a, signatures, ctx, source));
      return;
    }
    case 'ArrayAccessNode':
      analyzeExpression(expr.array, signatures, ctx, source);
      analyzeExpression(expr.index, signatures, ctx, source);
      return;
    case 'BinaryOpNode':
      analyzeExpression(expr.left, signatures, ctx, source);
      analyzeExpression(expr.right, signatures, ctx, source);
      return;
    case 'MemberAccessNode':
      analyzeExpression(expr.object, signatures, ctx, source);
      return;
    case 'IdentifierNode':
    case 'LiteralNode':
      return;
    default: {
      // LENGTH(...) is parsed as a GenericActionNode standing in for an expression.
      const maybeArgs = (expr as { args?: ExpressionNode[] }).args;
      maybeArgs?.forEach((a) => analyzeExpression(a, signatures, ctx, source));
      return;
    }
  }
}

function posOptions(pos: Position, source: string | undefined, suggestion?: string) {
  return { line: pos.line, column: pos.column, source, suggestion };
}

export type { FunctionSignature };
export type { CompileError };
