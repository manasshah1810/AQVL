import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator, analyzeFunctions } from '@aqvl/compiler';
import { diagnoseCompileError, type AQIRProgram, type ErrorInfo, type RawCompileError } from '@aqvl/runtime';
import type { EditorErrorMarker } from '../components/IDEEditor';

/** A compile failure, already described: where it is, what kind it is, and what to tell the learner. */
export class CompileIssue extends Error {
  constructor(
    readonly info: ErrorInfo,
    readonly markers: EditorErrorMarker[],
  ) {
    super(info.message);
  }
}

export function rawOf(e: unknown, stage: string): RawCompileError {
  const at = e as { name?: string; message?: string; lineNumber?: number; column?: number; suggestion?: string };
  return { name: at.name ?? 'Error', message: at.message ?? String(e), line: typeof at.lineNumber === 'number' ? at.lineNumber : null, column: at.column, suggestion: at.suggestion, stage };
}

export function markerFor(info: ErrorInfo): EditorErrorMarker {
  return { line: info.line ?? 1, column: info.column, length: info.length, message: info.message };
}

/** Lex → parse → validate → optimise → generate. Throws a CompileIssue (the described failure, with editor markers). */
export function compileProgram(source: string): AQIRProgram {
  let ast;
  try {
    const tokens = new Lexer(source).tokenize();
    ast = new Parser(tokens).parse();
  } catch (e) {
    const info = diagnoseCompileError(rawOf(e, 'Parser'), source);
    throw new CompileIssue(info, info.line === null ? [] : [markerFor(info)]);
  }
  const diagnostics = new SemanticValidator().validate(ast);
  if (diagnostics.length > 0) {
    const infos = diagnostics.map((d) => diagnoseCompileError({ name: 'SemanticError', message: d.message, line: d.line, column: d.column, stage: 'Semantic' }, source));
    throw new CompileIssue(infos[0], infos.map(markerFor));
  }
  // Calls to undeclared functions, wrong argument counts, RETURN outside a function.
  const functionErrors = analyzeFunctions(ast, source).getErrors();
  if (functionErrors.length > 0) {
    const infos = functionErrors.map((e) => diagnoseCompileError({ ...rawOf(e, 'Semantic'), line: e.lineNumber ?? null }, source));
    throw new CompileIssue(infos[0], infos.map(markerFor));
  }
  const optimized = new Optimizer().optimize(ast, {});
  const generator = new AQIRGenerator();
  const aqir = generator.generate(optimized) as unknown as AQIRProgram;
  // User FUNCTIONs: the VM resolves CALLs through this table.
  aqir.functionTable = {};
  for (const fn of generator.getFunctionTable().all()) {
    aqir.functionTable[fn.name] = { name: fn.name, params: fn.params, entryAddress: fn.startPC };
  }
  return aqir;
}

/** compileProgram, with any failure (described or not) turned into a CompileIssue. */
export function compileOrIssue(source: string): { program: AQIRProgram } | { issue: CompileIssue } {
  try {
    return { program: compileProgram(source) };
  } catch (e) {
    if (e instanceof CompileIssue) return { issue: e };
    // Anything that is not an already-described failure is still described, never shown as a bare stack message.
    const info = diagnoseCompileError(rawOf(e, 'Compiler'), source);
    return { issue: new CompileIssue(info, info.line === null ? [] : [markerFor(info)]) };
  }
}
