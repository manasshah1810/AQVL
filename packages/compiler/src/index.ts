import { Lexer } from './lexer';
import { Parser } from './parser';
import { SemanticValidator } from './semantic/validator';
import { analyzeFunctions } from './semantics/analysis';
import { TypeChecker } from './types/TypeSystem';
import { Optimizer } from './optimizer';
import { AQIRGenerator } from './aqir/generator';
import type { AQIRProgram } from './aqir/types';
import { SemanticError as AQVLSemanticError, formatErrors, type AQVLError } from '@aqvl/shared';

export function compile(source: string): AQIRProgram {
  // 1. Lexical Analysis
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  console.log('==========================\nTOKENS\n==========================');
  console.log(tokens.map(t => `${t.type}(${t.value})`).join('\n'));
  console.log('✓ Lexer Complete\n');

  // 2. Parsing
  const parser = new Parser(tokens, source);
  const ast = parser.parse();
  console.log('==========================\nAST\n==========================');
  console.log(JSON.stringify(ast, null, 2));
  console.log('✓ Parser Complete');
  console.log('✓ AST Generated\n');

  // 3. Semantic Validation (declared-variable/object scoping)
  const validator = new SemanticValidator();
  const diagnostics = validator.validate(ast);
  console.log('✓ Semantic Validation Passed');

  // 3b. Function declaration/call validation (undeclared function, wrong
  // argument count, duplicate function declarations) — not covered by
  // SemanticValidator above, which only tracks scene-level variables/objects.
  const functionErrors = analyzeFunctions(ast, source).getErrors();

  // 3c. Static type checking (literal-level mismatches, e.g. `"hello" - 5`).
  const typeChecker = new TypeChecker();
  const typeErrors = typeChecker.analyzeTypes(ast, source).errors;

  // Collect every diagnostic from all three semantic passes instead of
  // failing on the first one found, so a single compile() call reports
  // every problem in the program at once rather than making the user
  // fix-and-recompile one error at a time.
  const semanticErrors: AQVLError[] = [
    ...diagnostics.map(
      (d) => new AQVLSemanticError(d.message, { line: d.line, column: d.column, source })
    ),
    ...functionErrors,
    ...typeErrors,
  ];

  if (semanticErrors.length === 1) {
    // Preserve the specific error subclass (UndeclaredFunctionError,
    // WrongArgumentCountError, ...) instead of erasing it to a generic
    // SemanticError, so downstream consumers can catch/branch on it.
    throw semanticErrors[0];
  }

  if (semanticErrors.length > 1) {
    throw new AQVLSemanticError(formatErrors(semanticErrors), { source });
  }

  // 4. Optimization Pass
  const optimizer = new Optimizer();
  const optimizedAst = optimizer.optimize(ast);

  // 5. AQIR Generation
  const generator = new AQIRGenerator();
  const aqir = generator.generate(optimizedAst);

  // 6. Post-generation cleanup: strip instructions left unreachable by
  // branching (dead code after an unconditional JUMP/RET with no jump
  // landing on it), re-targeting jumps and function entry points for the
  // shifted indices.
  const functionTable = generator.getFunctionTable();
  const { instructions, remapPC } = optimizer.removeUnreachableInstructions(
    aqir.instructions,
    functionTable.all().map((fn) => fn.startPC)
  );
  aqir.instructions = instructions;
  functionTable.remapAddresses(remapPC);

  aqir.functionTable = {};
  for (const fn of functionTable.all()) {
    aqir.functionTable[fn.name] = { name: fn.name, params: fn.params, entryAddress: fn.startPC };
  }

  console.log('\n=========================\nAQIR\n=========================');
  console.log(JSON.stringify(aqir, null, 2));
  console.log('✓ AQIR Generated');

  return aqir;
}

export { Lexer } from './lexer';
export { Parser } from './parser';
export * from './ast/types';
export * from './semantic/types';
export { SemanticValidator } from './semantic/validator';
export { Optimizer } from './optimizer';
export { AQIRGenerator } from './aqir/generator';
export { ValidationContext } from './validator';
export { analyzeFunctions } from './semantics/analysis';
export { TypeChecker, Type } from './types/TypeSystem';
export type { TypeResult } from './types/TypeSystem';
export {
  AQVLError,
  CompileError,
  TokenError,
  SyntaxError,
  ParseError,
  SemanticError,
  UndeclaredVariableError,
  UndeclaredFunctionError,
  DuplicateDeclarationError,
  ReturnOutsideFunctionError,
  WrongArgumentCountError,
  TypeMismatchError,
  RuntimeError,
  OutOfBoundsError,
  DivisionByZeroError,
  formatError,
  formatErrors,
  generateErrorMessage,
  suggestFor,
  findClosestMatch,
} from '@aqvl/shared';
