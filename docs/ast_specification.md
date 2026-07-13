# AQVL Abstract Syntax Tree (AST) Specification

This document defines the Abstract Syntax Tree (AST) nodes that the AQVL Parser generates from the lexer's token stream. Everything downstream in the compiler and renderer relies on this AST.

## 1. Base Node Structure
Every node in the AST will inherit from a base `ASTNode` interface, which typically contains:
*   `type`: The node type (e.g., `"CompareNode"`, `"SceneNode"`).
*   `line`: The line number in the source file (for error reporting).
*   `column`: The column number (for error reporting).

## 2. Program Level Nodes
*   **`ProgramNode`**
    *   Represents the root of an `.aqvl` file.
    *   `imports`: Array of `ImportNode`
    *   `scenes`: Array of `SceneNode`

*   **`ImportNode`**
    *   `path`: `StringLiteralNode` (the file being imported)

*   **`SceneNode`**
    *   `name`: `IdentifierNode`
    *   `declarations`: `DeclareBlockNode`
    *   `sequence`: `SequenceBlockNode`

## 3. Block Nodes
*   **`DeclareBlockNode`**
    *   `variables`: Array of `VariableDeclNode` (e.g., `ArrayDeclNode`)

*   **`SequenceBlockNode`**
    *   `statements`: Array of `StatementNode`

## 4. Declaration Nodes
*   **`ArrayDeclNode`** (extends `VariableDeclNode`)
    *   `name`: `IdentifierNode`
    *   `initialElements`: Array of `LiteralNode` (optional, e.g., `[5, 3, 8]`)

## 5. Statement Nodes
*   **`CompareNode`**
    *   `left`: `ExpressionNode` (usually an `ArrayAccessNode`)
    *   `right`: `ExpressionNode`

*   **`SwapNode`**
    *   `left`: `ExpressionNode`
    *   `right`: `ExpressionNode`

*   **`HighlightNode`**
    *   `target`: `ExpressionNode`
    *   `color`: `ColorLiteralNode`

*   **`LoopNode`**
    *   `iterator`: `IdentifierNode` (e.g., `i`)
    *   `start`: `ExpressionNode` (e.g., `0`)
    *   `end`: `ExpressionNode` (e.g., `length`)
    *   `body`: Array of `StatementNode`

## 6. Expression Nodes
*   **`IdentifierNode`**
    *   `name`: String (e.g., `"arr"`, `"i"`)

*   **`ArrayAccessNode`**
    *   `array`: `IdentifierNode`
    *   `index`: `ExpressionNode` (e.g., an identifier like `i` or a math expression like `j + 1`)

*   **`BinaryOpNode`** (For math expressions like `j + 1`)
    *   `left`: `ExpressionNode`
    *   `operator`: String (e.g., `"+"`, `"-"`)
    *   `right`: `ExpressionNode`

*   **`LiteralNode`**
    *   `value`: Number or String
    *   `dataType`: `"number"` | `"string"` | `"color"`

## Example Transformation
**AQVL Source:**
```aqvl
COMPARE arr[0] arr[1]
```

**Resulting AST (JSON representation):**
```json
{
  "type": "CompareNode",
  "left": {
    "type": "ArrayAccessNode",
    "array": { "type": "IdentifierNode", "name": "arr" },
    "index": { "type": "LiteralNode", "value": 0, "dataType": "number" }
  },
  "right": {
    "type": "ArrayAccessNode",
    "array": { "type": "IdentifierNode", "name": "arr" },
    "index": { "type": "LiteralNode", "value": 1, "dataType": "number" }
  }
}
```
