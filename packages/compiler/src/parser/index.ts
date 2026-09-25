import { Token, TokenType } from '../lexer';
import { ParseError, SyntaxError as AQVLSyntaxError, TokenError, type AQVLErrorOptions } from '@aqvl/shared';
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
  HashMapDeclNode,
  HashMapEntryLiteral,
  LinkedListDeclNode,
  ObjectDeclNode,
  RelationshipNode,
  GenericActionNode,
  SetStateNode,
  LoopNode,
  IfNode,
  WhileNode,
  PrintNode,
  BinaryTreeDeclNode,
  BSTDeclNode,
  FunctionDeclNode,
  BlockNode,
  ReturnNode,
  CallNode,
  PropertyNode,
  LayoutStatementNode,
  CameraStatementNode,
  PositionStatementNode,
  TupleLiteralNode,
} from '../ast/types';

export class Parser {
  private tokens: Token[];
  private current: number = 0;
  private source?: string;

  constructor(tokens: Token[], source?: string) {
    this.tokens = tokens;
    this.source = source;
  }

  /** Builds AQVLErrorOptions (line/col/source) for the token at the current parse position, unless `at` is given. */
  private errorOptions(at?: Token, suggestion?: string): AQVLErrorOptions {
    const token = at ?? this.peek();
    return { line: token.pos.line, column: token.pos.column, source: this.source, suggestion };
  }

  public parse(): ProgramNode {
    const scenes: SceneNode[] = [];
    while (!this.isAtEnd()) {
      if (this.matchKeyword('SCENE')) {
        scenes.push(this.parseScene());
      } else {
        throw new AQVLSyntaxError(`Expected SCENE, got "${this.peek().value}".`, this.errorOptions());
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

    let declarations: DeclareBlockNode = { type: 'DeclareBlockNode', variables: [], functions: [], pos: nameToken.pos };
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
    const functions: FunctionDeclNode[] = [];

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
        variables.push(this.parseLinkedListDecl('SINGLY'));
      } else if (this.matchKeyword('DOUBLY')) {
        this.consumeKeyword('LINKEDLIST', 'Expected LINKEDLIST after DOUBLY.');
        variables.push(this.parseLinkedListDecl('DOUBLY'));
      } else if (this.matchKeyword('SINGLY')) {
        this.consumeKeyword('LINKEDLIST', 'Expected LINKEDLIST after SINGLY.');
        variables.push(this.parseLinkedListDecl('SINGLY'));
      } else if (this.matchKeyword('CIRCULAR')) {
        this.consumeKeyword('LINKEDLIST', 'Expected LINKEDLIST after CIRCULAR.');
        variables.push(this.parseLinkedListDecl('CIRCULAR'));
      } else if (this.matchKeyword('TREE')) {
        variables.push(this.parseTreeDecl());
      } else if (this.matchKeyword('BINARY_TREE')) {
        variables.push(this.parseBinaryTreeDecl());
      } else if (this.matchKeyword('BST')) {
        variables.push(this.parseBSTDecl());
      } else if (this.matchKeyword('HEAP')) {
        variables.push(this.parseHeapDecl());
      } else if (this.matchKeyword('HASH_MAP')) {
        variables.push(this.parseHashMapDecl());
      } else if (this.matchKeyword('TRIE')) {
        variables.push(this.parseTrieDecl());
      } else if (this.matchKeyword('GRAPH')) {
        variables.push(this.parseGraphDecl());
      } else if (this.matchKeyword('FUNCTION')) {
        functions.push(this.parseFunctionDeclaration());
      } else if (this.peek().type === TokenType.Keyword && objectKeywords.has(this.peek().value.toUpperCase())) {
        const keyword = this.advance().value.toUpperCase();
        variables.push(this.parseObjectDecl(keyword));
      } else {
        throw new AQVLSyntaxError(`Unexpected token "${this.peek().value}" in DECLARE block.`, this.errorOptions());
      }
    }

    return { type: 'DeclareBlockNode', variables, functions, pos };
  }

  // --- User-defined functions (VM mode) ---

  /** FUNCTION name(params) { ... } — FUNCTION keyword already consumed. */
  private parseFunctionDeclaration(): FunctionDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected function name after FUNCTION.');

