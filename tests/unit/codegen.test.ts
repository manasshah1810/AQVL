/**
 * Unit tests for AQIR code generation: that the compiler emits the expected
 * control-flow opcodes (CALL, JUMP_IF_FALSE, JUMP, PUSH_SCOPE) for function
 * calls, IF, LOOP, and function bodies respectively.
 *
 * compile() logs a full token/AST/AQIR dump on every call; silence it so
 * `vitest run` output stays readable.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../utils/testHelpers';
import type { ControlFlowInstruction } from '../../packages/compiler/src/aqir/types';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

function withOpcode(instructions: unknown[], opcode: string): ControlFlowInstruction[] {
  return (instructions as ControlFlowInstruction[]).filter((i) => (i as any).opcode === opcode);
}

describe('AQIR code generation', () => {
  it('emits a CALL instruction for a function call', () => {
    const source = `SCENE Test
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
SEQUENCE
  result = add(1, 2)
END
`;
    const calls = withOpcode(compile(source), 'CALL');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ functionName: 'add', args: [1, 2] });
  });

  it('emits a JUMP_IF_FALSE instruction for an IF', () => {
    const source = `SCENE Test
DECLARE
  FUNCTION sign(x) {
    IF x > 0 {
      RETURN 1
    }
    RETURN 0
  }
SEQUENCE
  r = sign(5)
END
`;
    const branches = withOpcode(compile(source), 'JUMP_IF_FALSE');
    expect(branches.length).toBeGreaterThanOrEqual(1);
  });

  it('emits a JUMP instruction for a LOOP back-edge', () => {
    const source = `SCENE Test
SEQUENCE
  total = 0
  LOOP i FROM 0 TO 3
    total = total + i
  END
END
`;
    const jumps = withOpcode(compile(source), 'JUMP');
    expect(jumps.length).toBeGreaterThanOrEqual(1);
  });

  it('emits a PUSH_SCOPE instruction for a function body', () => {
    const source = `SCENE Test
DECLARE
  FUNCTION add(a, b) {
    RETURN a + b
  }
SEQUENCE
END
`;
    const scopes = withOpcode(compile(source), 'PUSH_SCOPE');
    expect(scopes.length).toBeGreaterThanOrEqual(1);
  });
});
