import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from '../export/text-measure';
import { cardLayoutOf, cardSize, sizeLimitsOf, CARD_SIZE_LIMITS } from '../canvas-geometry';
import { shapeLayout } from './shape-layout';

const measure = fixedWidthMeasurer(0.55);

describe('shape size and title layout (031)', () => {
  it('uses the shape’s default size when none is stored, whatever the title', () => {
    expect(cardSize({ type: 'diamond', title: 'OK?' })).toEqual({ width: 176, height: 112 });
    expect(cardSize({ type: 'pill', title: 'x '.repeat(80) })).toEqual({ width: 176, height: 52 });
    expect(cardSize({ type: 'database', display: 'shape', title: 'DB' })).toEqual({
      width: 152,
      height: 104,
    });
    // The same type in card form keeps the card's layout.
    expect(cardSize({ type: 'database', title: 'DB' }).width).toBe(184);
  });

  it('keeps a stored size, clamped to the shape’s minimum and the card maximum', () => {
    expect(cardSize({ type: 'diamond', size: { width: 300, height: 200 } })).toEqual({
      width: 300,
      height: 200,
    });
    expect(cardSize({ type: 'diamond', size: { width: 10, height: 10 } })).toEqual({
      width: 80,
      height: 56,
    });
    expect(cardSize({ type: 'text', size: { width: 40, height: 24 } })).toEqual({
      width: 40,
      height: 24,
    });
    expect(cardSize({ type: 'ellipse', size: { width: 2000, height: 900 } })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('wraps the title in the title box, up to 3 lines, and says when it is cut', () => {
    const short = shapeLayout('rect', { title: 'Validate cart' }, measure);
    expect(short).toMatchObject({ titleLines: 1, titleCut: false, tagRows: 0 });
    const long = shapeLayout('rect', { title: 'word '.repeat(60) }, measure);
    expect(long.titleLines).toBe(3);
    expect(long.titleCut).toBe(true);
    // A minimum-size pill has room for one line only.
    const small = shapeLayout(
      'stadium',
      { title: 'word '.repeat(20), size: { width: 80, height: 36 } },
      measure,
    );
    expect(small.titleLines).toBe(1);
    expect(small.titleCut).toBe(true);
  });

  it('ignores description, tags and the "n inside" row: the shape never grows', () => {
    const layout = cardLayoutOf(
      { type: 'cylinder', title: 'Orders', tech: 'Postgres', tags: ['a', 'b'] },
      { description: 'Long description', childCount: 3 },
    );
    expect(layout).toMatchObject({
      width: 152,
      height: 104,
      descriptionLines: 0,
      tagRows: 0,
      hasChildrenRow: false,
    });
  });

  it('gives each shape its own resize minimum; cards keep theirs', () => {
    expect(sizeLimitsOf({ type: 'actor' }).min).toEqual({ width: 48, height: 72 });
    expect(sizeLimitsOf({ type: 'decision', display: 'shape' }).min).toEqual({
      width: 80,
      height: 56,
    });
    expect(sizeLimitsOf({ type: 'decision' })).toBe(CARD_SIZE_LIMITS);
    expect(sizeLimitsOf({})).toBe(CARD_SIZE_LIMITS);
  });
});
