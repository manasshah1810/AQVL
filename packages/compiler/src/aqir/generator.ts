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
  TrieDeclNode,
  GraphDeclNode,
  LoopNode,
  IfNode,
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
  LinkObjectsInstruction,
  GenericActionInstruction,
  SetStateInstruction,
} from '@aqvl/shared';

export class AQIRGenerator {
  private objectIdCounter = 0;
  // Maps logical identifier (e.g. "arr[0]") to physical object ID (e.g. "obj_001")
  private symbolMap = new Map<string, string>();
  private generatedObjects: AQIRObject[] = [];
  
  // Environment for tracking loop iterators and array lengths during unrolling
  // private env = new Map<string, number>();

  private generateId(): string {
    const id = `obj_${String(this.objectIdCounter).padStart(3, '0')}`;
    this.objectIdCounter++;
    return id;
  }

  public generate(program: ProgramNode, userInputs: Record<string, any> = {}): AQIRProgram {
    this.objectIdCounter = 0;
    this.symbolMap.clear();
    this.generatedObjects = [];

    // Since v1 assumes one scene per program, we extract the first one
    const scene = program.scenes[0];
    const instructions = this.generateSceneInstructions(scene, userInputs);

    return {
      version: "0.1",
      scene: scene.name.name,
      objects: this.generatedObjects,
      instructions,
    };
  }

  private generateSceneInstructions(scene: SceneNode, userInputs: Record<string, any>): AQIRInstruction[] {
    if (scene.declarations) {
      this.processDeclarations(scene.declarations, userInputs);
    }
    
    if (scene.sequence) {
      return this.generateSequence(scene.sequence);
    }
    
    return [];
  }

