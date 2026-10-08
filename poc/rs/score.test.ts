import { describe, it, expect } from 'vitest';
import { scoreDiagnostic, Answer } from './score';

describe('RS2 Diagnostic Scoring Engine', () => {
  it('handles STRONG answer set', () => {
    const answers: Answer[] = [
      { questionId: 'Q1', option: 'B' },
      { questionId: 'Q2', option: 'B' },
      { questionId: 'Q3', option: 'C' },
      { questionId: 'Q4', option: 'B' },
      { questionId: 'Q5', option: 'B' },
    ];

    const result = scoreDiagnostic(answers);

    expect(result.scores).toEqual({
      arrays: 4,
      recursion: 4,
      trees: 4,
      graphs: 4,
      hashing: 4,
    });

    expect(result.weakestRanking).toEqual([
      'arrays',
      'recursion',
      'trees',
      'graphs',
      'hashing'
    ]);
  });

  it('handles WEAK answer set', () => {
    // Picking the lowest score or clearly incorrect option for each.
    // Q1: D (0), Q2: D (0), Q3: D (0), Q4: D (0), Q5: D (0)
    const answers: Answer[] = [
      { questionId: 'Q1', option: 'D' },
      { questionId: 'Q2', option: 'D' },
      { questionId: 'Q3', option: 'D' },
      { questionId: 'Q4', option: 'D' },
      { questionId: 'Q5', option: 'D' },
    ];

    const result = scoreDiagnostic(answers);

    expect(result.scores).toEqual({
      arrays: 0,
      recursion: 0,
      trees: 0,
      graphs: 0,
      hashing: 0,
    });

    expect(result.weakestRanking).toEqual([
      'arrays',
      'recursion',
      'trees',
      'graphs',
      'hashing'
    ]);
  });

  it('handles MIXED answer set', () => {
    // Q1 arrays: C (1)
    // Q2 recursion: C (2)
    // Q3 trees: B (1)
    // Q4 graphs: A (1)
    // Q5 hashing: C (1)
    const answers: Answer[] = [
      { questionId: 'Q1', option: 'C' },
      { questionId: 'Q2', option: 'C' },
      { questionId: 'Q3', option: 'B' },
      { questionId: 'Q4', option: 'A' },
      { questionId: 'Q5', option: 'C' },
    ];

    const result = scoreDiagnostic(answers);

    expect(result.scores).toEqual({
      arrays: 1,
      recursion: 2,
      trees: 1,
      graphs: 1,
      hashing: 1,
    });

    // Score ordering:
    // arrays: 1, trees: 1, graphs: 1, hashing: 1 (all tied, so arrays < trees < graphs < hashing)
    // recursion: 2
    expect(result.weakestRanking).toEqual([
      'arrays',
      'trees',
      'graphs',
      'hashing',
      'recursion'
    ]);
  });

  it('handles ALL-SKIPPED answer set', () => {
    const answers: Answer[] = [
      { questionId: 'Q1' }, // Missing option
      { questionId: 'Q2', option: null }, // Null option
      { questionId: 'Q3', option: undefined }, // Undefined option
      { questionId: 'Q4' },
      { questionId: 'Q5' },
    ];

    const result = scoreDiagnostic(answers);

    expect(result.scores).toEqual({
      arrays: 0,
      recursion: 0,
      trees: 0,
      graphs: 0,
      hashing: 0,
    });

    expect(result.weakestRanking).toEqual([
      'arrays',
      'recursion',
      'trees',
      'graphs',
      'hashing'
    ]);
  });

  it('rejects unknown question IDs', () => {
    const answers: Answer[] = [
      { questionId: 'Q99', option: 'A' }
    ];
    expect(() => scoreDiagnostic(answers)).toThrow('Unknown questionId: Q99');
  });

  it('rejects invalid options', () => {
    const answers: Answer[] = [
      { questionId: 'Q1', option: 'E' }
    ];
    expect(() => scoreDiagnostic(answers)).toThrow('Invalid option: E for questionId: Q1');
  });
});
