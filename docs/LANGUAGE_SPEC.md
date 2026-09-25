# AQVL Language Specification

AQVL ("Algorithm/Animation Query/Visualization Language") is a small domain-specific
language for describing data-structure and algorithm visualizations. A program is
compiled by a pipeline of Lexer → Parser → semantic validation/type checking →
Optimizer → AQIR code generation, and the resulting AQIR (a bytecode-like
instruction set) is executed by the runtime's animation/virtual-machine engine.

This document describes the language as it is actually implemented in this
repository. It supersedes `docs/grammar.md`, `docs/lexer_vocabulary.md`,
`docs/ast_specification.md`, and `docs/syntax_diagnostics.md`, which are stale and
describe syntax (indentation significance, an `IMPORT` statement) that does not
exist in the current implementation. Those files are not sources of truth.

For the full list of built-in operations, their exact syntax, complexity, and
examples, see `docs/API_REFERENCE.md`. This document focuses on core grammar,
declarations, control flow, the type system, and error handling.

---

## 1. Compilation pipeline

Source (`packages/compiler/src/index.ts`, `compile(source)`) is processed as:

1. **Lexer** (`packages/compiler/src/lexer/index.ts`) — tokenizes source. Whitespace
   and newlines are insignificant and simply skipped; there is no indentation-based
   block structure.
2. **Parser** (`packages/compiler/src/parser/index.ts`) — builds an AST
   (`packages/compiler/src/ast/types.ts`).
3. **SemanticValidator** (`packages/compiler/src/semantic/validator.ts`) — validates
   declared variables/objects and scoping (duplicate scenes, duplicate
   declarations, undeclared identifiers).
4. **analyzeFunctions** (`packages/compiler/src/semantics/analysis.ts`) — validates
   function declarations and calls (undeclared function, wrong argument count,
   duplicate declarations).
5. **TypeChecker** (`packages/compiler/src/types/TypeSystem.ts`) — static type
   checking for obviously invalid operations (e.g. `"hello" - 5`).
6. **Optimizer** (`packages/compiler/src/optimizer/index.ts`).
7. **AQIRGenerator** (`packages/compiler/src/aqir/generator.ts`) — emits AQIR
   instructions, followed by a dead-code-elimination pass.

Note: the repository also contains `packages/compiler/src/validator.ts`, which
exports a separate `ValidationContext` utility. It is **not** wired into the main
`compile()` pipeline described above and should not be assumed to run against
every program.

---

## 2. Top-level program structure

```bnf
program        ::= scene+
scene          ::= "SCENE" identifier declare_block? sequence_block? "END"
declare_block  ::= "DECLARE" declaration*
sequence_block ::= "SEQUENCE" statement*
```

- Every program consists of one or more `SCENE <Name>` blocks.
- Each scene has an optional `DECLARE` section (data structure and function
  declarations) and an optional `SEQUENCE` section (statements to animate/run),
  and is closed with `END`.
- There is **no indentation significance** anywhere in the grammar — the examples
  in this document are indented purely for human readability.
- Compound blocks (`LOOP`, `IF`, `SEQUENCE`) in the animation grammar are closed
  with the `END` keyword, not braces.

Minimal valid program:

```aqvl
SCENE Empty
SEQUENCE
END
```

---

## 3. Two statement grammars

AQVL has two parallel statement grammars that can both appear in the same
program (though not mixed within the same block):

1. **Animation/scripting grammar** — used inside `SEQUENCE`, and inside
   `LOOP ... END` / `IF ... END` blocks. This is the grammar used to script and
   animate operations on data structures.
2. **Function bodies** — `FUNCTION name(params) ... END` (or `{ ... }`)
   declared in a `DECLARE` block. A body accepts every animation statement
   plus `RETURN`; `IF cond { } ELSE { }` brace chains are also accepted.

The two grammars differ specifically in how `IF` works (see §5) and in block
delimiters (`END` vs `{ }`).

---

## 4. Lexical elements

### 4.1 Literals

- **Numbers**: integer or floating point (e.g. `42`, `3.14`).
  - Unary `-` is only legal directly on a numeric literal (e.g. `-5`). Negating an
    arbitrary expression (`-x`) is a **parse error** with the message
    "Use subtraction instead" — write `0 - x` instead.
