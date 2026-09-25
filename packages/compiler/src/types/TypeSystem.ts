/**
 * Lightweight static type checking for AQVL expressions.
 *
 * AQVL has no type annotation syntax, so most values (variables, array
 * elements, function results) are statically unknowable and treated as
 * `ANY` — this pass only catches mismatches it can prove from literals and
 * the operators applied to them (e.g. `"hello" - 5`), rather than trying to
 * fully infer types across variables and risking false positives on valid
 * programs.
 */
import {
  ProgramNode,
  SceneNode,
  StatementNode,
  ExpressionNode,
  BinaryOpNode,
  LiteralNode,
  Position,
  LayoutStatementNode,
  PositionStatementNode,
  PropertyNode,
} from '../ast/types';
import { TypeMismatchError, type AQVLErrorOptions } from '@aqvl/shared';

export enum Type {
  Number = 'NUMBER',
  String = 'STRING',
  Boolean = 'BOOLEAN',
  Array = 'ARRAY',
  Object = 'OBJECT',
  Any = 'ANY',
}

export interface TypeResult {
  errors: TypeMismatchError[];
}

const NUMBER_ONLY_OPERATORS = new Set(['-', '*', '/', '%']);
const LOGICAL_OPERATORS = new Set(['AND', 'OR']);
const COMPARISON_OPERATORS = new Set(['<', '>', '<=', '>=', '==', '!=', '=']);

/**
 * LAYOUT/POSITION argument names that must be numbers — see
 * docs/design/spatial-syntax-spec.md §1/§3 for the per-strategy param
 * tables. Deliberately excludes enum-like args (e.g. `axis=horizontal`)
 * and `origin=(x,y,z)`, which parses as a TupleLiteralNode and is skipped
 * below regardless of this set.
 */
const NUMERIC_GEOMETRY_PARAMS = new Set([
  'spacing', 'radius', 'startAngle', 'repulsion', 'springLength', 'springTension',
  'gravity', 'iterations', 'levelGap', 'siblingGap', 'columns', 'spacingX', 'spacingY',
  'x', 'y', 'z',
]);

export class TypeChecker {
  private errors: TypeMismatchError[] = [];
  private source?: string;

  /** Type-checks every scene in `program`, collecting (not throwing) every mismatch found. */
  public analyzeTypes(program: ProgramNode, source?: string): TypeResult {
    this.errors = [];
    this.source = source;
    for (const scene of program.scenes) {
      this.visitScene(scene);
    }
    return { errors: this.errors };
  }

  /** Returns true if a value of type `actual` may be used where `expected` is required. ANY is compatible with everything. */
  public assertTypeCompatibility(actual: Type, expected: Type): boolean {
    return actual === Type.Any || expected === Type.Any || actual === expected;
  }

  private visitScene(scene: SceneNode) {
    for (const fn of scene.declarations.functions ?? []) {
      fn.body.statements.forEach((s) => this.visitStatement(s));
    }
    scene.sequence.statements.forEach((s) => this.visitStatement(s));
  }

  private visitStatement(stmt: StatementNode) {
    switch (stmt.type) {
      case 'ExpressionStatementNode':
        this.getExpressionType(stmt.expression);
        return;
      case 'CompareNode':
      case 'SwapNode':
        this.getExpressionType(stmt.left);
        this.getExpressionType(stmt.right);
        return;
      case 'IfNode':
        this.getExpressionType(stmt.condition);
        stmt.body.forEach((s) => this.visitStatement(s));
        stmt.elseBody?.forEach((s) => this.visitStatement(s));
        return;
      case 'LoopNode':
        this.getExpressionType(stmt.start);
        this.getExpressionType(stmt.end);
        stmt.body.forEach((s) => this.visitStatement(s));
        return;
      case 'WhileNode':
        this.getExpressionType(stmt.condition);
        stmt.body.forEach((s) => this.visitStatement(s));
        return;
      case 'PrintNode':
        stmt.args.forEach((a) => this.getExpressionType(a));
        return;
      case 'ReturnNode':
        if (stmt.value) this.getExpressionType(stmt.value);
        return;
      case 'RelationshipNode':
        this.getExpressionType(stmt.source);
        this.getExpressionType(stmt.target);
        return;
      case 'GenericActionNode':
        stmt.args.forEach((a) => this.getExpressionType(a));
        return;
      case 'SetStateNode':
        this.getExpressionType(stmt.target);
        return;
      case 'FunctionDeclNode':
        stmt.body.statements.forEach((s) => this.visitStatement(s));
        return;
      case 'LayoutStatementNode':
        (stmt as LayoutStatementNode).args.forEach((a) => this.checkGeometryArg(a));
        return;
      case 'PositionStatementNode':
        (stmt as PositionStatementNode).args.forEach((a) => this.checkGeometryArg(a));
        return;
      default:
        return;
    }
  }

