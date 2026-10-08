import { describe, it, expect } from 'vitest';
import { recommendForDimension, recommendForError } from './recommend';
// Read actual registry from the demo package to verify examples exist.
import { EXAMPLES } from '../../packages/demo/src/examples/registry';
import { SkillDimension } from './score';

describe('RS3 Recommendation Mapping', () => {
  const actualExampleIds = new Set(EXAMPLES.map(ex => ex.id));

  const dimensions: SkillDimension[] = [
    'arrays',
    'recursion',
    'trees',
    'graphs',
    'hashing'
  ];

  dimensions.forEach((dim) => {
    it(`maps dimension "${dim}" to a real registry example`, () => {
      const rec = recommendForDimension(dim);
      expect(rec).toBeDefined();
      expect(rec!.dimension).toBe(dim);
      
      // Assert the example ID actually exists in the real registry
      expect(actualExampleIds.has(rec!.exampleId)).toBe(true);
    });
  });

  it('returns undefined for an unknown dimension', () => {
    expect(recommendForDimension('unknown-dimension' as SkillDimension)).toBeUndefined();
  });

  it('maps placeholder error rules correctly', () => {
    const errorRec = recommendForError('PLACEHOLDER_RULE_1_OUT_OF_BOUNDS');
    expect(errorRec).toBeDefined();
    expect(errorRec!.ruleId).toBe('PLACEHOLDER_RULE_1_OUT_OF_BOUNDS');
    expect(errorRec!.remedialTopic).toBe('Array Indexing Rules');
    if (errorRec!.exampleId) {
      expect(actualExampleIds.has(errorRec!.exampleId)).toBe(true);
    }
  });

  it('returns undefined for an unknown error rule', () => {
    expect(recommendForError('NON_EXISTENT_RULE')).toBeUndefined();
  });
});
