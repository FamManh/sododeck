import { describe, expect, it } from 'vitest';

import {
  anchorPoint,
  arrowHead,
  cardHeight,
  crowFoot,
  curve,
  DECK,
  roundedPath,
  textLines,
} from './geometry';

describe('textLines', () => {
  it('counts nothing for empty text and one line for a short title', () => {
    expect(textLines('', 156, 14)).toBe(0);
    expect(textLines('Order Service', 156, 14)).toBe(1);
  });

  it('wraps long text and caps it at max', () => {
    const long = 'Retries reuse the order id so the provider sees one charge only once';
    expect(textLines(long, 156, 12)).toBe(3);
    expect(textLines(long, 156, 12, 2)).toBe(2);
  });
});

describe('cardHeight', () => {
  it('measures header, title and description like the design board', () => {
    // 2·1.5 border + 2·12 pad + 24 header + 8 + 14·1.28 + 8 + 12·1.4 = 101.72
    expect(cardHeight({ title: 'Order Service', description: 'Creates the order' })).toBe(102);
  });

  it('adds field rows, tag rows and the "inside" row', () => {
    const base = cardHeight({ title: 'Orders DB' });
    expect(cardHeight({ title: 'Orders DB', fields: 2 })).toBe(base + DECK.gap + 48);
    expect(cardHeight({ title: 'Orders DB', tags: 4 })).toBe(base + DECK.gap + 2 * DECK.tagRow);
    expect(cardHeight({ title: 'Orders DB', inside: true })).toBe(base + DECK.gap + 24);
  });
});

describe('anchorPoint', () => {
  const box = { x: 10, y: 20, w: 184, h: 100 };

  it('attaches left and right at the anchor, top and bottom at the middle', () => {
    expect(anchorPoint(box, 'l')).toEqual({ x: 10, y: 50 });
    expect(anchorPoint(box, 'r')).toEqual({ x: 194, y: 50 });
    expect(anchorPoint(box, 't')).toEqual({ x: 102, y: 20 });
    expect(anchorPoint(box, 'b')).toEqual({ x: 102, y: 120 });
  });

  it('keeps the anchor inside a short box and honours an explicit offset', () => {
    expect(anchorPoint({ ...box, h: 40 }, 'r')).toEqual({ x: 194, y: 40 });
    expect(anchorPoint(box, 't', 150)).toEqual({ x: 160, y: 20 });
  });
});

describe('curve', () => {
  it('starts and ends at its points and leaves each side along its normal', () => {
    const geometry = curve({ x: 0, y: 0 }, 'b', { x: 0, y: 100 }, 't');
    expect(geometry.d).toBe('M0 0 C0 42 0 58 0 100');
    expect(geometry.at(0)).toEqual({ x: 0, y: 0 });
    expect(geometry.at(1)).toEqual({ x: 0, y: 100 });
    expect(geometry.at(0.5).y).toBeCloseTo(50);
  });

  it('uses handles of at least 28px for close cards', () => {
    expect(curve({ x: 0, y: 0 }, 'r', { x: 10, y: 0 }, 'l').d).toBe('M0 0 C28 0 -18 0 10 0');
  });
});

describe('roundedPath', () => {
  it('rounds every inner corner', () => {
    const d = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      10,
    );
    expect(d).toBe('M0 0 L90 0 Q100 0 100 10 L100 100');
  });

  it('is empty without points', () => {
    expect(roundedPath([], 10)).toBe('');
  });
});

describe('arrowHead', () => {
  it('points into the side it enters', () => {
    expect(arrowHead({ x: 50, y: 50 }, 't')).toBe('M50 49L55 41L45 41Z');
  });
});

describe('crowFoot', () => {
  const p = { x: 0, y: 0 };
  const u = { x: 1, y: 0 };

  it('draws one bar for "one" and toes plus a ring for "zero or many"', () => {
    expect(crowFoot(p, u, 'one')).toEqual({ paths: ['M10 -6L10 6'], rings: [] });
    expect(crowFoot(p, u, 'zmany')).toEqual({
      paths: ['M0 -6L12 0L0 6'],
      rings: [{ x: 20, y: 0 }],
    });
  });

  it('draws a bar and a ring for "zero or one" and toes plus a bar for "many"', () => {
    expect(crowFoot(p, u, 'zone').rings).toEqual([{ x: 17, y: 0 }]);
    expect(crowFoot(p, u, 'many').paths).toHaveLength(2);
  });
});
