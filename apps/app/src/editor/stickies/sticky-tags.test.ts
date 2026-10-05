import { describe, expect, it } from 'vitest';

import type { TagLook } from '../tags/tag-colours';
import { hiddenTagsLabel, noteTags } from './sticky-tags';

// 6 px a character: a three letter tag is 18 + 12 padding + 2 slack = 32 px wide, "+2" 26 px.
const measure = (text: string) => text.length * 6;
const look = (text: string): TagLook => ({ text, chip: 'c', ink: 'i', dot: 'd' });
const looks = (...texts: string[]) => texts.map(look);

describe('noteTags (053)', () => {
  it('has nothing without tags', () => {
    expect(noteTags([], 200, measure)).toEqual({ shown: [], hidden: 0, rows: 0 });
  });

  it('shows every tag that fits in two rows', () => {
    const result = noteTags(looks('api', 'ops', 'pci'), 200, measure);
    expect(result).toMatchObject({ hidden: 0, rows: 1 });
    expect(result.shown.map((t) => t.text)).toEqual(['api', 'ops', 'pci']);
  });

  it('wraps to a second row before collapsing', () => {
    // 100 px: two 32 px chips and a gap fit (68), a third does not.
    const result = noteTags(looks('api', 'ops', 'pci', 'dev'), 100, measure);
    expect(result).toMatchObject({ hidden: 0, rows: 2 });
  });

  it('collapses the rest to "+N", leaving room for the chip itself', () => {
    const result = noteTags(looks('api', 'ops', 'pci', 'dev', 'qa1', 'qa2', 'qa3'), 100, measure);
    expect(result.rows).toBeLessThanOrEqual(2);
    expect(result.hidden).toBeGreaterThan(0);
    expect(result.shown.length + result.hidden).toBe(7);
    expect(hiddenTagsLabel(result.hidden)).toBe(`+${String(result.hidden)}`);
  });

  it('shows only "+N" when not even one tag fits a row', () => {
    const result = noteTags(looks('a-very-long-tag-name'), 20, measure);
    // One chip is clamped to the row width, so it still fits as a single row.
    expect(result.rows).toBe(1);
    expect(result.shown).toHaveLength(1);
  });
});
