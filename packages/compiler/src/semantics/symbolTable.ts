/**
 * Symbol table for AQVL's user-defined functions and local scoping.
 *
 * Scene-level declarations (arrays, stacks, ...) and user functions all
 * live in the global scope; each function call opens a new scope for its
 * parameters, and each `IF`/`ELSE`/`LOOP` body opens a nested block scope
 * so a variable declared inside one branch doesn't leak into another.
 *
 * This module only tracks declarations and resolves references — it does
 * not evaluate anything (no type checking, Phase 2).
 */

import type { Position } from '../ast/types';

export type DeclarationKind = 'variable' | 'function';

export class DuplicateDeclarationError extends Error {
  constructor(public readonly kind: DeclarationKind, public readonly declName: string, public readonly pos: Position) {
    super(`Duplicate ${kind} declaration "${declName}" at line ${pos.line}.`);
    this.name = 'DuplicateDeclarationError';
  }
}

export class UndeclaredVariableError extends Error {
  constructor(public readonly declName: string, public readonly pos: Position) {
    super(`Undeclared variable "${declName}" used at line ${pos.line}.`);
    this.name = 'UndeclaredVariableError';
  }
}

export class UndeclaredFunctionError extends Error {
  constructor(public readonly declName: string, public readonly pos: Position) {
    super(`Call to undeclared function "${declName}" at line ${pos.line}.`);
    this.name = 'UndeclaredFunctionError';
  }
}

export interface VariableSymbol {
  name: string;
  pos: Position;
  scopeId: string;
}

export interface FunctionSymbol {
  name: string;
  params: string[];
  pos: Position;
  scopeId: string;
}

interface Scope {
  id: string;
  parent: Scope | null;
  variables: Map<string, VariableSymbol>;
}

const GLOBAL_SCOPE_ID = 'global';

export class SymbolTable {
  private globalScope: Scope;
  private stack: Scope[];
  private functions: Map<string, FunctionSymbol> = new Map();
  private scopeCounter = 0;

  constructor() {
    this.globalScope = { id: GLOBAL_SCOPE_ID, parent: null, variables: new Map() };
    this.stack = [this.globalScope];
  }

  private currentScope(): Scope {
    return this.stack[this.stack.length - 1];
  }

  public getCurrentScopeId(): string {
    return this.currentScope().id;
  }

  public isGlobalScope(scopeId: string): boolean {
    return scopeId === GLOBAL_SCOPE_ID;
  }

  /** Opens a new nested scope (function body, IF/ELSE branch, LOOP body). Returns its id. */
  public enterScope(): string {
    const id = `scope_${++this.scopeCounter}`;
    this.stack.push({ id, parent: this.currentScope(), variables: new Map() });
    return id;
  }

  /** Discards the innermost scope, returning to its parent. */
  public exitScope(): void {
    if (this.stack.length <= 1) {
      throw new Error('Cannot exit the global scope.');
    }
    this.stack.pop();
  }

  /** Declares a variable/parameter in the current scope. Throws DuplicateDeclarationError if already declared *in this scope*. */
  public declareVariable(name: string, pos: Position): VariableSymbol {
    const scope = this.currentScope();
    if (scope.variables.has(name)) {
      throw new DuplicateDeclarationError('variable', name, pos);
    }
    const symbol: VariableSymbol = { name, pos, scopeId: scope.id };
    scope.variables.set(name, symbol);
    return symbol;
  }

  /** Declares a function. Functions are always global — AQVL has no nested/first-class functions yet. */
  public declareFunction(name: string, params: string[], pos: Position): FunctionSymbol {
    if (this.functions.has(name)) {
      throw new DuplicateDeclarationError('function', name, pos);
    }
    const symbol: FunctionSymbol = { name, params, pos, scopeId: GLOBAL_SCOPE_ID };
    this.functions.set(name, symbol);
    return symbol;
  }

  /** Resolves a variable reference: current scope, then outward to parents, then global. */
  public getVariable(name: string, usagePos: Position): VariableSymbol {
    let scope: Scope | null = this.currentScope();
    while (scope) {
      const found = scope.variables.get(name);
      if (found) return found;
      scope = scope.parent;
    }
    throw new UndeclaredVariableError(name, usagePos);
  }

  public hasVariable(name: string): boolean {
    let scope: Scope | null = this.currentScope();
    while (scope) {
      if (scope.variables.has(name)) return true;
      scope = scope.parent;
    }
    return false;
  }

  public getFunction(name: string, usagePos: Position): FunctionSymbol {
    const found = this.functions.get(name);
    if (!found) {
      throw new UndeclaredFunctionError(name, usagePos);
    }
    return found;
  }

  public hasFunction(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * Scans a flat list of same-kind declarations (e.g. one function's
   * parameter names) for repeats *within that list* — distinct from
   * declareVariable/declareFunction, which only catch a name colliding
   * with something already in the table.
   */
  public detectDuplicateDeclarations(
    items: Array<{ name: string; pos: Position }>,
    kind: DeclarationKind = 'variable'
  ): DuplicateDeclarationError[] {
    const seen = new Set<string>();
    const errors: DuplicateDeclarationError[] = [];
    for (const item of items) {
      if (seen.has(item.name)) {
        errors.push(new DuplicateDeclarationError(kind, item.name, item.pos));
      } else {
        seen.add(item.name);
      }
    }
    return errors;
  }
}
