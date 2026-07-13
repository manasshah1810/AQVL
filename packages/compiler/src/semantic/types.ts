import { Position } from '../ast/types';

export type DiagnosticLevel = 'ERROR' | 'WARNING';

export interface SemanticDiagnostic {
  level: DiagnosticLevel;
  line: number;
  column: number;
  message: string;
}

export type SymbolType = 'ARRAY' | 'SCALAR' | 'COLOR' | 'SCENE';

export interface SymbolRecord {
  name: string;
  type: SymbolType;
  declaredAt: Position;
}

export class SymbolTable {
  private symbols: Map<string, SymbolRecord> = new Map();
  private parent?: SymbolTable;

  constructor(parent?: SymbolTable) {
    this.parent = parent;
  }

  public define(record: SymbolRecord): boolean {
    if (this.symbols.has(record.name)) {
      return false; // Already defined in this scope
    }
    this.symbols.set(record.name, record);
    return true;
  }

  public lookup(name: string): SymbolRecord | undefined {
    if (this.symbols.has(name)) {
      return this.symbols.get(name);
    }
    if (this.parent) {
      return this.parent.lookup(name);
    }
    return undefined;
  }
}
