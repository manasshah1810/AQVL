/**
 * Types for the IDE's compile pipeline (lexer -> parser -> ... -> runtime),
 * shared by App and its panels.
 */
import type { AQIRGenerator, Lexer, ProgramNode } from '@aqvl/compiler';

export type { ProgramNode };

/** The compiled program, as the AQIR generator returns it. */
export type AQIRProgram = ReturnType<AQIRGenerator['generate']>;

/** One lexer token. */
export type Token = ReturnType<Lexer['tokenize']>[number];

export type PipelineStatus = 'pending' | 'success' | 'error';

export interface PipelineState {
  lexer: PipelineStatus;
  parser: PipelineStatus;
  semantic: PipelineStatus;
  optimizer: PipelineStatus;
  generator: PipelineStatus;
  runtime: PipelineStatus;
  expandedAst?: ProgramNode;
}

/** One compile stage (every PipelineState key except expandedAst). */
export type PipelineStage = Exclude<keyof PipelineState, 'expandedAst'>;

/**
 * An AQIR instruction as the IDE's instruction lists read it. Each opcode
 * carries different fields, so every field the lists show is optional.
 */
export interface InstructionView {
  type?: string;
  action?: string;
  actionName?: string;
  opcode?: string;
  leftId?: string;
  rightId?: string;
  targetId?: string;
  args?: unknown[];
}

/** The program's instructions, in the shape the instruction lists read. */
export function instructionViews(aqir: AQIRProgram | null): InstructionView[] {
  return (aqir?.instructions ?? []) as InstructionView[];
}
