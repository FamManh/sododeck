import { describe, expect, it } from 'vitest';

import { textLines } from './card-text';

describe('textLines (017 research R11)', () => {
  it('gives a single title line at the 44 px minimum height, full layout', () => {
    expect(textLines({ width: 164, height: 44 }, 'component')).toEqual({ title: 1, subtitle: 0 });
  });

  it('gives 2 title lines and 1 subtitle line at 80 px, full layout', () => {
    expect(textLines({ width: 164, height: 80 }, 'component')).toEqual({ title: 2, subtitle: 1 });
  });

  it('gives the compact layout more room, with no kind-tile reserve', () => {
    const compact = textLines({ width: 164, height: 80 }, 'system');
    const full = textLines({ width: 164, height: 80 }, 'component');
    expect(compact).not.toEqual(full);
    expect(compact.title).toBeGreaterThan(full.title);
  });

  it('never gives fewer than one title line, even smaller than the minimum', () => {
    expect(textLines({ width: 120, height: 10 }, 'component').title).toBe(1);
    expect(textLines({ width: 120, height: 10 }, 'system').title).toBe(1);
  });

  it('grows both fields with the height', () => {
    const small = textLines({ width: 164, height: 104 }, 'component');
    const big = textLines({ width: 164, height: 260 }, 'component');
    expect(big.title).toBeGreaterThanOrEqual(small.title);
    expect(big.subtitle).toBeGreaterThanOrEqual(small.subtitle);
  });
});
