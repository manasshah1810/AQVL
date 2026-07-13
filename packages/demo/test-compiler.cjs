const { compile } = require('../compiler/dist/index.js');

const bubbleSortScript = `
SCENE BubbleSort

DECLARE
  ARRAY arr = [5, 2, 4, 1]

SEQUENCE
  COMPARE arr[0] arr[1]
  SWAP arr[0] arr[1]

  COMPARE arr[1] arr[2]

  COMPARE arr[2] arr[3]
  SWAP arr[2] arr[3]

  COMPARE arr[0] arr[1]

  COMPARE arr[1] arr[2]
  SWAP arr[1] arr[2]

  COMPARE arr[0] arr[1]
`;

try {
  console.log("Compiling...");
  const aqir = compile(bubbleSortScript);
  console.log("Success!", JSON.stringify(aqir, null, 2));
} catch (e) {
  console.error("Compilation Error:");
  console.error(e);
}