  /** Reports a TypeMismatchError if a known numeric-only LAYOUT/POSITION param (e.g. `spacing=`) was given a non-number value. */
  private checkGeometryArg(arg: PropertyNode): void {
    if (!NUMERIC_GEOMETRY_PARAMS.has(arg.name)) return;
    if ((arg.value as any).type === 'TupleLiteralNode') return;
    const type = this.getExpressionType(arg.value);
    if (!this.assertTypeCompatibility(type, Type.Number)) {
      this.report(arg.value.pos, `Layout/position parameter '${arg.name}' expects a number, got ${type}.`);
    }
  }

  /** Infers the static type of `expr`, recording a TypeMismatchError for any concrete incompatibility found along the way. */
  public getExpressionType(expr: ExpressionNode): Type {
    switch (expr.type) {
      case 'LiteralNode':
        return this.literalType(expr as LiteralNode);
      case 'ArrayAccessNode':
        this.getExpressionType(expr.index);
        return Type.Any;
      case 'CallNode':
        expr.args.forEach((a) => this.getExpressionType(a));
        return Type.Any;
      case 'BinaryOpNode':
        return this.binaryOpType(expr as BinaryOpNode);
      case 'IdentifierNode':
      default:
        // Variables, array elements, and function results aren't statically
        // known without type annotations — treat as ANY.
        return Type.Any;
    }
  }

  private literalType(node: LiteralNode): Type {
    return node.dataType === 'number' ? Type.Number : Type.String; // 'string' and 'color' literals are both textual
  }

  private binaryOpType(node: BinaryOpNode): Type {
    const left = this.getExpressionType(node.left);
    const right = this.getExpressionType(node.right);
    const { operator } = node;

    if (LOGICAL_OPERATORS.has(operator)) return Type.Boolean;

    if (COMPARISON_OPERATORS.has(operator)) {
      if (!this.assertTypeCompatibility(left, right)) {
        this.report(node.pos, `Cannot compare ${left} to ${right} with '${operator}'.`);
      }
      return Type.Boolean;
    }

    if (operator === '+') {
      // '+' doubles as arithmetic and string concatenation, so a STRING on
      // either side makes the whole expression a STRING rather than an error.
      if (left === Type.String || right === Type.String) return Type.String;
      if (!this.assertTypeCompatibility(left, Type.Number)) {
        this.report(node.left.pos, `Operator '+' expects a number or string, got ${left}.`);
      }
      if (!this.assertTypeCompatibility(right, Type.Number)) {
        this.report(node.right.pos, `Operator '+' expects a number or string, got ${right}.`);
      }
      return Type.Number;
    }

    if (NUMBER_ONLY_OPERATORS.has(operator)) {
      if (!this.assertTypeCompatibility(left, Type.Number)) {
        this.report(node.left.pos, `Operator '${operator}' expects a number on the left, got ${left}.`);
      }
      if (!this.assertTypeCompatibility(right, Type.Number)) {
        this.report(node.right.pos, `Operator '${operator}' expects a number on the right, got ${right}.`);
      }
      return Type.Number;
    }

    return Type.Any;
  }

  private report(pos: Position, message: string) {
    const options: AQVLErrorOptions = { line: pos.line, column: pos.column, source: this.source };
    this.errors.push(new TypeMismatchError(message, options));
  }
}
