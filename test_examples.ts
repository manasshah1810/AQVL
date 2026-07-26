import { Lexer } from './packages/compiler/src/lexer/index';
import { Parser } from './packages/compiler/src/parser/index';
import { EXAMPLES } from './packages/demo/src/examples/registry';

async function validate() {
  let errors = 0;
  for (const example of EXAMPLES) {
    try {
      console.log(`Validating [${example.id}] ${example.title}...`);
      const lexer = new Lexer(example.source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      parser.parse();
    } catch (e) {
      console.error(`Error in ${example.title}:`, e);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\nValidation failed: ${errors} errors found.`);
    process.exit(1);
  } else {
    console.log(`\nAll ${EXAMPLES.length} examples validated successfully!`);
  }
}

validate();
