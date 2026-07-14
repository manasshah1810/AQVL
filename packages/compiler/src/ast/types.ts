// Base Nodes
export interface Position {
  line: number;
  column: number;
}

export interface ASTNode {
  type: string;
  pos: Position;
}

// Program and Import
export interface ProgramNode extends ASTNode {
  type: 'ProgramNode';
  imports: ImportNode[];
  scenes: SceneNode[];
}

export interface ImportNode extends ASTNode {
  type: 'ImportNode';
  path: StringLiteralNode;
}

// Scene and Blocks
export interface SceneNode extends ASTNode {
  type: 'SceneNode';
  name: IdentifierNode;
  declarations: DeclareBlockNode;
  sequence: SequenceBlockNode;
}

export interface DeclareBlockNode extends ASTNode {
  type: 'DeclareBlockNode';
  variables: VariableDeclNode[];
}

export interface SequenceBlockNode extends ASTNode {
  type: 'SequenceBlockNode';
  statements: StatementNode[];
}

// Declarations
export type VariableDeclNode = ArrayDeclNode | ObjectDeclNode | LinkedListDeclNode | StackDeclNode | QueueDeclNode | TreeDeclNode | HeapDeclNode | TrieDeclNode | GraphDeclNode;

export interface PropertyNode extends ASTNode {
  type: 'PropertyNode';
  name: string;
  value: ExpressionNode;
}

export interface ArrayDeclNode extends ASTNode {
  type: 'ArrayDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}

export interface ObjectDeclNode extends ASTNode {
  type: 'ObjectDeclNode';
  objectType: string; // e.g., 'NODE', 'EDGE'
  name: IdentifierNode;
  args?: ExpressionNode[]; // Using 'args' to avoid conflict with 'arguments' JS keyword
  properties?: PropertyNode[];
}

export interface LinkedListDeclNode extends ASTNode {
  type: 'LinkedListDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
  variant?: 'SINGLY' | 'DOUBLY' | 'CIRCULAR';
}

export interface StackDeclNode extends ASTNode {
  type: 'StackDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}

export interface QueueDeclNode extends ASTNode {
  type: 'QueueDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}

export interface TreeDeclNode extends ASTNode {
  type: 'TreeDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}
export interface HeapDeclNode extends ASTNode {
  type: 'HeapDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}

export interface TrieDeclNode extends ASTNode {
  type: 'TrieDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[]; // Can be strings
}

export interface GraphDeclNode extends ASTNode {
  type: 'GraphDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}

// Statements
export type StatementNode = CompareNode | SwapNode | HighlightNode | LoopNode | IfNode | ExpressionStatementNode | WaitNode | RelationshipNode | GenericActionNode | SetStateNode;

export interface CompareNode extends ASTNode {
  type: 'CompareNode';
  left: ExpressionNode;
  right: ExpressionNode;
  body?: StatementNode[]; // Optional nested body for compare
}

export interface SwapNode extends ASTNode {
  type: 'SwapNode';
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface WaitNode extends ASTNode {
  type: 'WaitNode';
}

export interface RelationshipNode extends ASTNode {
  type: 'RelationshipNode';
  source: ExpressionNode;
  target: ExpressionNode;
  directed: boolean;
  relationType: string;
}

export interface GenericActionNode extends ASTNode {
  type: 'GenericActionNode';
  actionName: string;
  args: ExpressionNode[];
}

export interface SetStateNode extends ASTNode {
  type: 'SetStateNode';
  target: ExpressionNode;
  stateName: string;
}

export interface HighlightNode extends ASTNode {
  type: 'HighlightNode';
  target: ExpressionNode;
  color: ColorLiteralNode;
}

export interface LoopNode extends ASTNode {
  type: 'LoopNode';
  iterator: IdentifierNode;
  start: ExpressionNode;
  end: ExpressionNode;
  body: StatementNode[];
}

export interface ExpressionStatementNode extends ASTNode {
  type: 'ExpressionStatementNode';
  expression: ExpressionNode;
}

export interface IfNode extends ASTNode {
  type: 'IfNode';
  condition: ExpressionNode;
  body: StatementNode[];
}

// Expressions
export type ExpressionNode = IdentifierNode | ArrayAccessNode | BinaryOpNode | LiteralNode;

export interface IdentifierNode extends ASTNode {
  type: 'IdentifierNode';
  name: string;
}

export interface ArrayAccessNode extends ASTNode {
  type: 'ArrayAccessNode';
  array: IdentifierNode;
  index: ExpressionNode;
}

export interface BinaryOpNode extends ASTNode {
  type: 'BinaryOpNode';
  left: ExpressionNode;
  operator: string;
  right: ExpressionNode;
}

export type LiteralNode = NumberLiteralNode | StringLiteralNode | ColorLiteralNode;

export interface NumberLiteralNode extends ASTNode {
  type: 'LiteralNode';
  dataType: 'number';
  value: number;
}

export interface StringLiteralNode extends ASTNode {
  type: 'LiteralNode';
  dataType: 'string';
  value: string;
}

export interface ColorLiteralNode extends ASTNode {
  type: 'LiteralNode';
  dataType: 'color';
  value: string; // e.g. "RED"
}
