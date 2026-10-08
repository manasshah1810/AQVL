import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator, analyzeFunctions } from '@aqvl/compiler';
import { recordTrace, diagnoseCompileError, type AQIRProgram, type ErrorInfo, type ExecutionTrace } from '@aqvl/runtime';

/** The Playground's own pipeline, minus the React: lex → parse → validate → optimise → generate. */
export function compile(source: string): AQIRProgram {
  const ast = new Parser(new Lexer(source).tokenize()).parse();
  const diagnostics = new SemanticValidator().validate(ast);
  if (diagnostics.length) throw Object.assign(new Error(diagnostics[0].message), { lineNumber: diagnostics[0].line, column: diagnostics[0].column, name: 'SemanticError' });
  const fe = analyzeFunctions(ast, source).getErrors();
  if (fe.length) throw fe[0];
  const generator = new AQIRGenerator();
  const aqir = generator.generate(new Optimizer().optimize(ast, {})) as unknown as AQIRProgram;
  aqir.functionTable = {};
  for (const fn of generator.getFunctionTable().all()) aqir.functionTable![fn.name] = { name: fn.name, params: fn.params, entryAddress: fn.startPC };
  return aqir;
}

export function run(source: string): Promise<ExecutionTrace> {
  return recordTrace(compile(source), { source });
}

/** The described failure of a program that does not compile. */
export function compileIssue(source: string): ErrorInfo {
  try {
    compile(source);
  } catch (e) {
    const at = e as { name?: string; message: string; lineNumber?: number; column?: number; suggestion?: string };
    return diagnoseCompileError({ name: at.name ?? 'Error', message: at.message, line: at.lineNumber ?? null, column: at.column, suggestion: at.suggestion }, source);
  }
  throw new Error('expected the program not to compile');
}

export function program(sequence: string, declare = 'ARRAY arr = [5, 3, 2]', scene = 'Demo'): string {
  return `SCENE ${scene}\n\nDECLARE\n  ${declare}\n\nSEQUENCE\n${sequence
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n')}\nEND\n`;
}
