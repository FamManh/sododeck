import { describe, expect, it } from 'vitest';

import { anchorReadout, stepAnchor } from './anchor-drag';

describe('anchorReadout', () => {
  it('says the side and the percentage', () => {
    expect(anchorReadout('left', 0.78)).toBe('left side · 78 %');
    expect(anchorReadout('top', 0.25, true)).toBe('top side · 25 % · snapped');
  });
});

describe('stepAnchor', () => {
  it('moves one stop along the side', () => {
    expect(stepAnchor('top', 0.5, 1)).toEqual({ side: 'top', at: 0.75 });
    expect(stepAnchor('top', 0.5, -1)).toEqual({ side: 'top', at: 0.25 });
    expect(stepAnchor('left', 0.78, 1)).toEqual({ side: 'left', at: 1 });
    expect(stepAnchor('left', 0.78, -1)).toEqual({ side: 'left', at: 0.75 });
  });

  it('carries on to the neighbouring side at a corner', () => {
    expect(stepAnchor('top', 1, 1)).toEqual({ side: 'right', at: 0 });
    expect(stepAnchor('top', 0, -1)).toEqual({ side: 'left', at: 0 });
    expect(stepAnchor('right', 1, 1)).toEqual({ side: 'bottom', at: 1 });
    expect(stepAnchor('bottom', 0, -1)).toEqual({ side: 'left', at: 1 });
  });
});
