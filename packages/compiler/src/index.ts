import { Lexer } from './lexer';
import { Parser } from './parser';
import { SemanticValidator } from './semantic/validator';
import { Optimizer } from './optimizer';
import { AQIRGenerator } from './aqir/generator';
import type { AQIRProgram } from '@aqvl/shared';

export function compile(source: string): AQIRProgram {
  // 1. Lexical Analysis
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  console.log('==========================\nTOKENS\n==========================');
  console.log(tokens.map(t => `${t.type}(${t.value})`).join('\n'));
  console.log('✓ Lexer Complete\n');

  // 2. Parsing
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log('==========================\nAST\n==========================');
  console.log(JSON.stringify(ast, null, 2));
  console.log('✓ Parser Complete');
  console.log('✓ AST Generated\n');

  // 3. Semantic Validation
  const validator = new SemanticValidator();
  const diagnostics = validator.validate(ast);
  console.log('✓ Semantic Validation Passed');

  if (diagnostics.length > 0) {
    const errors = diagnostics.map(d => `[${d.level}] Line ${d.line}, Col ${d.column}: ${d.message}`).join('\n');
    throw new Error(`Semantic Validation Failed:\n${errors}`);
  }

  // 4. Optimization Pass
  const optimizer = new Optimizer();
  const optimizedAst = optimizer.optimize(ast);

  // 5. AQIR Generation
  const generator = new AQIRGenerator();
  const aqir = generator.generate(optimizedAst);
  
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