- **Strings**: double- or single-quoted (`"hello"`, `'hello'`).
- **Colors / barewords**: there is no dedicated boolean or color token type.
  Colors are plain identifiers or string literals, e.g.:
  ```aqvl
  HIGHLIGHT arr[4] 'SUCCESS'
  ```

### 4.2 Symbols

```
= [ ] + , { } : - < > ( ) * / ; . <- -> <-> <= >= == !=
```

### 4.3 Operators

Binary operators: `<= >= == != + - * / > <`

- `=` is right-associative and has the lowest precedence. It is used both as a
  statement-level assignment (`x = expr`) and, inside VM-mode (`{ }`) `IF`
  conditions, as an equality test — the VM treats a bare `=` inside an expression
  as `===`.

### 4.4 Built-in expression form

`LENGTH(arr)` is a special built-in expression (not a generic user function call)
that returns the length of an array/structure. Common usage:

```aqvl
LOOP i FROM 0 TO LENGTH(arr) - 1
  ...
END
```

### 4.5 Expression AST node kinds

`IdentifierNode`, `ArrayAccessNode` (`arr[expr]`), `BinaryOpNode`, `LiteralNode`
(number / string / color / `NULL`), `CallNode` (`name(args...)`),
`MemberAccessNode` (`expr.member`).

---

## 5. Control flow

### 5.1 `IF` — animation grammar

```bnf
if_stmt (animation) ::= "IF" expr statement*
                        ( "ELSE" "IF" expr statement* )*
                        ( "ELSE" statement* )? "END"
```

`ELSE IF` requires `IF` on the same line as `ELSE`; an `IF` on the next line
starts an ordinary nested `IF` inside the `ELSE` body. A chain has one `END`.

```aqvl
IF arr[j] > arr[j+1]
  SWAP arr[j] arr[j+1]
END
```


### 5.1a `WHILE` and `PRINT`

```bnf
while_stmt ::= "WHILE" expr statement* "END"
print_stmt ::= "PRINT" expr+          (all on the PRINT line)
```

`PRINT` writes its values, space-separated, to the output console; a bare
array name prints the whole array (`PRINT "Result:" arr`).

### 5.1b Expressions

Precedence, loosest first: `OR`, `AND`, comparisons (`< > <= >= == !=`),
`+ -`, `* / %`; parentheses group. `AND` / `OR` short-circuit.

Linked-list pointer expressions: `NULL` is the null pointer; `x.member`
reads a field — `list.head`, `list.tail`, `node.val`, `node.next`,
`node.prev` — and may be chained (`fast.next.next`). A field is also an
assignment target (`prev.next = curr.next`, `list.head = n`).
`NEW_NODE(list, value)` allocates a node and `FREE p` releases one. See
`docs/API_REFERENCE.md` §5. `arr[i]` inside an expression reads the
element's *current* value, and `LENGTH(arr)` its current length. Array
targets (`SWAP arr[i] arr[j]`, `UPDATE arr[i] expr`, `INSERT arr[i] expr`,
`DELETE arr[i]`) are resolved at run time by current index; an index out
of range is a runtime error. Action arguments end at the end of the line.
Variables first assigned inside a `LOOP`/`WHILE`/`IF` body are local to it.

### 5.2 `IF` — function-body / VM grammar (full else-if chain)

```bnf
if_stmt (vm) ::= "IF" expr "{" statement* "}"
                 ( "ELSE" "IF" expr "{" statement* "}" )*
                 ( "ELSE" "{" statement* "}" )?
```

```aqvl
FUNCTION sign(x) {
  IF x > 0 {
    RETURN 1
  } ELSE {
    RETURN 0
  }
}
```

### 5.3 `LOOP`

```bnf
loop_stmt ::= "LOOP" identifier "FROM" expr "TO" expr statement* "END"
```

```aqvl
LOOP i FROM 0 TO LENGTH(arr) - 1
  HIGHLIGHT arr[i]
END
```

`LOOP` is only defined in the animation grammar (used inside `SEQUENCE`).

