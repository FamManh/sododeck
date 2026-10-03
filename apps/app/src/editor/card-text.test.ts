import { describe, expect, it } from 'vitest';

import { textLines } from './card-text';

describe('textLines (017 research R11)', () => {
  it('gives one title line and one description line at 50 px (Deck line heights 18 and 16.8)', () => {
    expect(textLines({ width: 164, height: 50 })).toEqual({ title: 1, subtitle: 1 });
  });

  it('gives more title lines as the card grows', () => {
    expect(textLines({ width: 164, height: 80 })).toEqual({ title: 3, subtitle: 1 });
  });

  it('never gives fewer than one title line, even smaller than the minimum', () => {
    expect(textLines({ width: 120, height: 10 }).title).toBe(1);
  });

  it('grows both fields with the height', () => {
    const small = textLines({ width: 164, height: 104 });
    const big = textLines({ width: 164, height: 260 });
    expect(big.title).toBeGreaterThanOrEqual(small.title);
    expect(big.subtitle).toBeGreaterThanOrEqual(small.subtitle);
  });
});
