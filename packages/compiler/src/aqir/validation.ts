/**
 * Static validation for VM-mode AQIR instruction streams.
 *
 * These checks run over a flat `Instruction[]` (see ./InstructionSet) before
 * a program is handed to a runtime — they catch structurally invalid jumps,
 * calls to undeclared functions, and unbalanced scope/call nesting.
 *
 * Design-only: not yet called from the Optimizer or generator pipeline.
 */

import { AQIROpcode, Instruction } from './InstructionSet';
import type {
  JumpInstruction,
  JumpIfFalseInstruction,
  CallInstruction,
  RetInstruction,
  PushScopeInstruction,
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
