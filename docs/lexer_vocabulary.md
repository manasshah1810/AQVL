# AQVL Lexer Vocabulary

This document defines the token vocabulary for the AQVL Lexer. The lexer will scan the raw AQVL source code and convert it into a stream of these discrete tokens.

## 1. Keywords
Reserved words that have special meaning in AQVL.
*   `KEYWORD_SCENE`: `SCENE`
*   `KEYWORD_DECLARE`: `DECLARE`
*   `KEYWORD_ARRAY`: `ARRAY`
*   `KEYWORD_SEQUENCE`: `SEQUENCE`
*   `KEYWORD_COMPARE`: `COMPARE`
*   `KEYWORD_SWAP`: `SWAP`
*   `KEYWORD_LOOP`: `LOOP`
*   `KEYWORD_FROM`: `FROM`
*   `KEYWORD_TO`: `TO`
*   `KEYWORD_IMPORT`: `IMPORT`
*   `KEYWORD_HIGHLIGHT`: `HIGHLIGHT`

## 2. Identifiers
Names defined by the user (variables, scene names, etc.).
*   `IDENTIFIER`: Any string starting with a letter or underscore, followed by letters, numbers, or underscores (e.g., `arr`, `BubbleSort`, `i`, `my_var`).

## 3. Literals
Fixed values defined in the source code.
*   `NUMBER`: Integer or floating-point numerical values (e.g., `0`, `5`, `-1`, `3.14`).
*   `STRING`: Text enclosed in double quotes (e.g., `"dark_mode.aqvl"`).
*   `COLOR`: Color literals, either named (e.g., `RED`, `BLUE`) or hex values (e.g., `#FF0000`).

## 4. Operators & Punctuation
Symbols used for indexing, math, and structure.
*   `LEFT_BRACKET`: `[`
*   `RIGHT_BRACKET`: `]`
*   `PLUS`: `+`
*   `MINUS`: `-`
*   `MULTIPLY`: `*`
*   `DIVIDE`: `/`
*   `ASSIGN`: `=`
*   `COMMA`: `,`

## 5. Structural Tokens (Whitespace)
Since AQVL relies on significant indentation, the lexer must emit tokens for structural changes. Normal inline spaces are discarded.
*   `NEWLINE`: Indicates the end of a line.
*   `INDENT`: Emitted when the indentation level increases relative to the previous line.
*   `DEDENT`: Emitted when the indentation level decreases relative to the previous line.

## 6. Comments
Ignored by the compiler but handled during lexical analysis.
*   `COMMENT`: Text following `//` or `#` up to the end of the line. The lexer usually skips emitting these to the parser, though they can be retained for formatting/tooling purposes.

## Example Tokenization
**Source:**
```aqvl
COMPARE arr[0] arr[1]
```
**Token Stream:**
1. `KEYWORD_COMPARE`
2. `IDENTIFIER` (arr)
3. `LEFT_BRACKET`
4. `NUMBER` (0)
5. `RIGHT_BRACKET`
6. `IDENTIFIER` (arr)
7. `LEFT_BRACKET`
8. `NUMBER` (1)
9. `RIGHT_BRACKET`
10. `NEWLINE`
