import {
  ProgramNode,
  SceneNode,
  ASTNode,
  StatementNode,
  ExpressionNode,
  DeclareBlockNode,
  SequenceBlockNode,
  VariableDeclNode,
  ArrayDeclNode,
  CompareNode,
  SwapNode,
  HighlightNode,
  LoopNode,
  ExpressionStatementNode,
  WaitNode,
  IdentifierNode,
  ArrayAccessNode,
  BinaryOpNode,
  LiteralNode,
  RelationshipNode,
  GenericActionNode,
  SetStateNode,
} from '../ast/types';
import { SymbolTable, SemanticDiagnostic } from './types';

export class SemanticValidator {
  private diagnostics: SemanticDiagnostic[] = [];
  private currentSymbolTable: SymbolTable = new SymbolTable();

  public validate(program: ProgramNode): SemanticDiagnostic[] {
    this.diagnostics = [];
    this.currentSymbolTable = new SymbolTable(); // Global scope
    this.visitProgram(program);
    return this.diagnostics;
  }

  private reportError(node: ASTNode, message: string) {
    this.diagnostics.push({
      level: 'ERROR',
      line: node.pos.line,
      column: node.pos.column,
      message,
    });
  }

  private visitProgram(node: ProgramNode) {
    for (const scene of node.scenes) {
      this.visitScene(scene);
    }
  }

  private visitScene(node: SceneNode) {
    // Check for duplicate scene name in global scope
    if (
      !this.currentSymbolTable.define({
        name: node.name.name,
        type: 'SCENE',
        declaredAt: node.name.pos,
      })
    ) {
      this.reportError(node.name, `Scene name '${node.name.name}' is already defined.`);
    }

    // Enter scene scope
    const previousScope = this.currentSymbolTable;
    this.currentSymbolTable = new SymbolTable(previousScope);

    // Provide default built-ins for the scene (e.g., 'length')
    // Though usually 'length' is a property, in AQVL loop examples it's used as a global-like variable
    // We will let 'length' be a warning instead of error if undeclared, or we can just pre-define it.
    this.currentSymbolTable.define({
      name: 'length',
      type: 'SCALAR',
      declaredAt: { line: 0, column: 0 },
    });

    if (node.declarations) {
      this.visitDeclareBlock(node.declarations);
    }
    if (node.sequence) {
      this.visitSequenceBlock(node.sequence);
    }

    // Exit scene scope
    this.currentSymbolTable = previousScope;
  }

  private visitDeclareBlock(node: DeclareBlockNode) {
    for (const variable of node.variables) {
      if (variable.type === 'ArrayDeclNode') {
        const arrDecl = variable as ArrayDeclNode;
        if (
          !this.currentSymbolTable.define({
            name: arrDecl.name.name,
            type: 'ARRAY',
            declaredAt: arrDecl.name.pos,
          })
        ) {
          this.reportError(arrDecl.name, `Variable '${arrDecl.name.name}' is already declared.`);
        }
      } else if (variable.type === 'ObjectDeclNode') {
        const objDecl = variable as any; // Avoid importing ObjectDeclNode if missing
        if (
          !this.currentSymbolTable.define({
            name: objDecl.name.name,
            type: objDecl.objectType,
            declaredAt: objDecl.name.pos,
          })
        ) {
          this.reportError(objDecl.name, `Variable '${objDecl.name.name}' is already declared.`);
        }
        
        if (objDecl.properties) {
          for (const prop of objDecl.properties) {
            this.visitExpression(prop.value);
          }
        }
      } else {
        // Handle LinkedListDeclNode, StackDeclNode, QueueDeclNode, etc.
        const decl = variable as any;
        if (decl.name) {
          let t = 'ARRAY'; // fallback
          if (variable.type.endsWith('DeclNode')) {
            t = variable.type.replace('DeclNode', '').toUpperCase();
          }
          if (
            !this.currentSymbolTable.define({
              name: decl.name.name,
              type: t as any,
              declaredAt: decl.name.pos,
            })
          ) {
            this.reportError(decl.name, `Variable '${decl.name.name}' is already declared.`);
          }
        }
      }
    }
  }

