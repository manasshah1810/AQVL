import { Token, TokenType } from '../lexer';
import {
  ProgramNode,
  SceneNode,
  DeclareBlockNode,
  SequenceBlockNode,
  StatementNode,
  CompareNode,
  SwapNode,
  ExpressionNode,
  ArrayAccessNode,
  IdentifierNode,
  LiteralNode,
  VariableDeclNode,
  ArrayDeclNode,
  StackDeclNode,
  QueueDeclNode,
  TreeDeclNode,
  HeapDeclNode,
  LinkedListDeclNode,
  ObjectDeclNode,
  RelationshipNode,
  GenericActionNode,
  SetStateNode,
  LoopNode,
  IfNode,
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

    const objectKeywords = new Set([
      'NODE', 'EDGE', 'POINTER', 'STACK', 'QUEUE',
      'GRAPH', 'VERTEX', 'GRAPH_EDGE', 'TREE', 'TREE_NODE',
      'LABEL', 'ANNOTATION'
    ]);

    while (!this.isAtEnd() && !this.checkKeyword('SEQUENCE') && !this.checkKeyword('SCENE')) {
      if (this.matchKeyword('ARRAY')) {
        variables.push(this.parseArrayDecl());
      } else if (this.matchKeyword('STACK')) {
        variables.push(this.parseStackDecl());
      } else if (this.matchKeyword('QUEUE')) {
        variables.push(this.parseQueueDecl());
      } else if (this.matchKeyword('LINKEDLIST')) {
        variables.push(this.parseLinkedListDecl());
      } else if (this.matchKeyword('TREE')) {
        variables.push(this.parseTreeDecl());
      } else if (this.matchKeyword('HEAP')) {
        variables.push(this.parseHeapDecl());
      } else if (this.matchKeyword('TRIE')) {
        variables.push(this.parseTrieDecl());
      } else if (this.matchKeyword('GRAPH')) {
        variables.push(this.parseGraphDecl());
      } else if (this.peek().type === TokenType.Keyword && objectKeywords.has(this.peek().value.toUpperCase())) {
        const keyword = this.advance().value.toUpperCase();
        variables.push(this.parseObjectDecl(keyword));
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

  private parseTrieDecl(): any { // Returning TrieDeclNode but using any to avoid type issues if not imported yet (wait, they are in the same package and file probably imports it)
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected trie name.');
    this.consumeSymbol('=', 'Expected "=" after trie name.');
    this.consumeSymbol('[', 'Expected "[" for trie initialization.');

    const initialElements: any[] = [];
    if (!this.checkSymbol(']')) {
      do {
        const strToken = this.consume(TokenType.String, 'Expected string in trie.');
        initialElements.push({
          type: 'LiteralNode',
          dataType: 'string',
          value: strToken.value,
          pos: strToken.pos,
        });
      } while (this.matchSymbol(','));
    }

    this.consumeSymbol(']', 'Expected "]" after trie elements.');

    return {
      type: 'TrieDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos,
    };
  }

  private parseGraphDecl(): any {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected graph name.');

    let initialElements: LiteralNode[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('[', 'Expected "[" for graph initialization.');
      initialElements = [];
      if (!this.checkSymbol(']')) {
        do {
          const strToken = this.consume(TokenType.String, 'Expected string for graph edge.');
          initialElements.push({
            type: 'LiteralNode',
            dataType: 'string',
            value: strToken.value,
            pos: strToken.pos,
          });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(']', 'Expected "]" after graph elements.');
    }

    return {
      type: 'GraphDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos,
    };
  }

  private parseObjectDecl(objectType: string): ObjectDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, `Expected identifier for ${objectType}.`);

    const args: ExpressionNode[] = [];

    if (this.matchSymbol('=')) {
      if (this.matchSymbol('[')) {
        if (!this.checkSymbol(']')) {
          do {
            args.push(this.parseExpression());
          } while (this.matchSymbol(','));
        }
        this.consumeSymbol(']', 'Expected "]" after array elements.');
      } else {
        while (!this.isAtEnd() && this.peek().type !== TokenType.Keyword && this.peek().value !== '{') {
          args.push(this.parseExpression());
        }
      }
    }

    const properties: any[] = [];
    if (this.matchSymbol('{')) {
      while (!this.checkSymbol('}')) {
        const propNameToken = this.consume(TokenType.Identifier, 'Expected property name.');
        this.consumeSymbol(':', 'Expected ":" after property name.');
        const propValue = this.parseExpression();

        properties.push({
          type: 'PropertyNode',
          name: propNameToken.value,
          value: propValue,
          pos: propNameToken.pos
        });

        if (!this.matchSymbol(',')) {
          break;
        }
      }
      this.consumeSymbol('}', 'Expected "}" after properties.');
    }

    return {
      type: 'ObjectDeclNode',
      objectType,
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      args,
      properties,
      pos,
    };
  }

  private parseStackDecl(): StackDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected stack name.');

    let initialElements: LiteralNode[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('[', 'Expected "[" for stack initialization.');
      initialElements = [];
      if (!this.checkSymbol(']')) {
        do {
          const numToken = this.consume(TokenType.Number, 'Expected number in stack.');
          initialElements.push({
            type: 'LiteralNode',
            dataType: 'number',
            value: parseFloat(numToken.value),
            pos: numToken.pos,
          });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(']', 'Expected "]" after stack elements.');
    }

    return {
      type: 'StackDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos
    };
  }
  private parseLinkedListDecl(): any {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected linked list name.');

    let initialElements: LiteralNode[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('[', 'Expected "[" for linked list initialization.');
      initialElements = [];
      if (!this.checkSymbol(']')) {
        do {
          const numToken = this.consume(TokenType.Number, 'Expected number in linked list.');
          initialElements.push({
            type: 'LiteralNode',
            dataType: 'number',
            value: parseFloat(numToken.value),
            pos: numToken.pos,
          });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(']', 'Expected "]" after linked list elements.');
    }

    return {
      type: 'LinkedListDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos
    };
  }


  private parseQueueDecl(): QueueDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected queue name.');

    let initialElements: LiteralNode[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('[', 'Expected "[" for queue initialization.');
      initialElements = [];
      if (!this.checkSymbol(']')) {
        do {
          const numToken = this.consume(TokenType.Number, 'Expected number in queue.');
          initialElements.push({
            type: 'LiteralNode',
            dataType: 'number',
            value: parseFloat(numToken.value),
            pos: numToken.pos,
          });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(']', 'Expected "]" after queue elements.');
    }

    return {
      type: 'QueueDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos
    };
  }

  private parseTreeDecl(): TreeDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected tree name.');

    let initialElements: LiteralNode[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('[', 'Expected "[" for tree initialization.');
      initialElements = [];
      if (!this.checkSymbol(']')) {
        do {
          const numToken = this.consume(TokenType.Number, 'Expected number in tree array.');
          initialElements.push({
            type: 'LiteralNode',
            dataType: 'number',
            value: parseFloat(numToken.value),
            pos: numToken.pos,
          });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(']', 'Expected "]" after tree elements.');
    }

    return {
      type: 'TreeDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos
    };
  }

  private parseHeapDecl(): HeapDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected heap name.');

    let initialElements: LiteralNode[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('[', 'Expected "[" for heap initialization.');
      initialElements = [];
      if (!this.checkSymbol(']')) {
        do {
          const numToken = this.consume(TokenType.Number, 'Expected number in heap array.');
          initialElements.push({
            type: 'LiteralNode',
            dataType: 'number',
            value: parseFloat(numToken.value),
            pos: numToken.pos,
          });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(']', 'Expected "]" after heap elements.');
    }

    return {
      type: 'HeapDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos
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
      } else if (this.matchKeyword('LINK')) {
        statements.push(this.parseLinkStatement());
      } else if (this.matchKeyword('LOOP')) {
        statements.push(this.parseLoop());
      } else if (this.matchKeyword('IF')) {
        statements.push(this.parseIf());
      } else if (this.peek().type === TokenType.Keyword && new Set(['HIGHLIGHT', 'INSERT', 'DELETE', 'UPDATE', 'MOVE', 'CONNECT', 'DISCONNECT', 'PUSH', 'POP', 'PEEK', 'ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR', 'VISIT', 'MARK', 'TRAVERSE', 'ROTATE', 'SEARCH', 'HEAPIFY']).has(this.peek().value.toUpperCase())) {
        statements.push(this.parseGenericAction());
      } else if (this.matchKeyword('SET')) {
        statements.push(this.parseSetState());
      } else if (this.check(TokenType.Identifier)) {
        statements.push(this.parseExpressionOrRelationship());
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

  private parseLoop(): LoopNode {
    const pos = this.previous().pos;
    const iteratorToken = this.consume(TokenType.Identifier, 'Expected iterator variable name after LOOP.');

    this.consumeKeyword('FROM', 'Expected FROM after loop iterator.');
    const startExpr = this.parseExpression();

    this.consumeKeyword('TO', 'Expected TO after loop start expression.');
    const endExpr = this.parseExpression();

    const body: StatementNode[] = [];
    while (!this.isAtEnd() && !this.checkKeyword('END')) {
      if (this.matchKeyword('COMPARE')) {
        body.push(this.parseCompare());
      } else if (this.matchKeyword('SWAP')) {
        body.push(this.parseSwap());
      } else if (this.matchKeyword('WAIT')) {
        body.push(this.parseWait());
      } else if (this.matchKeyword('LINK')) {
        body.push(this.parseLinkStatement());
      } else if (this.matchKeyword('LOOP')) {
        body.push(this.parseLoop());
      } else if (this.matchKeyword('IF')) {
        body.push(this.parseIf());
      } else if (this.peek().type === TokenType.Keyword && new Set(['HIGHLIGHT', 'INSERT', 'DELETE', 'MOVE', 'CONNECT', 'DISCONNECT', 'PUSH', 'POP', 'PEEK', 'ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR', 'VISIT', 'MARK', 'TRAVERSE', 'ROTATE', 'SEARCH', 'HEAPIFY']).has(this.peek().value.toUpperCase())) {
        body.push(this.parseGenericAction());
      } else if (this.matchKeyword('SET')) {
        body.push(this.parseSetState());
      } else if (this.check(TokenType.Identifier)) {
        body.push(this.parseExpressionOrRelationship());
      } else {
        throw new Error(`Unexpected token in LOOP block at line ${this.peek().pos.line}: ${this.peek().value}`);
      }
    }

    // Consume END
    this.consumeKeyword('END', 'Expected END to close LOOP block.');

    // In AQVL we just use END for scenes, sequences and loops.
    // If it's END LOOP, we might optionally consume LOOP.
    if (this.checkKeyword('LOOP')) {
      this.advance();
    }

    return {
      type: 'LoopNode',
      iterator: { type: 'IdentifierNode', name: iteratorToken.value, pos: iteratorToken.pos },
      start: startExpr,
      end: endExpr,
      body,
      pos
    };
  }

  private parseIf(): IfNode {
    const pos = this.previous().pos;
    const condition = this.parseExpression();

    const body: StatementNode[] = [];
    while (!this.isAtEnd() && !this.checkKeyword('END')) {
      if (this.matchKeyword('COMPARE')) {
        body.push(this.parseCompare());
      } else if (this.matchKeyword('SWAP')) {
        body.push(this.parseSwap());
      } else if (this.matchKeyword('WAIT')) {
        body.push(this.parseWait());
      } else if (this.matchKeyword('LINK')) {
        body.push(this.parseLinkStatement());
      } else if (this.matchKeyword('LOOP')) {
        body.push(this.parseLoop());
      } else if (this.matchKeyword('IF')) {
        body.push(this.parseIf());
      } else if (this.peek().type === TokenType.Keyword && new Set(['HIGHLIGHT', 'INSERT', 'DELETE', 'MOVE', 'CONNECT', 'DISCONNECT', 'PUSH', 'POP', 'PEEK', 'ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR', 'VISIT', 'MARK', 'TRAVERSE', 'ROTATE', 'SEARCH', 'HEAPIFY']).has(this.peek().value.toUpperCase())) {
        body.push(this.parseGenericAction());
      } else if (this.matchKeyword('SET')) {
        body.push(this.parseSetState());
      } else if (this.check(TokenType.Identifier)) {
        body.push(this.parseExpressionOrRelationship());
      } else {
        throw new Error(`Unexpected token in IF block at line ${this.peek().pos.line}: ${this.peek().value}`);
      }
    }

    this.consumeKeyword('END', 'Expected END to close IF block.');
    if (this.checkKeyword('IF')) {
      this.advance();
    }

    return { type: 'IfNode', condition, body, pos };
  }

  private parseLinkStatement(): RelationshipNode {
    const pos = this.previous().pos;
    const source = this.parseExpression();
    this.consumeKeyword('TO', 'Expected TO after source in LINK statement.');
    const target = this.parseExpression();
    return { type: 'RelationshipNode', source, target, directed: true, relationType: 'LINK', pos };
  }

  private parseGenericAction(): GenericActionNode {
    const pos = this.peek().pos;
    const actionName = this.advance().value.toUpperCase();
    const args: ExpressionNode[] = [];

    // Read expressions until we hit a keyword that might start the next statement or end of block, 
    // or newline. Since AQVL is newline-sensitive or not?
    // Actually, sequence block parses statements until 'END' or another statement keyword.
    // So we just parse expressions as long as the next token is an identifier, number, or string.
    while (!this.isAtEnd()) {
      const nextType = this.peek().type;
      if (nextType === TokenType.Identifier || nextType === TokenType.Number || nextType === TokenType.String) {
        args.push(this.parseExpression());
      } else if (nextType === TokenType.Symbol && this.peek().value === '[') {
        // Handle standalone array indexing logic if needed, but parseExpression covers it if it starts with Identifier
        break;
      } else {
        break; // Stop parsing args if we hit a Keyword or other Symbol
      }
    }

    return { type: 'GenericActionNode', actionName, args, pos };
  }

  private parseSetState(): SetStateNode {
    const pos = this.previous().pos;
    const target = this.parseExpression();
    this.consumeKeyword('STATE', 'Expected STATE keyword after target in SET statement.');

    // We allow keywords or identifiers as state names (e.g. active could be parsed as an identifier)
    // Actually, states are usually identifiers, let's accept identifiers or keywords if they aren't protected.
    // For simplicity, we just check if it's an Identifier or Keyword and grab the value.
    const stateToken = this.advance();
    if (stateToken.type !== TokenType.Identifier && stateToken.type !== TokenType.Keyword) {
      throw new Error(`[Parser] Expected state name after STATE. Line ${stateToken.pos.line}`);
    }

    return { type: 'SetStateNode', target, stateName: stateToken.value.toLowerCase(), pos };
  }

  private parseExpressionOrRelationship(): StatementNode {
    const pos = this.peek().pos;
    const expr = this.parseExpression();

    if (this.matchSymbol('->')) {
      const target = this.parseExpression();
      return { type: 'RelationshipNode', source: expr, target, directed: true, relationType: 'DIRECTED', pos };
    } else if (this.matchSymbol('<-')) {
      const target = this.parseExpression();
      return { type: 'RelationshipNode', source: target, target: expr, directed: true, relationType: 'DIRECTED', pos };
    } else if (this.matchSymbol('<->')) {
      const target = this.parseExpression();
      return { type: 'RelationshipNode', source: expr, target, directed: false, relationType: 'UNDIRECTED', pos };
    }

    return { type: 'ExpressionStatementNode', expression: expr, pos };
  }

  private parseExpression(): ExpressionNode {
    return this.parseBinaryExpression();
  }

  private parseBinaryExpression(): ExpressionNode {
    let expr = this.parsePrimaryExpression();

    while (this.checkSymbol('+') || this.checkSymbol('-') || this.checkSymbol('>') || this.checkSymbol('<') || this.checkSymbol('=')) {
      const op = this.advance();
      const right = this.parsePrimaryExpression();
      expr = { type: 'BinaryOpNode', left: expr, operator: op.value, right, pos: op.pos };
    }

    return expr;
  }

  private parsePrimaryExpression(): ExpressionNode {
    if (this.check(TokenType.Number)) {
      const token = this.advance();
      return { type: 'LiteralNode', dataType: 'number', value: parseFloat(token.value), pos: token.pos };
    }

    if (this.check(TokenType.String)) {
      const token = this.advance();
      return { type: 'LiteralNode', dataType: 'string', value: token.value, pos: token.pos };
    }

    if (this.matchKeyword('LENGTH')) {
      const pos = this.previous().pos;
      this.consumeSymbol('(', 'Expected "(" after LENGTH.');
      const arrayName = this.consume(TokenType.Identifier, 'Expected array name inside LENGTH().');
      this.consumeSymbol(')', 'Expected ")" after array name.');
      return {
        type: 'GenericActionNode', // Hack: Repurpose GenericActionNode as a function call for LENGTH in expressions
        actionName: 'LENGTH',
        args: [{ type: 'IdentifierNode', name: arrayName.value, pos: arrayName.pos }],
        pos
      } as any;
    }

    const token = this.consume(TokenType.Identifier, 'Expected identifier expression.');
    const pos = token.pos;

    if (this.matchSymbol('[')) {
      const indexExpr = this.parseExpression();
      this.consumeSymbol(']', 'Expected "]" after index.');

      return {
        type: 'ArrayAccessNode',
        array: { type: 'IdentifierNode', name: token.value, pos },
        index: indexExpr,
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

  private consumeKeyword(kw: string, message: string): Token {
    if (this.checkKeyword(kw)) return this.advance();
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