  private processDeclarations(declareBlock: DeclareBlockNode, userInputs: Record<string, any>): void {
    for (const v of declareBlock.variables) {
      if (v.type === 'ArrayDeclNode') {
        const arr = v as ArrayDeclNode;
        let elements = arr.initialElements ? arr.initialElements.map(e => e.value) : [];
        
        // Override with user input if provided
        if (userInputs[arr.name.name] && Array.isArray(userInputs[arr.name.name])) {
          elements = userInputs[arr.name.name];
        }
        
        // this.env.set(`LENGTH(${arr.name.name})`, elements.length);
        
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
        
        this.generatedObjects.push({
          id: headId,
          type: 'sphere',
          originalType: 'HEAD',
          logicalParent: list.name.name,
          value: 'HEAD',
          label: 'HEAD',
          color: '#ff6b6b' // Distinct red color for boundary
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
        
        this.generatedObjects.push({
          id: nullId,
          type: 'sphere',
          originalType: 'NULL',
          logicalParent: list.name.name,
          value: 'NULL',
          label: 'NULL',
          color: '#ff6b6b' // Distinct red color for boundary
        });

        // Generate NEXT edges
        let prevId = headId;
        for (let i = 0; i < nodeIds.length; i++) {
          this.generatedObjects.push({
            id: this.generateId(),
            type: 'EDGE',
            logicalParent: list.name.name,
            args: [prevId, nodeIds[i]],
            properties: { directed: true, forward: true }
          });
          prevId = nodeIds[i];
        }
        
        // Link last node to NULL
        this.generatedObjects.push({
          id: this.generateId(),
          type: 'EDGE',
          logicalParent: list.name.name,
          args: [prevId, nullId],
          properties: { directed: true, forward: true }
        });
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
        let elements = tree.initialElements ? tree.initialElements.map(e => e.value) : [];
        if (userInputs[tree.name.name] && Array.isArray(userInputs[tree.name.name])) {
          elements = userInputs[tree.name.name];
        }
        
        // this.env.set(`LENGTH(${tree.name.name})`, elements.length);
        
        const nodeIds: string[] = [];
        for (let i = 0; i < elements.length; i++) {
          if (elements[i] !== null && elements[i] !== undefined) {
            const id = this.generateId();
            nodeIds[i] = id;
            this.symbolMap.set(`${tree.name.name}[${i}]`, id);
            
            this.generatedObjects.push({
              id,
              type: 'TREE_NODE',
              logicalParent: tree.name.name,
              logicalIndex: i,
              value: elements[i],
              label: `${tree.name.name}[${i}]`,
            });
          }
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
              logicalParent: tree.name.name,
              args: [nodeIds[i], nodeIds[leftChildIdx]],
              properties: { directed: true, label: 'L' }
            });
          }
          if (rightChildIdx < nodeIds.length && nodeIds[rightChildIdx]) {
            this.generatedObjects.push({
              id: this.generateId(),
              type: 'EDGE',
              logicalParent: tree.name.name,
              args: [nodeIds[i], nodeIds[rightChildIdx]],
              properties: { directed: true, label: 'R' }
            });
          }
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
      } else if (v.type === 'TrieDeclNode') {
        const trie = v as TrieDeclNode;
        let words = trie.initialElements ? trie.initialElements.map((e: any) => e.value as string) : [];
        if (userInputs[trie.name.name] && Array.isArray(userInputs[trie.name.name])) {
          words = userInputs[trie.name.name];
        }
        
        // this.env.set(`LENGTH(${trie.name.name})`, words.length);

        const rootId = this.generateId();
        this.symbolMap.set(trie.name.name, rootId);
        
        this.generatedObjects.push({
          id: rootId,
          type: 'TRIE_NODE',
          logicalParent: trie.name.name,
          value: '',
          label: '',
        });

        const pathMap = new Map<string, string>();
        pathMap.set('', rootId);
        
        for (const word of words) {
          let currentPath = '';
          let parentId = rootId;
          
          for (let i = 0; i < word.length; i++) {
            const char = word[i];
            currentPath += char;
            
            if (!pathMap.has(currentPath)) {
              const charId = this.generateId();
              pathMap.set(currentPath, charId);
              
              this.symbolMap.set(`${trie.name.name}["${currentPath}"]`, charId);
              
              this.generatedObjects.push({
                id: charId,
                type: 'TRIE_NODE',
                logicalParent: trie.name.name,
                value: char,
                label: currentPath,
              });
              
              this.generatedObjects.push({
                id: this.generateId(),
                type: 'EDGE',
                logicalParent: trie.name.name,
                args: [parentId, charId],
                properties: { directed: true }
              });
            }
            
            parentId = pathMap.get(currentPath)!;
          }
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

        this.generatedObjects.push({
          id,
          type: obj.objectType,
          label: obj.name.name,
          args,
          ...(Object.keys(properties).length > 0 ? { properties } : {}),
        });
      }
    }
  }

  private generateSequence(sequenceBlock: SequenceBlockNode): AQIRInstruction[] {
    const instructions: AQIRInstruction[] = [];
    for (const stmt of sequenceBlock.statements) {
      this.generateInstruction(stmt, instructions);
    }
    return instructions;
  }

  private generateInstruction(stmt: StatementNode, outInstructions: AQIRInstruction[]): void {
    switch (stmt.type) {
      case 'CompareNode': {
        const leftId = this.resolveExpressionId(stmt.left);
        const rightId = this.resolveExpressionId(stmt.right);
        outInstructions.push({
          action: 'COMPARE_OBJECTS',
          leftId,
          rightId,
        } as CompareObjectsInstruction);
        break;
      }
      case 'SwapNode': {
        const leftId = this.resolveExpressionId(stmt.left);
        const rightId = this.resolveExpressionId(stmt.right);
        outInstructions.push({
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
        outInstructions.push({
          action: 'HIGHLIGHT_OBJECT',
          targetId: this.resolveExpressionId((stmt as any).target),
          color: (stmt as any).color.value,
        } as HighlightObjectInstruction);
        break;
      case 'WaitNode':
        outInstructions.push({
          action: 'WAIT',
        } as WaitInstruction);
        break;
      case 'RelationshipNode': {
        const rel = stmt as any;
        outInstructions.push({
          action: 'LINK_OBJECTS',
          sourceId: this.resolveExpressionId(rel.source),
          targetId: this.resolveExpressionId(rel.target),
          directed: rel.directed,
          relationType: rel.relationType,
        } as LinkObjectsInstruction);
        break;
      }
      case 'GenericActionNode': {
        const actionNode = stmt as any;
        const resolvedArgs = actionNode.args.map((arg: any) => {
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
          logicalIndex = actionNode.args[0].index.value;
        } else if (actionNode.args[0]?.type === 'IdentifierNode') {
          logicalParent = actionNode.args[0].name;
        }

        outInstructions.push({
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
        outInstructions.push({
          action: 'SET_STATE',
          targetId: this.resolveExpressionId(setStateNode.target),
          stateName: setStateNode.stateName,
        } as SetStateInstruction);
        break;
      }
      case 'LoopNode': 
        throw new Error('LoopNode should have been unrolled by Optimizer.');
      case 'IfNode':
        throw new Error('IfNode should have been flattened by Optimizer.');
      case 'ExpressionStatementNode':
        break;
      default:
        throw new Error(`Unknown statement type: ${(stmt as any).type}`);
    }
  }

  /**
   * Translates an AST expression representing an object reference into its stable ID.
   */
  private resolveExpressionId(expr: ExpressionNode): string {
    if (expr.type === 'ArrayAccessNode') {
      const idx = (expr.index as any).value;
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
