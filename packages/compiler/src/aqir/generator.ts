import {
  ProgramNode,
  SceneNode,
  StatementNode,
  ExpressionNode,
  BinaryOpNode,
  DeclareBlockNode,
  SequenceBlockNode,
  VariableDeclNode,
  ArrayDeclNode,
  LinkedListDeclNode,
  StackDeclNode,
  QueueDeclNode,
  TreeDeclNode,
  BinaryTreeDeclNode,
  BSTDeclNode,
  HeapDeclNode,
  HashMapDeclNode,
  TrieDeclNode,
  GraphDeclNode,
  LoopNode,
  IfNode,
  WhileNode,
  PrintNode,
  WaitNode,
  FunctionDeclNode,
  ReturnNode,
  CallNode,
  Position,
  LayoutStatementNode,
  CameraStatementNode,
  PositionStatementNode,
  PropertyNode,
  TupleLiteralNode,
} from '../ast/types';
import type {
  AQIRObject,
  AQIRInstruction,
  CompareObjectsInstruction,
  SwapObjectsInstruction,
  HighlightObjectInstruction,
  WaitInstruction,
  LinkObjectsInstruction,
  GenericActionInstruction,
  SetStateInstruction,
} from '@aqvl/shared';
import { getSemanticColorToken, OutOfBoundsError } from '@aqvl/shared';
import type { AQIRProgram, VMInstruction, SourceLocation } from './types';
import {
  AQIROpcode,
  type JumpInstruction,
  type JumpIfFalseInstruction,
  type CallInstruction,
  type RetInstruction,
  type PushScopeInstruction,
  type PopScopeInstruction,
  type SetVarInstruction,
  type AQIRValue,
  type SetLayoutStrategyInstruction,
  type SetPositionInstruction,
  type ComputeLayoutInstruction,
  type SetCameraInstruction,
  type LayoutStrategyName,
  type GeometryParamValue,
} from './InstructionSet';
import { FunctionTable } from '../codegen/functionTable';
import { EnvironmentBuilder } from '../codegen/environment';
import { LayoutTracker } from '../codegen/layoutTracker';
import { computeDefaultLayoutParams } from '../codegen/defaultLayoutParams';

/** A jump target that hasn't been resolved yet — patched once the label's PC is known. */
interface PendingJump {
  pc: number;
  label: string;
}

export class AQIRGenerator {
  private objectIdCounter = 0;
  // Maps logical identifier (e.g. "arr[0]") to physical object ID (e.g. "obj_001")
  private symbolMap = new Map<string, string>();
  private generatedObjects: AQIRObject[] = [];
  // BST/Tree initial-value INSERT instructions to be prepended before the user sequence
  private pendingInitInstructions: AQIRInstruction[] = [];

  // --- VM-mode code generation state ---
  private instructionList: VMInstruction[] = [];
  private labelMap = new Map<string, number>();
  private labelCounter = 0;
  private pendingJumps: PendingJump[] = [];
  private functionTable = new FunctionTable();
  private environment = new EnvironmentBuilder();
  // Counter for unique per-call-site temp variables (see generateFunctionCall).
  private tempCounter = 0;
  // Which structures have an explicit LAYOUT statement, so generateDefaultLayout
  // (backward-compat backfill) doesn't emit a duplicate for them.
  private layoutTracker = new LayoutTracker();
  // Names declared with `ARRAY name = [...]`. Element references into these
  // are resolved at runtime by (array, logical index) — see resolveExpressionId.
  private arrayNames = new Set<string>();
  // Arrays some INSERT grows: a literal index past the declared length may be valid by then.
  private growableArrays = new Set<string>();
  // Names declared with `[SINGLY|DOUBLY|CIRCULAR] LINKEDLIST`. Like arrays,
  // `list[i]` is resolved at run time (by walking i nodes from the head),
  // since the list's shape changes as the program relinks pointers.
  private linkedListNames = new Set<string>();
  // Names declared with `BINARY_TREE` / `BST`: pointer-based trees (see the
  // runtime's TreeEngine) whose shape the program changes by relinking
  // `left` / `right` pointers.
  private treeNames = new Set<string>();
  // Names declared with `QUEUE` / `STACK` — their length is read at run time.
  private containerNames = new Set<string>();
  // Names declared with `GRAPH` (see the runtime's GraphProgramEngine).
  private graphNames = new Set<string>();
  // Every user FUNCTION name (a user function shadows a built-in of the same name).
  private userFunctionNames = new Set<string>();

  /** Built-in functions usable in expressions (see Parser.BUILTIN_EXPRESSION_FUNCTIONS). */
  private static readonly CONTAINER_READS = new Set(['DEQUEUE', 'POP', 'PEEK', 'FRONT', 'REAR']);
  /** Graph reads usable in expressions, evaluated by the runtime's GraphProgramEngine. */
  private static readonly GRAPH_READS = new Set([
    'VERTEX', 'VERTEX_AT', 'VERTEX_COUNT', 'EDGE_AT', 'EDGE_COUNT', 'DEGREE', 'IN_DEGREE', 'NEIGHBOR', 'WEIGHT', 'HAS_EDGE',
  ]);
  /** Graph edits usable as statements: `ADD_EDGE g "A" "B" 4`, `REMOVE_VERTEX g "C"`, ... */
  private static readonly GRAPH_EDITS = new Set(['ADD_VERTEX', 'ADD_EDGE', 'REMOVE_EDGE', 'REMOVE_VERTEX']);

  /** True when `name(...)` is the built-in `builtin` rather than a user function. */
  private isBuiltinCall(node: CallNode, builtin: string): boolean {
    return node.callee.name.toUpperCase() === builtin && !this.userFunctionNames.has(node.callee.name);
  }

  /** The function table populated by the most recent `generate()` call. */
  public getFunctionTable(): FunctionTable {
    return this.functionTable;
  }

  private generateId(): string {
    const id = `obj_${String(this.objectIdCounter).padStart(3, '0')}`;
    this.objectIdCounter++;
    return id;
  }

  // ---------------------------------------------------------------------
  // Instruction emission primitives
  // ---------------------------------------------------------------------

  /** Appends an instruction to the program's flat instruction stream. Returns its PC. */
  private emit(instruction: VMInstruction): number {
    this.instructionList.push(instruction);
    return this.instructionList.length - 1;
  }

  /** Generates a unique label name, e.g. for a branch target that isn't known yet. */
  private createLabel(prefix = 'L'): string {
    return `${prefix}_${this.labelCounter++}`;
  }

  /** Binds `name` to the current end of the instruction stream (the next instruction emitted). */
  private labelCurrentPC(name: string): void {
    this.labelMap.set(name, this.instructionList.length);
  }

  /**
   * Resolves every pending JUMP/JUMP_IF_FALSE that targets `name` to the PC
   * recorded by `labelCurrentPC`. Must be called after `labelCurrentPC(name)`.
   */
  private patchJump(name: string): void {
    const target = this.labelMap.get(name);
    if (target === undefined) {
      throw new Error(`Cannot patch jump to label "${name}": labelCurrentPC() was never called for it.`);
    }
    this.pendingJumps = this.pendingJumps.filter((pending) => {
      if (pending.label !== name) return true;
      const instr = this.instructionList[pending.pc] as JumpInstruction | JumpIfFalseInstruction;
      instr.target = target;
      return false;
    });
  }

  private toSourceLocation(pos: Position): SourceLocation {
    return { line: pos.line, column: pos.column };
  }

  /** Emits an unconditional jump to `label`, resolving it immediately if already bound (backward jump) or deferring it (forward jump). */
  private emitJump(label: string, pos: Position): number {
    const target = this.labelMap.get(label);
    const pc = this.emit({
      opcode: AQIROpcode.JUMP,
      target: target ?? -1,
      lineNumber: pos.line,
      sourceLocation: this.toSourceLocation(pos),
    } as JumpInstruction);
    if (target === undefined) this.pendingJumps.push({ pc, label });
    return pc;
  }

  /** Emits a conditional jump to `label` taken when `condition` is falsy. */
  private emitJumpIfFalse(condition: AQIRValue, label: string, pos: Position): number {
    const target = this.labelMap.get(label);
    const pc = this.emit({
      opcode: AQIROpcode.JUMP_IF_FALSE,
      target: target ?? -1,
      condition,
      lineNumber: pos.line,
      sourceLocation: this.toSourceLocation(pos),
    } as JumpIfFalseInstruction);
    if (target === undefined) this.pendingJumps.push({ pc, label });
    return pc;
  }

  private emitPushScope(scopeId: string, pos: Position): void {
    this.emit({
      opcode: AQIROpcode.PUSH_SCOPE,
      scopeId,
      lineNumber: pos.line,
      sourceLocation: this.toSourceLocation(pos),
    } as PushScopeInstruction);
  }

  private emitPopScope(pos: Position): void {
    this.emit({
      opcode: AQIROpcode.POP_SCOPE,
      lineNumber: pos.line,
      sourceLocation: this.toSourceLocation(pos),
    } as PopScopeInstruction);
  }

  /** Emits a store into `name` (local if declared in the current scope chain, global otherwise). */
  private emitSetVar(name: string, value: AQIRValue, pos: Position): void {
    this.emit({
      opcode: AQIROpcode.SET_VAR,
      name,
      value,
      lineNumber: pos.line,
      sourceLocation: this.toSourceLocation(pos),
    } as SetVarInstruction);
  }

  // ---------------------------------------------------------------------
  // Top-level generation
  // ---------------------------------------------------------------------

