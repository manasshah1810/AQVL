import {
  ProgramNode,
  SceneNode,
  StatementNode,
  ExpressionNode,
  SequenceBlockNode,
  LoopNode,
  IfNode,
  WhileNode,
  CompareNode,
  SwapNode,
  RelationshipNode,
  GenericActionNode,
  SetStateNode,
  HighlightNode,
  LiteralNode,
  ArrayAccessNode,
  IdentifierNode,
  BinaryOpNode,
  ArrayDeclNode
} from '../ast/types';
import { AQIROpcode } from '../aqir/InstructionSet';
import type { JumpInstruction, JumpIfFalseInstruction } from '../aqir/InstructionSet';
import type { VMInstruction } from '../aqir/types';

export class Optimizer {
  private env = new Map<string, number>();
  private arraySimulations = new Map<string, number[]>();

  public optimize(ast: ProgramNode, userInputs: Record<string, any> = {}): ProgramNode {
    this.env.clear();
    this.arraySimulations.clear();

    const optimizedScenes: SceneNode[] = [];

    for (const scene of ast.scenes) {
      const resized = new Set<string>();
      if (scene.sequence) Optimizer.collectResizedArrays(scene.sequence.statements, resized);
      if (scene.declarations) {
        // Track variable states for simulation
        for (const v of scene.declarations.variables) {
          if (v.type === 'ArrayDeclNode') {
            const arr = v as ArrayDeclNode;
            let elements = arr.initialElements ? arr.initialElements.map(e => e.value as number) : [];
            if (userInputs[arr.name.name] && Array.isArray(userInputs[arr.name.name])) {
              elements = [...userInputs[arr.name.name]];
            }
            // An array that INSERT/DELETE resize has no compile-time length:
            // leave LENGTH(arr) for the runtime to evaluate.
            if (!resized.has(arr.name.name)) {
              this.env.set(`LENGTH(${arr.name.name})`, elements.length);
            }
            this.arraySimulations.set(arr.name.name, elements);
          }
          // We can add tracking for other types here if needed for if-conditions
        }
      }

      let optimizedSequence = scene.sequence;
      if (scene.sequence) {
        optimizedSequence = this.expandSequence(scene.sequence);
      }

      optimizedScenes.push({
        ...scene,
        sequence: optimizedSequence
      });
    }

    return {
      ...ast,
      scenes: optimizedScenes
    };
  }

  /** Names of arrays targeted by INSERT / DELETE anywhere in `statements` (recursing into blocks). */
  private static collectResizedArrays(statements: StatementNode[], out: Set<string>): void {
    for (const stmt of statements) {
      const any = stmt as any;
      if (stmt.type === 'GenericActionNode' && (any.actionName === 'INSERT' || any.actionName === 'DELETE')
          && any.args[0]?.type === 'ArrayAccessNode') {
        out.add(any.args[0].array.name);
      }
      if (Array.isArray(any.body)) Optimizer.collectResizedArrays(any.body, out);
      if (Array.isArray(any.elseBody)) Optimizer.collectResizedArrays(any.elseBody, out);
    }
  }

  private expandSequence(sequence: SequenceBlockNode): SequenceBlockNode {
    const flattenedStatements: StatementNode[] = [];
    for (const stmt of sequence.statements) {
      this.expandStatement(stmt, flattenedStatements);
    }
    return {
      ...sequence,
      statements: flattenedStatements
    };
  }

