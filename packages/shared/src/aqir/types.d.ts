export interface AQIRProgram {
    scenes: AQIRScene[];
}
export interface AQIRScene {
    name: string;
    variables: AQIRVariable[];
    instructions: AQIRInstruction[];
}
export interface AQIRVariable {
    name: string;
    type: 'ARRAY' | 'SCALAR' | 'COLOR';
    initialValue?: any;
}
export interface AQIRInstruction {
    action: string;
}
export interface CompareInstruction extends AQIRInstruction {
    action: 'COMPARE';
    left: AQIRExpression;
    right: AQIRExpression;
}
export interface SwapInstruction extends AQIRInstruction {
    action: 'SWAP';
    left: AQIRExpression;
    right: AQIRExpression;
}
export interface HighlightInstruction extends AQIRInstruction {
    action: 'HIGHLIGHT';
    target: AQIRExpression;
    color: string;
}
export interface LoopInstruction extends AQIRInstruction {
    action: 'LOOP';
    iterator: string;
    start: AQIRExpression;
    end: AQIRExpression;
    body: AQIRInstruction[];
}
export type AQIRExpression = {
    type: 'Identifier';
    value: string;
} | {
    type: 'Literal';
    value: number | string;
} | {
    type: 'ArrayAccess';
    array: string;
    index: AQIRExpression;
} | {
    type: 'BinaryOp';
    operator: string;
    left: AQIRExpression;
    right: AQIRExpression;
};
