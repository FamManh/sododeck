import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from './export/text-measure';
import { MAX_CARD_TAGS, TAG_CHIP, cardTags, tagBlockHeight, tagChips, tagRows } from './card-tags';

// 10.5px × 0.5 = 5.25 px per character, so "abcd" is a 21 px label and a 35 px chip (+2 slack).
const measure = fixedWidthMeasurer(0.5);

describe('card tags (2026-10-03)', () => {
  it('has no tag block without tags', () => {
    expect(tagRows([], 144, measure)).toBe(0);
    expect(tagBlockHeight(undefined, 184, measure)).toBe(0);
  });

  it('wraps chips into rows that fit the card', () => {
    // Three 35 px chips + 2 px slack each + 4 px gaps = 119 px: one row in 144 px, two in 100 px.
    expect(tagRows(['abcd', 'efgh', 'ijkl'], 144, measure)).toBe(1);
    expect(tagRows(['abcd', 'efgh', 'ijkl'], 100, measure)).toBe(2);
  });

  it('gives a chip longer than the card a row of its own (it truncates)', () => {
    expect(tagRows(['x'.repeat(60), 'ab'], 144, measure)).toBe(2);
  });

  it('adds the rows and the gaps between them', () => {
    const one = tagBlockHeight(['abcd'], 184, measure);
    const two = tagBlockHeight(['abcd', 'efgh', 'ijkl'], 120, measure);
    expect(one).toBe(TAG_CHIP.height);
    expect(two).toBe(2 * TAG_CHIP.height + TAG_CHIP.gap);
  });

  it('shows at most ten tags', () => {
    const many = Array.from({ length: 14 }, (_, i) => `t${String(i)}`);
    expect(cardTags(many)).toHaveLength(MAX_CARD_TAGS);
    expect(MAX_CARD_TAGS).toBe(10);
  });
});

describe('tagChips', () => {
  it('places chips left to right with the wrap gap, then wraps to the next row', () => {
    // 144 px inner width: three 37 px chips (4 gap) fit, so the fourth starts row 1.
    const chips = tagChips(['abcd', 'efgh', 'ijkl', 'mnop'], 114, measure);
    const width = 4 * 5.25 + 2 * TAG_CHIP.paddingX + TAG_CHIP.slack;
    expect(chips.map((chip) => [chip.row, chip.x])).toEqual([
      [0, 0],
      [0, width + TAG_CHIP.gap],
      [0, 2 * (width + TAG_CHIP.gap)],
      [1, 0],
    ]);
    expect(chips[0]?.width).toBeCloseTo(width);
  });

  it('agrees with tagRows', () => {
    const tags = ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst'];
    for (const inner of [60, 114, 158]) {
      const last = tagChips(tags, inner, measure).at(-1);
      expect((last?.row ?? -1) + 1).toBe(tagRows(tags, inner, measure));
    }
  });

  it('caps a chip at the inner width', () => {
    expect(tagChips(['x'.repeat(100)], 100, measure)[0]?.width).toBe(100);
  });
});
