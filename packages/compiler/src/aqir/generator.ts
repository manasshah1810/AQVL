import {
  ProgramNode,
  SceneNode,
  StatementNode,
  ExpressionNode,
  DeclareBlockNode,
  SequenceBlockNode,
  VariableDeclNode,
  ArrayDeclNode,
  LinkedListDeclNode,
  StackDeclNode,
  QueueDeclNode,
  TreeDeclNode,
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

    // Since v1 assumes one scene per program, we extract the first one
    const scene = program.scenes[0];
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
        throw new Error(`Unsupported statement in function body: ${(stmt as any).type}`);
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
      const value = this.compileValue(expr.right);
      this.emitSetVar(expr.left.name, value, expr.pos);
      return true;
    }
    return false;
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
      case 'CallNode':
        return this.generateFunctionCall(expr as CallNode);
      case 'IdentifierNode':
        return expr.name;
      case 'LiteralNode':
        return expr.value;
      case 'BinaryOpNode':
        return {
          op: expr.operator,
          left: this.compileValue(expr.left),
          right: this.compileValue(expr.right),
        };
      case 'ArrayAccessNode':
        if (this.arrayNames.has(expr.array.name)) {
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
          if (this.arrayNames.has(arrayName)) return { len: arrayName } as unknown as AQIRValue;
          return this.resolveArrayLength(arrayName);
        }
        throw new Error(`Unsupported expression type: ${(expr as any).type}`);
    }
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
        let elements = list.initialElements ? list.initialElements.map(e => e.value) : [];
        if (userInputs[list.name.name] && Array.isArray(userInputs[list.name.name])) {
          elements = userInputs[list.name.name];
        }

        const headId = this.generateId();
        const nullId = this.generateId();
        const boundaryToken = getSemanticColorToken('AUXILIARY');

        this.generatedObjects.push({
          id: headId,
          type: 'sphere',
          originalType: 'HEAD',
          logicalParent: list.name.name,
          value: 'HEAD',
          label: 'HEAD',
          color: boundaryToken.color
        });

        const nodeIds: string[] = [];
        for (let i = 0; i < elements.length; i++) {
          const id = this.generateId();
          nodeIds.push(id);
          this.symbolMap.set(`${list.name.name}[${i}]`, id);

          this.generatedObjects.push({
            id,
            type: 'sphere',
            originalType: 'LINKEDLIST_NODE',
            logicalParent: list.name.name,
            value: elements[i],
            label: `${elements[i]}`
          });
        }

        const isCircular = list.variant === 'CIRCULAR';
        const isEmpty = nodeIds.length === 0;
        const needsNull = !isCircular || isEmpty;

        if (needsNull) {
          this.generatedObjects.push({
            id: nullId,
            type: 'sphere',
            originalType: 'NULL',
            logicalParent: list.name.name,
            value: 'NULL',
            label: 'NULL',
            color: boundaryToken.color
          });
        }

        // Generate NEXT and PREV edges
        let prevId = headId;
        for (let i = 0; i < nodeIds.length; i++) {
          this.generatedObjects.push({
            id: this.generateId(),
            type: 'EDGE',
            logicalParent: list.name.name,
            args: [prevId, nodeIds[i]],
            properties: { directed: true, forward: true }
          });

          if (list.variant === 'DOUBLY') {
            this.generatedObjects.push({
              id: this.generateId(),
              type: 'EDGE',
              logicalParent: list.name.name,
              args: [nodeIds[i], prevId],
              properties: { directed: true, backward: true }
            });
          }

          prevId = nodeIds[i];
        }

        if (isCircular && !isEmpty) {
          this.generatedObjects.push({
            id: this.generateId(),
            type: 'EDGE',
            logicalParent: list.name.name,
            args: [prevId, nodeIds[0]],
            properties: { directed: true, forward: true, circular: true }
          });
        } else {
          // Link last node to NULL
          this.generatedObjects.push({
            id: this.generateId(),
            type: 'EDGE',
            logicalParent: list.name.name,
            args: [prevId, nullId],
            properties: { directed: true, forward: true }
          });

          if (list.variant === 'DOUBLY') {
            this.generatedObjects.push({
              id: this.generateId(),
              type: 'EDGE',
              logicalParent: list.name.name,
              args: [nullId, prevId],
              properties: { directed: true, backward: true }
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
      } else if (v.type === 'BinaryTreeDeclNode') {
        const tree = v as any;
        const id = this.generateId();
        this.symbolMap.set(tree.name.name, id);

        this.generatedObjects.push({
          id,
          type: 'BINARY_TREE',
          label: tree.name.name,
        });
      } else if (v.type === 'BSTDeclNode') {
        const tree = v as any;
        const id = this.generateId();
        const bstName = tree.name.name as string;
        this.symbolMap.set(bstName, id);

        // Store the BST anchor object. logicalParent = bstName lets the runtime
        // auto-detect which tree name to use as activeTreeName.
        this.generatedObjects.push({
          id,
          type: 'BST',
          label: bstName,
          logicalParent: bstName,
        } as any);

        // Convert initialElements (e.g. BST t = [50, 30, 70]) into BST_INSERT
        // instructions prepended before the user sequence so the tree is built
        // via the proper BST insertion algorithm (maintains ordering + animations).
        let elements: number[] = tree.initialElements
          ? (tree.initialElements as any[]).map((e: any) => Number(e.value))
          : [];
        if (userInputs[bstName] && Array.isArray(userInputs[bstName])) {
          elements = userInputs[bstName] as number[];
        }
        for (const val of elements) {
          this.pendingInitInstructions.push({
            action: 'GENERIC_ACTION',
            actionName: 'BST_INSERT',
            args: [val],
            payload: { logicalParent: bstName },
          } as any);
        }
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
        const graph = v as GraphDeclNode;
        let edges = graph.initialElements ? graph.initialElements.map((e: any) => e.value as string) : [];
        if (userInputs[graph.name.name] && Array.isArray(userInputs[graph.name.name])) {
          edges = userInputs[graph.name.name];
        }

        const nodesMap = new Map<string, string>(); // name -> id

        const ensureNode = (nodeName: string) => {
          if (!nodesMap.has(nodeName)) {
            const nodeId = this.generateId();
            nodesMap.set(nodeName, nodeId);
            this.symbolMap.set(`${graph.name.name}["${nodeName}"]`, nodeId);

            this.generatedObjects.push({
              id: nodeId,
              type: 'VERTEX',
              logicalParent: graph.name.name,
              value: nodeName,
              label: nodeName,
            });
          }
          return nodesMap.get(nodeName)!;
        };

        for (const edgeStr of edges) {
          // Format: "A->B:5", "A-B:5", "A"
          const match = edgeStr.match(/^([^->:]+)(?:(-|>)([^:]+)(?::(.*))?)?$/);
          if (match) {
            const source = match[1].trim();
            const sourceId = ensureNode(source);

            if (match[3]) { // Has target
              const target = match[3].trim();
              const targetId = ensureNode(target);

              const isDirected = match[2] === '>';
              const weight = match[4] ? match[4].trim() : undefined;

              const edgeId = this.generateId();
              this.symbolMap.set(`${graph.name.name}["${source}${isDirected ? '->' : '-'}${target}"]`, edgeId);

              this.generatedObjects.push({
                id: edgeId,
                type: 'GRAPH_EDGE',
                logicalParent: graph.name.name,
                args: [sourceId, targetId],
                properties: {
                  directed: isDirected,
                  label: weight
                }
              });
            }
          }
        }
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
      params.targetId = this.resolveStaticObjectId(node.target);
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
        const targetsArraySlot =
          actionNode.args[0]?.type === 'ArrayAccessNode' && this.arrayNames.has(actionNode.args[0].array.name);
        const takesValue = targetsArraySlot && (actionNode.actionName === 'UPDATE' || actionNode.actionName === 'INSERT');
        const resolvedArgs = actionNode.args.map((arg: any, argIndex: number) => {
          // `UPDATE arr[i] total + arr[i-1]` — the value is an expression the
          // runtime evaluates when the step executes, not an object reference.
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
        const id = this.symbolMap.get(logicalName);
        if (!id && this.growableArrays.has(expr.array.name) && typeof idx === 'number' && idx >= 0) {
          // May exist by the time this runs; the runtime reports it if not.
          return `${expr.array.name}#${idx}`;
        }
        if (!id) {
          const declaredLength = this.resolveArrayLength(expr.array.name);
          throw new OutOfBoundsError(idx, declaredLength, expr.array.name, {
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
      if (this.arrayNames.has(expr.array.name)) {
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
      // Fallback to their logicalName.
      return id || logicalName;
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
