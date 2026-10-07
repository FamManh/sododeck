import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { ARRANGE_GAP, arrangeRequest, placeArranged } from './arrange-tables';
import { cardBox } from './canvas-geometry';

const table = (id: string, x: number, y: number, parent?: string): Node => ({
  id,
  type: 'db-table',
  title: id,
  position: { x, y },
  columns: [
    { id: `${id}-id`, name: 'id', type: 'uuid', pk: true },
    { id: `${id}-ref`, name: 'ref_id', type: 'uuid' },
  ],
  ...(parent === undefined ? {} : { parent }),
});
const deckOf = (nodes: Node[], edges: SododeckFile['edges'] = []): SododeckFile => ({
  ...emptySododeckFile(),
  nodes,
  edges,
});
const fk = (id: string, child: string, parent: string) => ({
  id,
  from: child,
  to: parent,
  fromColumns: [`${child}-ref`],
  toColumns: [`${parent}-id`],
  cardinality: 'n-1' as const,
});

describe('arrangeRequest', () => {
  it('sends the tables and only the relationships between them, referenced table first', () => {
    const deck = deckOf(
      [table('a', 0, 0), table('b', 0, 300), table('c', 0, 600)],
      [fk('ab', 'b', 'a'), fk('ca', 'c', 'a')],
    );
    const request = arrangeRequest(deck, ['a', 'b']);
    expect(request.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(request.edges).toHaveLength(1);
    expect(request.edges[0]).toMatchObject({ id: 'ab', source: 'a', target: 'b' });
    expect(request.edges[0]?.sourceY).toBeDefined();
  });
});

describe('placeArranged', () => {
  it('keeps the top-left corner the tables had together', () => {
    const deck = deckOf([table('a', 100, 200), table('b', 100, 600)]);
    const placed = placeArranged(deck, ['a', 'b'], { a: { x: 0, y: 50 }, b: { x: 400, y: 0 } });
    expect(placed.get('a')).toEqual({ x: 100, y: 250 });
    expect(placed.get('b')).toEqual({ x: 500, y: 200 });
  });

  it('moves right past a card at the same level it would cover', () => {
    const other: Node = {
      id: 'card',
      type: 'service',
      title: 'Card',
      position: { x: 500, y: 200 },
    };
    const deck = deckOf([table('a', 100, 200), table('b', 100, 600), other]);
    const placed = placeArranged(deck, ['a', 'b'], { a: { x: 0, y: 0 }, b: { x: 400, y: 0 } });
    const box = cardBox(other, 2, 'system');
    expect(placed.get('a')?.x).toBe(box.x + box.width + ARRANGE_GAP);
  });

  it('ignores cards at another level', () => {
    const inside = table('inside', 500, 200, 'db');
    const deck = deckOf([table('a', 100, 200), table('b', 100, 600), inside]);
    const placed = placeArranged(deck, ['a', 'b'], { a: { x: 0, y: 0 }, b: { x: 400, y: 0 } });
    expect(placed.get('a')).toEqual({ x: 100, y: 200 });
  });
});
