declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => { toBe: (expected: any) => void; toEqual: (expected: any) => void };

import {
  isElementHighlighted,
  getHighlightAccentColor,
  getHighlightConfig,
  normalizeHighlightType,
  HIGHLIGHT_PALETTE,
} from './highlightStyle';

describe('Highlight Style System', () => {
  test('detects highlighted state correctly', () => {
    expect(isElementHighlighted({ isHighlighted: true })).toBe(true);
    expect(isElementHighlighted({ state: 'EVALUATING' })).toBe(true);
    expect(isElementHighlighted({ state: 'MODIFYING' })).toBe(true);
    expect(isElementHighlighted({ state: 'TRAVERSING' })).toBe(true);
    expect(isElementHighlighted({ state: 'NEUTRAL' })).toBe(false);
    expect(isElementHighlighted({ state: 'STRUCTURAL' })).toBe(false);
    expect(isElementHighlighted({ isHighlighted: false, state: 'NEUTRAL' })).toBe(false);
  });

  test('normalizes highlight types correctly', () => {
    expect(normalizeHighlightType('COMPARE')).toBe('EVALUATING');
    expect(normalizeHighlightType('SWAP')).toBe('MODIFYING');
    expect(normalizeHighlightType('POINTER')).toBe('TRAVERSING');
    expect(normalizeHighlightType('FOUND')).toBe('SUCCESS');
    expect(normalizeHighlightType('MID')).toBe('FOCUS');
    expect(normalizeHighlightType('UNKNOWN')).toBe('DEFAULT');
  });

  test('resolves accent colors based on highlightType or state', () => {
    const evalAccent = getHighlightAccentColor({ state: 'EVALUATING' });
    expect(evalAccent.color).toBe(HIGHLIGHT_PALETTE.EVALUATING.color);

    const swapAccent = getHighlightAccentColor({ highlightType: 'SWAP' });
    expect(swapAccent.color).toBe(HIGHLIGHT_PALETTE.MODIFYING.color);

    const focusAccent = getHighlightAccentColor({ highlightType: 'MID' });
    expect(focusAccent.color).toBe(HIGHLIGHT_PALETTE.FOCUS.color);
  });

  test('returns full highlight config with consistent defaults', () => {
    const config = getHighlightConfig({ isHighlighted: true, state: 'EVALUATING' });
    expect(config.scaleMultiplier).toBe(1.20);
    expect(config.emissiveBoost).toBe(0.65);
    expect(config.ringOpacity).toBe(0.85);
    expect(config.accentColor).toBe(HIGHLIGHT_PALETTE.EVALUATING.color);
  });
});
