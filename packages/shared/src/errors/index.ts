/**
 * AQVL error hierarchy.
 *
 * Every error thrown by the compiler (lexer/parser/semantic analysis/codegen)
 * or the runtime (VM) extends `AQVLError`, carrying enough structured
 * context — a source line/column, the offending source line's text, and
 * (where one can be computed) a "did you mean" suggestion — for
 * `formatError` (see ./formatter) to render a single human-readable report
 * instead of a bare message.
 */

export interface AQVLErrorOptions {
  line?: number;
  column?: number;
  /** Full source text being compiled, so the formatter can render the offending line. */
  source?: string;
  /** A short actionable hint, e.g. "Did you mean \"total\"?". */
  suggestion?: string;
}

export abstract class AQVLError extends Error {
  public readonly lineNumber?: number;
  public readonly column?: number;
  public readonly source?: string;
  public readonly suggestion?: string;

  constructor(message: string, options: AQVLErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.lineNumber = options.line;
    this.column = options.column;
    this.source = options.source;
    this.suggestion = options.suggestion;
    // Restore the prototype chain (needed when compiling to ES5 targets / across some bundlers).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------
// Compile-time errors
// ---------------------------------------------------------------------

export class CompileError extends AQVLError {}

/** A malformed token (bad character, unterminated string, ...). */
export class TokenError extends CompileError {}

/** A token stream that doesn't match AQVL's grammar (unexpected token, missing delimiter, ...). */
export class AQVLSyntaxError extends CompileError {}
export { AQVLSyntaxError as SyntaxError };

/** A structurally valid but otherwise malformed construct the parser couldn't build a node for. */
export class ParseError extends CompileError {}

export class SemanticError extends CompileError {}

export class UndeclaredVariableError extends SemanticError {
  constructor(name: string, options: AQVLErrorOptions = {}) {
    super(`Undeclared variable "${name}".`, options);
  }
}

export class UndeclaredFunctionError extends SemanticError {
  constructor(name: string, options: AQVLErrorOptions = {}) {
    super(`Call to undeclared function "${name}".`, options);
  }
}

export class DuplicateDeclarationError extends SemanticError {
  constructor(kind: 'variable' | 'function', name: string, options: AQVLErrorOptions = {}) {
    super(`Duplicate ${kind} declaration "${name}".`, options);
  }
}

export class ReturnOutsideFunctionError extends SemanticError {
  constructor(options: AQVLErrorOptions = {}) {
    super('RETURN used outside of a function.', options);
  }
}

export class WrongArgumentCountError extends SemanticError {
  constructor(fnName: string, expected: number, got: number, options: AQVLErrorOptions = {}) {
    super(`Function "${fnName}" expects ${expected} argument(s) but got ${got}.`, options);
  }
}

export class TypeMismatchError extends SemanticError {
  constructor(message: string, options: AQVLErrorOptions = {}) {
    super(message, options);
  }
}

// ---------------------------------------------------------------------
// Runtime errors
// ---------------------------------------------------------------------

export class RuntimeError extends AQVLError {}

export class StackUnderflowError extends RuntimeError {}

export class StackOverflowError extends RuntimeError {
  constructor(limit: number, options: AQVLErrorOptions = {}) {
    super(
      `Call stack exceeded ${limit} frames — likely unbounded recursion (a function calling itself with no base case that's ever reached).`,
      options
    );
  }
}

export class UndefinedVariableError extends RuntimeError {
  constructor(name: string, options: AQVLErrorOptions = {}) {
    super(`Undefined variable "${name}".`, options);
  }
}

export class OutOfBoundsError extends RuntimeError {
  constructor(index: number | string, length: number, context?: string, options: AQVLErrorOptions = {}) {
    const where = context ? ` of "${context}"` : '';
    super(`Index ${index} is out of bounds${where} (length ${length}).`, options);
  }
}

export class DivisionByZeroError extends RuntimeError {
  constructor(context?: string, options: AQVLErrorOptions = {}) {
    super(context ? `Division by zero in "${context}".` : 'Division by zero.', options);
  }
}

export class JumpTargetError extends RuntimeError {
  constructor(target: number, max: number, options: AQVLErrorOptions = {}) {
    super(`Invalid jump target ${target}: must be in range [0, ${max}].`, options);
  }
}

export class FunctionNotFoundError extends RuntimeError {
  constructor(name: string, options: AQVLErrorOptions = {}) {
    super(`Call to undefined function "${name}".`, options);
  }
}

export * from './formatter';
export * from './ErrorMessages';
