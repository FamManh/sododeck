import { describe, expect, it } from 'vitest';

import {
  cardLayout,
  DECK_CARD,
  DECK_CARD_WIDTH,
  wrapText,
  type CardLayoutInput,
} from './card-layout';
import { fixedWidthMeasurer } from './export/text-measure';

// 0.5 em per character: 7 px at the 14 px title, 6 px at the 12 px description, 5.25 px in tags.
// The inner width of a 184 px card is 184 − 2 × 13 = 158 px, so 22 title or 26 description
// characters fit on a line.
const raw = fixedWidthMeasurer(0.5);
// Memoised like the canvas measurer the app uses, so the perf case measures `cardLayout`, not the
// test double's grapheme segmenter.
const memo = new Map<string, number>();
const measure: typeof raw = (text, font) => {
  const key = `${font}|${text}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const width = raw(text, font);
  memo.set(key, width);
  return width;
};
const layout = (input: CardLayoutInput, width = DECK_CARD_WIDTH) =>
  cardLayout(input, width, measure);
const line = (n: number) => 'x'.repeat(n);

describe('cardLayout titleCut', () => {
  it('is false when the title fits and true past three lines or a short stored height', () => {
    expect(layout({ title: 'Billing' }).titleCut).toBe(false);
    expect(layout({ title: line(22 * 3) }).titleCut).toBe(false);
    expect(layout({ title: `${line(21)} ${line(21)} ${line(21)} ${line(21)}` }).titleCut).toBe(
      true,
    );
    const short = layout({ title: `${line(21)} ${line(21)}`, size: { width: 184, height: 4 } });
    expect(short.titleLines).toBe(1);
    expect(short.titleCut).toBe(true);
  });
});

describe('cardLayout (research R7)', () => {
  it('defaults to a 184 px wide card', () => {
    expect(DECK_CARD_WIDTH).toBe(184);
    expect(layout({ title: 'Billing' }).width).toBe(184);
  });

  it('a title-only card is padding + header + gap + one title line, on the 4 px step', () => {
    // 12 + 24 + 8 + 18 + 12 = 74 → 76
    expect(layout({ title: 'Billing' })).toMatchObject({
      height: 76,
      titleLines: 1,
      descriptionLines: 0,
      tagRows: 0,
      hasChildrenRow: false,
    });
  });

  it('wraps the title and caps it at three lines', () => {
    expect(layout({ title: `${line(22)} ${line(10)}` }).titleLines).toBe(2);
    const long = layout({ title: Array.from({ length: 12 }, () => line(10)).join(' ') });
    expect(long.titleLines).toBe(3);
    // 12 + 24 + 8 + 3 × 18 + 12 = 110 → 112
    expect(long.height).toBe(112);
  });

  it('an empty title still takes one line', () => {
    expect(layout({ title: '' }).titleLines).toBe(1);
  });

  it('adds the description with its gap, up to three lines', () => {
    // 74 + 8 + 16.8 = 98.8 → 100
    expect(layout({ title: 'A', description: 'short' })).toMatchObject({
      descriptionLines: 1,
      height: 100,
    });
    const long = layout({
      title: 'A',
      description: Array.from({ length: 30 }, () => 'word').join(' '),
    });
    expect(long.descriptionLines).toBe(3);
    // 74 + 8 + 3 × 16.8 = 132.4 → 136
    expect(long.height).toBe(136);
  });

  it('empty regions add nothing', () => {
    const bare = layout({ title: 'A' });
    expect(layout({ title: 'A', description: '', tags: [], childCount: 0 })).toEqual(bare);
    expect(layout({ title: 'A', description: '   ' }).descriptionLines).toBe(0);
  });

  it('adds the tag block with its gap', () => {
    // one row: 74 + 8 + 18 = 100
    expect(layout({ title: 'A', tags: ['api'] })).toMatchObject({ tagRows: 1, height: 100 });
    // enough chips to wrap into two rows: 74 + 8 + (18 + 4 + 18) = 122 → 124
    const many = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    expect(layout({ title: 'A', tags: many })).toMatchObject({ tagRows: 2, height: 124 });
  });

  it('adds the "n inside" row', () => {
    // 74 + 8 + 24 = 106 → 108
    expect(layout({ title: 'A', childCount: 3 })).toMatchObject({
      hasChildrenRow: true,
      height: 108,
    });
  });

  it('stacks every region', () => {
    // 74 + (8 + 16.8) + (8 + 18) + (8 + 24) = 156.8 → 160
    expect(layout({ title: 'A', description: 'd', tags: ['t'], childCount: 2 }).height).toBe(160);
  });

  it('uses the stored width and height, and never goes below the minimum', () => {
    const stored = layout({ title: 'A', size: { width: 240, height: 200 } });
    expect(stored).toMatchObject({ width: 240, height: 200 });
    // minimum: 12 + 24 + 8 + 18 + 12 = 74 → 76, plus the tag block
    const tiny = layout({ title: 'A', tags: ['t'], size: { width: 200, height: 20 } });
    expect(tiny.width).toBe(200);
    expect(tiny.height).toBe(100);
  });

  it('reduces the lines to what fits, title first', () => {
    const title = Array.from({ length: 12 }, () => line(10)).join(' ');
    const description = Array.from({ length: 30 }, () => 'word').join(' ');
    // 3 title lines + description would need 154; a 100 px card keeps the title and drops the rest.
    const cut = layout({ title, description, size: { width: 184, height: 100 } });
    expect(cut.titleLines).toBe(2);
    expect(cut.descriptionLines).toBe(0);
    // Room for the whole title and one description line: 56 + 54 + 8 + 16.8 = 134.8 → 136.
    const mid = layout({ title, description, size: { width: 184, height: 136 } });
    expect(mid.titleLines).toBe(3);
    expect(mid.descriptionLines).toBe(1);
  });

  it('does not depend on the zoom level: the same input gives the same layout', () => {
    const input = { title: 'Billing service', description: 'Takes payments', tags: ['a', 'b'] };
    expect(layout(input)).toEqual(layout(input));
  });

  it('computes 500 cards in under 20 ms once warm', () => {
    const inputs = Array.from({ length: 500 }, (_, i) => ({
      title: `Service number ${String(i % 40)} with a longer name`,
      description: `Handles request type ${String(i % 25)} for the platform`,
      tags: ['api', `t${String(i % 7)}`],
      childCount: i % 3,
    }));
    for (const input of inputs) layout(input);
    const start = performance.now();
    for (const input of inputs) layout(input);
    expect(performance.now() - start).toBeLessThan(20);
  });
});

const DECK_TITLE = DECK_CARD.titleFont;

describe('wrapText', () => {
  // 7 px per title character, 158 px inner width: 22 characters per line.
  const font = '600 14px x';
  it('wraps at word boundaries and keeps paragraphs apart', () => {
    expect(wrapText(`${line(15)} ${line(15)}\nend`, 158, font, measure)).toEqual([
      line(15),
      line(15),
      'end',
    ]);
  });

  it('breaks a word wider than the card between characters', () => {
    expect(wrapText(line(50), 158, font, measure).map((part) => part.length)).toEqual([22, 22, 6]);
  });

  it('counts the lines the layout uses', () => {
    const text = `${line(15)} ${line(15)} ${line(15)}`;
    expect(layout({ title: text }).titleLines).toBe(
      wrapText(text, 158, DECK_TITLE, measure).length,
    );
  });

  it('is empty for no text', () => {
    expect(wrapText('', 158, font, measure)).toEqual([]);
  });
});