  private expandStatement(stmt: StatementNode, out: StatementNode[]): void {
    switch (stmt.type) {
      case 'LoopNode': {
        // No longer unrolled: the generator compiles LOOP directly to a
        // JUMP_IF_FALSE/JUMP branch, so this pass only constant-folds the
        // bounds (e.g. LENGTH(arr), literal arithmetic) when possible and
        // recurses into the body once — it does not duplicate it per
        // iteration, and it does not bind the iterator into `this.env`
        // (nothing inside the body can be evaluated against a concrete
        // iterator value anymore; see resolveToConcreteExpression's
        // try/catch fallback for array-index folding).
        const loop = stmt as LoopNode;
        const start = this.tryFoldToLiteral(loop.start);
        const end = this.tryFoldToLiteral(loop.end);

        const bodyOut: StatementNode[] = [];
        for (const bodyStmt of loop.body) {
          this.expandStatement(bodyStmt, bodyOut);
        }

        out.push({ ...loop, start, end, body: bodyOut });
        break;
      }

      case 'WhileNode': {
        // Compiled to a runtime branch like LOOP; only the body is optimized.
        const whileNode = stmt as WhileNode;
        const bodyOut: StatementNode[] = [];
        for (const bodyStmt of whileNode.body) {
          this.expandStatement(bodyStmt, bodyOut);
        }
        out.push({ ...whileNode, body: bodyOut });
        break;
      }

      case 'IfNode': {
        // No longer statically evaluated/inlined: the generator compiles IF
        // directly to a JUMP_IF_FALSE branch over the (possibly runtime-only)
        // condition, so both branches are kept and only their bodies are
        // recursively optimized.
        const ifNode = stmt as IfNode;

        const bodyOut: StatementNode[] = [];
        for (const bodyStmt of ifNode.body) {
          this.expandStatement(bodyStmt, bodyOut);
        }

        let elseBodyOut: StatementNode[] | undefined;
        if (ifNode.elseBody) {
          elseBodyOut = [];
          for (const bodyStmt of ifNode.elseBody) {
            this.expandStatement(bodyStmt, elseBodyOut);
          }
        }

        out.push({ ...ifNode, body: bodyOut, elseBody: elseBodyOut });
        break;
      }

      case 'CompareNode': {
        const compare = stmt as CompareNode;
        out.push({
          ...compare,
          left: this.resolveToConcreteExpression(compare.left),
          right: this.resolveToConcreteExpression(compare.right)
        });
        break;
      }
      
      case 'SwapNode': {
        const swap = stmt as SwapNode;
        const leftExpr = this.resolveToConcreteExpression(swap.left);
        const rightExpr = this.resolveToConcreteExpression(swap.right);
        
        out.push({
          ...swap,
          left: leftExpr,
          right: rightExpr
        });
        
        // Simulate the swap to keep static evaluation correct for IF conditions
        if (leftExpr.type === 'ArrayAccessNode' && rightExpr.type === 'ArrayAccessNode') {
          const leftName = leftExpr.array.name;
          const leftIdx = (leftExpr.index as LiteralNode).value as number;
          const rightName = rightExpr.array.name;
          const rightIdx = (rightExpr.index as LiteralNode).value as number;
          
          if (this.arraySimulations.has(leftName) && this.arraySimulations.has(rightName)) {
            const arrLeft = this.arraySimulations.get(leftName)!;
            const arrRight = this.arraySimulations.get(rightName)!;
            
            const temp = arrLeft[leftIdx];
            arrLeft[leftIdx] = arrRight[rightIdx];
            arrRight[rightIdx] = temp;
          }
        }
        break;
      }

      case 'GenericActionNode': {
        const action = stmt as GenericActionNode;
        if (action.actionName === 'HIGHLIGHT') {
          out.push({
            type: 'HighlightNode',
            pos: action.pos,
            target: this.resolveToConcreteExpression(action.args[0]),
            color: action.args[1] ? { type: 'LiteralNode', dataType: 'color', value: (action.args[1] as LiteralNode).value as string, pos: action.pos } : { type: 'LiteralNode', dataType: 'color', value: 'EVALUATING', pos: action.pos }
          } as HighlightNode);
        } else {
          out.push({
            ...action,
            args: action.args.map(a => this.resolveToConcreteExpression(a))
          });
        }
        break;
      }

      case 'RelationshipNode': {
        const rel = stmt as RelationshipNode;
        out.push({
          ...rel,
          source: this.resolveToConcreteExpression(rel.source),
          target: this.resolveToConcreteExpression(rel.target)
        });
        break;
      }

      case 'SetStateNode': {
        const set = stmt as SetStateNode;
        out.push({
          ...set,
          target: this.resolveToConcreteExpression(set.target)
        });
        break;
      }

      default:
        out.push(stmt); // WaitNode, etc.
        break;
    }
  }

  private resolveToConcreteExpression(expr: ExpressionNode): ExpressionNode {
    if (expr.type === 'ArrayAccessNode') {
      try {
        const idx = this.evaluateExpressionNumber(expr.index);
        return {
          ...expr,
          index: { type: 'LiteralNode', dataType: 'number', value: idx, pos: expr.index.pos } as LiteralNode
        };
      } catch {
        // Index depends on a value only known at runtime (e.g. a LOOP
        // iterator, now that loops aren't unrolled) — leave it symbolic;
        // the generator resolves it dynamically (see resolveExpressionId).
        return expr;
      }
    }

    if (expr.type === 'IdentifierNode') {
      // It might be a variable that should be substituted, or just an object ref.
      // In AQVL, we mostly use array indices, but let's keep identifier intact for now,
      // generator will map it to symbol map.
      return expr;
    }

    if (expr.type === 'BinaryOpNode' || expr.type === 'LiteralNode' || (expr as any).type === 'GenericActionNode') {
      // Evaluate and replace with literal? Not needed unless it's the target itself.
      // Usually targets are ArrayAccess or Identifier.
      return expr;
    }

    return expr;
  }

