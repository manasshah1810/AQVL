const fs = require('fs');
const { Lexer } = require('./packages/compiler/dist/lexer/index.js');
const { Parser } = require('./packages/compiler/dist/parser/index.js');
const { AQIRGenerator } = require('./packages/compiler/dist/aqir/generator.js');

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
const generator = new AQIRGenerator(ast);
const aqir = generator.generate();

console.log(JSON.stringify(aqir, null, 2));