  public generate(program: ProgramNode, userInputs: Record<string, any> = {}): AQIRProgram {
    this.objectIdCounter = 0;
    this.symbolMap.clear();
    this.generatedObjects = [];
    this.pendingInitInstructions = [];
    this.instructionList = [];
    this.labelMap.clear();
    this.labelCounter = 0;
    this.pendingJumps = [];
    this.functionTable = new FunctionTable();
    this.environment = new EnvironmentBuilder();
    this.tempCounter = 0;
    this.layoutTracker.reset();
    this.arrayNames.clear();
    this.growableArrays.clear();
    this.linkedListNames.clear();
    this.treeNames.clear();
    this.containerNames.clear();
    this.graphNames.clear();
    this.userFunctionNames.clear();

    // Since v1 assumes one scene per program, we extract the first one
    const scene = program.scenes[0];
    const collectFunctionNames = (fns: FunctionDeclNode[]) => {
      for (const fn of fns) {
        this.userFunctionNames.add(fn.name.name);
        collectFunctionNames(fn.body.statements.filter((st): st is FunctionDeclNode => st.type === 'FunctionDeclNode'));
      }
    };
    collectFunctionNames(scene?.declarations?.functions ?? []);
    this.generateSceneInstructions(scene, userInputs);

    if (this.pendingJumps.length > 0) {
      const unresolved = this.pendingJumps.map((p) => p.label).join(', ');
      throw new Error(`Unresolved jump label(s) at end of generation: ${unresolved}`);
    }

    return {
      version: '0.1',
      scene: scene.name.name,
      objects: this.generatedObjects,
      instructions: this.instructionList,
      functionTable: {},
    };
  }

  private generateSceneInstructions(scene: SceneNode, userInputs: Record<string, any>): void {
    // Pre-scan the sequence for explicit LAYOUT statements before DECLARE
    // processing runs, so generateDefaultLayout (backward-compat backfill,
    // emitted as each structure is declared) can already tell whether a
    // given structure will get an explicit LAYOUT later in the sequence.
    if (scene.sequence) {
      this.collectExplicitLayoutTargets(scene.sequence.statements);
      this.collectGrowableArrays(scene.sequence.statements);
    }

    if (scene.declarations) {
      this.processDeclarations(scene.declarations, userInputs);
      this.declarePointerContainers(scene.declarations);
    }

    // Function bodies are emitted up front (so CALL sites anywhere in the
    // sequence can resolve their startPC), guarded by a JUMP so the main
    // sequence below doesn't fall into them.
    const functions = scene.declarations?.functions ?? [];
    if (functions.length > 0) {
      const skipLabel = this.createLabel('skip_functions');
      this.emitJump(skipLabel, scene.pos);
      for (const fn of functions) {
        this.generateFunctionDeclaration(fn);
      }
      this.labelCurrentPC(skipLabel);
      this.patchJump(skipLabel);
    }

    // Prepend BST/tree initial INSERT instructions before user sequence
    for (const instr of this.pendingInitInstructions) {
      this.emit(instr);
    }

    if (scene.sequence) {
      this.generateSequence(scene.sequence);
    }
  }

  // ---------------------------------------------------------------------
  // Functions (VM mode: FUNCTION / RETURN / IF-ELSE / CALL)
  // ---------------------------------------------------------------------

  private generateFunctionDeclaration(fn: FunctionDeclNode): void {
    const startPC = this.instructionList.length;
    this.functionTable.add(fn.name.name, startPC, fn.params.map((p) => p.name));

    const scopeId = this.environment.enterScope();
    fn.params.forEach((param) => this.environment.declareVariable(param.name, scopeId));

    const previousFunctionName = this.currentFunctionName;
    this.currentFunctionName = fn.name.name;

    this.emitPushScope(scopeId, fn.pos);
    for (const stmt of fn.body.statements) {
      this.generateFunctionBodyStatement(stmt);
    }
    // Implicit RET for a body that falls off the end without an explicit RETURN.
    this.emitPopScope(fn.pos);
    this.generateReturn({ type: 'ReturnNode', pos: fn.pos });

    this.currentFunctionName = previousFunctionName;
    this.environment.exitScope();
  }

  private generateFunctionBodyStatement(stmt: StatementNode): void {
    switch (stmt.type) {
      case 'ReturnNode':
        this.generateReturn(stmt as ReturnNode);
        return;
      case 'IfNode':
        this.generateIf(stmt as IfNode, this.generateFunctionBodyStatement.bind(this));
        return;
      case 'FunctionDeclNode': {
        // Nested function declaration: emit its body out-of-line, guarded so
        // control never falls into it from the enclosing statement stream.
        const skipLabel = this.createLabel('skip_fn');
        this.emitJump(skipLabel, stmt.pos);
        this.generateFunctionDeclaration(stmt as FunctionDeclNode);
        this.labelCurrentPC(skipLabel);
        this.patchJump(skipLabel);
        return;
      }
      case 'ExpressionStatementNode': {
        // `x = expr` compiles to an actual store; anything else (e.g. a bare
        // function call) is evaluated for its side effect and discarded.
        const expr = (stmt as any).expression as ExpressionNode;
        if (!this.tryGenerateAssignment(expr)) {
          this.compileValue(expr);
        }
        return;
      }
      default:
        // WHILE, LOOP, PRINT, HIGHLIGHT, COMPARE, pointer writes, FREE, ...:
        // a function body accepts every SEQUENCE statement.
        this.generateInstruction(stmt);
    }
  }

  private generateReturn(node: ReturnNode): void {
    const returnValue = node.value !== undefined ? this.compileValue(node.value) : undefined;
    this.emit({
      opcode: AQIROpcode.RET,
      returnValue,
      lineNumber: node.pos.line,
      sourceLocation: this.toSourceLocation(node.pos),
    } as RetInstruction);
  }

  private generateFunctionCall(node: CallNode): AQIRValue {
    const args = node.args.map((arg) => this.compileValue(arg));
    this.functionTable.registerCall(this.currentFunctionName ?? '<sequence>', node.callee.name);
    // Every call site gets its own temp variable to receive the callee's
    // return value: the VM stores into it (in the *caller's* scope) when RET
    // pops the callee's frame, and it's returned here as the AQIRValue this
    // call compiles to, so it can be read back like any other variable —
    // including from within a larger expression containing more than one
    // call (e.g. `fib(n-1) + fib(n-2)`), where a single shared "last return
    // value" slot would have the second call's result clobber the first's
    // before the addition ever reads it.
    const resultVar = `__call_${this.tempCounter++}`;
    this.emit({
      opcode: AQIROpcode.CALL,
      functionName: node.callee.name,
      args,
      resultVar,
      lineNumber: node.pos.line,
      sourceLocation: this.toSourceLocation(node.pos),
    } as CallInstruction);
    return resultVar;
  }

  /**
   * Compiles `target = expr` (parsed as a BinaryOpNode with operator '=')
   * into a SET_VAR store, if `expr` has that shape. Returns false for any
   * other expression so the caller falls back to evaluating it for its
   * value/side effect only (e.g. a bare function call).
   */
  private tryGenerateAssignment(expr: ExpressionNode): boolean {
    if (expr.type === 'BinaryOpNode' && expr.operator === '=' && expr.left.type === 'IdentifierNode') {
      const right = expr.right;
      const value =
        right.type === 'CallNode' && this.isBuiltinCall(right, 'NEW_NODE')
          ? this.generateNewNode(right, expr.left.name)
          : right.type === 'CallNode' && AQIRGenerator.CONTAINER_READS.has(right.callee.name.toUpperCase()) && !this.userFunctionNames.has(right.callee.name)
            ? this.generateContainerRead(right, expr.left.name)
            : this.compileValue(right);
      this.emit({
        opcode: AQIROpcode.SET_VAR,
        name: expr.left.name,
        value,
        // Shown in the output console when the assignment moves a pointer
        // variable (e.g. `curr = curr.next`), see AnimationController.
        sourceText: `${expr.left.name} = ${this.exprToString(expr.right)}`,
        lineNumber: expr.pos.line,
        sourceLocation: this.toSourceLocation(expr.pos),
      } as SetVarInstruction);
      return true;
    }
    if (expr.type === 'BinaryOpNode' && expr.operator === '=' && expr.left.type === 'MemberAccessNode') {
      // `curr.next = prev`, `list.head = node`, `node.left = n`, `node.val = 5`:
      // a pointer / field write, animated by the runtime's LinkedListEngine
      // or TreeEngine (whichever owns the target).
      this.emit({
        action: 'LL_SET',
        target: this.compileValue(expr.left.object),
        field: expr.left.member,
        value: this.compileValue(expr.right),
        sourceText: `${this.exprToString(expr.left)} = ${this.exprToString(expr.right)}`,
        lineNumber: expr.pos.line,
      } as any);
      return true;
    }
    return false;
  }

  /** Renders an expression back to AQVL source form, for console messages. */
  private exprToString(expr: ExpressionNode): string {
    switch (expr.type) {
      case 'IdentifierNode':
        return expr.name;
      case 'LiteralNode':
        if (expr.value === null) return 'NULL';
        if (typeof expr.value === 'boolean') return expr.value ? 'TRUE' : 'FALSE';
        if (expr.value === Infinity) return 'INFINITY';
        return expr.dataType === 'string' ? `"${expr.value}"` : String(expr.value);
      case 'MemberAccessNode':
        return `${this.exprToString(expr.object)}.${expr.member}`;
      case 'ArrayAccessNode':
        return `${expr.array.name}[${this.exprToString(expr.index)}]`;
      case 'BinaryOpNode':
        return `${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)}`;
      case 'CallNode':
        return `${expr.callee.name}(${expr.args.map((a) => this.exprToString(a)).join(', ')})`;
      default:
        if ((expr as any).type === 'GenericActionNode' && (expr as any).actionName === 'LENGTH') {
          return `LENGTH(${(expr as any).args[0].name})`;
        }
        return '?';
    }
  }

  /** Name of the function currently being compiled, for call-graph tracking; undefined at the top level. */
  private currentFunctionName: string | undefined;