---

## 6. Variables and scalars

There is no explicit scalar declaration keyword. Assigning to an identifier for
the first time auto-declares it as a `SCALAR` symbol:

```aqvl
SEQUENCE
  x = 5
  y = x + 1
END
```

---

## 7. Functions, recursion, and scoping

Functions are declared inside a scene's `DECLARE` block and may be recursive.
Two body forms are accepted:

- `FUNCTION name(params) ... END` — the body accepts **every** SEQUENCE
  statement (`WHILE`, `LOOP`, `IF ... END`, `PRINT`, `HIGHLIGHT`, pointer
  writes, `FREE`, ...) plus `RETURN [expr]`, which may appear inside loops and
  IFs;
- `FUNCTION name(params) { ... }` — the same statements, brace-delimited; `IF
  cond { ... } ELSE { ... }` is accepted anywhere.

`RETURN` outside a function is a syntax error. Parameters and variables first
assigned inside a function are local to that call; assigning a parameter
(e.g. `remaining = remaining - node.val`) changes only that call's copy.

```bnf
function_decl ::= "FUNCTION" name "(" param_list? ")" ( statement* "END" | "{" statement* "}" )
```

```aqvl
SCENE Fibonacci
DECLARE
  FUNCTION fib(n)
    IF n <= 1
      RETURN n
    END
    RETURN fib(n - 1) + fib(n - 2)
  END
SEQUENCE
  result = fib(5)
END
```

Names: only the structural words (`SCENE`, `DECLARE`, `SEQUENCE`, `END`, `IF`,
`ELSE`, `WHILE`, `LOOP`, `FUNCTION`, `RETURN`, `AND`, `OR`, `NULL`, `TO`,
`FROM`, `INTO`, `PRINT`, `LENGTH`, `SET`, `STATE`, `COMPARE`, `SWAP`, `WAIT`,
`HIGHLIGHT`, `LINK`, `FREE`, `LAYOUT`, `CAMERA`, `POSITION` and the structure
declaration keywords) are reserved. Command words such as `node`, `root`,
`height`, `size`, `level`, `sum`, `min`, `max`, `search`, `insert` are commands
only at the start of a statement and can otherwise be used as variable and
function names (`FUNCTION height(node)`).

Built-in expression functions: `MAX(a, b)`, `MIN(a, b)`, `ABS(x)`,
`NEW_NODE(structure, value)`, and — for every stack, and the queues of a tree program —
`DEQUEUE(q)`, `POP(s)`, `FRONT(q)`, `PEEK(s)`, `IS_EMPTY(x)`. `AND` / `OR`
short-circuit when their right side reads a queue / stack
(`LENGTH(s) > 0 AND PEEK(s) < x` never peeks at an empty stack).

Scoping is lexical, implemented via chained symbol tables: global → scene →
loop (see §8). `analyzeFunctions` (semantics/analysis.ts) validates function
calls against declarations: it reports undeclared functions, wrong argument
counts, and duplicate function declarations.

---

## 8. The type system

AQVL's type system is intentionally lightweight — it is closer to a set of
compile-time/runtime sanity checks than a full static type system.

### 8.1 Semantic symbol types

From `packages/compiler/src/semantic/types.ts`, the `SymbolType` enum is:

```
ARRAY | SCALAR | COLOR | SCENE | LINKEDLIST | STACK | QUEUE | TREE | HEAP
| TRIE | GRAPH | NODE | EDGE
```

Array-indexable types (support `name[expr]`): `ARRAY, LINKEDLIST, STACK, QUEUE,
TREE, HEAP, TRIE, GRAPH`.

Scoping uses chained `SymbolTable`s: global → scene → loop. Scalars are
auto-declared as `SCALAR` on first assignment and do not require a prior
`DECLARE` entry; other structure types must be declared explicitly (see §9).

Diagnostics from the semantic validator are all **ERROR**-level and include:
duplicate scene names, duplicate variable declarations, and undeclared
identifiers/arrays (with "did you mean" suggestions when a close match exists).

### 8.2 Static type checking

