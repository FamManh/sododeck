import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { cardBox, type Rect } from './canvas-geometry';
import { belowCard, placeTables } from './place-tables';

const table = (id: string, parent: string | undefined, x: number, y: number) => ({
  id,
  type: 'db-table' as const,
  title: id,
  position: { x, y },
  columns: [{ id: `${id}-id`, name: 'id', type: 'int' }],
  ...(parent === undefined ? {} : { parent }),
});

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'odb', type: 'database', title: 'Orders DB', position: { x: 0, y: 0 } },
    { id: 'svc', type: 'service', title: 'Svc', position: { x: 0, y: 200 } },
    table('a', 'odb', 0, 0),
    table('b', 'odb', 0, 0),
    table('c', 'odb', 900, 900),
  ],
};

const overlaps = (x: Rect, y: Rect) =>
  x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height;

describe('placeTables (049 T016)', () => {
  it('places tables leaving a card so they overlap nothing on the level above', () => {
    const moving = ['a', 'b'];
    const placed = placeTables(deck, moving, undefined, belowCard(deck, 'odb'));
    const boxes = deck.nodes.map((node, index) => {
      const at = placed.get(node.id);
      return {
        id: node.id,
        top: node.parent === undefined || moving.includes(node.id),
        box: { ...cardBox(node, index, 'system'), ...(at ?? {}) },
      };
    });
    const top = boxes.filter((b) => b.top);
    for (const x of top) {
      for (const y of top)
        if (x !== y) expect(overlaps(x.box, y.box), `${x.id}/${y.id}`).toBe(false);
    }
  });

  it('keeps a spot that is already free at the new level', () => {
    expect(placeTables(deck, ['c'], undefined, { x: 0, y: 0 }).size).toBe(0);
  });

  it('starts below the card it leaves', () => {
    const below = belowCard(deck, 'odb');
    expect(below.x).toBe(0);
    expect(below.y).toBeGreaterThan(0);
  });
});