  /**
   * Compiles an expression into an `AQIRValue` usable as a CALL argument,
   * RETURN value, or branch condition. Identifiers/literals pass through as
   * themselves; binary expressions and array accesses compile to small
   * serializable descriptors for a future runtime expression evaluator
   * (Phase 2) to interpret — see AQVLVirtualMachine.evaluateExpression.
   */
  private compileValue(expr: ExpressionNode): AQIRValue {
    switch (expr.type) {
      case 'CallNode': {
        const call = expr as CallNode;
        if (this.isBuiltinCall(call, 'NEW_NODE')) return this.generateNewNode(call);
        if (this.isBuiltinCall(call, 'MAX') || this.isBuiltinCall(call, 'MIN')) {
          return { op: call.callee.name.toUpperCase(), left: this.compileValue(call.args[0]), right: this.compileValue(call.args[1]) } as unknown as AQIRValue;
        }
        if (this.isBuiltinCall(call, 'ABS')) {
          return { op: 'ABS', left: this.compileValue(call.args[0]), right: 0 } as unknown as AQIRValue;
        }
        if (this.isBuiltinCall(call, 'IS_EMPTY')) {
          return { op: '==', left: { len: this.containerArgName(call) }, right: 0 } as unknown as AQIRValue;
        }
        if (AQIRGenerator.CONTAINER_READS.has(call.callee.name.toUpperCase()) && !this.userFunctionNames.has(call.callee.name)) {
          return this.generateContainerRead(call);
        }
        if (AQIRGenerator.GRAPH_READS.has(call.callee.name.toUpperCase()) && !this.userFunctionNames.has(call.callee.name)) {
          // Read at run time: `{ gfn, args }` (see VM evaluateExpression / GraphProgramEngine.read).
          return {
            gfn: call.callee.name.toUpperCase(),
            args: call.args.map((a) => this.compileGraphOperand(a)),
            source: this.exprToString(call),
            argSources: call.args.map((a) => this.exprToString(a)),
          } as unknown as AQIRValue;
        }
        return this.generateFunctionCall(call);
      }
      case 'MemberAccessNode':
        // Read at run time: `{ member, object }` (see VM evaluateExpression).
        return { member: expr.member, object: this.compileValue(expr.object) } as unknown as AQIRValue;
      case 'IdentifierNode':
        return expr.name;
      case 'LiteralNode':
        return expr.value;
      case 'BinaryOpNode':
        if ((expr.operator === 'AND' || expr.operator === 'OR') && this.containsContainerRead(expr.right)) {
          return this.compileShortCircuit(expr);
        }
        return {
          op: expr.operator,
          left: this.compileValue(expr.left),
          right: this.compileValue(expr.right),
        };
      case 'ArrayAccessNode':
        if (this.arrayNames.has(expr.array.name) || this.linkedListNames.has(expr.array.name)) {
          // Reads the element's current value at runtime (VM `{ elem, index }`
          // operand), so `IF arr[i] > arr[i+1]` or `total = total + arr[i]`
          // see live values — including after swaps, updates and inserts.
          return { elem: expr.array.name, index: this.compileValue(expr.index) } as unknown as AQIRValue;
        }
        return this.resolveExpressionId(expr);
      default:
        // LENGTH(arr) is parsed as a GenericActionNode standing in for an
        // expression (see Parser.parsePrimaryExpression) — it's always
        // resolvable at compile time from the declared array's element count.
        if ((expr as any).type === 'GenericActionNode' && (expr as any).actionName === 'LENGTH') {
          const arrayName = ((expr as any).args[0] as any).name;
          // Arrays can grow/shrink (INSERT / DELETE), so read their live length.
          if (
            this.arrayNames.has(arrayName) ||
            this.linkedListNames.has(arrayName) ||
            this.treeNames.has(arrayName) ||
            this.containerNames.has(arrayName) ||
            this.graphNames.has(arrayName)
          ) {
            return { len: arrayName } as unknown as AQIRValue;
          }
          return this.resolveArrayLength(arrayName);
        }
        throw new Error(`Unsupported expression type: ${(expr as any).type}`);
    }
  }

  /**
   * `BINARY_TREE t = [1, 2, 3, NULL, 5]` (level order, NULL = no child) or
   * `BST t = [50, 30, 70]` (inserted in order, smaller keys to the left).
   * Emits the tree fully built: an invisible anchor `bt:<tree>` holding the
   * root pointer, one node `bt:<tree>:<n>` per value and one edge per
   * non-NULL child pointer (`<node>>left` / `<node>>right`).
   */
  private declarePointerTree(decl: BinaryTreeDeclNode | BSTDeclNode, userInputs: Record<string, any>): void {
    const treeName = decl.name.name;
    const isBST = decl.type === 'BSTDeclNode';
    let values: (number | null)[] = (decl.initialElements ?? []).map((e) => (e.value === null ? null : Number(e.value)));
    if (Array.isArray(userInputs[treeName])) values = userInputs[treeName];
    this.treeNames.add(treeName);

    const nodeValues: number[] = [];
    const left = new Map<number, number>();
    const right = new Map<number, number>();

    if (isBST) {
      for (const raw of values) {
        if (raw === null) throw new Error(`BST ${treeName} cannot contain NULL (line ${decl.pos.line}).`);
        if (nodeValues.includes(raw)) {
          throw new Error(`BST ${treeName} lists ${raw} twice — a binary search tree holds each key once (line ${decl.pos.line}).`);
        }
        const n = nodeValues.push(raw) - 1;
        if (n === 0) continue;
        let at = 0;
        for (;;) {
          const side = raw < nodeValues[at] ? left : right;
          const child = side.get(at);
          if (child === undefined) {
            side.set(at, n);
            break;
          }
          at = child;
        }
      }
    } else if (values.length > 0) {
      if (values[0] === null) throw new Error(`BINARY_TREE ${treeName}: the first value is the root and cannot be NULL (line ${decl.pos.line}).`);
      nodeValues.push(values[0] as number);
      const queue: number[] = [0];
      let i = 1;
      while (queue.length > 0 && i < values.length) {
        const parent = queue.shift()!;
        for (const side of [left, right]) {
          if (i >= values.length) break;
          const v = values[i++];
          if (v === null) continue;
          const n = nodeValues.push(v) - 1;
          side.set(parent, n);
          queue.push(n);
        }
      }
      if (i < values.length) {
        throw new Error(`BINARY_TREE ${treeName}: values after position ${i - 1} have no parent (every NULL has no children) (line ${decl.pos.line}).`);
      }
    }

    const nodeId = (n: number) => `bt:${treeName}:${n}`;
    this.generatedObjects.push({
      id: `bt:${treeName}`,
      type: 'BINARYTREE',
      originalType: 'BINARYTREE',
      logicalParent: treeName,
      label: treeName,
      properties: {
        kind: isBST ? 'BST' : 'BINARY',
        rootId: nodeValues.length > 0 ? nodeId(0) : null,
        nextNodeNumber: nodeValues.length,
      },
    } as any);
    nodeValues.forEach((value, n) => {
      this.generatedObjects.push({
        id: nodeId(n),
        type: 'sphere',
        originalType: 'TREE_NODE',
        logicalParent: treeName,
        value,
        label: '',
      } as any);
    });
    for (const [side, pointer, label] of [[left, 'left', 'L'], [right, 'right', 'R']] as const) {
      side.forEach((child, parent) => {
        this.generatedObjects.push({
          id: `${nodeId(parent)}>${pointer}`,
          type: 'EDGE',
          logicalParent: treeName,
          args: [nodeId(parent), nodeId(child)],
          properties: { directed: true, pointer, label },
        });
      });
    }
  }

  /**
   * `GRAPH g = ["A-B:4", "A-C", "D"]`: `A-B` is an undirected edge, `A->B`
   * (or the older shorthand `A>B`) a directed one, `:4` its weight (1 when omitted) and a lone name an
   * isolated vertex. Emits an invisible anchor `g:<graph>` (whether the graph
   * is directed), one VERTEX `gv:<graph>:<name>` per vertex in order of first
   * appearance and one GRAPH_EDGE `ge:<graph>:<n>` per edge in the order
   * listed — which is also the order NEIGHBOR(v, i) lists a vertex's
   * neighbours. A vertex / edge reference held in a variable is that id.
   */
  private declareGraph(graph: GraphDeclNode, userInputs: Record<string, any>): void {
    const graphName = graph.name.name;
    let edges: string[] = graph.initialElements ? graph.initialElements.map((e: any) => String(e.value)) : [];
    if (userInputs[graphName] && Array.isArray(userInputs[graphName])) edges = userInputs[graphName].map(String);
    this.graphNames.add(graphName);

    const parsed: { source: string; target?: string; directed: boolean; weight?: number; text: string }[] = [];
    for (const raw of edges) {
      const text = raw.trim();
      const match = text.match(/^([^\->:]+?)\s*(?:(->|>|-)\s*([^:]+?)\s*(?::\s*(.+))?)?$/);
      if (!match) {
        throw new Error(`GRAPH ${graphName}: "${raw}" is not an edge. Write "A-B" (undirected), "A->B" (directed), "A-B:4" (weighted) or "A" (a vertex on its own) (line ${graph.pos.line}).`);
      }
      let weight: number | undefined;
      if (match[4] !== undefined) {
        weight = Number(match[4]);
        if (!Number.isFinite(weight)) {
          throw new Error(`GRAPH ${graphName}: the weight in "${raw}" must be a number, e.g. "A-B:4" (line ${graph.pos.line}).`);
        }
      }
      parsed.push({ source: match[1].trim(), target: match[3]?.trim(), directed: match[2] === '->' || match[2] === '>', weight, text });
    }
    const withTarget = parsed.filter((p) => p.target !== undefined);
    const directed = withTarget.some((p) => p.directed);
    if (directed && withTarget.some((p) => !p.directed)) {
      throw new Error(`GRAPH ${graphName} mixes directed ("A->B") and undirected ("A-B") edges. Use one kind for every edge (line ${graph.pos.line}).`);
    }
    const weighted = withTarget.some((p) => p.weight !== undefined);

    this.generatedObjects.push({
      id: `g:${graphName}`,
      type: 'GRAPH',
      originalType: 'GRAPH',
      logicalParent: graphName,
      label: graphName,
      properties: { directed, weighted, nextEdgeNumber: withTarget.length },
    } as any);

    const vertexIds = new Map<string, string>();
    const ensureVertex = (name: string) => {
      if (!vertexIds.has(name)) {
        const id = `gv:${graphName}:${name}`;
        vertexIds.set(name, id);
        this.symbolMap.set(`${graphName}["${name}"]`, id);
        this.generatedObjects.push({
          id,
          type: 'VERTEX',
          logicalParent: graphName,
          logicalIndex: vertexIds.size - 1,
          value: name,
          label: '',
        });
      }
      return vertexIds.get(name)!;
    };

    let edgeNumber = 0;
    const seen = new Set<string>();
    for (const p of parsed) {
      const sourceId = ensureVertex(p.source);
      if (p.target === undefined) continue;
      const targetId = ensureVertex(p.target);
      const key = directed ? `${p.source}->${p.target}` : [p.source, p.target].sort().join('-');
      if (seen.has(key)) {
        throw new Error(`GRAPH ${graphName} lists the edge "${p.text}" twice (line ${graph.pos.line}).`);
      }
      seen.add(key);
      const edgeId = `ge:${graphName}:${edgeNumber++}`;
      this.symbolMap.set(`${graphName}["${p.source}${directed ? '->' : '-'}${p.target}"]`, edgeId);
      this.generatedObjects.push({
        id: edgeId,
        type: 'GRAPH_EDGE',
        logicalParent: graphName,
        args: [sourceId, targetId],
        properties: {
          directed,
          // The weight drawn on the edge; an unweighted graph shows none (every weight is 1).
          label: weighted ? String(p.weight ?? 1) : undefined,
          weight: p.weight ?? 1,
        },
      });
    }
  }