`TypeChecker` (`packages/compiler/src/types/TypeSystem.ts`) performs additional
static checks on top of the semantic validator, e.g. rejecting `"hello" - 5"`
(mismatched operand types for an arithmetic operator).

### 8.3 Compile-time vs. runtime checks

Not all validation happens at runtime. In particular, an array index that is a
literal constant known to be out of bounds is caught as a **compile-time**
error, not only surfaced when the program executes.

---

## 9. Data structure declarations

All data structure declarations occur inside a scene's `DECLARE` block. Initial
contents (`= [...]` / `= {...}`) are optional unless noted.

| Declaration | Notes |
|---|---|
| `ARRAY name = [v, v, ...]` | Number or string literals (`["(", "[", ")"]`). |
| `STACK name [= [v, ...]]` | Init optional; numbers or strings, listed bottom to top. |
| `QUEUE name [= [n, ...]]` | Init optional. |
| `LINKEDLIST name [= [n,...]]` | Defaults to singly-linked. |
| `SINGLY LINKEDLIST name [= [n,...]]` | Explicit singly-linked (default). |
| `DOUBLY LINKEDLIST name [= [n,...]]` | Doubly-linked variant. |
| `CIRCULAR LINKEDLIST name [= [n,...]]` | Circular variant. |
| `TREE name [= [n,...]]` | General tree. |
| `BINARY_TREE name [= [n,...]]` | Binary tree. |
| `BST name [= [n,...]]` | Binary search tree. |
| `HEAP name [= [n,...]]` | Min-heap only — there is no max-heap variant. |
| `HASH_MAP name [= {k1: v1, k2: v2}]` | Keys/values: number, quoted string, or bareword identifier (treated as a string). |
| `TRIE name [= ["str", "str", ...]]` | String literals only. |
| `GRAPH name [= ["A-B", "A->B", "A-B:5", ...]]` | Edge strings: `"A-B"` undirected, `"A->B"` directed, `"A-B:5"` weighted (colon suffix is the weight). Directedness/weight is inferred from the edge-string syntax at code generation time, not stored separately on the declaration node. |
| `NODE / EDGE / POINTER / TREE_NODE / LABEL / ANNOTATION name [= expr...] [{ prop: val, ... }]` | Generic object declaration with optional property block. |

Example — general tree built from explicit `TREE_NODE` declarations:

```aqvl
SCENE GeneralTreeDemo
DECLARE
  TREE t
  TREE_NODE r = ["Root"] { parent: t }
  TREE_NODE c1 = ["A"] { parent: t }
  TREE_NODE c2 = ["B"] { parent: t }
SEQUENCE
  LINK r TO c1
  WAIT
  LINK r TO c2
END
```

Example — tree built without an explicit `TREE` declaration, using `ROOT`/`CHILD`
actions directly in `SEQUENCE`:

```aqvl
SCENE TreeOperations
SEQUENCE
    ROOT A
    CHILD A B
    CHILD A C
    PREORDER
    LEVELORDER
    SEARCH E
    HEIGHT
    SIZE
    LEAVES
    DELETE D
END
```

**Important caveat about the example above:** in this `ROOT`/`CHILD` style, only
`PREORDER`, `LEVELORDER`, `SEARCH`, and `DELETE` are confirmed to have general
runtime handlers, and `HEIGHT`/`SIZE`/`ROOT`/`IS_EMPTY`/`MIN`/`MAX` are
implemented **only for `BST`** (`packages/runtime/src/core/algorithms/BSTAlgorithms.ts`),
not for general/binary trees. `LEAVES` (generic, non-BST) has no confirmed
runtime handler — see §11. This example is shown to illustrate valid *syntax*,
not a guarantee that every action in it executes meaningfully at runtime.

---

## 10. Animation/scripting statements (SEQUENCE / LOOP / IF bodies)

In addition to `LOOP`/`IF` (§5) and data-structure action keywords (documented
per-structure in `docs/API_REFERENCE.md`), the animation grammar includes:

- `COMPARE a b` — visually compare two elements.
- `SWAP a b` — swap two elements.
- `WAIT` — pause/step the animation.
- `HIGHLIGHT target [color]` — highlight an element, optionally with a color/label.
- `LINK a TO b` — create a visual link between two declared objects. Bare
  relationship expressions are also accepted: `a -> b`, `a <- b`, `a <-> b`.
