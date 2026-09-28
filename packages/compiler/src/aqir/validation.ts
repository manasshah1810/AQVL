/**
 * Static validation for AQIR instruction streams.
 *
 * These checks run over a flat instruction array (see ./InstructionSet)
 * before a program is handed to a runtime — they catch structurally invalid
 * jumps, calls to undeclared functions, unbalanced scope/call nesting, and
 * malformed STEPs (docs/design/aqir-primitives-spec.md §3.3).
 *
 * Not called from the compile() pipeline itself; the test suite runs it over
 * every compiled example.
 */

import { AQIROpcode, PRIMITIVE_VERBS, Instruction } from './InstructionSet';
import type {
  JumpInstruction,
  JumpIfFalseInstruction,
  CallInstruction,
  RetInstruction,
  PushScopeInstruction,
  PrimitiveOp,
  StepInstruction,
} from './InstructionSet';

/** Minimal function signature info needed to validate a CALL site. Parameter *type* checking is Phase 2. */
export interface FunctionSignature {
  name: string;
  /** Parameter names, in declaration order. Used only to check arity here. */
  params: string[];
}

export type FunctionTable = Record<string, FunctionSignature>;

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  /** Index into the instruction array this issue pertains to. */
  index: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * A jump target is valid iff it is an in-bounds index into `instructions`.
 * Jumping to one-past-the-end (i.e. `instructions.length`) is allowed as a
 * "fall off the end" target (e.g. an `if` with no else branch jumping past
 * its body).
 */
export function validateJumpTarget(instructions: Instruction[], target: number): boolean {
  return Number.isInteger(target) && target >= 0 && target <= instructions.length;
}

/**
 * A CALL site is valid iff the callee is declared in `functionTable` and the
 * argument count matches its declared parameter count. Argument *types* are
 * not checked (Phase 2).
 */
export function validateCallSignature(
  functionName: string,
  args: unknown[],
  functionTable: FunctionTable
): boolean {
  const signature = functionTable[functionName];
  if (!signature) {
    return false;
  }
  return args.length === signature.params.length;
}

/** Fields each op must carry, by `kind` and then `verb` ('*' = every verb of the kind). */
const REQUIRED_FIELDS: Record<string, Record<string, string[]>> = {
  MUTATE: { set: ['target', 'value'], exchange: ['target', 'with'], create: [], destroy: ['target'] },
  TRANSFORM: { arrange: ['target', 'strategy', 'params'], reflow: [], place: ['target', 'x', 'y', 'z'], view: ['mode', 'params'], orient: ['target', 'x', 'y', 'z'], scale: ['target', 'x', 'y', 'z'] },
  RELATE: { '*': [] },
  ANNOTATE: { focus: ['targets'], contrast: ['targets'], state: ['targets', 'state'], boundary: ['collection'], region: ['collection', 'range', 'state'] },
  EMIT: { log: ['parts'] },
  INVOKE: { '*': ['procedure', 'args'] },
};

/** Addresses anywhere in `op` (targets, sources, ...) that refer to an op created in the same step. */
function createdReferences(op: PrimitiveOp): number[] {
  const refs: number[] = [];
  const visit = (value: unknown) => {
    if (value !== null && typeof value === 'object' && (value as { at?: unknown }).at === 'created') {
      refs.push((value as { op: number }).op);
    }
  };
  const any = op as unknown as Record<string, unknown>;
  for (const key of ['target', 'with', 'source']) visit(any[key]);
  if (Array.isArray(any.targets)) any.targets.forEach(visit);
  return refs;
}

/**
 * Checks one STEP against spec §3.3: known op kinds and verbs with their
 * required fields, INVOKE and TRANSFORM each alone in their step, and every
 * `{ at: 'created', op }` address naming an earlier MUTATE create of the
 * same step. Returns an empty list for a well-formed step.
 */
export function validateStep(step: StepInstruction): string[] {
  const problems: string[] = [];
  if (!Array.isArray(step.ops)) return ['STEP has no ops array.'];

  step.ops.forEach((op, n) => {
    const kind = (op as { kind?: unknown }).kind;
    const fields = typeof kind === 'string' ? REQUIRED_FIELDS[kind] : undefined;
    if (!fields) {
      problems.push(`op ${n} has unknown kind "${String(kind)}".`);
      return;
    }
    if (kind === 'INVOKE' || kind === 'TRANSFORM') {
      if (step.ops.length > 1) problems.push(`op ${n}: ${kind} must be the only op in its step.`);
    }
    let required = fields['*'];
    if (kind !== 'INVOKE') {
      const verb = (op as { verb?: unknown }).verb;
      const verbs = PRIMITIVE_VERBS[kind as keyof typeof PRIMITIVE_VERBS] as readonly string[];
      if (typeof verb !== 'string' || !verbs.includes(verb)) {
        problems.push(`op ${n}: ${kind} has unknown verb "${String(verb)}" (expected one of ${verbs.join(', ')}).`);
        return;
      }
      required = fields[verb] ?? fields['*'];
    }
    for (const field of required) {
      if (!Object.prototype.hasOwnProperty.call(op, field)) problems.push(`op ${n}: ${kind} is missing "${field}".`);
    }
    for (const ref of createdReferences(op)) {
      const creator = step.ops[ref] as { kind?: string; verb?: string } | undefined;
      if (!(ref < n && creator?.kind === 'MUTATE' && creator.verb === 'create')) {
        problems.push(`op ${n}: refers to created op ${ref}, which is not an earlier MUTATE create in this step.`);
      }
    }
  });
  return problems;
}