  /**
   * Every STACK and every QUEUE is emitted in the form the runtime's TreeEngine animates: an invisible
   * anchor `ctr:<name>` (kind QUEUE / STACK) plus one item per initial value.
   * It holds values or node pointers (`PUSH s t.root`) and can be read inside
   * expressions (`x = POP(s)`, `PEEK(s)`, `IS_EMPTY(s)`, `LENGTH(s)`), so stack
   * algorithms are written with real loops and IFs.
   */
  private declarePointerContainers(declareBlock: DeclareBlockNode): void {
    for (const v of declareBlock.variables) {
      if (v.type !== 'StackDeclNode' && v.type !== 'QueueDeclNode') continue;
      const name = (v as QueueDeclNode | StackDeclNode).name.name;
      const kind = v.type === 'QueueDeclNode' ? 'QUEUE' : 'STACK';
      const elementType = kind === 'QUEUE' ? 'QUEUE_ELEMENT' : 'STACK_ELEMENT';
      const values = this.generatedObjects
        .filter((o) => o.type === elementType && o.logicalParent === name)
        .map((o) => o.value);
      this.generatedObjects = this.generatedObjects.filter((o) => !(o.type === elementType && o.logicalParent === name));
      this.generatedObjects.push({
        id: `ctr:${name}`,
        type: 'CONTAINER',
        logicalParent: name,
        label: name,
        properties: { kind, nextItemNumber: values.length },
      } as any);
      values.forEach((value, i) => {
        // `HIGHLIGHT s[0]` names the initial item (0 = bottom of a stack, front of a queue).
        this.symbolMap.set(`${name}[${i}]`, `ctr:${name}:${i}`);
        this.generatedObjects.push({
          id: `ctr:${name}:${i}`,
          type: 'CONTAINER_ITEM',
          logicalParent: name,
          logicalIndex: i,
          value,
          label: '',
          properties: { order: i },
        } as any);
      });
    }
  }

  /**
   * `NEW_NODE(list, value)` allocates an unlinked node belonging to `list`
   * (shown in that list's heap-memory area until the program links it in).
   * The new node's reference is stored into a per-call temp variable, which
   * is what the expression evaluates to — like a function call's result.
   */
  private generateNewNode(node: CallNode, assignTo?: string): AQIRValue {
    const [listArg, valueArg] = node.args;
    if (!listArg || listArg.type !== 'IdentifierNode' || !(this.linkedListNames.has(listArg.name) || this.treeNames.has(listArg.name))) {
      throw new Error(`NEW_NODE expects a linked list or tree as its first argument, e.g. NEW_NODE(list, 5) or NEW_NODE(tree, 5) (line ${node.pos.line}).`);
    }
    const resultVar = `__new_${this.tempCounter++}`;
    this.emit({
      action: 'LL_NEW',
      list: listArg.name,
      value: valueArg ? this.compileValue(valueArg) : 0,
      resultVar,
      // `newNode = NEW_NODE(...)`: the allocation step already shows the
      // variable's tag, so the assignment that follows isn't a step of its own.
      assignTo,
      sourceText: assignTo ? `${assignTo} = ${this.exprToString(node)}` : this.exprToString(node),
      lineNumber: node.pos.line,
    } as any);
    return resultVar;
  }

  /** Whether `expr` reads a queue / stack (`PEEK(s)`, `POP(s)`, ...) — a step with a visible effect. */
  private containsContainerRead(expr: ExpressionNode | undefined): boolean {
    if (!expr) return false;
    switch (expr.type) {
      case 'CallNode':
        return (
          (AQIRGenerator.CONTAINER_READS.has(expr.callee.name.toUpperCase()) && !this.userFunctionNames.has(expr.callee.name)) ||
          expr.args.some((a) => this.containsContainerRead(a))
        );
      case 'BinaryOpNode':
        return this.containsContainerRead(expr.left) || this.containsContainerRead(expr.right);
      case 'ArrayAccessNode':
        return this.containsContainerRead(expr.index);
      case 'MemberAccessNode':
        return this.containsContainerRead(expr.object);
      default:
        return false;
    }
  }

  /**
   * `a AND b` / `a OR b` whose right side reads a queue / stack, with C's
   * short-circuit order: `LENGTH(s) > 0 AND PEEK(s) < x` must not PEEK an
   * empty stack. The left side is stored in a temp; the right side's reads
   * run only when its value is still needed.
   */
  private compileShortCircuit(expr: BinaryOpNode): AQIRValue {
    const resultVar = `__cond_${this.tempCounter++}`;
    const done = this.createLabel('sc_end');
    const setResult = (value: AQIRValue) =>
      this.emit({ opcode: AQIROpcode.SET_VAR, name: resultVar, value, lineNumber: expr.pos.line, sourceLocation: this.toSourceLocation(expr.pos) } as any);

    // Stored as a real TRUE / FALSE, so the temp holds exactly the condition's value.
    const asBoolean = (value: AQIRValue) => ({ op: 'AND', left: value, right: true }) as unknown as AQIRValue;
    setResult(asBoolean(this.compileValue(expr.left)));
    if (expr.operator === 'AND') {
      this.emitJumpIfFalse(resultVar, done, expr.pos);
    } else {
      const evaluateRight = this.createLabel('sc_right');
      this.emitJumpIfFalse(resultVar, evaluateRight, expr.pos);
      this.emitJump(done, expr.pos);
      this.labelCurrentPC(evaluateRight);
      this.patchJump(evaluateRight);
    }
    setResult(asBoolean(this.compileValue(expr.right)));
    this.labelCurrentPC(done);
    this.patchJump(done);
    return resultVar;
  }

  /**
   * An operand of a graph built-in or graph edit: a graph's name and a text
   * literal (a vertex name such as "A") are passed as `{ text }` so they can
   * never be mistaken for a variable of the same name; anything else is an
   * ordinary expression evaluated when the step runs.
   */
  private compileGraphOperand(arg: ExpressionNode): AQIRValue {
    if (arg.type === 'IdentifierNode' && this.graphNames.has(arg.name)) return { text: arg.name } as unknown as AQIRValue;
    if (arg.type === 'LiteralNode' && typeof arg.value === 'string') return { text: arg.value } as unknown as AQIRValue;
    return this.compileValue(arg);
  }

  /** The queue / stack named by a built-in's single argument (`DEQUEUE(q)`). */
  private containerArgName(node: CallNode): string {
    const arg = node.args[0];
    const name = node.callee.name.toUpperCase();
    if (!arg || arg.type !== 'IdentifierNode' || !this.containerNames.has(arg.name)) {
      throw new Error(`${name} expects a declared QUEUE or STACK, e.g. ${name}(q) (line ${node.pos.line}).`);
    }
    return arg.name;
  }

  /**
   * `DEQUEUE(q)`, `POP(s)`, `PEEK(s)`, `FRONT(q)`, `REAR(q)` inside an expression: the
   * runtime removes / reads the element (animated) and stores it into a
   * per-call temp variable, which is what the expression evaluates to.
   */
  private generateContainerRead(node: CallNode, assignTo?: string): AQIRValue {
    const container = this.containerArgName(node);
    const resultVar = `__take_${this.tempCounter++}`;
    this.emit({
      action: 'CONTAINER_READ',
      op: node.callee.name.toUpperCase(),
      container,
      resultVar,
      assignTo,
      sourceText: assignTo ? `${assignTo} = ${this.exprToString(node)}` : this.exprToString(node),
      lineNumber: node.pos.line,
    } as any);
    return resultVar;
  }

  /** Counts the declared elements of `arrayName`, for compiling LENGTH(arr) to a literal. */
  private resolveArrayLength(arrayName: string): number {
    return this.generatedObjects.filter(
      (obj) => obj.type === 'ARRAY_ELEMENT' && obj.logicalParent === arrayName
    ).length;
  }

  /** IF (with an optional ELSE) compiled to JUMP_IF_FALSE branching — no static evaluation, no duplication. */
  private generateIf(node: IfNode, generateBodyStatement: (stmt: StatementNode) => void): void {
    const condition = this.compileValue(node.condition);
    const elseLabel = this.createLabel('else');
    const endLabel = this.createLabel('endif');

    this.emitJumpIfFalse(condition, elseLabel, node.pos);

    const thenScopeId = this.environment.enterScope();
    this.emitPushScope(thenScopeId, node.pos);
    for (const stmt of node.body) generateBodyStatement(stmt);
    this.emitPopScope(node.pos);
    this.environment.exitScope();

    if (node.elseBody && node.elseBody.length > 0) {
      this.emitJump(endLabel, node.pos);
    }

    this.labelCurrentPC(elseLabel);
    this.patchJump(elseLabel);

    if (node.elseBody && node.elseBody.length > 0) {
      const elseScopeId = this.environment.enterScope();
      this.emitPushScope(elseScopeId, node.pos);
      for (const stmt of node.elseBody) generateBodyStatement(stmt);
      this.emitPopScope(node.pos);
      this.environment.exitScope();

      this.labelCurrentPC(endLabel);
      this.patchJump(endLabel);
    }
  }

