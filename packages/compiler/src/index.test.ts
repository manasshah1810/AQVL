declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => { toContain: (expected: string) => void };

import { compile } from './index';

describe('compile() semantic diagnostics', () => {
  test('reports every semantic error found, not just the first', () => {
    const source = `SCENE ErrorTest

DECLARE
    ARRAY arr = [1, 2, 3]
    FUNCTION add(a, b) {
        RETURN a + b
    }
    FUNCTION add(x, y) {
        RETURN x - y
    }

SEQUENCE
    COMPARE missingVar arr[0]
    add(1)
`;

    let message = '';
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e: any) {
      message = e.message;
    }

    // Undeclared variable (SemanticValidator), duplicate declaration and
    // wrong argument count (analyzeFunctions) are three independent errors —
    // all three must show up together, not just whichever came first.
    expect(message).toContain(`Undeclared identifier 'missingVar'.`);
    expect(message).toContain('Duplicate function declaration "add".');
    expect(message).toContain('Function "add" expects 2 argument(s) but got 1.');
  });

  test('allows indexing into BST and HASHMAP declarations', () => {
    const source = `SCENE IndexableTest

DECLARE
    BST tree = [5, 3, 8]
    HASH_MAP map = { a: 1, b: 2 }

SEQUENCE
    COMPARE tree[0] map[0]
`;

    expect(() => compile(source)).not.toThrow();
  });

  test('still rejects indexing into a non-indexable (scalar) identifier', () => {
    const source = `SCENE NonIndexableTest

DECLARE
    ARRAY arr = [1, 2, 3]

SEQUENCE
    x = 5
    COMPARE x[0] x[0]
`;

    let message = '';
    try {
      compile(source);
      throw new Error('expected compile() to throw');
    } catch (e: any) {
      message = e.message;
    }

    expect(message).toContain(`Identifier 'x' is not indexable.`);
  });
});
