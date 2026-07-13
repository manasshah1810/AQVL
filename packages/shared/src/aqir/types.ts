export interface AQIRProgram {
  version: string;
  scene: string;
  objects: AQIRObject[];
  instructions: AQIRInstruction[];
}

// Objects represent initial runtime states.
export interface AQIRObject {
  id: string;
  type: 'ARRAY_ELEMENT' | 'SCALAR' | 'COLOR';
  logicalParent?: string; // e.g. "arr"
  logicalIndex?: number;  // e.g. 0
  value: any;
  label?: string;
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

// Action: LOOP
export interface LoopInstruction extends AQIRInstruction {
  action: 'LOOP';
  iterator: string;
  start: number; // Simplified to number since compiler should evaluate constants if possible
  end: number;
  body: AQIRInstruction[];
}