  // ---------------------------------------------------------------------
  // Scene declarations (unchanged object/graph construction, plus scopeId bookkeeping)
  // ---------------------------------------------------------------------

  private processDeclarations(declareBlock: DeclareBlockNode, userInputs: Record<string, any>): void {
    for (const v of declareBlock.variables) {
      this.generateVariableDeclaration(v);
      this.generateDefaultLayout(v);

      if (v.type === 'ArrayDeclNode') {
        const arr = v as ArrayDeclNode;
        let elements = arr.initialElements ? arr.initialElements.map(e => e.value) : [];

        // Override with user input if provided
        if (userInputs[arr.name.name] && Array.isArray(userInputs[arr.name.name])) {
          elements = userInputs[arr.name.name];
        }

        this.arrayNames.add(arr.name.name);

        for (let i = 0; i < elements.length; i++) {
          const id = this.generateId();
          this.symbolMap.set(`${arr.name.name}[${i}]`, id);

          this.generatedObjects.push({
            id,
            type: 'ARRAY_ELEMENT',
            logicalParent: arr.name.name,
            logicalIndex: i,
            value: elements[i],
            label: `${arr.name.name}[${i}]`,
          });
        }
      } else if (v.type === 'LinkedListDeclNode') {
        const list = v as LinkedListDeclNode;
        const listName = list.name.name;
        let elements = list.initialElements ? list.initialElements.map(e => e.value) : [];
        if (userInputs[listName] && Array.isArray(userInputs[listName])) {
          elements = userInputs[listName];
        }
        this.linkedListNames.add(listName);

        // Node ids are `ll:<list>:<n>` so the runtime can recognise a
        // pointer value (a node reference held in a variable) by its shape.
        const nodeIds = elements.map((_, i) => `ll:${listName}:${i}`);

        // The list itself: an invisible anchor holding the head pointer and
        // the variant. There are no HEAD / NULL spheres — the renderer tags
        // the first node HEAD and the last TAIL instead.
        this.generatedObjects.push({
          id: `ll:${listName}`,
          type: 'LINKEDLIST',
          originalType: 'LINKEDLIST',
          logicalParent: listName,
          label: listName,
          properties: {
            variant: list.variant || 'SINGLY',
            headId: nodeIds.length > 0 ? nodeIds[0] : null,
            nextNodeNumber: nodeIds.length,
          },
        } as any);

        nodeIds.forEach((id, i) => {
          this.symbolMap.set(`${listName}[${i}]`, id);
          this.generatedObjects.push({
            id,
            type: 'sphere',
            originalType: 'LINKEDLIST_NODE',
            logicalParent: listName,
            value: elements[i],
            label: '',
            properties: { slot: i },
          } as any);
        });

        // next pointers (+ prev pointers for DOUBLY). A pointer to NULL is
        // simply the absence of an edge.
        const isCircular = list.variant === 'CIRCULAR';
        for (let i = 0; i < nodeIds.length; i++) {
          const next = i + 1 < nodeIds.length ? nodeIds[i + 1] : (isCircular ? nodeIds[0] : null);
          if (next) {
            this.generatedObjects.push({
              id: `${nodeIds[i]}>next`,
              type: 'EDGE',
              logicalParent: listName,
              args: [nodeIds[i], next],
              properties: { directed: true, pointer: 'next' },
            });
          }
          if (list.variant === 'DOUBLY' && i > 0) {
            this.generatedObjects.push({
              id: `${nodeIds[i]}>prev`,
              type: 'EDGE',
              logicalParent: listName,
              args: [nodeIds[i], nodeIds[i - 1]],
              properties: { directed: true, pointer: 'prev' },
            });
          }
        }
      } else if (v.type === 'StackDeclNode') {
        const stack = v as StackDeclNode;
        let elements = stack.initialElements ? stack.initialElements.map(e => e.value) : [];
        if (userInputs[stack.name.name] && Array.isArray(userInputs[stack.name.name])) {
          elements = userInputs[stack.name.name];
        }

        // this.env.set(`LENGTH(${stack.name.name})`, elements.length);

        this.containerNames.add(stack.name.name);
        for (let i = 0; i < elements.length; i++) {
          const id = this.generateId();
          this.symbolMap.set(`${stack.name.name}[${i}]`, id);

          this.generatedObjects.push({
            id,
            type: 'STACK_ELEMENT',
            logicalParent: stack.name.name,
            logicalIndex: i,
            value: elements[i],
            label: `${stack.name.name}[${i}]`,
          });
        }
      } else if (v.type === 'QueueDeclNode') {
        const queue = v as QueueDeclNode;
        let elements = queue.initialElements ? queue.initialElements.map(e => e.value) : [];
        if (userInputs[queue.name.name] && Array.isArray(userInputs[queue.name.name])) {
          elements = userInputs[queue.name.name];
        }

        // this.env.set(`LENGTH(${queue.name.name})`, elements.length);

        this.containerNames.add(queue.name.name);
        for (let i = 0; i < elements.length; i++) {
          const id = this.generateId();
          this.symbolMap.set(`${queue.name.name}[${i}]`, id);

          this.generatedObjects.push({
            id,
            type: 'QUEUE_ELEMENT',
            logicalParent: queue.name.name,
            logicalIndex: i,
            value: elements[i],
            label: `${queue.name.name}[${i}]`,
          });
        }
      } else if (v.type === 'BinaryTreeDeclNode' || v.type === 'BSTDeclNode') {
        this.declarePointerTree(v as BinaryTreeDeclNode | BSTDeclNode, userInputs);
      } else if (v.type === 'TreeDeclNode') {
        const tree = v as TreeDeclNode;
        // Generate a virtual tree object to hold a reference
        const id = this.generateId();
        this.symbolMap.set(tree.name.name, id);

        this.generatedObjects.push({
          id,
          type: 'TREE',
          label: tree.name.name,
        });
      } else if (v.type === 'HeapDeclNode') {
        const heap = v as HeapDeclNode;
        let elements = heap.initialElements ? heap.initialElements.map(e => e.value) : [];
        if (userInputs[heap.name.name] && Array.isArray(userInputs[heap.name.name])) {
          elements = userInputs[heap.name.name];
        }

        // this.env.set(`LENGTH(${heap.name.name})`, elements.length);

        const nodeIds: string[] = [];
        for (let i = 0; i < elements.length; i++) {
          const treeId = this.generateId();
          const arrayId = this.generateId();
          nodeIds[i] = treeId;

          // Map index to the tree node so that logic can find it easily
          // But actually we want both to swap. We'll map to the tree node id as primary in symbol map if needed.
          this.symbolMap.set(`${heap.name.name}[${i}]`, treeId);

          this.generatedObjects.push({
            id: treeId,
            type: 'HEAP_NODE',
            logicalParent: heap.name.name,
            logicalIndex: i,
            value: elements[i],
            label: `${heap.name.name}[${i}]`,
          });

          this.generatedObjects.push({
            id: arrayId,
            type: 'HEAP_ARRAY_ELEMENT',
            logicalParent: heap.name.name,
            logicalIndex: i,
            value: elements[i],
            label: `${heap.name.name}[${i}]`,
          });
        }

        // Generate edges based on binary tree 2i+1, 2i+2
        for (let i = 0; i < nodeIds.length; i++) {
          if (!nodeIds[i]) continue;

          const leftChildIdx = 2 * i + 1;
          const rightChildIdx = 2 * i + 2;

          if (leftChildIdx < nodeIds.length && nodeIds[leftChildIdx]) {
            this.generatedObjects.push({
              id: this.generateId(),
              type: 'EDGE',
              logicalParent: heap.name.name,
              args: [nodeIds[i], nodeIds[leftChildIdx]],
              properties: { directed: true, label: 'L' }
            });
          }
          if (rightChildIdx < nodeIds.length && nodeIds[rightChildIdx]) {
            this.generatedObjects.push({
              id: this.generateId(),
              type: 'EDGE',
              logicalParent: heap.name.name,
              args: [nodeIds[i], nodeIds[rightChildIdx]],
              properties: { directed: true, label: 'R' }
            });
          }
        }
      } else if (v.type === 'HashMapDeclNode') {
        // Unlike Heap/BST (which precompute a static scene layout from
        // initialElements), a hash map's bucket structure depends on
        // runtime hashing/collision/resize behavior, so it's built the same
        // way BST_INSERT builds a tree: HASHMAP_INIT creates the empty
        // bucket row, then one HASHMAP_INSERT per entry runs the real
        // insert algorithm (hash -> bucket -> chain -> maybe resize).
        const hashMap = v as HashMapDeclNode;
        const hashMapName = hashMap.name.name;
        const entries = hashMap.initialEntries || [];

        this.pendingInitInstructions.push({
          action: 'GENERIC_ACTION',
          actionName: 'HASHMAP_INIT',
          args: [hashMapName],
          payload: { logicalParent: hashMapName },
        } as any);

        for (const entry of entries) {
          this.pendingInitInstructions.push({
            action: 'GENERIC_ACTION',
            actionName: 'HASHMAP_INSERT',
            args: [hashMapName, entry.key.value, entry.value.value],
            payload: { logicalParent: hashMapName },
          } as any);
        }
      } else if (v.type === 'TrieDeclNode') {
        // Like HashMap/Heap, a trie's shape depends on a real algorithm
        // (shared-prefix compression + isEndOfWord marking), so it's built
        // the same way BST_INSERT/HEAP_INSERT build their structures:
        // TRIE_INIT creates the root, then one TRIE_INSERT per word runs
        // the real insert algorithm.
        const trie = v as TrieDeclNode;
        let words = trie.initialElements ? trie.initialElements.map((e: any) => e.value as string) : [];
        if (userInputs[trie.name.name] && Array.isArray(userInputs[trie.name.name])) {
          words = userInputs[trie.name.name];
        }

        this.pendingInitInstructions.push({
          action: 'GENERIC_ACTION',
          actionName: 'TRIE_INIT',
          args: [trie.name.name],
          payload: { logicalParent: trie.name.name },
        } as any);

        for (const word of words) {
          this.pendingInitInstructions.push({
            action: 'GENERIC_ACTION',
            actionName: 'TRIE_INSERT',
            args: [trie.name.name, word],
            payload: { logicalParent: trie.name.name },
          } as any);
        }
      } else if (v.type === 'GraphDeclNode') {
        this.declareGraph(v as GraphDeclNode, userInputs);
      } else if (v.type === 'ObjectDeclNode') {
        const obj = v as any; // Type assert to avoid import issues if not explicitly typed in this file
        const id = this.generateId();
        this.symbolMap.set(obj.name.name, id);

        const args = (obj.args || []).map((arg: any) => {
          if (arg.type === 'LiteralNode') return arg.value;
          if (arg.type === 'IdentifierNode') return arg.name; // Keep identifier names for linker/resolution
          return null;
        });

        const properties: Record<string, any> = {};
        if (obj.properties) {
          for (const prop of obj.properties) {
            let val = null;
            if (prop.value.type === 'LiteralNode') val = prop.value.value;
            else if (prop.value.type === 'IdentifierNode') val = prop.value.name;
            properties[prop.name] = val;
          }
        }

        const isTreeNode = obj.objectType === 'TREE_NODE';

        this.generatedObjects.push({
          id,
          type: isTreeNode ? 'sphere' : obj.objectType,
          originalType: obj.objectType,
          label: obj.name.name,
          value: isTreeNode && args.length > 0 ? args[0] : undefined,
          logicalParent: properties['parent'] || undefined,
          args,
          ...(Object.keys(properties).length > 0 ? { properties } : {}),
        });
      }
    }
  }

