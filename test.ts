import { Lexer } from './packages/compiler/src/lexer/index';
import { Parser } from './packages/compiler/src/parser/index';
import { Optimizer } from './packages/compiler/src/optimizer/index';
import { AQIRGenerator } from './packages/compiler/src/aqir/generator';
import { SemanticValidator } from './packages/compiler/src/semantic/index';

const code = `
SCENE TreeDemo

DECLARE
  TREE t
  TREE_NODE r = ["Root"] { parent: t }
  TREE_NODE c1 = ["A"] { parent: t }
SEQUENCE
  LINK r TO c1
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();
const generator = new AQIRGenerator();
const aqir = generator.generate(ast);

console.log(JSON.stringify(aqir, null, 2));