- `SET target STATE name` — set a named visual state on a target.
- Bare expression statements: assignment (`x = expr`) and calls (`f(a, b)`).

---

## 11. Reserved / Not Yet Implemented

The following are documented explicitly so they are not mistaken for working
features.

### 11.1 `IMPORT`

`IMPORT` appears in the lexer's keyword list but has **no parser rule**. Using it
in source is a parse error. There is no module/import system in AQVL currently.

### 11.2 Reserved tree-query keywords with no runtime handler

These lex and parse successfully as generic action keywords (no compile error),
but a repository-wide check of `packages/runtime/src/core/algorithms/` found no
runtime handler for any of them (the only matches for
`HEIGHT|SIZE|IS_BALANCED|LCA|COUNT_|LEAVES|DEPTH` were the BST-specific set in
`BSTAlgorithms.ts`, already documented in §9/§API_REFERENCE, and an unrelated
match in `HashMapVisualizer.ts`). **Do not assume any of these execute anything
at runtime**, even though the compiler will accept them:

```
PARENT, LEFT_CHILD, RIGHT_CHILD, SIBLING, GRANDPARENT, UNCLE, COUSINS,
PARENTOF, CHILDRENOF, ANCESTORS, DESCENDANTS, SIBLINGS, PATH, LCA, DISTANCE,
DEPTH, LEVEL, MIN_DEPTH, INTERNAL,
DEGREE, STATS, COUNT_INTERNAL, COUNT_LEFT_LEAVES,
COUNT_RIGHT_LEAVES, COUNT_FULL, COUNT_HALF, IS_FULL, IS_COMPLETE, IS_PERFECT,
IS_BALANCED, IS_DEGENERATE, IS_LEFT_SKEWED, IS_RIGHT_SKEWED, IS_SYMMETRIC,
REVERSE, ZIGZAG, REVERSELEVELORDER, ROOT_TO_NODE, ROOT_TO_LEAVES,
LONGEST_PATH, SHORTEST_PATH
```

### 11.3 AVL trees and Red-Black trees

`packages/runtime/src/data-structures/AVLTree.ts` and `RedBlackTree.ts` contain
full, tested implementations (real rotations/recoloring; see
`tests/integration/balancing.test.ts`), but **there is no AQVL syntax that
reaches them**. `AVL`, `AVL_TREE`, `RED_BLACK`, and `RBT` are not lexer
keywords, and no parser rule constructs these types. They are implemented in
the runtime engine but not yet reachable from AQVL source — do not write AQVL
examples declaring `AVL_TREE` or `RED_BLACK` structures.

---

## 12. Error handling

AQVL's error hierarchy (`packages/shared/src/errors/index.ts`) is rooted at
`AQVLError`, which carries line/column/source/suggestion information.

```
AQVLError
└── CompileError
    ├── TokenError
    ├── AQVLSyntaxError / SyntaxError
    ├── ParseError
    └── SemanticError
        ├── UndeclaredVariableError
        ├── UndeclaredFunctionError
        ├── DuplicateDeclarationError
        ├── ReturnOutsideFunctionError
        ├── WrongArgumentCountError
        └── TypeMismatchError

AQVLError
└── RuntimeError
    ├── StackUnderflowError
    ├── StackOverflowError
    ├── UndefinedVariableError
    ├── OutOfBoundsError
    ├── DivisionByZeroError
    ├── JumpTargetError
    └── FunctionNotFoundError
```

`formatError()` renders a human-readable error report containing:

- `<ErrorName>`
- `line N, col M`
- a source snippet with a `^` caret pointing at the offending column
- a `Suggestion: ...` line when a suggestion is available (e.g. a
  "did you mean" hint for an undeclared identifier)

Some diagnostics — notably literal, statically-known out-of-bounds array
indices — are raised at **compile time** rather than only at runtime (see §8.3).

---

## 13. See also

- `docs/API_REFERENCE.md` — full catalog of built-in data-structure and
  algorithm operations, their exact syntax, complexity, and examples.
