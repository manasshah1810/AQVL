import { TokenError } from '@aqvl/shared';

export enum TokenType {
  Keyword = 'Keyword',
  Identifier = 'Identifier',
  Number = 'Number',
  String = 'String',
  Symbol = 'Symbol',
  EOF = 'EOF',
}

export interface Position {
  line: number;
  column: number;
}

export interface Token {
  type: TokenType;
  value: string;
  pos: Position;
}

const KEYWORDS = new Set([
  'SCENE', 'DECLARE', 'ARRAY', 'SEQUENCE', 
  'COMPARE', 'SWAP', 'HIGHLIGHT', 'WAIT', 'END',
  'LINKEDLIST', 'TYPE', 'SINGLY', 'DOUBLY', 'CIRCULAR',
  'NODE', 'EDGE', 'POINTER', 'STACK', 'QUEUE', 'HEAP',
  'GRAPH', 'VERTEX', 'GRAPH_EDGE', 'TREE', 'TREE_NODE', 'BINARY_TREE', 'BST',
  'LABEL', 'ANNOTATION', 'LINK', 'RELATION', 'DIRECTED', 'UNDIRECTED',
  'TO', 'FROM', 'PARENT', 'CHILD', 'LEFT_CHILD', 'RIGHT_CHILD', 'SIBLING',
  'INSERT', 'DELETE', 'INSERT_HEAD', 'INSERT_TAIL', 'DELETE_HEAD', 'DELETE_TAIL', 'FREE', 'MOVE', 'CONNECT', 'DISCONNECT', 'PUSH', 'POP', 'PEEK',
  'ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR', 'VISIT', 'MARK', 'TRAVERSE', 'ROTATE', 'SEARCH', 'HEAPIFY', 'UPDATE',
  'HEAP_INSERT', 'HEAP_EXTRACT', 'HEAP_DECREASE', 'BUILD_HEAP',
  'HASH_MAP', 'HASHMAP_INSERT', 'HASHMAP_LOOKUP', 'HASHMAP_DELETE',
  'TRIE_INSERT', 'TRIE_SEARCH', 'TRIE_DELETE', 'TRIE_AUTOCOMPLETE', 'TRIE_STARTSWITH',
  'SET', 'STATE', 'LOOP', 'LENGTH', 'NULL', 'TRIE', 'IF', 'CLEAR', 'IS_EMPTY',
  'ROOT', 'REMOVE', 'COPY', 'FIND', 'SELECT', 'PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER', 'REVERSE', 'ZIGZAG', 'DFS', 'BFS', 'DIJKSTRA', 'BELLMAN_FORD', 'ASTAR', 'PRIM', 'KRUSKAL', 'TOPO_SORT',
  'HEIGHT', 'DEPTH', 'LEVEL', 'MAX_DEPTH', 'MIN_DEPTH', 'SIZE', 'LEAVES', 'INTERNAL', 'DEGREE', 'STATS', 'PARENTOF', 'CHILDRENOF', 'ANCESTORS', 'DESCENDANTS', 'SIBLINGS', 'PATH', 'INTO',
  'COUNT_NODES', 'COUNT_LEAVES', 'COUNT_INTERNAL', 'COUNT_LEFT_LEAVES', 'COUNT_RIGHT_LEAVES', 'COUNT_FULL', 'COUNT_HALF',
  'IS_FULL', 'IS_COMPLETE', 'IS_PERFECT', 'IS_BALANCED', 'IS_DEGENERATE', 'IS_LEFT_SKEWED', 'IS_RIGHT_SKEWED', 'IS_SYMMETRIC',
  'LCA', 'DISTANCE', 'GRANDPARENT', 'UNCLE', 'COUSINS',
  'ROOT_TO_NODE', 'ROOT_TO_LEAVES', 'LONGEST_PATH', 'SHORTEST_PATH',
  'MIRROR', 'INVERT', 'CLONE', 'REMOVE_LEAVES', 'PRUNE',
  'LEFT_VIEW', 'RIGHT_VIEW', 'TOP_VIEW', 'BOTTOM_VIEW', 'BOUNDARY', 'VERTICAL_ORDER', 'DIAGONAL',
  'MAX_VALUE', 'MIN_VALUE', 'MIN', 'MAX', 'SUM', 'AVERAGE', 'MAX_LEVEL_SUM',
  'BUBBLE_SORT', 'SELECTION_SORT', 'INSERTION_SORT', 'MERGE_SORT', 'QUICK_SORT',
  // User-defined functions (VM mode)
  'FUNCTION', 'RETURN', 'ELSE',
  // Scene-level control flow / output
  'WHILE', 'PRINT', 'AND', 'OR',
  // Spatial syntax (LAYOUT / CAMERA / POSITION) — see docs/design/spatial-syntax-spec.md
  'LAYOUT', 'AS', 'LINE', 'HIERARCHY', 'FORCE_DIRECTED', 'GRID', 'CUSTOM',
  'CAMERA', 'FOCUS', 'AUTO_FIT', 'ORBIT', 'POSITION', 'AT',
]);

