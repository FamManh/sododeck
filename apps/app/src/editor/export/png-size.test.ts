import { describe, expect, it } from 'vitest';

import { largestScale, pngSize, scaleAllowed } from './png-size';

describe('PNG size limits', () => {
  it('scales integer image dimensions', () => {
    expect(pngSize({ width: 1090, height: 660 }, 2)).toEqual({ width: 2180, height: 1320 });
    expect(pngSize({ width: 1.1, height: 1.1 }, 3)).toEqual({ width: 6, height: 6 });
  });

  it('rejects browser canvas limits', () => {
    const medium = { width: 6000, height: 3000 };
    expect(scaleAllowed(medium, 1)).toBe(false);
    expect(largestScale(medium)).toBeNull();
    expect(largestScale({ width: 17000, height: 10 })).toBeNull();
    expect(largestScale({ width: 2000, height: 1000 })).toBe(2);
  });
});
