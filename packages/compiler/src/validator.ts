import type { CompileError } from '@aqvl/shared';

/**
 * Accumulates compile errors across a validation pass (lexing, parsing, or
 * semantic analysis) instead of failing on the first one, so a single
 * `compile()` call can report every problem it found rather than making the
 * user fix-and-recompile one error at a time.
 */
export class ValidationContext {
  private errors: CompileError[] = [];

  public addError(error: CompileError): void {
    this.errors.push(error);
  }

  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  public getErrors(): CompileError[] {
    return this.errors;
  }

  /** Throws the first recorded error, if any. The rest remain available via `getErrors()`. */
  public throwIfErrors(): void {
    if (this.errors.length > 0) {
      throw this.errors[0];
    }
  }
}