  /**
   * Registers a scene-level declaration (array, stack, tree, ...) in the
   * compile-time environment as a global variable, so later CALL/condition
   * compilation can distinguish a global reference from a local one via
   * `environment.getVariableScope`. This does not affect the object/graph
   * construction above — it is bookkeeping only.
   */
  private generateVariableDeclaration(decl: VariableDeclNode): void {
    this.environment.declareVariable(decl.name.name, this.environment.getCurrentScopeId());
  }

  // ---------------------------------------------------------------------
  // Animation sequence (SEQUENCE / LOOP / IF, END-delimited grammar)
  // ---------------------------------------------------------------------

  private generateSequence(sequenceBlock: SequenceBlockNode): void {
    for (const stmt of sequenceBlock.statements) {
      this.generateInstruction(stmt);
    }
  }

  // ---------------------------------------------------------------------
  // Spatial syntax (LAYOUT / CAMERA / POSITION) — see
  // docs/design/aqir-geometry-spec.md
  // ---------------------------------------------------------------------

  /**
   * Walks the sequence (recursing into LOOP/IF bodies) recording every
   * structure named by an explicit `LAYOUT` statement, before any
   * instruction is emitted. Lets `generateDefaultLayout` (called while
   * DECLARE is processed, earlier in program order than the sequence)
   * know not to backfill a default for a structure that gets an explicit
   * one later.
   */
  private collectExplicitLayoutTargets(statements: StatementNode[]): void {
    for (const stmt of statements) {
      if (stmt.type === 'LayoutStatementNode') {
        this.layoutTracker.markExplicit((stmt as LayoutStatementNode).target.name);
      } else if (stmt.type === 'LoopNode') {
        this.collectExplicitLayoutTargets((stmt as LoopNode).body);
      } else if (stmt.type === 'WhileNode') {
        this.collectExplicitLayoutTargets((stmt as WhileNode).body);
      } else if (stmt.type === 'IfNode') {
        const ifNode = stmt as IfNode;
        this.collectExplicitLayoutTargets(ifNode.body);
        if (ifNode.elseBody) this.collectExplicitLayoutTargets(ifNode.elseBody);
      }
    }
  }

  /** Records every array targeted by an INSERT anywhere in `statements` (recursing into blocks). */
  private collectGrowableArrays(statements: StatementNode[]): void {
    for (const stmt of statements) {
      const any = stmt as any;
      if (stmt.type === 'GenericActionNode' && any.actionName === 'INSERT' && any.args[0]?.type === 'ArrayAccessNode') {
        this.growableArrays.add(any.args[0].array.name);
      }
      if (Array.isArray(any.body)) this.collectGrowableArrays(any.body);
      if (Array.isArray(any.elseBody)) this.collectGrowableArrays(any.elseBody);
    }
  }

  /** Resolves a LAYOUT/POSITION argument expression to a GeometryParamValue (number, enum bareword, or (x,y,z) tuple). */
  private resolveGeometryParamValue(expr: ExpressionNode): GeometryParamValue {
    if (expr.type === 'LiteralNode') return expr.value as GeometryParamValue;
    if (expr.type === 'IdentifierNode') return expr.name;
    if ((expr as any).type === 'TupleLiteralNode') {
      const elements = (expr as TupleLiteralNode).elements;
      const nums = elements.map((e) => this.evaluateExpressionNumber(e));
      return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
    }
    if (expr.type === 'BinaryOpNode') return this.evaluateExpressionNumber(expr);
    throw new Error(`Unsupported layout/position argument expression: ${(expr as any).type}`);
  }

  /** Converts a LAYOUT/POSITION statement's named-arg list into a params record for SET_LAYOUT_STRATEGY. */
  private paramsFromNamedArgs(args: PropertyNode[]): Record<string, GeometryParamValue> {
    const params: Record<string, GeometryParamValue> = {};
    for (const arg of args) {
      params[arg.name] = this.resolveGeometryParamValue(arg.value);
    }
    return params;
  }

  /** `LAYOUT <target> AS <STRATEGY>(...)` -> SET_LAYOUT_STRATEGY + COMPUTE_LAYOUT. */
  private generateLayoutStatement(node: LayoutStatementNode): void {
    const targetId = node.target.name;
    this.layoutTracker.markExplicit(targetId);

    this.emit({
      action: 'SET_LAYOUT_STRATEGY',
      targetId,
      strategy: node.strategy as LayoutStrategyName,
      params: this.paramsFromNamedArgs(node.args),
    } as SetLayoutStrategyInstruction);

    this.emit({
      action: 'COMPUTE_LAYOUT',
      targetId,
    } as ComputeLayoutInstruction);
  }

  /** `CAMERA FOCUS(...) | AUTO_FIT | ORBIT(...) | POSITION(...)` -> SET_CAMERA. */
  private generateCameraStatement(node: CameraStatementNode): void {
    const params: SetCameraInstruction['params'] = {};

    if (node.mode === 'FOCUS' && node.target) {
      // A tree is framed by its anchor (`bt:<tree>`), which the runtime keeps at the tree's top-left.
      params.targetId =
        node.target.type === 'IdentifierNode' && this.treeNames.has(node.target.name)
          ? `bt:${node.target.name}`
          : this.resolveStaticObjectId(node.target);
    } else if (node.mode === 'ORBIT' && node.args) {
      params.speed = this.evaluateExpressionNumber(node.args[0]);
    } else if (node.mode === 'POSITION' && node.args) {
      params.x = this.evaluateExpressionNumber(node.args[0]);
      params.y = this.evaluateExpressionNumber(node.args[1]);
      params.z = this.evaluateExpressionNumber(node.args[2]);
    }

    this.emit({
      action: 'SET_CAMERA',
      mode: node.mode,
      params,
    } as SetCameraInstruction);
  }

  /**
   * `POSITION <target> AT (x=, y=, z=)` -> SET_POSITION. Emitted at the
   * point in program order the statement appears — after whatever
   * COMPUTE_LAYOUT/SET_LAYOUT_STRATEGY instructions already exist for the
   * target, so the pin takes precedence over the strategy-computed
   * position per docs/design/aqir-geometry-spec.md §1.2/§1.3.
   */
  private generatePositionOverride(node: PositionStatementNode): void {
    const elementId = this.resolveStaticObjectId(node.target);
    const axis: { x: number | null; y: number | null; z: number | null } = { x: null, y: null, z: null };

    for (const arg of node.args) {
      const key = arg.name.toLowerCase();
      if (key === 'x' || key === 'y' || key === 'z') {
        axis[key] = this.evaluateExpressionNumber(arg.value);
      }
    }

    this.emit({
      action: 'SET_POSITION',
      elementId,
      x: axis.x,
      y: axis.y,
      z: axis.z,
    } as SetPositionInstruction);
  }

  /**
   * Backward-compat backfill (docs/design/aqir-geometry-spec.md §4): for a
   * structure with no explicit `LAYOUT` statement anywhere in the
   * sequence, synthesizes `SET_LAYOUT_STRATEGY` + `COMPUTE_LAYOUT` from the
   * spatial-syntax-spec.md §4 default table, immediately after its
   * DECLARE. A structure kind absent from the table (e.g. a lone
   * NODE/EDGE `ObjectDeclNode`) gets nothing, matching today's behavior of
   * such objects not going through a LayoutManager strategy at all.
   */
  private generateDefaultLayout(decl: VariableDeclNode): void {
    const targetId = (decl as any).name?.name as string | undefined;
    if (!targetId) return;
    if (this.layoutTracker.hasExplicitLayout(targetId)) return;

    const kind = decl.type.replace(/DeclNode$/, '').toUpperCase();
    const count = this.getInitialElementCount(decl);
    const defaultEntry = computeDefaultLayoutParams(kind, count);
    if (!defaultEntry) return;

    this.emit({
      action: 'SET_LAYOUT_STRATEGY',
      targetId,
      strategy: defaultEntry.strategy as LayoutStrategyName,
      params: defaultEntry.params,
    } as SetLayoutStrategyInstruction);

    this.emit({
      action: 'COMPUTE_LAYOUT',
      targetId,
    } as ComputeLayoutInstruction);
  }

