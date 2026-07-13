# AQVL Grammar Specification

This document defines the core syntax and grammar rules for AQVL (Algorithm Query and Visualization Language), independent of its underlying compiler or renderer implementations.

## 1. General Structure

AQVL is designed to be highly readable, declarative, and intuitive. It reads somewhat like English grammar or a clean scripting language. 

### 1.1 Keywords and Identifiers
- **Keywords** (e.g., `SCENE`, `DECLARE`, `SEQUENCE`, `COMPARE`, `SWAP`) are typically written in ALL CAPS by convention, though the language parser may be case-insensitive.
- **Identifiers** (e.g., variable names, scene names) are alphanumeric and can include underscores (e.g., `arr`, `BubbleSort`).

## 2. Formatting & Whitespace

### 2.1 Do Spaces Matter?
**Yes, for token separation.** Spaces are used to separate keywords, identifiers, and operators. Multiple spaces are treated as a single space (unless inside a string literal). 

### 2.2 Does Indentation Matter?
**Yes.** AQVL uses significant indentation (like Python or YAML) to denote block structures and nesting. This eliminates the need for curly braces `{}` or `BEGIN`/`END` keywords, keeping the code clean and focused.

```aqvl
SCENE BubbleSort
    DECLARE
        ARRAY arr
    SEQUENCE
        COMPARE arr[i] arr[j]
        SWAP arr[i] arr[j]
```

## 3. Nesting

### 3.1 Can Nesting Happen?
**Yes.** Nesting is achieved entirely through indentation. A nested block belongs to the keyword or control structure that precedes it at a lower indentation level.

```aqvl
SCENE ComplexAlgorithm
    DECLARE
        ARRAY data
    SEQUENCE
        LOOP i FROM 0 TO size
            COMPARE data[i] target
                HIGHLIGHT data[i] RED
```

## 4. Comments

### 4.1 Can Comments Exist?
**Yes.** Comments are supported to allow developers to document their visualizations.
- **Single-line comments:** Begin with `//` or `#`. Everything following on that line is ignored by the parser.

```aqvl
// This is a scene for sorting
SCENE BubbleSort
    DECLARE // Variables go here
        ARRAY arr
```

## 5. File Management & Modularity

### 5.1 Can Files Import Other Files?
**Yes.** To keep scenes and logic modular, AQVL supports an `IMPORT` statement. This allows you to define reusable components, layouts, or common algorithms in separate files and compose them together.

```aqvl
IMPORT "common_arrays.aqvl"
IMPORT "themes/dark_mode.aqvl"

SCENE BubbleSort
    // Uses definitions from imported files
```

## 6. Syntax Examples

A complete, syntactically correct AQVL file looks like this:

```aqvl
// main.aqvl
IMPORT "styles.aqvl"

SCENE BubbleSort
    DECLARE
        ARRAY arr [5, 3, 8, 4, 2]
    
    SEQUENCE
        LOOP i FROM 0 TO length
            LOOP j FROM 0 TO length - i - 1
                COMPARE arr[j] arr[j+1]
                SWAP arr[j] arr[j+1]
```
