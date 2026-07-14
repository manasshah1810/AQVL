export interface AQIRProgram {
  version: string;
  scene: string;
  objects: AQIRObject[];
  instructions: AQIRInstruction[];
}

// Objects represent initial runtime states.
export interface AQIRObject {
  id: string;
  type: 'ARRAY_ELEMENT' | 'SCALAR' | 'COLOR' | 'NODE' | 'EDGE' | 'POINTER' | 'ARRAY' | 'STACK' | 'QUEUE' | 'GRAPH' | 'VERTEX' | 'GRAPH_EDGE' | 'TREE' | 'TREE_NODE' | 'LABEL' | 'ANNOTATION' | string;
  logicalParent?: string; // e.g. "arr"
  logicalIndex?: number;  // e.g. 0
  value?: any;
  args?: any[]; // for storing structural arguments like targets of an edge
  label?: string;
  properties?: Record<string, any>;
}

// Base Instruction
export interface AQIRInstruction {
  action: string;
}

// Action: COMPARE_OBJECTS
export interface CompareObjectsInstruction extends AQIRInstruction {
  action: 'COMPARE_OBJECTS';
  leftId: string;
  rightId: string;
}

// Action: SWAP_OBJECTS
export interface SwapObjectsInstruction extends AQIRInstruction {
  action: 'SWAP_OBJECTS';
  leftId: string;
  rightId: string;
}

// Action: HIGHLIGHT_OBJECT
export interface HighlightObjectInstruction extends AQIRInstruction {
  action: 'HIGHLIGHT_OBJECT';
  targetId: string;
  color: string;
}

// Action: WAIT
export interface WaitInstruction extends AQIRInstruction {
  action: 'WAIT';
}

// Action: LINK_OBJECTS
export interface LinkObjectsInstruction extends AQIRInstruction {
  action: 'LINK_OBJECTS';
  sourceId: string;
  targetId: string;
  directed: boolean;
  relationType?: string;
}

// Action: LOOP
export interface LoopInstruction extends AQIRInstruction {
  action: 'LOOP';
  iterator: string;
  start: number; // Simplified to number since compiler should evaluate constants if possible
  end: number;
  body: AQIRInstruction[];
}

// Action: GENERIC_ACTION
export interface GenericActionInstruction extends AQIRInstruction {
  action: 'GENERIC_ACTION';
  actionName: string;
  targetId?: string;
  args: any[];
}

// Action: SET_STATE
export interface SetStateInstruction extends AQIRInstruction {
  action: 'SET_STATE';
  targetId: string;
  stateName: string;
}

// Action: UPDATE_LAYOUT
export interface UpdateLayoutInstruction extends AQIRInstruction {
  action: 'UPDATE_LAYOUT';
}

