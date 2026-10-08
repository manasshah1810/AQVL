import { describe, it, expect } from 'vitest';
import { validateAQVL } from './validate';
import { SortingScripts } from '../../packages/demo/src/examples/SortingLibrary';
import { SearchingScripts } from '../../packages/demo/src/examples/SearchingLibrary';
import { LoopScripts } from '../../packages/demo/src/examples/LoopLibrary';

describe('AQVL Validation Harness', () => {
  describe('Valid Cases', () => {
    it('should validate Y1 Bubble Sort reference', () => {
      const result = validateAQVL(SortingScripts.BubbleSort);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stage).toBe('AQIRGenerator');
    });

    it('should validate Y1 Linear Search reference', () => {
      const result = validateAQVL(SearchingScripts.LinearSearch);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stage).toBe('AQIRGenerator');
    });

    it('should validate Y1 For Loop Basics reference', () => {
      const result = validateAQVL(LoopScripts.ForLoopBasics);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stage).toBe('AQIRGenerator');
    });
  });

  describe('Invalid Cases', () => {
    it('should fail on deliberately broken syntax', () => {
      const brokenSyntax = `
SCENE BrokenSyntax
DECLARE
  ARRAY arr = [1, 2]
SEQUENCE
  LOOP IF @#$! 
END
      `;
      const result = validateAQVL(brokenSyntax);
      expect(result.valid).toBe(false);
      expect(result.stage).toMatch(/Lexer|Parser/); // Might fail at Parser or Lexer depending on exact syntax
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].length).toBeGreaterThan(0);
    });

    it('should fail on deliberately broken semantic/type usage', () => {
      const brokenSemantics = `
SCENE BrokenSemantics
SEQUENCE
  PRINT undeclaredArray[0]
  x = "hello" - 5
END
      `;
      const result = validateAQVL(brokenSemantics);
      expect(result.valid).toBe(false);
      expect(result.stage).toBe('SemanticValidator');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].length).toBeGreaterThan(0);
    });

    it('should fail on another deliberately broken AQVL program (wrong args)', () => {
      const wrongArgs = `
SCENE WrongArgs
SEQUENCE
  SWAP arr[0]
END
      `;
      const result = validateAQVL(wrongArgs);
      expect(result.valid).toBe(false);
      expect(result.stage).toMatch(/Parser|SemanticValidator/);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].length).toBeGreaterThan(0);
    });
  });
});
