declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => { toBe: (expected: any) => void; toEqual: (expected: any) => void };

import { normalizeSemanticState, getSemanticColorToken, SEMANTIC_PALETTE } from './semanticColors';

describe('Semantic Operation State System', () => {
  test('normalizes evaluating state aliases', () => {
    expect(normalizeSemanticState('evaluating')).toBe('EVALUATING');
    expect(normalizeSemanticState('compare')).toBe('EVALUATING');
    expect(normalizeSemanticState('comparing')).toBe('EVALUATING');
    expect(normalizeSemanticState('active')).toBe('EVALUATING');
    expect(normalizeSemanticState('selecting')).toBe('EVALUATING');
  });

  test('normalizes traversing state aliases', () => {
    expect(normalizeSemanticState('traversing')).toBe('TRAVERSING');
    expect(normalizeSemanticState('pointer')).toBe('TRAVERSING');
    expect(normalizeSemanticState('current')).toBe('TRAVERSING');
    expect(normalizeSemanticState('visited')).toBe('TRAVERSING');
    expect(normalizeSemanticState('peek')).toBe('TRAVERSING');
  });

  test('normalizes modifying state aliases', () => {
    expect(normalizeSemanticState('modifying')).toBe('MODIFYING');
    expect(normalizeSemanticState('swap')).toBe('MODIFYING');
    expect(normalizeSemanticState('swapping')).toBe('MODIFYING');
    expect(normalizeSemanticState('insert')).toBe('MODIFYING');
    expect(normalizeSemanticState('update')).toBe('MODIFYING');
    expect(normalizeSemanticState('replace')).toBe('MODIFYING');
  });

  test('normalizes success state aliases', () => {
    expect(normalizeSemanticState('sorted')).toBe('SUCCESS');
    expect(normalizeSemanticState('found')).toBe('SUCCESS');
    expect(normalizeSemanticState('confirmed')).toBe('SUCCESS');
    expect(normalizeSemanticState('finalized')).toBe('SUCCESS');
  });

  test('normalizes discarded state aliases', () => {
    expect(normalizeSemanticState('pruned')).toBe('DISCARDED');
    expect(normalizeSemanticState('eliminated')).toBe('DISCARDED');
    expect(normalizeSemanticState('out_of_scope')).toBe('DISCARDED');
    expect(normalizeSemanticState('deleted')).toBe('DISCARDED');
    expect(normalizeSemanticState('not_found')).toBe('DISCARDED');
  });

  test('normalizes auxiliary state aliases', () => {
    expect(normalizeSemanticState('temp')).toBe('AUXILIARY');
    expect(normalizeSemanticState('helper')).toBe('AUXILIARY');
    expect(normalizeSemanticState('intermediate')).toBe('AUXILIARY');
    expect(normalizeSemanticState('head')).toBe('AUXILIARY');
    expect(normalizeSemanticState('null')).toBe('AUXILIARY');
  });

  test('normalizes structural state aliases', () => {
    expect(normalizeSemanticState('root')).toBe('STRUCTURAL');
    expect(normalizeSemanticState('leaf')).toBe('STRUCTURAL');
    expect(normalizeSemanticState('parent')).toBe('STRUCTURAL');
    expect(normalizeSemanticState('child')).toBe('STRUCTURAL');
    expect(normalizeSemanticState('left_view')).toBe('STRUCTURAL');
  });

  test('returns corresponding color tokens for all 8 states', () => {
    expect(getSemanticColorToken('NEUTRAL')).toEqual(SEMANTIC_PALETTE.NEUTRAL);
    expect(getSemanticColorToken('EVALUATING')).toEqual(SEMANTIC_PALETTE.EVALUATING);
    expect(getSemanticColorToken('TRAVERSING')).toEqual(SEMANTIC_PALETTE.TRAVERSING);
    expect(getSemanticColorToken('MODIFYING')).toEqual(SEMANTIC_PALETTE.MODIFYING);
    expect(getSemanticColorToken('SUCCESS')).toEqual(SEMANTIC_PALETTE.SUCCESS);
    expect(getSemanticColorToken('DISCARDED')).toEqual(SEMANTIC_PALETTE.DISCARDED);
    expect(getSemanticColorToken('AUXILIARY')).toEqual(SEMANTIC_PALETTE.AUXILIARY);
    expect(getSemanticColorToken('STRUCTURAL')).toEqual(SEMANTIC_PALETTE.STRUCTURAL);
  });
});
