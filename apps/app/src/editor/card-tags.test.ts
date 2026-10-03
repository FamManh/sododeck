import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from './export/text-measure';
import { MAX_CARD_TAGS, TAG_CHIP, cardTags, tagBlockHeight, tagRows } from './card-tags';

// 11.5px × 0.5 ≈ 5.75 px per character, so "abcd" is a 23 px label and a 39 px chip.
const measure = fixedWidthMeasurer(0.5);

describe('card tags (2026-10-03)', () => {
  it('has no tag block without tags', () => {
    expect(tagRows([], 144, measure)).toBe(0);
    expect(tagBlockHeight(undefined, 164, measure)).toBe(0);
  });

  it('wraps chips into rows that fit the card', () => {
    // Three 39 px chips + 4 px gaps = 125 px: one row in 144 px, two rows in 100 px.
    expect(tagRows(['abcd', 'efgh', 'ijkl'], 144, measure)).toBe(1);
    expect(tagRows(['abcd', 'efgh', 'ijkl'], 100, measure)).toBe(2);
  });

  it('gives a chip longer than the card a row of its own (it truncates)', () => {
    expect(tagRows(['x'.repeat(60), 'ab'], 144, measure)).toBe(2);
  });

  it('adds the rows, the gaps between them and the bottom padding', () => {
    const one = tagBlockHeight(['abcd'], 164, measure);
    const two = tagBlockHeight(['abcd', 'efgh', 'ijkl'], 120, measure);
    expect(one).toBe(TAG_CHIP.height + TAG_CHIP.paddingBottom);
    expect(two).toBe(2 * TAG_CHIP.height + TAG_CHIP.gap + TAG_CHIP.paddingBottom);
  });

  it('shows at most ten tags', () => {
    const many = Array.from({ length: 14 }, (_, i) => `t${String(i)}`);
    expect(cardTags(many)).toHaveLength(MAX_CARD_TAGS);
    expect(MAX_CARD_TAGS).toBe(10);
  });
});
