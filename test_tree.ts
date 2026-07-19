import { compile } from './packages/compiler/src';

const code = `
SCENE GeneralTreeDemo
DECLARE
  TREE_NODE root = 100
  TREE_NODE child1 = 50
  TREE_NODE child2 = 150
  TREE_NODE child3 = 200
  TREE_NODE grandchild = 75
SEQUENCE
  LINK root TO child1
  LINK root TO child2
  LINK root TO child3
  LINK child1 TO grandchild
END
`;

try {
  const aqir = compile(code);
  console.log(JSON.stringify(aqir, null, 2));
} catch (e) {
  console.error(e);
}
