import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { PLACE_GAP_X, PLACE_GAP_Y, placeNewTables, type SizeOf } from './place-new-tables';

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
});
