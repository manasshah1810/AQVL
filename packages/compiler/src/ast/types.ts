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
  /** User-defined functions declared in this scene (VM mode). */
  functions?: FunctionDeclNode[];
}

// --- User-defined functions (VM mode) ---

export interface BlockNode extends ASTNode {
  type: 'BlockNode';
  statements: StatementNode[];
}

export interface FunctionDeclNode extends ASTNode {
  type: 'FunctionDeclNode';
  name: IdentifierNode;
  params: IdentifierNode[];
  body: BlockNode;
}

export interface ReturnNode extends ASTNode {
  type: 'ReturnNode';
  value?: ExpressionNode;
}

export interface SequenceBlockNode extends ASTNode {
  type: 'SequenceBlockNode';
  statements: StatementNode[];
}

// Declarations
export type VariableDeclNode = ArrayDeclNode | ObjectDeclNode | LinkedListDeclNode | StackDeclNode | QueueDeclNode | TreeDeclNode | BinaryTreeDeclNode | BSTDeclNode | HeapDeclNode | TrieDeclNode | GraphDeclNode | HashMapDeclNode;

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
export interface BinaryTreeDeclNode extends ASTNode {
  type: 'BinaryTreeDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}
export interface BSTDeclNode extends ASTNode {
  type: 'BSTDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}
export interface HeapDeclNode extends ASTNode {
  type: 'HeapDeclNode';
  name: IdentifierNode;
  initialElements?: LiteralNode[];
}

export interface HashMapEntryLiteral {
  key: LiteralNode;
  value: LiteralNode;
}

export interface HashMapDeclNode extends ASTNode {
  type: 'HashMapDeclNode';
  name: IdentifierNode;
  keyType?: string;
  valueType?: string;
  initialEntries?: HashMapEntryLiteral[];
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
  /** Whether edges carry weights (needed for Dijkstra/Prim/Kruskal). */
  supportWeights?: boolean;
  /** Whether edges are directed. Defaults to undirected when omitted. */
  isDirected?: boolean;
}

// Statements
export type StatementNode = CompareNode | SwapNode | HighlightNode | LoopNode | WhileNode | IfNode | PrintNode | ExpressionStatementNode | WaitNode | RelationshipNode | GenericActionNode | SetStateNode | ReturnNode | FunctionDeclNode | LayoutStatementNode | CameraStatementNode | PositionStatementNode;

// --- Spatial syntax (LAYOUT / CAMERA / POSITION) — see docs/design/spatial-syntax-spec.md ---

/** `LAYOUT <target> AS <STRATEGY>(namedArg=expr, ...)`. */
export interface LayoutStatementNode extends ASTNode {
  type: 'LayoutStatementNode';
  target: IdentifierNode;
  /** 'LINE' | 'HIERARCHY' | 'CIRCULAR' | 'FORCE_DIRECTED' | 'GRID' | 'CUSTOM' */
  strategy: string;
  args: PropertyNode[];
}

/** `CAMERA FOCUS(target) | AUTO_FIT | ORBIT(speed) | POSITION(x, y, z)`. */
export interface CameraStatementNode extends ASTNode {
  type: 'CameraStatementNode';
  mode: 'FOCUS' | 'AUTO_FIT' | 'ORBIT' | 'POSITION';
  /** FOCUS only — the structure/element to soft-follow. */
  target?: ExpressionNode;
  /** ORBIT: [speed]. POSITION: [x, y, z]. Absent for FOCUS/AUTO_FIT. */
  args?: ExpressionNode[];
}

/** `POSITION <target> AT (x=expr, y=expr, z=expr)` — an empty arg list releases a prior pin. */
export interface PositionStatementNode extends ASTNode {
  type: 'PositionStatementNode';
  target: ExpressionNode;
  args: PropertyNode[];
}

/** `(x, y, z)` tuple literal — used for `origin=(x,y,z)`-shaped LAYOUT/POSITION arguments. */
export interface TupleLiteralNode extends ASTNode {
  type: 'TupleLiteralNode';
  elements: ExpressionNode[];
}

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

/** `WHILE cond ... END` — re-evaluates `cond` before every iteration (scene grammar). */
export interface WhileNode extends ASTNode {
  type: 'WhileNode';
  condition: ExpressionNode;
  body: StatementNode[];
}

/** `PRINT expr expr ...` — evaluates each expression at runtime and writes them, space-separated, to the output console. */
export interface PrintNode extends ASTNode {
  type: 'PrintNode';
  args: ExpressionNode[];
}

export interface ExpressionStatementNode extends ASTNode {
  type: 'ExpressionStatementNode';
  expression: ExpressionNode;
}

export interface IfNode extends ASTNode {
  type: 'IfNode';
  condition: ExpressionNode;
  body: StatementNode[];
  /** Present when the IF has an ELSE (or ELSE IF) branch. */
  elseBody?: StatementNode[];
}

// Expressions
export type ExpressionNode = IdentifierNode | ArrayAccessNode | BinaryOpNode | LiteralNode | CallNode | TupleLiteralNode | MemberAccessNode;

/**
 * `object.member` — a linked-list field (`curr.next`, `curr.prev`,
 * `curr.val`) or list property (`list.head`, `list.tail`). Also the target
 * of a pointer assignment such as `curr.next = prev`.
 */
export interface MemberAccessNode extends ASTNode {
  type: 'MemberAccessNode';
  object: ExpressionNode;
  member: string;
}

export interface IdentifierNode extends ASTNode {
  type: 'IdentifierNode';
  name: string;
  /** Id of the lexical scope this reference resolves in, set by semantic analysis (VM mode). */
  scopeId?: string;
  /** True if this reference resolves to a function-local variable/parameter rather than a global. */
  isLocal?: boolean;
}

export interface CallNode extends ASTNode {
  type: 'CallNode';
  callee: IdentifierNode;
  args: ExpressionNode[];
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

export type LiteralNode = NumberLiteralNode | StringLiteralNode | ColorLiteralNode | NullLiteralNode;

/** The `NULL` pointer literal. */
export interface NullLiteralNode extends ASTNode {
  type: 'LiteralNode';
  dataType: 'null';
  value: null;
}

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
