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
  'COMPARE', 'SWAP', 'HIGHLIGHT', 'WAIT', 'END'
]);

export class Lexer {
  private source: string;
  private current: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
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

    if ('=[]+,'.includes(c)) {
      const pos = this.getPos();
      this.advance();
      return { type: TokenType.Symbol, value: c, pos };
    }

    throw new Error(`Unexpected character '${c}' at line ${this.line}, column ${this.column}`);
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
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }
    return { type: TokenType.Number, value, pos };
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
