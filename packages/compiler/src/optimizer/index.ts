import {
  ProgramNode,
  SceneNode,
  StatementNode,
  ExpressionNode,
  SequenceBlockNode,
  LoopNode,
  IfNode,
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

export class Optimizer {
  private env = new Map<string, number>();
  private arraySimulations = new Map<string, number[]>();

  public optimize(ast: ProgramNode, userInputs: Record<string, any> = {}): ProgramNode {
    this.env.clear();
    this.arraySimulations.clear();

    const optimizedScenes: SceneNode[] = [];

    for (const scene of ast.scenes) {
      if (scene.declarations) {
        // Track variable states for simulation
        for (const v of scene.declarations.variables) {
          if (v.type === 'ArrayDeclNode') {
            const arr = v as ArrayDeclNode;
            let elements = arr.initialElements ? arr.initialElements.map(e => e.value as number) : [];
            if (userInputs[arr.name.name] && Array.isArray(userInputs[arr.name.name])) {
              elements = [...userInputs[arr.name.name]];
            }
            this.env.set(`LENGTH(${arr.name.name})`, elements.length);
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
        const loop = stmt as LoopNode;
        const start = this.evaluateExpressionNumber(loop.start);
        const end = this.evaluateExpressionNumber(loop.end);
        
        const iterName = loop.iterator.name;
        const previousValue = this.env.get(iterName);
        
        const step = start <= end ? 1 : -1;
        for (let i = start; start <= end ? i <= end : i >= end; i += step) {
          this.env.set(iterName, i);
          for (const bodyStmt of loop.body) {
            this.expandStatement(bodyStmt, out);
          }
        }
        
        if (previousValue !== undefined) this.env.set(iterName, previousValue);
        else this.env.delete(iterName);
        break;
      }
      
      case 'IfNode': {
        const ifNode = stmt as IfNode;
        const condition = this.evaluateExpressionNumber(ifNode.condition);
        if (condition > 0) {
          for (const bodyStmt of ifNode.body) {
            this.expandStatement(bodyStmt, out);
          }
        }
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
            color: action.args[1] ? { type: 'LiteralNode', dataType: 'color', value: (action.args[1] as LiteralNode).value as string, pos: action.pos } : { type: 'LiteralNode', dataType: 'color', value: 'red', pos: action.pos }
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
      const idx = this.evaluateExpressionNumber(expr.index);
      return {
        ...expr,
        index: { type: 'LiteralNode', dataType: 'number', value: idx, pos: expr.index.pos } as LiteralNode
      };
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
}
