import { describe, it, expect } from 'vitest';
import { audit } from '../../scripts/audit-generic-layer';

describe('generic layer audit', () => {
  it('packages/shared/src and runtime/src/models contain no DSA-specific identifiers', () => {
    expect(audit()).toEqual([]);
  });
});