/**
 * Walks the full instruction stream and reports structural problems:
 *
 * - JUMP / JUMP_IF_FALSE targets that fall outside the instruction array.
 * - CALL to a function missing from `functionTable`, or with the wrong
 *   argument count.
 * - RET that occurs with no enclosing CALL (unbalanced call stack), tracked
 *   statically via a running call-depth counter.
 * - PUSH_SCOPE without a matching POP_SCOPE (and vice versa) by the end of
 *   the stream, or a POP_SCOPE with no open scope.
 * - Dead code: any instruction after an unconditional JUMP or RET that is
 *   not itself the target of some earlier/later jump (unreachable unless a
 *   jump lands on it).
 * - Malformed STEPs (see `validateStep`).
 *
 * This is a static, single-pass structural check — it does not simulate
 * control flow (no cycle detection through JUMP targets), so it cannot
 * catch every runtime-only error (e.g. a JUMP_IF_FALSE landing inside a
 * function it doesn't belong to). That level of flow analysis is left to
 * the runtime and future phases.
 */
export function validateInstructionSequence(
  instructions: Instruction[],
  functionTable: FunctionTable = {}
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // First pass: collect every index that is a jump target, so the dead-code
  // pass can tell "unreachable fallthrough" apart from "reachable via jump".
  const jumpTargets = new Set<number>();
  for (const instr of instructions) {
    if (instr.opcode === AQIROpcode.JUMP || instr.opcode === AQIROpcode.JUMP_IF_FALSE) {
      const target = (instr as JumpInstruction | JumpIfFalseInstruction).target;
      jumpTargets.add(target);
    }
  }

  let callDepth = 0;
  const openScopes: string[] = [];
  let precedingInstructionUnconditionallyExits = false;

  instructions.forEach((instr, index) => {
    switch (instr.opcode) {
      case AQIROpcode.JUMP:
      case AQIROpcode.JUMP_IF_FALSE: {
        const target = (instr as JumpInstruction | JumpIfFalseInstruction).target;
        if (!validateJumpTarget(instructions, target)) {
          issues.push({
            severity: 'error',
            message: `${instr.opcode} at index ${index} targets out-of-range instruction ${target} (valid range: 0-${instructions.length}).`,
            index,
          });
        }
        break;
      }

      case AQIROpcode.CALL: {
        const call = instr as CallInstruction;
        if (!validateCallSignature(call.functionName, call.args, functionTable)) {
          const declared = functionTable[call.functionName];
          const message = !declared
            ? `CALL at index ${index} references undefined function "${call.functionName}".`
            : `CALL at index ${index} passes ${call.args.length} argument(s) to "${call.functionName}", which expects ${declared.params.length}.`;
          issues.push({ severity: 'error', message, index });
        }
        callDepth++;
        break;
      }

      case AQIROpcode.RET: {
        if (callDepth <= 0) {
          issues.push({
            severity: 'error',
            message: `RET at index ${index} has no enclosing CALL — unbalanced call stack.`,
            index,
          });
        } else {
          callDepth--;
        }
        break;
      }

      case AQIROpcode.PUSH_SCOPE: {
        openScopes.push((instr as PushScopeInstruction).scopeId);
        break;
      }

      case AQIROpcode.POP_SCOPE: {
        if (openScopes.length === 0) {
          issues.push({
            severity: 'error',
            message: `POP_SCOPE at index ${index} has no matching PUSH_SCOPE.`,
            index,
          });
        } else {
          openScopes.pop();
        }
        break;
      }

      case AQIROpcode.STEP: {
        for (const problem of validateStep(instr as unknown as StepInstruction)) {
          issues.push({ severity: 'error', message: `STEP at index ${index}: ${problem}`, index });
        }
        break;
      }

      default:
        break;
    }

    // Dead code: an instruction that isn't a jump target but immediately
    // follows an unconditional JUMP or RET can never execute.
    if (precedingInstructionUnconditionallyExits && !jumpTargets.has(index)) {
      issues.push({
        severity: 'warning',
        message: `Instruction at index ${index} is unreachable (follows an unconditional ${instructions[index - 1].opcode} with no jump landing here).`,
        index,
      });
    }

    precedingInstructionUnconditionallyExits =
      instr.opcode === AQIROpcode.JUMP || instr.opcode === AQIROpcode.RET;
  });

  if (callDepth !== 0) {
    issues.push({
      severity: 'error',
      message: `${callDepth} CALL instruction(s) have no matching RET by end of stream.`,
      index: instructions.length,
    });
  }

  for (const scopeId of openScopes) {
    issues.push({
      severity: 'error',
      message: `PUSH_SCOPE "${scopeId}" has no matching POP_SCOPE by end of stream.`,
      index: instructions.length,
    });
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}
