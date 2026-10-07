import { describe, expect, it } from 'vitest';

import { schemeOfKind } from '../src/theme';

describe('schemeOfKind', () => {
  it.each([
    [1, 'light'],
    [4, 'light'],
    [2, 'dark'],
    [3, 'dark'],
  ] as const)('kind %i is %s', (kind, scheme) => {
    expect(schemeOfKind(kind)).toBe(scheme);
  });
});
