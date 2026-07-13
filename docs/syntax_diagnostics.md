# AQVL Syntax Diagnostics & Error Handling

This document specifies the validation rules for the AQVL Lexer and Parser, focusing strictly on **syntax** (not runtime or semantic logic). The primary goal is to provide **helpful, human-readable diagnostics** rather than crashing.

## 1. Error Reporting Structure
When the parser encounters a syntax error, it will emit a `Diagnostic` object instead of throwing an unhandled exception. The compiler can collect multiple diagnostics to report all errors at once.

A diagnostic includes:
*   `level`: `"ERROR" | "WARNING"`
*   `line`: The line number where the error occurred.
*   `column`: The exact character index.
*   `message`: A human-readable description of the problem.
*   `snippet`: The source code line with a caret (`^`) pointing to the error.

## 2. Common Syntax Errors & Expected Diagnostics

### 2.1 Missing Bracket
**Source:** `COMPARE arr[0 arr[1]`
**Diagnostic:**
```text
[Line 1, Column 14] ERROR: Expected closing bracket ']' after array index.
    COMPARE arr[0 arr[1]
                 ^
```

### 2.2 Unknown Keyword / Unexpected Token
**Source:** `SORT arr` (where `SORT` is not a valid keyword)
**Diagnostic:**
```text
[Line 2, Column 1] ERROR: Unknown keyword or unexpected token 'SORT'. Did you mean 'SCENE' or 'SEQUENCE'?
    SORT arr
    ^
```

### 2.3 Wrong Indentation
**Source:**
```aqvl
SCENE BubbleSort
DECLARE
    ARRAY arr
```
**Diagnostic:**
```text
[Line 2, Column 1] ERROR: Unexpected indentation level. Expected block to be indented inside 'SCENE'.
    DECLARE
    ^
```

### 2.4 Missing Operands
**Source:** `COMPARE arr[0]` (Compare requires two things to compare)
**Diagnostic:**
```text
[Line 5, Column 1] ERROR: 'COMPARE' expects exactly two operands. Only one provided.
    COMPARE arr[0]
    ^
```

## 3. Recovery Strategies
To prevent the compiler from crashing or giving up after the first error, the parser should implement **Panic Mode Recovery**:
1. When an error is encountered, report the diagnostic.
2. Enter "panic mode" and discard tokens until a synchronization point is found (e.g., the next `NEWLINE`, or a structural keyword like `SCENE` or `DECLARE`).
3. Resume parsing to catch any subsequent errors in the file.

This ensures the user gets a comprehensive list of syntax mistakes in a single run, greatly improving the developer experience.