  private visitSequenceBlock(node: SequenceBlockNode) {
    for (const statement of node.statements) {
      this.visitStatement(statement);
    }
  }

  private visitStatement(node: StatementNode) {
    switch (node.type) {
      case 'CompareNode':
        this.visitExpression(node.left);
        this.visitExpression(node.right);
        if (node.body) {
          for (const stmt of node.body) {
            this.visitStatement(stmt);
          }
        }
        break;
      case 'SwapNode':
        this.visitExpression(node.left);
        this.visitExpression(node.right);
        break;
      case 'HighlightNode':
        this.visitExpression(node.target);
        // HighlightNode color is a LiteralNode usually.
        break;
      case 'WaitNode':
        // Wait Node needs no specific validation
        break;
      case 'LoopNode':
        this.visitLoop(node);
        break;
      case 'ExpressionStatementNode':
        this.visitExpression(node.expression);
        break;
      case 'RelationshipNode':
        this.visitExpression(node.source);
        this.visitExpression(node.target);
        break;
      case 'GenericActionNode': {
        const treeActions = ['TREE', 'ROOT', 'CHILD', 'PARENT', 'INSERT', 'DELETE', 'REMOVE', 'MOVE', 'COPY', 'SEARCH', 'FIND', 'HIGHLIGHT', 'SELECT', 'PREORDER', 'POSTORDER', 'LEVELORDER', 'DFS', 'BFS', 'HEIGHT', 'DEPTH', 'SIZE', 'LEAVES', 'INTERNAL', 'DEGREE', 'STATS', 'PARENTOF', 'CHILDRENOF', 'ANCESTORS', 'DESCENDANTS', 'SIBLINGS', 'PATH'];
        if (treeActions.includes(node.actionName)) {
          // Tree actions use dynamically created node IDs that aren't defined in the DECLARE block.
          // Skip identifier validation for their arguments.
          break;
        }
        for (const arg of node.args) {
          this.visitExpression(arg);
        }
        break;
      }
      case 'SetStateNode':
        this.visitExpression(node.target);
        break;
    }
  }

  private visitLoop(node: LoopNode) {
    // Loop iterator becomes a local variable in the loop scope
    const previousScope = this.currentSymbolTable;
    this.currentSymbolTable = new SymbolTable(previousScope);

    if (
      !this.currentSymbolTable.define({
        name: node.iterator.name,
        type: 'SCALAR',
        declaredAt: node.iterator.pos,
      })
    ) {
      this.reportError(node.iterator, `Iterator '${node.iterator.name}' is already declared.`);
    }

    this.visitExpression(node.start);
    this.visitExpression(node.end);

    for (const stmt of node.body) {
      this.visitStatement(stmt);
    }

    // Exit loop scope
    this.currentSymbolTable = previousScope;
  }

  private visitExpression(node: ExpressionNode) {
    switch (node.type) {
      case 'IdentifierNode':
        const symbol = this.currentSymbolTable.lookup(node.name);
        if (!symbol) {
          this.reportError(node, `Undeclared identifier '${node.name}'.`);
        }
        break;
      case 'ArrayAccessNode':
        const arrSymbol = this.currentSymbolTable.lookup(node.array.name);
        if (!arrSymbol) {
          this.reportError(node.array, `Undeclared array '${node.array.name}'.`);
        } else if (!['ARRAY', 'LINKEDLIST', 'STACK', 'QUEUE', 'TREE', 'HEAP', 'TRIE', 'GRAPH'].includes(arrSymbol.type)) {
          this.reportError(node.array, `Identifier '${node.array.name}' is not indexable.`);
        }
        this.visitExpression(node.index);
        break;
      case 'BinaryOpNode':
        this.visitExpression(node.left);
        this.visitExpression(node.right);
        break;
      case 'LiteralNode':
        // No semantic checks needed for basic literals
        break;
    }
  }
}
