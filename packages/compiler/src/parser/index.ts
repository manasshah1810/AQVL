import { Token, TokenType } from '../lexer';
import {
  ProgramNode,
  SceneNode,
  DeclareBlockNode,
  SequenceBlockNode,
  ArrayDeclNode,
  StatementNode,
  CompareNode,
  SwapNode,
  ExpressionNode,
  ArrayAccessNode,
  IdentifierNode,
  LiteralNode,
} from '../ast/types';

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): ProgramNode {
    const scenes: SceneNode[] = [];
    while (!this.isAtEnd()) {
      if (this.matchKeyword('SCENE')) {
        scenes.push(this.parseScene());
      } else {
        throw new Error(`Expected SCENE at line ${this.peek().pos.line}`);
      }
    }
    return {
      type: 'ProgramNode',
      imports: [],
      scenes,
      pos: { line: 1, column: 1 },
    };
  }

  private parseScene(): SceneNode {
    const nameToken = this.consume(TokenType.Identifier, 'Expected scene name.');
    const name: IdentifierNode = {
      type: 'IdentifierNode',
      name: nameToken.value,
      pos: nameToken.pos,
    };

    let declarations: DeclareBlockNode = { type: 'DeclareBlockNode', variables: [], pos: nameToken.pos };
    if (this.matchKeyword('DECLARE')) {
      declarations = this.parseDeclareBlock();
    }

    let sequence: SequenceBlockNode = { type: 'SequenceBlockNode', statements: [], pos: nameToken.pos };
    if (this.matchKeyword('SEQUENCE')) {
      sequence = this.parseSequenceBlock();
    }

    return {
      type: 'SceneNode',
      name,
      declarations,
      sequence,
      pos: nameToken.pos,
    };
  }

  private parseDeclareBlock(): DeclareBlockNode {
    const pos = this.previous().pos;
    const variables = [];
    
    while (!this.isAtEnd() && !this.checkKeyword('SEQUENCE') && !this.checkKeyword('SCENE')) {
      if (this.matchKeyword('ARRAY')) {
        variables.push(this.parseArrayDecl());
      } else {
        throw new Error(`Unexpected token in DECLARE block at line ${this.peek().pos.line}`);
      }
    }

    return { type: 'DeclareBlockNode', variables, pos };
  }

  private parseArrayDecl(): ArrayDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected array name.');
    this.consumeSymbol('=', 'Expected "=" after array name.');
    this.consumeSymbol('[', 'Expected "[" for array initialization.');
    
    const initialElements: LiteralNode[] = [];
    if (!this.checkSymbol(']')) {
      do {
        const numToken = this.consume(TokenType.Number, 'Expected number in array.');
        initialElements.push({
          type: 'LiteralNode',
          dataType: 'number',
          value: parseFloat(numToken.value),
          pos: numToken.pos,
        });
      } while (this.matchSymbol(','));
    }
    
    this.consumeSymbol(']', 'Expected "]" after array elements.');

    return {
      type: 'ArrayDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos,
    };
  }

  private parseSequenceBlock(): SequenceBlockNode {
    const pos = this.previous().pos;
    const statements: StatementNode[] = [];
    
    while (!this.isAtEnd() && !this.checkKeyword('SCENE') && !this.checkKeyword('END')) {
      if (this.matchKeyword('COMPARE')) {
        statements.push(this.parseCompare());
      } else if (this.matchKeyword('SWAP')) {
        statements.push(this.parseSwap());
      } else if (this.matchKeyword('WAIT')) {
        statements.push(this.parseWait());
      } else {
        throw new Error(`Unexpected token in SEQUENCE block at line ${this.peek().pos.line}: ${this.peek().value}`);
      }
    }

    if (this.matchKeyword('END')) {
      // Successfully consumed END keyword
    }

    return { type: 'SequenceBlockNode', statements, pos };
  }

  private parseCompare(): CompareNode {
    const pos = this.previous().pos;
    const left = this.parseExpression();
    const right = this.parseExpression();
    return { type: 'CompareNode', left, right, pos };
  }

  private parseSwap(): SwapNode {
    const pos = this.previous().pos;
    const left = this.parseExpression();
    const right = this.parseExpression();
    return { type: 'SwapNode', left, right, pos };
  }

  private parseWait(): StatementNode {
    const pos = this.previous().pos;
    return { type: 'WaitNode', pos };
  }

  private parseExpression(): ExpressionNode {
    const token = this.consume(TokenType.Identifier, 'Expected identifier expression.');
    const pos = token.pos;
    
    if (this.matchSymbol('[')) {
      const indexToken = this.consume(TokenType.Number, 'Expected index number.');
      this.consumeSymbol(']', 'Expected "]" after index.');
      
      const index: LiteralNode = {
        type: 'LiteralNode',
        dataType: 'number',
        value: parseFloat(indexToken.value),
        pos: indexToken.pos,
      };
      
      return {
        type: 'ArrayAccessNode',
        array: { type: 'IdentifierNode', name: token.value, pos },
        index,
        pos,
      };
    }
    
    return { type: 'IdentifierNode', name: token.value, pos };
  }

  // --- Helpers ---
  private matchKeyword(kw: string): boolean {
    if (this.checkKeyword(kw)) {
      this.advance();
      return true;
    }
    return false;
  }

  private checkKeyword(kw: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === TokenType.Keyword && this.peek().value.toUpperCase() === kw;
  }

  private matchSymbol(sym: string): boolean {
    if (this.checkSymbol(sym)) {
      this.advance();
      return true;
    }
    return false;
  }

  private checkSymbol(sym: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === TokenType.Symbol && this.peek().value === sym;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at line ${this.peek().pos.line}`);
  }

  private consumeSymbol(sym: string, message: string): Token {
    if (this.checkSymbol(sym)) return this.advance();
    throw new Error(`${message} at line ${this.peek().pos.line}`);
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}