  private evaluateExpressionNumber(expr: ExpressionNode): number {
    if (expr.type === 'LiteralNode') {
      if (typeof expr.value === 'number') return expr.value;
      return parseFloat(expr.value as string);
    }
    if (expr.type === 'IdentifierNode') {
      const val = this.env.get(expr.name);
      if (val !== undefined) return val;
      throw new Error(`Undefined variable or loop iterator: ${expr.name}`);
    }
    if ((expr as any).type === 'GenericActionNode' && (expr as any).actionName === 'LENGTH') {
      const arrayName = ((expr as any).args[0] as any).name;
      const len = this.env.get(`LENGTH(${arrayName})`);
      if (len !== undefined) return len;
      throw new Error(`Unknown array length for: ${arrayName}`);
    }
    if (expr.type === 'ArrayAccessNode') {
      const arrayName = expr.array.name;
      const idx = this.evaluateExpressionNumber(expr.index);
      const arr = this.arraySimulations.get(arrayName);
      if (arr && arr[idx] !== undefined) {
        return arr[idx];
      }
      throw new Error(`Cannot evaluate non-numeric array element at compile-time: ${arrayName}[${idx}]`);
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
    throw new Error(`Compiler cannot currently statically evaluate expression at compile time.`);
  }

  /** Constant-folds `expr` to a literal when possible (e.g. `LENGTH(arr)`, literal arithmetic); otherwise returns it unchanged. */
  private tryFoldToLiteral(expr: ExpressionNode): ExpressionNode {
    try {
      const value = this.evaluateExpressionNumber(expr);
      return { type: 'LiteralNode', dataType: 'number', value, pos: expr.pos } as LiteralNode;
    } catch {
      return expr;
    }
  }

  /**
   * Post-generation pass: strips instructions that can never execute —
   * anything between an unconditional JUMP/RET and the next instruction any
   * JUMP/JUMP_IF_FALSE actually targets, or that a CALL enters (see
   * `functionEntryPoints`) — and re-targets every remaining jump/call to
   * account for the shifted indices. Duplicate-instruction removal and
   * constant folding happen earlier, on the AST (see `optimize()` /
   * `resolveToConcreteExpression`); this is the one optimization that must
   * run after AQIRGenerator has produced a flat instruction stream, since
   * only then do JUMP/RET/CALL and their targets exist.
   *
   * `functionEntryPoints` must list every function's `startPC` (e.g.
   * `generator.getFunctionTable().all().map(f => f.startPC)`) — a function
   * body is only ever reached via CALL, never via a JUMP/JUMP_IF_FALSE
   * target, so it isn't visible from the instruction stream alone. Every
   * function in AQVL is always emitted behind a guarding JUMP (see
   * AQIRGenerator.generateSceneInstructions), so without these roots this
   * pass would treat every function body as dead code.
   */
  public removeUnreachableInstructions(
    instructions: VMInstruction[],
    functionEntryPoints: number[] = []
  ): { instructions: VMInstruction[]; remapPC: (pc: number) => number } {
    const isJump = (instr: VMInstruction): instr is JumpInstruction | JumpIfFalseInstruction =>
      (instr as any).opcode === AQIROpcode.JUMP || (instr as any).opcode === AQIROpcode.JUMP_IF_FALSE;

    const jumpTargets = new Set<number>(functionEntryPoints);
    jumpTargets.add(0);
    for (const instr of instructions) {
      if (isJump(instr)) jumpTargets.add(instr.target);
    }

    const keep: boolean[] = new Array(instructions.length).fill(true);
    let deadUntilNextTarget = false;
    for (let i = 0; i < instructions.length; i++) {
      if (jumpTargets.has(i)) deadUntilNextTarget = false;
      if (deadUntilNextTarget) keep[i] = false;

      const instr = instructions[i];
      if ((instr as any).opcode === AQIROpcode.JUMP || (instr as any).opcode === AQIROpcode.RET) {
        deadUntilNextTarget = true;
      }
    }

    const indexMap = new Map<number, number>();
    let newIndex = 0;
    instructions.forEach((_, i) => {
      if (keep[i]) indexMap.set(i, newIndex++);
    });
    // One-past-the-end is a valid fallthrough target for jumps that land after the last instruction.
    indexMap.set(instructions.length, newIndex);

    const result: VMInstruction[] = [];
    instructions.forEach((instr, i) => {
      if (!keep[i]) return;
      if (isJump(instr)) {
        const mappedTarget = indexMap.get(instr.target);
        result.push({ ...instr, target: mappedTarget ?? instr.target });
      } else {
        result.push(instr);
      }
    });

    return {
      instructions: result,
      /** Maps a pre-removal PC (e.g. a `FunctionTable` entry's `startPC`) to its post-removal index. */
      remapPC: (pc: number) => indexMap.get(pc) ?? pc,
    };
  }
}
