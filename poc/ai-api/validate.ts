import { Lexer, Parser, SemanticValidator, Optimizer, AQIRGenerator } from '../../packages/compiler/src';
import { SemanticError } from '../../packages/shared/src';
import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  valid: boolean;
  stage: string;
  errors: string[];
}

export function validateAQVL(source: string): ValidationResult {
  let stage = 'Lexer';
  try {
    // 1. Lexical Analysis
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    // 2. Parsing
    stage = 'Parser';
    const parser = new Parser(tokens, source);
    const ast = parser.parse();

    // 3. Semantic Validation
    stage = 'SemanticValidator';
    const validator = new SemanticValidator();
    const diagnostics = validator.validate(ast);

    if (diagnostics.length > 0) {
      return {
        valid: false,
        stage: 'SemanticValidator',
        errors: diagnostics.map(d => `[${d.level}] Line ${d.line}, Col ${d.column}: ${d.message}`)
      };
    }

    // 4. Optimization
    stage = 'Optimizer';
    const optimizer = new Optimizer();
    const optimizedAst = optimizer.optimize(ast);

    // 5. AQIR Generation
    stage = 'AQIRGenerator';
    const generator = new AQIRGenerator();
    generator.generate(optimizedAst);

    return {
      valid: true,
      stage: 'AQIRGenerator',
      errors: []
    };
  } catch (error: any) {
    return {
      valid: false,
      stage: stage,
      errors: [error.message || String(error)]
    };
  }
}

// CLI Mode
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx tsx validate.ts <file.aqvl>');
    process.exit(1);
  }
  
  const filePath = path.resolve(args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(filePath, 'utf-8');
  const result = validateAQVL(source);
  
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
