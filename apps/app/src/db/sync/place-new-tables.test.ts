import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  MAX_COLUMN_HEIGHT,
  PLACE_GAP_X,
  PLACE_GAP_Y,
  placeNewTables,
  type PlaceLink,
  type SizeOf,
} from './place-new-tables';

const sizeOf: SizeOf = () => ({ width: 200, height: 100 });
const VIEWPORT = { x: 0, y: 0, width: 1000, height: 600 };
const table = (id: string, x: number, y: number): Node => ({
  id,
  type: 'db-table',
  title: id,
  position: { x, y },
  columns: [],
});
const deckOf = (nodes: Node[]): SododeckFile => ({ ...emptySododeckFile(), nodes });

describe('placeNewTables', () => {
  it('puts the first new table right of the scope with the gap, at its top', () => {
    const deck = deckOf([table('a', 0, 50), table('b', 300, 200)]);
    const placed = placeNewTables(deck, ['a', 'b'], [table('n', 0, 0)], VIEWPORT, sizeOf);
    expect(placed.get('n')).toEqual({ x: 300 + 200 + PLACE_GAP_X, y: 50 });
  });

  it('stacks several new tables without overlap', () => {
    const deck = deckOf([table('a', 0, 0)]);
    const placed = placeNewTables(
      deck,
      ['a'],
      [table('n1', 0, 0), table('n2', 0, 0)],
      VIEWPORT,
      sizeOf,
    );
    const first = placed.get('n1');
    const second = placed.get('n2');
    expect(first).toEqual({ x: 360, y: 0 });
    expect(second).toEqual({ x: 360, y: 100 + PLACE_GAP_Y });
  });

  it('moves below any card it would land on', () => {
    const deck = deckOf([table('a', 0, 0), table('other', 360, 0)]);
    const placed = placeNewTables(deck, ['a'], [table('n', 0, 0)], VIEWPORT, sizeOf);
    expect(placed.get('n')).toEqual({ x: 360, y: 100 + PLACE_GAP_Y });
  });

  it('uses the viewport centre in an empty deck', () => {
    const placed = placeNewTables(deckOf([]), [], [table('n', 0, 0)], VIEWPORT, sizeOf);
    expect(placed.get('n')).toEqual({ x: 500, y: 300 });
  });

  it('places next to the deck tables when the scope is empty but tables exist', () => {
    const deck = deckOf([table('a', 100, 100)]);
    const placed = placeNewTables(deck, [], [table('n', 0, 0)], VIEWPORT, sizeOf);
    expect(placed.get('n')).toEqual({ x: 100 + 200 + PLACE_GAP_X, y: 100 });
  });

  describe('with relationships between the new tables', () => {
    const step = 200 + PLACE_GAP_X;
    const at = (placed: Map<string, { x: number; y: number }>, id: string) => placed.get(id);
    const place = (ids: string[], links: PlaceLink[]) =>
      placeNewTables(
        deckOf([]),
        [],
        ids.map((id) => table(id, 0, 0)),
        VIEWPORT,
        sizeOf,
        links,
      );

    it('puts a referenced table left of the tables that point at it', () => {
      const placed = place(['child', 'parent'], [{ parent: 'parent', child: 'child' }]);
      expect(at(placed, 'parent')).toEqual({ x: 500, y: 300 });
      expect(at(placed, 'child')).toEqual({ x: 500 + step, y: 300 });
    });

    it('lays a pasted schema out in layers, breaking a cycle (the bug report)', () => {
      const links: PlaceLink[] = [
        { parent: 'vessel', child: 'candidate' },
        { parent: 'candidate', child: 'apm' },
        { parent: 'candidate', child: 'invoice' },
        { parent: 'candidate', child: 'history' },
        { parent: 'candidate', child: 'calc' },
        { parent: 'calc', child: 'candidate' },
        { parent: 'calc', child: 'history' },
        { parent: 'vessel', child: 'queue' },
      ];
      const ids = ['vessel', 'candidate', 'apm', 'invoice', 'history', 'calc', 'queue'];
      const placed = place(ids, links);
      const column = (id: string) => ((at(placed, id)?.x ?? NaN) - 500) / step;
      expect(ids.map(column)).toEqual([0, 1, 2, 2, 3, 2, 1]);
      const ys = [...placed.values()].map((p) => `${String(p.x)},${String(p.y)}`);
      expect(new Set(ys).size).toBe(ids.length);
    });

    it('wraps a tall layer into further columns', () => {
      const count = Math.floor(MAX_COLUMN_HEIGHT / (100 + PLACE_GAP_Y)) + 2;
      const ids = Array.from({ length: count }, (_, i) => `t${String(i)}`);
      const placed = place(ids, []);
      const xs = new Set([...placed.values()].map((p) => p.x));
      expect(xs.size).toBe(2);
      for (const p of placed.values())
        expect(p.y - 300 + 100).toBeLessThanOrEqual(MAX_COLUMN_HEIGHT);
    });

    it('ignores links to tables that are not new, and self links', () => {
      const placed = place(
        ['a'],
        [
          { parent: 'outside', child: 'a' },
          { parent: 'a', child: 'a' },
        ],
      );
      expect(at(placed, 'a')).toEqual({ x: 500, y: 300 });
    });
  });
});
