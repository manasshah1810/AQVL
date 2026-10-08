export type {
  Confidence,
  EnclosingLoop,
  ErrorGhost,
  ErrorInfo,
  ErrorKind,
  ErrorPhase,
  EvaluatedExpression,
  FrameError,
  RawCompileError,
  RawRuntimeError,
  Scalar,
  StripCell,
} from './types';
export { diagnoseRuntimeError, KIND_NAME } from './runtime';
export { diagnoseCompileError } from './compile';
export { detectLogicalIssues, detectStall, loopHeaderFor, selfCompareCandidates, checkSelfCompare } from './logic';
export type { SelfCompareCandidate } from './logic';
export { buildErrorFrame, GHOST_ID } from './ghost';
export { teachError } from './lesson';
export type { ErrorLesson, LessonCode, LessonFacts, LessonStrip } from './lesson';
