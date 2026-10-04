import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { existingRects, importTarget, newDeckName, targetContext } from './import-target';

const card = { id: 'card.db', type: 'database', title: 'Orders DB', position: { x: 0, y: 0 } };
const selected = { selection: ['card.db'], drill: [] };

describe('import targets (044 FR-004, FR-019)', () => {
  it('offers the selected or drilled database card first', () => {
    expect(targetContext(deckOf({ nodes: [card] }), selected).options.map((o) => o.label)).toEqual([
      'Import into Orders DB',
      'New deck',
    ]);
    expect(
      targetContext(deckOf({ nodes: [card] }), {
        selection: [],
        drill: [{ kind: 'node', id: 'card.db' }],
      }).card?.cardId,
    ).toBe('card.db');
  });

  it('does not offer a locked card (043)', () => {
    const context = targetContext(deckOf({ nodes: [{ ...card, locked: true }] }), selected);
    expect(context.card).toBeNull();
    expect(context.options[0]?.label).toBe('Import into this deck');
  });

  it('describes the target deck to the worker', () => {
    const deck = deckOf({
      dialect: 'mysql',
      description: 'About',
      nodes: [{ id: 't', type: 'db-table', title: 'orders', schema: 'shop', columns: [] }],
      enums: [{ id: 'e', name: 'mood', values: [] }],
    });
    expect(importTarget(deck, 'deck')).toEqual({
      kind: 'deck',
      deckDialect: 'mysql',
      deckHasTables: true,
      deckHasDescription: true,
      tableNames: [{ schema: 'shop', name: 'orders' }],
      enumNames: [{ name: 'mood' }],
    });
    expect(importTarget(deck, 'new-deck')).toMatchObject({
      deckDialect: 'generic',
      tableNames: [],
    });
  });

  it('lists the boxes of the target container', () => {
    const deck = deckOf({
      nodes: [
        card,
        {
          id: 'in',
          type: 'db-table',
          title: 'in',
          parent: 'card.db',
          position: { x: 50, y: 60 },
          columns: [],
        },
      ],
    });
    expect(existingRects(deck).map((r) => [r.x, r.y])).toEqual([[0, 0]]);
    expect(existingRects(deck, 'card.db').map((r) => [r.x, r.y])).toEqual([[50, 60]]);
  });

  it('names a new deck after the file', () => {
    expect(newDeckName('shop.sql')).toBe('shop');
    expect(newDeckName(undefined)).toBe('Imported schema');
  });
});
