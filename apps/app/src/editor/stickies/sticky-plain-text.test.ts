import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from '../export/text-measure';
import { FIT_STEPS } from './fit-font-size';
import { fitPlainNote, NOTE_LINE_HEIGHT, plainNoteText } from './sticky-plain-text';

const measure = fixedWidthMeasurer(0.5);
const family = 'sans-serif';

describe('plainNoteText', () => {
  it('strips emphasis, code ticks and link targets, and turns bullets into dots', () => {
    expect(plainNoteText('**Bold** and _soft_ `code`\n\n- one\n- [two](https://x.test)')).toBe(
      'Bold and soft code\n• one\n• two',
    );
  });

  it('is empty for blank text', () => {
    expect(plainNoteText('  ')).toBe('');
  });
});

describe('fitPlainNote', () => {
  it('takes the largest step when the text is short', () => {
    const fit = fitPlainNote({ markdown: 'Hi', width: 200, height: 160, family }, measure);
    expect(fit).toMatchObject({ fontSize: FIT_STEPS[0], lines: ['Hi'], clipped: false });
  });

  it('shrinks until the wrapped lines fit the height', () => {
    const markdown = 'word '.repeat(25).trim();
    const fit = fitPlainNote({ markdown, width: 150, height: 120, family }, measure);
    expect(fit.fontSize).toBeLessThan(FIT_STEPS[0] ?? 0);
    expect(fit.lines.length * fit.fontSize * NOTE_LINE_HEIGHT).toBeLessThanOrEqual(120);
    expect(fit.clipped).toBe(false);
  });

  it('keeps a pinned size and cuts the lines to the rows that fit', () => {
    const markdown = 'word '.repeat(60).trim();
    const fit = fitPlainNote({ markdown, width: 150, height: 60, fontSize: 16, family }, measure);
    expect(fit.fontSize).toBe(16);
    expect(fit.clipped).toBe(true);
    expect(fit.lines).toHaveLength(Math.floor(60 / (16 * NOTE_LINE_HEIGHT)));
  });

  it('marks text that overflows even at the smallest step as clipped', () => {
    const fit = fitPlainNote(
      { markdown: 'word '.repeat(400).trim(), width: 100, height: 40, family },
      measure,
    );
    expect(fit.fontSize).toBe(9);
    expect(fit.clipped).toBe(true);
  });
});
