import { describe, expect, it } from 'vitest';

import { ORDER_STATUS, TABLES } from './checkout-deck';
import { enumGeometry, layoutRelationship, tableGeometry } from './schema';
import { NARROW, WIDE } from './schema-worlds';

describe('tableGeometry', () => {
  it('sizes the card from its rows and index footer', () => {
    const g = tableGeometry(TABLES.orders);
    expect(g.top).toBe(71.5);
    expect(g.h).toBe(71.5 + 5 * 24 + 24 + 8 + 1.5);
    expect(tableGeometry(TABLES.payments).h).toBe(71.5 + 5 * 24 + 8 + 1.5);
  });

  it('puts each column at the centre of its row', () => {
    const g = tableGeometry(TABLES.orders);
    expect(g.rowY('id')).toBe(83.5);
    expect(g.rowY('customer_id')).toBe(107.5);
    expect(g.rowY('nope')).toBe(g.top / 2);
  });

  it('widens the key column when a column is both primary and foreign key', () => {
    expect(tableGeometry(TABLES.order_items).keyWidth).toBe(30);
    expect(tableGeometry(TABLES.orders).keyWidth).toBe(16);
  });
});

describe('enumGeometry', () => {
  it('lays four values out in two rows', () => {
    expect(enumGeometry(ORDER_STATUS)).toEqual({ w: 200, h: 133 });
  });
});

describe('layoutRelationship', () => {
  const rowY = () => 10;
  const rel = {
    from: 'a',
    fromColumn: 'x',
    to: 'b',
    toColumn: 'y',
    fromEnd: 'zmany',
    toEnd: 'one',
  } as const;

  it('leaves each card on the side facing the other, at the column row', () => {
    const layout = layoutRelationship(
      rel,
      { x: 0, y: 0, w: 100, rowY },
      { x: 200, y: 50, w: 100, rowY },
    );
    expect(layout.start).toEqual({ x: 100, y: 10 });
    expect(layout.end).toEqual({ x: 200, y: 60 });
    expect(layout.ends).toHaveLength(2);
  });

  it('uses the right sides when the cards overlap, or the forced sides', () => {
    const a = { x: 0, y: 0, w: 100, rowY };
    const b = { x: 50, y: 200, w: 100, rowY };
    expect(layoutRelationship(rel, a, b).end.x).toBe(150);
    expect(layoutRelationship({ ...rel, sides: ['l', 'l'] }, a, b).end.x).toBe(50);
  });
});

describe('schema worlds', () => {
  it('only relates tables and proxies that are on the board', () => {
    for (const world of [WIDE, NARROW]) {
      const keys = new Set([...world.tables.map((t) => t.key), 'cust']);
      for (const rel of world.relationships) {
        expect(keys.has(rel.from) && keys.has(rel.to)).toBe(true);
      }
      for (const lit of world.lit) expect(keys.has(lit.key)).toBe(true);
    }
  });

  it('keeps every table inside the Orders DB frame', () => {
    for (const world of [WIDE, NARROW]) {
      for (const placed of world.tables) {
        const g = tableGeometry(placed.table);
        expect(placed.x).toBeGreaterThanOrEqual(world.frame.x);
        expect(placed.x + g.w).toBeLessThanOrEqual(world.frame.x + world.frame.w);
        expect(placed.y + g.h).toBeLessThanOrEqual(world.frame.y + world.frame.h);
      }
    }
  });
});
