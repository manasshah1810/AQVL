import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateAndValidateAQVL, setModelOutputFn } from './server';

describe('Y5 Validate and Retry Loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on first attempt', async () => {
    const stub = vi.fn().mockResolvedValue(`
SCENE ValidScene
SEQUENCE
END
`);
    setModelOutputFn(stub);

    const result = await generateAndValidateAQVL('test topic');
    expect(result.valid).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.errors).toEqual([]);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('retries once then succeeds', async () => {
    let callCount = 0;
    const stub = vi.fn().mockImplementation(async (messages: any) => {
      callCount++;
      if (callCount === 1) {
        return `
SCENE InvalidScene
SEQUENCE
  INVALID_STATEMENT
END
`;
      }
      return `
SCENE ValidScene
SEQUENCE
END
`;
    });
    setModelOutputFn(stub);

    const result = await generateAndValidateAQVL('test topic');
    
    expect(result.valid).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.errors).toEqual([]);
    expect(stub).toHaveBeenCalledTimes(2);

    // Verify the second call received the validation errors from attempt 1
    const secondCallMessages = stub.mock.calls[1][0];
    const lastMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('Previous AQVL failed validation');
    expect(lastMessage.content).toContain('Compiler/validation errors');
  });

  it('returns invalid after three failed attempts', async () => {
    const stub = vi.fn().mockImplementation(async () => {
      return `
SCENE AlwaysInvalid
SEQUENCE
  BROKEN
END
`;
    });
    setModelOutputFn(stub);

    const result = await generateAndValidateAQVL('test topic');
    
    expect(result.valid).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(stub).toHaveBeenCalledTimes(3);
    expect(result.aqvl).toContain('AlwaysInvalid');
  });
});
