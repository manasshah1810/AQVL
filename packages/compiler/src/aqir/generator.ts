import {
  ProgramNode,
  SceneNode,
  StatementNode,
  ExpressionNode,
  DeclareBlockNode,
  SequenceBlockNode,
  VariableDeclNode,
  ArrayDeclNode,
  LoopNode,
  WaitNode,
} from '../ast/types';
import type {
  AQIRProgram,
  AQIRObject,
  AQIRInstruction,
  CompareObjectsInstruction,
  SwapObjectsInstruction,
  HighlightObjectInstruction,
  LoopInstruction,
  WaitInstruction,
} from '@aqvl/shared';

export class AQIRGenerator {
  private objectIdCounter = 0;
  // Maps logical identifier (e.g. "arr[0]") to physical object ID (e.g. "obj_001")
  private symbolMap = new Map<string, string>();
  private generatedObjects: AQIRObject[] = [];

  private generateId(): string {
    const id = `obj_${String(this.objectIdCounter).padStart(3, '0')}`;
    this.objectIdCounter++;
    return id;
  }

  public generate(program: ProgramNode): AQIRProgram {
    this.objectIdCounter = 0;
    this.symbolMap.clear();
    this.generatedObjects = [];

    // Since v1 assumes one scene per program, we extract the first one
    const scene = program.scenes[0];
    const instructions = this.generateSceneInstructions(scene);

    return {
      version: "0.1",
      scene: scene.name.name,
      objects: this.generatedObjects,
      instructions,
    };
  }

  private generateSceneInstructions(scene: SceneNode): AQIRInstruction[] {
    if (scene.declarations) {
      this.processDeclarations(scene.declarations);
    }
    
    if (scene.sequence) {
      return this.generateSequence(scene.sequence);
    }
    
    return [];
  }

  private processDeclarations(declareBlock: DeclareBlockNode): void {
    for (const v of declareBlock.variables) {
      if (v.type === 'ArrayDeclNode') {
        const arr = v as ArrayDeclNode;
        const elements = arr.initialElements || [];
        
        for (let i = 0; i < elements.length; i++) {
          const id = this.generateId();
          this.symbolMap.set(`${arr.name.name}[${i}]`, id);
          
          this.generatedObjects.push({
            id,
            type: 'ARRAY_ELEMENT',
            logicalParent: arr.name.name,
            logicalIndex: i,
            value: elements[i].value,
            label: `${arr.name.name}[${i}]`,
          });
        }
      }
    }
  }

  private generateSequence(sequenceBlock: SequenceBlockNode): AQIRInstruction[] {
    const instructions: AQIRInstruction[] = [];
    for (const stmt of sequenceBlock.statements) {
      const generated = this.generateInstruction(stmt);
      if (generated) instructions.push(generated);
    }
    return instructions;
  }

  private generateInstruction(stmt: StatementNode): AQIRInstruction | null {
    switch (stmt.type) {
      case 'CompareNode': {
        const leftId = this.resolveExpressionId(stmt.left);
        const rightId = this.resolveExpressionId(stmt.right);
        return {
          action: 'COMPARE_OBJECTS',
          leftId,
          rightId,
        } as CompareObjectsInstruction;
      }
      case 'SwapNode': {
        const leftId = this.resolveExpressionId(stmt.left);
        const rightId = this.resolveExpressionId(stmt.right);
        return {
          action: 'SWAP_OBJECTS',
          leftId,
          rightId,
        } as SwapObjectsInstruction;
      }
      case 'HighlightNode':
        return {
          action: 'HIGHLIGHT_OBJECT',
          targetId: this.resolveExpressionId(stmt.target),
          color: stmt.color.value,
        } as HighlightObjectInstruction;
      case 'WaitNode':
        return {
          action: 'WAIT',
        } as WaitInstruction;
      case 'LoopNode':
        // Minimal theoretical support for loop AST -> AQIR representation
        return {
          action: 'LOOP',
          iterator: stmt.iterator.name,
          start: this.evaluateExpressionNumber(stmt.start),
          end: this.evaluateExpressionNumber(stmt.end),
          body: stmt.body.map((b) => this.generateInstruction(b)).filter(Boolean) as AQIRInstruction[],
        } as LoopInstruction;
      case 'ExpressionStatementNode':
        return null;
      default:
        throw new Error(`Unknown statement type: ${(stmt as any).type}`);
    }
  }

  /**
   * Translates an AST expression representing an object reference into its stable ID.
   */
  private resolveExpressionId(expr: ExpressionNode): string {
    if (expr.type === 'ArrayAccessNode') {
      const idx = this.evaluateExpressionNumber(expr.index);
      const logicalName = `${expr.array.name}[${idx}]`;
      const id = this.symbolMap.get(logicalName);
      if (!id) throw new Error(`Reference Error: Unknown object ${logicalName}`);
      return id;
    }
    
    if (expr.type === 'IdentifierNode') {
      const logicalName = expr.name;
      const id = this.symbolMap.get(logicalName);
      if (!id) throw new Error(`Reference Error: Unknown object ${logicalName}`);
      return id;
    }

    throw new Error(`Invalid object reference in instruction`);
  }

  /**
   * For evaluating literal numbers at compile time (like loop bounds or array indices)
   */
  private evaluateExpressionNumber(expr: ExpressionNode): number {
    if (expr.type === 'LiteralNode') {
      if (typeof expr.value === 'number') return expr.value;
      return parseFloat(expr.value as string);
    }
    throw new Error(`Compiler cannot currently statically evaluate non-literal expressions`);
  }
}