  /** Initial element/entry count for a DECLARE node — the size input to computeDefaultLayoutParams. Dynamic growth after DECLARE (INSERT/PUSH/...) isn't reflected since the default is emitted once, at compile time. */
  private getInitialElementCount(decl: VariableDeclNode): number {
    if (decl.type === 'HashMapDeclNode') return decl.initialEntries?.length ?? 0;
    return (decl as { initialElements?: unknown[] }).initialElements?.length ?? 0;
  }

  private generateInstruction(stmt: StatementNode): void {
    switch (stmt.type) {
      case 'CompareNode': {
        const leftId = this.resolveExpressionId(stmt.left);
        const rightId = this.resolveExpressionId(stmt.right);
        this.emit({
          action: 'COMPARE_OBJECTS',
          leftId,
          rightId,
        } as CompareObjectsInstruction);
        break;
      }
      case 'SwapNode': {
        const leftId = this.resolveExpressionId(stmt.left);
        const rightId = this.resolveExpressionId(stmt.right);
        this.emit({
          action: 'SWAP_OBJECTS',
          leftId,
          rightId,
        } as SwapObjectsInstruction);

        // Update symbol map references so future reads see the new order in the array slots
        if (stmt.left.type === 'ArrayAccessNode' && stmt.right.type === 'ArrayAccessNode') {
          const leftLogical = `${stmt.left.array.name}[${(stmt.left.index as any).value}]`;
          const rightLogical = `${stmt.right.array.name}[${(stmt.right.index as any).value}]`;
          this.symbolMap.set(leftLogical, rightId);
          this.symbolMap.set(rightLogical, leftId);
        }
        break;
      }
      case 'HighlightNode':
        this.emit({
          action: 'HIGHLIGHT_OBJECT',
          targetId: this.resolveExpressionId((stmt as any).target),
          color: (stmt as any).color.value,
        } as HighlightObjectInstruction);
        break;
      case 'WaitNode':
        this.emit({
          action: 'WAIT',
        } as WaitInstruction);
        break;
      case 'RelationshipNode': {
        const rel = stmt as any;
        this.emit({
          action: 'LINK_OBJECTS',
          sourceId: this.resolveStaticObjectId(rel.source),
          targetId: this.resolveStaticObjectId(rel.target),
          directed: rel.directed,
          relationType: rel.relationType,
        } as LinkObjectsInstruction);
        break;
      }
      case 'GenericActionNode': {
        const actionNode = stmt as any;
        if (actionNode.actionName === 'FREE') {
          // `FREE temp` releases a node's memory; the operand is evaluated at
          // run time (a pointer variable or expression such as `curr.next`).
          if (actionNode.args.length !== 1) {
            throw new Error(`FREE takes exactly one node, e.g. FREE temp (line ${actionNode.pos.line}).`);
          }
          this.emit({
            action: 'LL_FREE',
            target: this.compileValue(actionNode.args[0]),
            sourceText: this.exprToString(actionNode.args[0]),
            lineNumber: actionNode.pos.line,
          } as any);
          break;
        }
        if (AQIRGenerator.GRAPH_EDITS.has(actionNode.actionName)) {
          // `ADD_EDGE g "A" "B" 4`, `ADD_EDGE g u w`: operands evaluated when the step runs.
          const first = actionNode.args[0];
          if (!first || first.type !== 'IdentifierNode' || !this.graphNames.has(first.name)) {
            throw new Error(`${actionNode.actionName} needs a declared GRAPH first, e.g. ${actionNode.actionName} g "A"${actionNode.actionName.endsWith('EDGE') ? ' "B"' : ''} (line ${actionNode.pos.line}).`);
          }
          this.emit({
            action: 'GRAPH_EDIT',
            op: actionNode.actionName,
            graph: first.name,
            args: actionNode.args.slice(1).map((a: ExpressionNode) => this.compileGraphOperand(a)),
            sourceText: `${actionNode.actionName} ${actionNode.args.map((a: ExpressionNode) => this.exprToString(a)).join(' ')}`,
            lineNumber: actionNode.pos.line,
          } as any);
          break;
        }
        const targetsArraySlot =
          actionNode.args[0]?.type === 'ArrayAccessNode' &&
          (this.arrayNames.has(actionNode.args[0].array.name) || this.linkedListNames.has(actionNode.args[0].array.name));
        const targetsList = actionNode.args[0]?.type === 'IdentifierNode' && this.linkedListNames.has(actionNode.args[0].name);
        const targetsTree = actionNode.args[0]?.type === 'IdentifierNode' && this.treeNames.has(actionNode.args[0].name);
        const targetsContainer = actionNode.args[0]?.type === 'IdentifierNode' && this.containerNames.has(actionNode.args[0].name);
        const takesValue =
          (targetsArraySlot && (actionNode.actionName === 'UPDATE' || actionNode.actionName === 'INSERT')) ||
          (targetsList && (actionNode.actionName === 'INSERT_HEAD' || actionNode.actionName === 'INSERT_TAIL')) ||
          // `INSERT t 65`, `SEARCH t key`, `DELETE t 30`
          targetsTree ||
          // `ENQUEUE q node.left`, `PUSH s curr` — a value or a node pointer
          (targetsContainer && (actionNode.actionName === 'ENQUEUE' || actionNode.actionName === 'PUSH'));
        const resolvedArgs = actionNode.args.map((arg: any, argIndex: number) => {
          // `UPDATE arr[i] total + arr[i-1]` / `INSERT_TAIL list a.val` — the
          // value is an expression the runtime evaluates when the step
          // executes, not an object reference.
          if (takesValue && argIndex > 0) return this.compileValue(arg);
          try {
            return this.resolveExpressionId(arg);
          } catch (e) {
            if (arg.type === 'ArrayAccessNode') {
              const idx = arg.index.value;
              const logicalName = `${arg.array.name}[${idx}]`;
              const newId = this.generateId();
              this.symbolMap.set(logicalName, newId);
              return newId;
            }
            if (arg.type === 'LiteralNode') return arg.value;
            return arg.name || null;
          }
        });

        let logicalParent = undefined;
        let logicalIndex = undefined;
        if (actionNode.args[0]?.type === 'ArrayAccessNode') {
          logicalParent = actionNode.args[0].array.name;
          // Only known here for a literal index; otherwise the runtime
          // computes it from the `arr#expr` reference in args[0].
          logicalIndex = actionNode.args[0].index.type === 'LiteralNode' ? actionNode.args[0].index.value : undefined;
        } else if (actionNode.args[0]?.type === 'IdentifierNode') {
          logicalParent = actionNode.args[0].name;
        }

        this.emit({
          action: 'GENERIC_ACTION',
          actionName: actionNode.actionName,
          targetId: typeof resolvedArgs[0] === 'string' && resolvedArgs[0].includes('obj_') ? resolvedArgs[0] : undefined,
          args: resolvedArgs,
          payload: { logicalParent, logicalIndex }
        } as any);
        break;
      }
      case 'SetStateNode': {
        const setStateNode = stmt as any;
        this.emit({
          action: 'SET_STATE',
          targetId: this.resolveExpressionId(setStateNode.target),
          stateName: setStateNode.stateName,
        } as SetStateInstruction);
        break;
      }
      case 'ReturnNode':
        // Inside a WHILE / LOOP / IF of a function body (checked by analyzeFunctions).
        this.generateReturn(stmt as ReturnNode);
        break;
      case 'LoopNode':
        this.generateLoop(stmt as LoopNode);
        break;
      case 'IfNode':
        this.generateIf(stmt as IfNode, (bodyStmt) => this.generateInstruction(bodyStmt));
        break;
      case 'WhileNode':
        this.generateWhile(stmt as WhileNode);
        break;
      case 'PrintNode':
        this.emit({
          action: 'PRINT',
          // A bare array name prints the whole array, e.g. `PRINT "Result:" arr`.
          parts: (stmt as PrintNode).args.map((arg) =>
            arg.type === 'IdentifierNode' && this.arrayNames.has(arg.name)
              ? ({ array: arg.name } as unknown as AQIRValue)
              : arg.type === 'IdentifierNode' && this.linkedListNames.has(arg.name)
                ? ({ list: arg.name } as unknown as AQIRValue)
                : arg.type === 'IdentifierNode' && this.treeNames.has(arg.name)
                  ? ({ tree: arg.name } as unknown as AQIRValue)
                  : arg.type === 'IdentifierNode' && this.containerNames.has(arg.name)
                    ? ({ container: arg.name } as unknown as AQIRValue)
                    : arg.type === 'IdentifierNode' && this.graphNames.has(arg.name)
                    ? ({ graph: arg.name } as unknown as AQIRValue)
                    : arg.type === 'LiteralNode' && typeof arg.value === 'string'
                      // Printed as written, even when a variable has the same name (`PRINT "top" top`).
                      ? ({ text: arg.value } as unknown as AQIRValue)
                      : this.compileValue(arg)
          ),
          lineNumber: stmt.pos.line,
        } as any);
        break;
      case 'LayoutStatementNode':
        this.generateLayoutStatement(stmt as LayoutStatementNode);
        break;
      case 'CameraStatementNode':
        this.generateCameraStatement(stmt as CameraStatementNode);
        break;
      case 'PositionStatementNode':
        this.generatePositionOverride(stmt as PositionStatementNode);
        break;
      case 'ExpressionStatementNode': {
        // VM-mode additions to the SEQUENCE grammar: `x = expr` (assignment)
        // and a bare function call (e.g. `main()`). Any other stray
        // expression statement stays a no-op, as before.
        const expr = (stmt as any).expression as ExpressionNode;
        if (!this.tryGenerateAssignment(expr) && expr.type === 'CallNode') {
          this.compileValue(expr);
        }
        break;
      }
      default:
        throw new Error(`Unknown statement type: ${(stmt as any).type}`);
    }
  }