export class Lexer {
  private source: string;
  private current: number = 0;
  private line: number = 1;
  private column: number = 1;
  /** The most recently emitted token, used to disambiguate a leading '-' as negation vs subtraction. */
  private lastToken?: Token;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Token types after which a '-' must mean subtraction (the previous token
   * is a complete value/operand). Anywhere else — start of input, after an
   * operator, '(', '[', ',', ':', '=', or a keyword like RETURN — a '-'
   * immediately followed by a digit starts a negative number literal.
   */
  private isOperandEnd(token: Token): boolean {
    if (token.type === TokenType.Number || token.type === TokenType.Identifier || token.type === TokenType.String) {
      return true;
    }
    if (token.type === TokenType.Symbol && (token.value === ')' || token.value === ']')) {
      return true;
    }
    return false;
  }

  private tokenError(message: string, pos: Position, suggestion?: string): TokenError {
    return new TokenError(message, { line: pos.line, column: pos.column, source: this.source, suggestion });
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      this.lastToken = token;
      token = this.nextToken();
    }
    tokens.push(token); // Push EOF
    return tokens;
  }

  private nextToken(): Token {
    this.skipWhitespace();

    if (this.isAtEnd()) {
      return this.createToken(TokenType.EOF, '');
    }

    const c = this.peek();

    if (this.isAlpha(c)) {
      return this.readIdentifierOrKeyword();
    }

    if (this.isDigit(c)) {
      return this.readNumber();
    }

    if (c === '"' || c === "'") {
      return this.readString();
    }

    if (c === '<' && this.peekNext() === '-' && this.peekNext(2) === '>') {
      const pos = this.getPos();
      this.advance(); this.advance(); this.advance();
      return { type: TokenType.Symbol, value: '<->', pos };
    }

    if (c === '<' && this.peekNext() === '-') {
      const pos = this.getPos();
      this.advance(); this.advance();
      return { type: TokenType.Symbol, value: '<-', pos };
    }

    if (c === '-' && this.peekNext() === '>') {
      const pos = this.getPos();
      this.advance(); this.advance();
      return { type: TokenType.Symbol, value: '->', pos };
    }

    // A '-' directly followed by a digit is a negative number literal
    // (e.g. `-5`, `-3.14`) unless the previous token was itself a complete
    // value (a number/identifier/string, or a closing ')'/']'), in which
    // case it's the subtraction operator, e.g. `x - 5`.
    if (c === '-' && this.isDigit(this.peekNext()) && !(this.lastToken && this.isOperandEnd(this.lastToken))) {
      return this.readNumber();
    }

    // Two-char comparison operators (function/expression conditions)
    if (this.peekNext() === '=' && (c === '<' || c === '>' || c === '=' || c === '!')) {
      const pos = this.getPos();
      this.advance(); this.advance();
      return { type: TokenType.Symbol, value: c + '=', pos };
    }

    // '.' is member access (`curr.next`, `list.head`); a '.' inside a number
    // literal (`3.14`) never gets here, since readNumber consumes it.
    if ('=[]+,{}:-<>()*/%;.'.includes(c)) {
      const pos = this.getPos();
      this.advance();
      return { type: TokenType.Symbol, value: c, pos };
    }

    throw this.tokenError(`Unexpected character '${c}'.`, this.getPos());
  }

  private skipWhitespace() {
    while (!this.isAtEnd()) {
      const c = this.peek();
      if (c === ' ' || c === '\r' || c === '\t') {
        this.advance();
      } else if (c === '\n') {
        this.line++;
        this.column = 1;
        this.current++;
      } else if (c === '/' && this.peekNext() === '/') {
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private readIdentifierOrKeyword(): Token {
    const pos = this.getPos();
    let value = '';
    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }
    const type = KEYWORDS.has(value.toUpperCase()) ? TokenType.Keyword : TokenType.Identifier;
    return { type, value, pos };
  }

  private readNumber(): Token {
    const pos = this.getPos();
    let value = '';
    if (this.peek() === '-') {
      value += this.advance();
    }
    let hasDot = false;
    while (!this.isAtEnd()) {
      const c = this.peek();
      if (this.isDigit(c)) {
        value += this.advance();
      } else if (c === '.' && !hasDot) {
        hasDot = true;
        value += this.advance();
      } else {
        break;
      }
    }
    return { type: TokenType.Number, value, pos };
  }

  private readString(): Token {
    const pos = this.getPos();
    const quote = this.advance(); // consume opening quote
    let value = '';
    while (!this.isAtEnd() && this.peek() !== quote) {
      value += this.advance();
    }
    if (this.isAtEnd()) {
      throw this.tokenError(`Unterminated string starting with ${quote}${value}.`, pos, `Add a closing ${quote} to end the string.`);
    }
    this.advance(); // consume closing quote
    return { type: TokenType.String, value, pos };
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private peek(): string {
    return this.source.charAt(this.current);
  }

  private peekNext(offset: number = 1): string {
    if (this.current + offset >= this.source.length) return '\0';
    return this.source.charAt(this.current + offset);
  }

  private advance(): string {
    this.column++;
    return this.source.charAt(this.current++);
  }

  private getPos(): Position {
    return { line: this.line, column: this.column };
  }

  private createToken(type: TokenType, value: string): Token {
    return { type, value, pos: this.getPos() };
  }
}
