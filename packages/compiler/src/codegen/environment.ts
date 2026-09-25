/**
 * Compile-time scope bookkeeping used while emitting instructions.
 *
 * Mirrors the PUSH_SCOPE/POP_SCOPE pairs the generator emits: every
 * `enterScope()` call corresponds to one PUSH_SCOPE instruction, and every
 * `exitScope()` to its matching POP_SCOPE. Distinct from
 * `../semantics/symbolTable.ts`'s `SymbolTable`, which resolves declarations
 * during semantic analysis (before any instruction exists) — this class
 * tracks the same shape of information but keyed to the instruction stream
 * being generated right now, so the generator can look up "what scope did I
 * declare this variable in" while emitting GENERIC_ACTION/CALL instructions.
 */

const GLOBAL_SCOPE_ID = 'global';

export class EnvironmentBuilder {
  private scopeStack: string[] = [GLOBAL_SCOPE_ID];
  private scopeCounter = 0;
  /** name -> scope id it was declared in. Later declarations of the same name (shadowing) overwrite the mapping. */
  private variableScopes = new Map<string, string>();
  private variableValues = new Map<string, unknown>();

  /** Opens a new nested scope (function body, IF/ELSE branch, LOOP body). Returns its id. */
  public enterScope(): string {
    const id = `scope_${++this.scopeCounter}`;
    this.scopeStack.push(id);
    return id;
  }

  /** Discards the innermost scope, returning to its parent. */
  public exitScope(): void {
    if (this.scopeStack.length <= 1) {
      throw new Error('Cannot exit the global scope.');
    }
    this.scopeStack.pop();
  }

  public getCurrentScopeId(): string {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  public declareVariable(name: string, scopeId: string, initialValue?: unknown): void {
    this.variableScopes.set(name, scopeId);
    this.variableValues.set(name, initialValue);
  }

  public getVariableScope(name: string): string | undefined {
    return this.variableScopes.get(name);
  }

  public isGlobal(scopeId: string): boolean {
    return scopeId === GLOBAL_SCOPE_ID;
  }
}