  /**
   * LOOP i FROM start TO end ... END, compiled to a real conditional-branch
   * loop (PUSH_SCOPE, init, JUMP_IF_FALSE test, body, increment, JUMP back)
   * instead of being unrolled into `end - start` copies of the body.
   *
   * `start`/`end` are compiled via `compileValue`, so a bound need not be a
   * literal — LENGTH(arr) resolves to a literal directly (see
   * `resolveArrayLength`), and a bound that references an outer loop's
   * iterator (e.g. `LOOP j FROM 0 TO LENGTH(arr) - i - 2`, common in nested
   * sorts) compiles to a runtime expression tree instead of failing.
   */
  /** WHILE cond ... END: test at the top, body in its own scope, jump back. */
  private generateWhile(node: WhileNode): void {
    const startLabel = this.createLabel('while_start');
    const endLabel = this.createLabel('while_end');
    this.labelCurrentPC(startLabel);

    this.emitJumpIfFalse(this.compileValue(node.condition), endLabel, node.pos);

    const scopeId = this.environment.enterScope();
    this.emitPushScope(scopeId, node.pos);
    for (const bodyStmt of node.body) {
      this.generateInstruction(bodyStmt);
    }
    this.emitPopScope(node.pos);
    this.environment.exitScope();

    this.emitJump(startLabel, node.pos);
    this.labelCurrentPC(endLabel);
    this.patchJump(endLabel);
  }

  private generateLoop(node: LoopNode): void {
    const iterName = node.iterator.name;
    const startValue = this.compileValue(node.start);
    const endValue = this.compileValue(node.end);

    const scopeId = this.environment.enterScope();
    this.emitPushScope(scopeId, node.pos);
    this.environment.declareVariable(iterName, scopeId, startValue);

    this.emitSetVar(iterName, startValue, node.pos);

    // Direction is resolved at runtime rather than compile time, since a
    // bound built from a non-literal expression (e.g. `LOOP j FROM
    // LENGTH(arr) - 1 TO 0`) can't be compared until the value is known.
    // `stepVar` becomes +1/-1 (JS coerces the `<=` boolean to 0/1 under
    // arithmetic), and `(iter - end) * step <= 0` is a single condition
    // that reads correctly for either direction: ascending (step=1) it's
    // `iter <= end`; descending (step=-1) it's `iter >= end`.
    const stepVar = `__loop_step_${this.tempCounter++}`;
    this.emitSetVar(
      stepVar,
      { op: '-', left: { op: '*', left: { op: '<=', left: startValue, right: endValue }, right: 2 }, right: 1 },
      node.pos
    );

    const startLabel = this.createLabel('loop_start');
    const endLabel = this.createLabel('loop_end');
    this.labelCurrentPC(startLabel);

    const condition = {
      op: '<=',
      left: { op: '*', left: { op: '-', left: iterName, right: endValue }, right: stepVar },
      right: 0,
    };
    this.emitJumpIfFalse(condition, endLabel, node.pos);

    for (const bodyStmt of node.body) {
      this.generateInstruction(bodyStmt);
    }

    this.emitSetVar(iterName, { op: '+', left: iterName, right: stepVar }, node.pos);
    this.emitJump(startLabel, node.pos);

    this.labelCurrentPC(endLabel);
    this.patchJump(endLabel);
    this.emitPopScope(node.pos);
    this.environment.exitScope();
  }

  /**
   * Translates an AST expression representing an object reference into its stable ID.
   *
   * When the expression is `arr[i]` and `i` is not a compile-time literal
   * (e.g. a LOOP iterator, now that loops are no longer unrolled), the
   * concrete object id can't be resolved at compile time — this returns a
   * symbolic placeholder (`arrayName#i`) instead of throwing, for a future
   * runtime dynamic-index resolver (Phase 2) to interpret. Static indices
   * resolve exactly as before.
   */
  /**
   * Like resolveExpressionId, but a literal `arr[2]` yields the declared
   * element's object id rather than a runtime slot reference — for
   * geometry/linking statements (POSITION, CAMERA FOCUS, LINK) that the VM
   * or relationship layer applies to a fixed object id.
   */
  private resolveStaticObjectId(expr: ExpressionNode): string {
    if (expr.type === 'ArrayAccessNode' && expr.index.type === 'LiteralNode') {
      const id = this.symbolMap.get(`${expr.array.name}[${expr.index.value}]`);
      if (id) return id;
    }
    return this.resolveExpressionId(expr);
  }

  private resolveExpressionId(expr: ExpressionNode): string {
    if (expr.type === 'ArrayAccessNode') {
      const indexExpr = expr.index;
      if (indexExpr.type === 'LiteralNode') {
        const idx = indexExpr.value;
        const logicalName = `${expr.array.name}[${idx}]`;
        // A linked list's `list[i]` is whatever node is i hops from the head
        // when the statement runs — resolved (and bounds-checked) at run time.
        if (this.linkedListNames.has(expr.array.name)) return `${expr.array.name}#${idx}`;
        const id = this.symbolMap.get(logicalName);
        if (!id && this.growableArrays.has(expr.array.name) && typeof idx === 'number' && idx >= 0) {
          // May exist by the time this runs; the runtime reports it if not.
          return `${expr.array.name}#${idx}`;
        }
        if (!id) {
          const declaredLength = this.resolveArrayLength(expr.array.name);
          throw new OutOfBoundsError(typeof idx === 'boolean' ? String(idx) : (idx ?? 'NULL'), declaredLength, expr.array.name, {
            line: expr.pos.line,
            column: expr.pos.column,
          });
        }
        // Array slots are resolved at runtime by logical index: INSERT,
        // DELETE and SWAP move elements between slots, so the object that
        // held `arr[2]` at declaration time is not necessarily there later.
        if (this.arrayNames.has(expr.array.name)) return `${expr.array.name}#${idx}`;
        return id;
      }
      if (this.arrayNames.has(expr.array.name) || this.linkedListNames.has(expr.array.name)) {
        // Any index expression (e.g. `arr[hi - 1]`, `arr[(lo + hi) / 2]`) is
        // shipped as its compiled VM value, JSON-encoded when structured, so
        // the runtime evaluates it with the same evaluator as IF conditions.
        const compiled = this.compileValue(indexExpr);
        const encoded = compiled !== null && typeof compiled === 'object' ? JSON.stringify(compiled) : String(compiled);
        return `${expr.array.name}#${encoded}`;
      }
      // The index depends on a runtime-only value (a LOOP iterator or an
      // expression built from one, e.g. `arr[j+1]`) — no concrete object id
      // exists at compile time. Return a symbolic placeholder for a future
      // runtime dynamic-index resolver (Phase 2) to interpret.
      return `${expr.array.name}#${this.stringifyIndexExpr(indexExpr)}`;
    }

    if (expr.type === 'IdentifierNode') {
      const logicalName = expr.name;
      const id = this.symbolMap.get(logicalName);
      // For dynamic tree nodes that are implicitly created (e.g. ROOT CEO), they won't be in the symbolMap yet.
      // Fallback to their logicalName (a pointer variable such as `curr` is
      // likewise resolved to the node it holds at run time).
      return id || logicalName;
    }

    if (expr.type === 'MemberAccessNode') {
      // `HIGHLIGHT curr.next`, `COMPARE slow fast.next`: which node this is
      // is only known at run time — ship the compiled expression.
      return `@expr:${JSON.stringify(this.compileValue(expr))}`;
    }

    throw new Error(`Invalid object reference in instruction`);
  }

  /** Renders a runtime-only index expression (e.g. `j+1`) as a compact symbolic string for `resolveExpressionId`'s placeholder. */
  private stringifyIndexExpr(expr: ExpressionNode): string {
    if (expr.type === 'LiteralNode') return String(expr.value);
    if (expr.type === 'IdentifierNode') return expr.name;
    if (expr.type === 'BinaryOpNode') {
      return `${this.stringifyIndexExpr(expr.left)}${expr.operator}${this.stringifyIndexExpr(expr.right)}`;
    }
    if ((expr as any).type === 'GenericActionNode' && (expr as any).actionName === 'LENGTH') {
      const arrayName = ((expr as any).args[0] as any).name;
      return String(this.resolveArrayLength(arrayName));
    }
    if (expr.type === 'MemberAccessNode') {
      return `${this.stringifyIndexExpr(expr.object)}.${expr.member}`;
    }
    throw new Error(`Cannot resolve array index expression at compile time: ${JSON.stringify(expr)}`);
  }

  /**
   * For evaluating literal numbers at compile time (like loop bounds or array indices)
   */
  private evaluateExpressionNumber(expr: ExpressionNode): number {
    if (expr.type === 'LiteralNode') {
      if (typeof expr.value === 'number') return expr.value;
      return parseFloat(expr.value as string);
    }
    if (expr.type === 'IdentifierNode') {
      throw new Error(`Undefined variable or loop iterator: ${expr.name}. The Optimizer should have evaluated this.`);
    }
    if ((expr as any).type === 'GenericActionNode' && (expr as any).actionName === 'LENGTH') {
      throw new Error(`LENGTH macro should have been evaluated by Optimizer.`);
    }
    if (expr.type === 'ArrayAccessNode') {
      throw new Error(`Array values should have been resolved by Optimizer`);
    }
    if (expr.type === 'BinaryOpNode') {
      const left = this.evaluateExpressionNumber(expr.left);
      const right = this.evaluateExpressionNumber(expr.right);
      if (expr.operator === '+') return left + right;
      if (expr.operator === '-') return left - right;
      if (expr.operator === '>') return left > right ? 1 : 0;
      if (expr.operator === '<') return left < right ? 1 : 0;
      if (expr.operator === '=') return left === right ? 1 : 0;
    }
    throw new Error(`Compiler cannot currently statically evaluate non-literal expressions like: ${JSON.stringify(expr)}`);
  }
}