    this.consumeSymbol('(', `Expected "(" after function name "${nameToken.value}".`);
    const params: IdentifierNode[] = [];
    if (!this.checkSymbol(')')) {
      do {
        const paramToken = this.consume(TokenType.Identifier, `Expected parameter name in function "${nameToken.value}".`);
        params.push({ type: 'IdentifierNode', name: paramToken.value, pos: paramToken.pos });
      } while (this.matchSymbol(','));
    }
    this.consumeSymbol(')', `Expected ")" after parameters of function "${nameToken.value}".`);

    const body = this.parseBlock();

    return {
      type: 'FunctionDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      params,
      body,
      pos,
    };
  }

  /** Parses `{ statement* }`. */
  private parseBlock(): BlockNode {
    const pos = this.peek().pos;
    this.consumeSymbol('{', 'Expected "{" to start block.');
    const statements: StatementNode[] = [];
    while (!this.isAtEnd() && !this.checkSymbol('}')) {
      statements.push(this.parseStatement());
    }
    this.consumeSymbol('}', 'Expected "}" to close block.');
    return { type: 'BlockNode', statements, pos };
  }

  /**
   * Statement dispatcher for function bodies (brace-delimited, general
   * computation): RETURN, IF/ELSE, nested FUNCTION declarations, and plain
   * expression statements (including function calls). This is separate
   * from the animation SEQUENCE/LOOP/IF grammar above, which stays
   * END-delimited for backward compatibility.
   */
  private parseStatement(): StatementNode {
    if (this.matchKeyword('RETURN')) {
      return this.parseReturnStatement();
    }
    if (this.matchKeyword('IF')) {
      return this.parseFunctionIf();
    }
    if (this.matchKeyword('FUNCTION')) {
      return this.parseFunctionDeclaration();
    }

    const pos = this.peek().pos;
    const expression = this.parseExpression();
    return { type: 'ExpressionStatementNode', expression, pos };
  }

  /** RETURN [expr] — RETURN keyword already consumed. */
  private parseReturnStatement(): ReturnNode {
    const pos = this.previous().pos;
    const value = this.checkSymbol('}') ? undefined : this.parseExpression();
    return { type: 'ReturnNode', value, pos };
  }

  /** IF cond { ... } [ELSE { ... } | ELSE IF ...] — IF keyword already consumed. */
  private parseFunctionIf(): IfNode {
    const pos = this.previous().pos;
    const condition = this.parseExpression();
    const thenBlock = this.parseBlock();

    let elseBody: StatementNode[] | undefined;
    if (this.matchKeyword('ELSE')) {
      if (this.matchKeyword('IF')) {
        elseBody = [this.parseFunctionIf()];
      } else {
        elseBody = this.parseBlock().statements;
      }
    }

    return { type: 'IfNode', condition, body: thenBlock.statements, elseBody, pos };
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
        let propNameToken;
        if (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword) {
          propNameToken = this.advance();
        } else {
          throw new ParseError(`Expected property name, got "${this.peek().value}".`, this.errorOptions());
        }
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
  private parseLinkedListDecl(variant: string = 'SINGLY'): any {
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
      variant,
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

  private parseBinaryTreeDecl(): BinaryTreeDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected binary tree name.');

    let initialElements: LiteralNode[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('[', 'Expected "[" for binary tree initialization.');
      initialElements = [];
      if (!this.checkSymbol(']')) {
        do {
          const numToken = this.consume(TokenType.Number, 'Expected number in binary tree array.');
          initialElements.push({
            type: 'LiteralNode',
            dataType: 'number',
            value: parseFloat(numToken.value),
            pos: numToken.pos,
          });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(']', 'Expected "]" after binary tree elements.');
    }

    return {
      type: 'BinaryTreeDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialElements,
      pos
    };
  }

  private parseBSTDecl(): BSTDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected BST name.');

    let initialElements: LiteralNode[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('[', 'Expected "[" for BST initialization.');
      initialElements = [];
      if (!this.checkSymbol(']')) {
        do {
          const numToken = this.consume(TokenType.Number, 'Expected number in BST array.');
          initialElements.push({
            type: 'LiteralNode',
            dataType: 'number',
            value: parseFloat(numToken.value),
            pos: numToken.pos,
          });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(']', 'Expected "]" after BST elements.');
    }

    return {
      type: 'BSTDeclNode',
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

  /** HASH_MAP name [= { k1: v1, k2: v2, ... }] — keys/values may be bareword identifiers (treated as strings), quoted strings, or numbers. */
  private parseHashMapDecl(): HashMapDeclNode {
    const pos = this.previous().pos;
    const nameToken = this.consume(TokenType.Identifier, 'Expected hash map name.');

    let initialEntries: HashMapEntryLiteral[] | undefined;

    if (this.matchSymbol('=')) {
      this.consumeSymbol('{', 'Expected "{" for hash map initialization.');
      initialEntries = [];
      if (!this.checkSymbol('}')) {
        do {
          const key = this.parseHashMapLiteral('key');
          this.consumeSymbol(':', 'Expected ":" between key and value in hash map entry.');
          const value = this.parseHashMapLiteral('value');
          initialEntries.push({ key, value });
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol('}', 'Expected "}" after hash map entries.');
    }

    return {
      type: 'HashMapDeclNode',
      name: { type: 'IdentifierNode', name: nameToken.value, pos: nameToken.pos },
      initialEntries,
      pos
    };
  }

  /** Parses a single hash map key or value: a number, a quoted string, or a bareword identifier (treated as a string literal). */
  private parseHashMapLiteral(label: 'key' | 'value'): LiteralNode {
    if (this.check(TokenType.Number)) {
      const token = this.advance();
      return { type: 'LiteralNode', dataType: 'number', value: parseFloat(token.value), pos: token.pos };
    }
    if (this.check(TokenType.String)) {
      const token = this.advance();
      return { type: 'LiteralNode', dataType: 'string', value: token.value, pos: token.pos };
    }
    if (this.check(TokenType.Identifier)) {
      const token = this.advance();
      return { type: 'LiteralNode', dataType: 'string', value: token.value, pos: token.pos };
    }
    throw new AQVLSyntaxError(`Expected a ${label} (number, string, or bareword) in hash map literal. Got "${this.peek().value}".`, this.errorOptions());
  }

  /** Keywords that start a generic data-structure action statement (parsed by parseGenericAction). */
  private static readonly GENERIC_ACTION_KEYWORDS = new Set(['TREE', 'ROOT', 'REMOVE', 'COPY', 'FIND', 'SELECT', 'PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER', 'REVERSE', 'ZIGZAG', 'DFS', 'BFS', 'DIJKSTRA', 'BELLMAN_FORD', 'ASTAR', 'PRIM', 'KRUSKAL', 'TOPO_SORT', 'HEIGHT', 'DEPTH', 'LEVEL', 'MAX_DEPTH', 'MIN_DEPTH', 'SIZE', 'LEAVES', 'INTERNAL', 'DEGREE', 'STATS', 'PARENTOF', 'CHILDRENOF', 'ANCESTORS', 'DESCENDANTS', 'SIBLINGS', 'PATH', 'HIGHLIGHT', 'INSERT', 'DELETE', 'INSERT_HEAD', 'INSERT_TAIL', 'DELETE_HEAD', 'DELETE_TAIL', 'UPDATE', 'MOVE', 'CONNECT', 'DISCONNECT', 'PUSH', 'POP', 'PEEK', 'ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR', 'VISIT', 'MARK', 'TRAVERSE', 'ROTATE', 'SEARCH', 'HEAPIFY', 'HEAP_INSERT', 'HEAP_EXTRACT', 'HEAP_DECREASE', 'BUILD_HEAP', 'HASHMAP_INSERT', 'HASHMAP_LOOKUP', 'HASHMAP_DELETE', 'TRIE_INSERT', 'TRIE_SEARCH', 'TRIE_DELETE', 'TRIE_AUTOCOMPLETE', 'TRIE_STARTSWITH', 'CHILD', 'PARENT', 'LEFT_CHILD', 'RIGHT_CHILD', 'SIBLING', 'CLEAR', 'IS_EMPTY', 'COUNT_NODES', 'COUNT_LEAVES', 'COUNT_INTERNAL', 'COUNT_LEFT_LEAVES', 'COUNT_RIGHT_LEAVES', 'COUNT_FULL', 'COUNT_HALF', 'IS_FULL', 'IS_COMPLETE', 'IS_PERFECT', 'IS_BALANCED', 'IS_DEGENERATE', 'IS_LEFT_SKEWED', 'IS_RIGHT_SKEWED', 'IS_SYMMETRIC', 'LCA', 'DISTANCE', 'GRANDPARENT', 'UNCLE', 'COUSINS', 'ROOT_TO_NODE', 'ROOT_TO_LEAVES', 'LONGEST_PATH', 'SHORTEST_PATH', 'MIRROR', 'INVERT', 'CLONE', 'REMOVE_LEAVES', 'PRUNE', 'LEFT_VIEW', 'RIGHT_VIEW', 'TOP_VIEW', 'BOTTOM_VIEW', 'BOUNDARY', 'VERTICAL_ORDER', 'DIAGONAL', 'MAX_VALUE', 'MIN_VALUE', 'MIN', 'MAX', 'SUM', 'AVERAGE', 'MAX_LEVEL_SUM', 'BUBBLE_SORT', 'SELECTION_SORT', 'INSERTION_SORT', 'MERGE_SORT', 'QUICK_SORT']);

  private parseSequenceBlock(): SequenceBlockNode {
    const pos = this.previous().pos;
    const statements: StatementNode[] = [];

    while (!this.isAtEnd() && !this.checkKeyword('SCENE') && !this.checkKeyword('END')) {
      statements.push(this.parseBlockStatement('SEQUENCE'));
    }

    if (this.matchKeyword('END')) {
      // Successfully consumed END keyword
    }

    return { type: 'SequenceBlockNode', statements, pos };
  }

  /**
   * One statement of the scene (animation) grammar — shared by SEQUENCE and
   * every LOOP / WHILE / IF / ELSE body, so all blocks accept exactly the
   * same statements. `blockName` only appears in the error message.
   */
  private parseBlockStatement(blockName: string): StatementNode {
    if (this.matchKeyword('COMPARE')) return this.parseCompare();
    if (this.matchKeyword('SWAP')) return this.parseSwap();
    if (this.matchKeyword('WAIT')) return this.parseWait();
    if (this.matchKeyword('LINK')) return this.parseLinkStatement();
    if (this.matchKeyword('LOOP')) return this.parseLoop();
    if (this.matchKeyword('WHILE')) return this.parseWhile();
    if (this.matchKeyword('IF')) return this.parseIf();
    if (this.matchKeyword('PRINT')) return this.parsePrint();
    if (this.matchKeyword('LAYOUT')) return this.parseLayoutStatement();
    if (this.matchKeyword('CAMERA')) return this.parseCameraStatement();
    if (this.matchKeyword('POSITION')) return this.parsePositionStatement();
    if (this.peek().type === TokenType.Keyword && Parser.GENERIC_ACTION_KEYWORDS.has(this.peek().value.toUpperCase())) {
      return this.parseGenericAction();
    }
    if (this.matchKeyword('SET')) return this.parseSetState();
    if (this.check(TokenType.Identifier)) return this.parseExpressionOrRelationship();
    if (this.checkKeyword('ELSE')) {
      throw new AQVLSyntaxError(`ELSE without a matching IF.`, this.errorOptions());
    }
    throw new AQVLSyntaxError(`Unexpected token "${this.peek().value}" in ${blockName} block.`, this.errorOptions());
  }

  /** Parses statements until one of `terminators` (not consumed) or end of input. */
  private parseStatementsUntil(blockName: string, terminators: string[]): StatementNode[] {
    const body: StatementNode[] = [];
    while (!this.isAtEnd() && !terminators.some((kw) => this.checkKeyword(kw))) {
      body.push(this.parseBlockStatement(blockName));
    }
    return body;
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

    const body = this.parseStatementsUntil('LOOP', ['END']);
    this.consumeKeyword('END', 'Expected END to close LOOP block.');

    return {
      type: 'LoopNode',
      iterator: { type: 'IdentifierNode', name: iteratorToken.value, pos: iteratorToken.pos },
      start: startExpr,
      end: endExpr,
      body,
      pos
    };
  }

  /** `WHILE cond ... END` — WHILE keyword already consumed. */
  private parseWhile(): WhileNode {
    const pos = this.previous().pos;
    const condition = this.parseExpression();
    const body = this.parseStatementsUntil('WHILE', ['END']);
    this.consumeKeyword('END', 'Expected END to close WHILE block.');
    return { type: 'WhileNode', condition, body, pos };
  }

  /**
   * `IF cond ... [ELSE IF cond ...]* [ELSE ...] END` — IF keyword already
   * consumed. An `ELSE IF` chain shares the single closing END, so the
   * nested IF parsed for it consumes that END itself.
   */
  private parseIf(): IfNode {
    const pos = this.previous().pos;
    const condition = this.parseExpression();
    const body = this.parseStatementsUntil('IF', ['END', 'ELSE']);

    let elseBody: StatementNode[] | undefined;
    if (this.matchKeyword('ELSE')) {
      // `ELSE IF` only when IF is on the ELSE line; an IF on the next line is
      // an ordinary nested IF statement inside the ELSE body.
      const elseLine = this.previous().pos.line;
      if (this.checkKeyword('IF') && this.peek().pos.line === elseLine) {
        this.advance();
        elseBody = [this.parseIf()];
        return { type: 'IfNode', condition, body, elseBody, pos };
      }
      elseBody = this.parseStatementsUntil('ELSE', ['END']);
    }

    this.consumeKeyword('END', 'Expected END to close IF block.');
    return { type: 'IfNode', condition, body, elseBody, pos };
  }

  /** `PRINT expr expr ...` — every argument must be on the PRINT line. */
  private parsePrint(): PrintNode {
    const keyword = this.previous();
    const args: ExpressionNode[] = [];
    while (!this.isAtEnd() && this.peek().pos.line === keyword.pos.line && this.startsExpression()) {
      args.push(this.parseExpression());
      this.matchSymbol(',');
    }
    if (args.length === 0) {
      throw new AQVLSyntaxError('PRINT needs at least one value, e.g. PRINT "sum =" total', this.errorOptions(keyword));
    }
    return { type: 'PrintNode', args, pos: keyword.pos };
  }

  /** True when the next token can begin an expression. */
  private startsExpression(): boolean {
    const t = this.peek();
    if (t.type === TokenType.Identifier || t.type === TokenType.Number || t.type === TokenType.String) return true;
    if (t.type === TokenType.Keyword && t.value.toUpperCase() === 'LENGTH') return true;
    return t.type === TokenType.Symbol && t.value === '(';
  }

  private parseLinkStatement(): RelationshipNode {
    const pos = this.previous().pos;
    const source = this.parseExpression();
    this.consumeKeyword('TO', 'Expected TO after source in LINK statement.');
    const target = this.parseExpression();
    return { type: 'RelationshipNode', source, target, directed: true, relationType: 'LINK', pos };
  }

  // --- Spatial syntax (LAYOUT / CAMERA / POSITION) ---

  /** `LAYOUT <target> AS <STRATEGY>(namedArg=expr, ...)` — LAYOUT keyword already consumed. */
  private parseLayoutStatement(): LayoutStatementNode {
    const pos = this.previous().pos;
    const targetToken = this.consume(TokenType.Identifier, 'Expected target identifier after LAYOUT.');
    this.consumeKeyword('AS', 'Expected AS after LAYOUT target.');

    const strategyToken = this.advance();
    if (strategyToken.type !== TokenType.Keyword) {
      throw new AQVLSyntaxError(`Expected a layout strategy (LINE, HIERARCHY, CIRCULAR, FORCE_DIRECTED, GRID, CUSTOM) after AS. Got "${strategyToken.value}".`, this.errorOptions(strategyToken));
    }
    const strategy = strategyToken.value.toUpperCase();

    this.consumeSymbol('(', `Expected "(" after strategy "${strategy}".`);
    const args: PropertyNode[] = [];
    if (!this.checkSymbol(')')) {
      do {
        args.push(this.parseNamedArg());
      } while (this.matchSymbol(','));
    }
    this.consumeSymbol(')', 'Expected ")" to close strategy arguments.');

    return {
      type: 'LayoutStatementNode',
      target: { type: 'IdentifierNode', name: targetToken.value, pos: targetToken.pos },
      strategy,
      args,
      pos,
    };
  }

  /** `CAMERA FOCUS(target) | AUTO_FIT | ORBIT(speed) | POSITION(x, y, z)` — CAMERA keyword already consumed. */
  private parseCameraStatement(): CameraStatementNode {
    const pos = this.previous().pos;

    if (this.matchKeyword('AUTO_FIT')) {
      return { type: 'CameraStatementNode', mode: 'AUTO_FIT', pos };
    }
    if (this.matchKeyword('FOCUS')) {
      this.consumeSymbol('(', 'Expected "(" after FOCUS.');
      const target = this.parseExpression();
      this.consumeSymbol(')', 'Expected ")" after FOCUS target.');
      return { type: 'CameraStatementNode', mode: 'FOCUS', target, pos };
    }
    if (this.matchKeyword('ORBIT')) {
      this.consumeSymbol('(', 'Expected "(" after ORBIT.');
      const speed = this.parseExpression();
      this.consumeSymbol(')', 'Expected ")" after ORBIT speed.');
      return { type: 'CameraStatementNode', mode: 'ORBIT', args: [speed], pos };
    }
    if (this.matchKeyword('POSITION')) {
      this.consumeSymbol('(', 'Expected "(" after POSITION.');
      const x = this.parseExpression();
      this.consumeSymbol(',', 'Expected "," after camera x.');
      const y = this.parseExpression();
      this.consumeSymbol(',', 'Expected "," after camera y.');
      const z = this.parseExpression();
      this.consumeSymbol(')', 'Expected ")" after camera z.');
      return { type: 'CameraStatementNode', mode: 'POSITION', args: [x, y, z], pos };
    }

    throw new AQVLSyntaxError(`Expected FOCUS, AUTO_FIT, ORBIT, or POSITION after CAMERA. Got "${this.peek().value}".`, this.errorOptions());
  }

  /** `POSITION <target> AT (x=expr, y=expr, z=expr)` — POSITION keyword already consumed. */
  private parsePositionStatement(): PositionStatementNode {
    const pos = this.previous().pos;
    const target = this.parsePositionTarget();
    this.consumeKeyword('AT', 'Expected AT after POSITION target.');
    this.consumeSymbol('(', 'Expected "(" after AT.');

    const args: PropertyNode[] = [];
    if (!this.checkSymbol(')')) {
      do {
        args.push(this.parseNamedArg());
      } while (this.matchSymbol(','));
    }
    this.consumeSymbol(')', 'Expected ")" to close POSITION arguments.');

    return { type: 'PositionStatementNode', target, args, pos };
  }

  /** Bare identifier or indexed slot (`arr[2]`) — the target surface form shared with ArrayAccessNode. */
  private parsePositionTarget(): ExpressionNode {
    const token = this.consume(TokenType.Identifier, 'Expected identifier target for POSITION.');
    if (this.matchSymbol('[')) {
      const indexExpr = this.parseExpression();
      this.consumeSymbol(']', 'Expected "]" after index.');
      return {
        type: 'ArrayAccessNode',
        array: { type: 'IdentifierNode', name: token.value, pos: token.pos },
        index: indexExpr,
        pos: token.pos,
      };
    }
    return { type: 'IdentifierNode', name: token.value, pos: token.pos };
  }

  /** `identifier = expr` where `expr` may be a bareword enum value (e.g. `horizontal`) or a `(x,y,z)` tuple. */
  private parseNamedArg(): PropertyNode {
    const nameToken = this.advance();
    if (nameToken.type !== TokenType.Identifier && nameToken.type !== TokenType.Keyword) {
      throw new AQVLSyntaxError(`Expected argument name, got "${nameToken.value}".`, this.errorOptions(nameToken));
    }
    this.consumeSymbol('=', `Expected "=" after argument name "${nameToken.value}".`);

    let value: ExpressionNode;
    if (this.checkSymbol('(')) {
      value = this.parseTupleLiteral();
    } else if (this.check(TokenType.Identifier) || (this.check(TokenType.Keyword) && !this.check(TokenType.Number))) {
      const idTok = this.advance();
      value = { type: 'IdentifierNode', name: idTok.value, pos: idTok.pos };
    } else {
      value = this.parseExpression();
    }

    return { type: 'PropertyNode', name: nameToken.value, value, pos: nameToken.pos };
  }

  /** `(expr, expr, expr)` — used for `origin=(x,y,z)`-shaped arguments. */
  private parseTupleLiteral(): TupleLiteralNode {
    const pos = this.peek().pos;
    this.consumeSymbol('(', 'Expected "(" to start tuple.');
    const elements: ExpressionNode[] = [];
    if (!this.checkSymbol(')')) {
      do {
        elements.push(this.parseExpression());
      } while (this.matchSymbol(','));
    }
    this.consumeSymbol(')', 'Expected ")" to close tuple.');
    return { type: 'TupleLiteralNode', elements, pos };
  }

  private parseGenericAction(): GenericActionNode {
    const pos = this.peek().pos;
    const actionName = this.advance().value.toUpperCase();
    const args: ExpressionNode[] = [];

    // Arguments are read only from the action's own line: statements are
    // not separator-terminated, so without this a following line such as
    // `total = total + 1` would be swallowed as extra arguments of
    // `HIGHLIGHT arr[i]` on the line above.
    while (!this.isAtEnd() && this.peek().pos.line === pos.line) {
      if (this.startsExpression()) {
        args.push(this.parseExpression());
      } else if (this.peek().type === TokenType.Keyword && ['TO', 'FROM', 'INTO'].includes(this.peek().value.toUpperCase())) {
        this.advance(); // consume filler keyword
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
      throw new ParseError(`Expected state name after STATE, got "${stateToken.value}".`, this.errorOptions(stateToken));
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

  /**
   * `=` is parsed separately, at lower precedence than every other operator
   * and right-associative, so `total = total + i` parses as
   * `total = (total + i)` rather than `(total = total) + i` — the uniform
   * left-to-right precedence climb below would otherwise treat `=` exactly
   * like `+`/`-`/etc. and bind it to just the next primary expression. This
   * matters once `=` is more than a same-value comparison in an IF/RETURN
   * (see generator.tryGenerateAssignment / VM SET_VAR): it's also how a
   * function-body or SEQUENCE assignment statement is written.
   */
  private parseExpression(): ExpressionNode {
    const expr = this.parseBinaryExpression();
    if (this.checkSymbol('=')) {
      const op = this.advance();
      const value = this.parseExpression(); // right-associative: a = b = c binds as a = (b = c)
      return { type: 'BinaryOpNode', left: expr, operator: op.value, right: value, pos: op.pos };
    }
    return expr;
  }

  /**
   * Binary operator precedence, loosest first. Each level is
   * left-associative, so `i < n - 1` is `i < (n - 1)` and
   * `a + b * c` is `a + (b * c)`. `AND` / `OR` are keywords, the rest symbols.
   */
  private static readonly PRECEDENCE_LEVELS: string[][] = [
    ['OR'],
    ['AND'],
    ['<=', '>=', '==', '!=', '>', '<'],
    ['+', '-'],
    ['*', '/', '%'],
  ];

  private parseBinaryExpression(level: number = 0): ExpressionNode {
    if (level >= Parser.PRECEDENCE_LEVELS.length) return this.parsePrimaryExpression();

    const operators = Parser.PRECEDENCE_LEVELS[level];
    let expr = this.parseBinaryExpression(level + 1);
    while (operators.some((op) => this.checkOperator(op))) {
      const op = this.advance();
      const right = this.parseBinaryExpression(level + 1);
      expr = { type: 'BinaryOpNode', left: expr, operator: op.value.toUpperCase(), right, pos: op.pos };
    }
    return expr;
  }

  /** Matches a symbol operator, or the AND / OR keyword operators. */
  private checkOperator(op: string): boolean {
    return op === 'AND' || op === 'OR' ? this.checkKeyword(op) : this.checkSymbol(op);
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

    if (this.matchSymbol('(')) {
      const inner = this.parseExpression();
      this.consumeSymbol(')', 'Expected ")" to close the parenthesised expression.');
      return inner;
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

    if (this.checkSymbol('-')) {
      throw new TokenError(
        `Unexpected '-': unary negation is only supported on numeric literals (e.g. -5), not general expressions.`,
        this.errorOptions(undefined, 'Use subtraction instead, e.g. "0 - x".')
      );
    }

    const token = this.consume(TokenType.Identifier, 'Expected identifier expression.');
    const pos = token.pos;

    if (this.matchSymbol('(')) {
      const args: ExpressionNode[] = [];
      if (!this.checkSymbol(')')) {
        do {
          args.push(this.parseExpression());
        } while (this.matchSymbol(','));
      }
      this.consumeSymbol(')', `Expected ")" after arguments to "${token.value}".`);
      const callee: IdentifierNode = { type: 'IdentifierNode', name: token.value, pos };
      return { type: 'CallNode', callee, args, pos };
    }

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
    if (type === TokenType.Number && this.checkSymbol('-')) {
      throw new TokenError(
        `Unexpected '-': expected a numeric literal here, not a subtraction expression.`,
        this.errorOptions()
      );
    }
    throw new ParseError(`${message} Got "${this.peek().value}".`, this.errorOptions());
  }

  private consumeKeyword(kw: string, message: string): Token {
    if (this.checkKeyword(kw)) return this.advance();
    throw new ParseError(`${message} Got "${this.peek().value}".`, this.errorOptions());
  }

  private consumeSymbol(sym: string, message: string): Token {
    if (this.checkSymbol(sym)) return this.advance();
    throw new ParseError(`${message} Got "${this.peek().value}".`, this.errorOptions());
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
