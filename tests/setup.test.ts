import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Project Setup Verification', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support fast-check property-based testing', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      })
    );
  });
});
