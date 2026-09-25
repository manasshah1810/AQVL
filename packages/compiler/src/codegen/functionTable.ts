/**
 * Compile-time function table: records every user-defined function's entry
 * point (PC), parameter list, and (optional) return type as the generator
 * emits its body. Distinct from `../semantics/symbolTable.ts`'s
 * `SymbolTable`, which resolves *variable/function declarations during
 * semantic analysis* (pre-generation, no PCs yet) — this table exists only
 * once instructions are actually being emitted.
 */

export interface FunctionDef {
  name: string;
  /** Instruction index of the function body's first instruction (after its PUSH_SCOPE). */
  startPC: number;
  params: string[];
  returnType?: string;
}

export class FunctionTable {
  private functions = new Map<string, FunctionDef>();
  /** caller -> set of callees, recorded via `registerCall` as the generator compiles CALL sites. */
  private callGraph = new Map<string, Set<string>>();

  public add(name: string, startPC: number, params: string[], returnType?: string): FunctionDef {
    const def: FunctionDef = { name, startPC, params, returnType };
    this.functions.set(name, def);
    return def;
  }

  public get(name: string): FunctionDef | undefined {
    return this.functions.get(name);
  }

  public all(): FunctionDef[] {
    return Array.from(this.functions.values());
  }

  /** Updates every `startPC` in place via `remap` (e.g. after a dead-code pass shifts instruction indices). */
  public remapAddresses(remap: (pc: number) => number): void {
    for (const def of this.functions.values()) {
      def.startPC = remap(def.startPC);
    }
  }

  /** Records that `caller` calls `callee`, for cycle detection in `validate()`. */
  public registerCall(caller: string, callee: string): void {
    if (!this.callGraph.has(caller)) {
      this.callGraph.set(caller, new Set());
    }
    this.callGraph.get(caller)!.add(callee);
  }

  /**
   * Walks the recorded call graph and reports every cycle found (direct
   * self-recursion included), as a human-readable chain e.g. "a -> b -> a".
   * Does not throw — recursion is a legitimate pattern (e.g. `fib` calling
   * itself); the caller decides whether a reported cycle is a problem.
   */
  public validate(): string[] {
    const issues: string[] = [];
    const visited = new Set<string>();
    const onStack = new Set<string>();

    const visit = (name: string, path: string[]): void => {
      if (onStack.has(name)) {
        issues.push(`Circular call dependency: ${[...path, name].join(' -> ')}`);
        return;
      }
      if (visited.has(name)) return;

      onStack.add(name);
      for (const callee of this.callGraph.get(name) ?? []) {
        visit(callee, [...path, name]);
      }
      onStack.delete(name);
      visited.add(name);
    };

    for (const name of this.functions.keys()) {
      visit(name, []);
    }
    return issues;
  }
}
