import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, fromJSON, serializeDeck, toJSON } from '../src';
import { expectValid, seqIds, shopDeck } from './helpers';

function twoDatabases(): SododeckFile {
  const file = shopDeck();
  file.nodes.push({ id: 'db2', type: 'database', title: 'Customers DB' });
  file.flows = [
    {
      id: 'fl',
      title: 'Checkout',
      steps: [
        {
          id: 's',
          edge: 'r-orders-customer',
          touches: [{ table: 'orders', column: 'o-total', access: 'write' }],
        },
      ],
    },
  ];
  return file;
}

function setup() {
  const doc = fromJSON(twoDatabases());
  const editor = createEditor(doc, { newId: seqIds() });
  const node = (id: string) => toJSON(doc).nodes.find((n) => n.id === id);
  return { doc, editor, node };
}

describe('setTableOwner (049)', () => {
  it('moves a table to another database card, keeping columns, edges and touches', () => {
    const { doc, editor, node } = setup();
    const before = toJSON(doc);
    editor.setTableOwner('orders', 'db2');
    const after = toJSON(doc);
    expect(node('orders')?.parent).toBe('db2');
    expect(node('orders')?.columns).toEqual(before.nodes.find((n) => n.id === 'orders')?.columns);
    expect(after.edges).toEqual(before.edges);
    expect(after.flows).toEqual(before.flows);
    expectValid(doc);
  });

  it('clears the owner with null and undo restores it in one step', () => {
    const { doc, editor, node } = setup();
    const before = serializeDeck(toJSON(doc));
    editor.setTableOwner('customers', null);
    expect(node('customers')?.parent).toBeUndefined();
    expect(editor.undo()).toBe(true);
    expect(serializeDeck(toJSON(doc))).toBe(before);
  });

  it('gives an unowned table an owner', () => {
    const { editor, node } = setup();
    expect(node('items')?.parent).toBeUndefined();
    editor.setTableOwner('items', 'db');
    expect(node('items')?.parent).toBe('db');
  });

  it('does nothing when the owner is already as asked', () => {
    const { editor } = setup();
    editor.setTableOwner('orders', 'db');
    editor.setTableOwner('items', null);
    expect(editor.canUndo()).toBe(false);
  });

  it('refuses a card that is not a database, a non-table and unknown ids', () => {
    const { editor, node } = setup();
    const code = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        return error instanceof DeckEditError ? error.code : 'other';
      }
      return undefined;
    };
    expect(
      code(() => {
        editor.setTableOwner('orders', 'customers');
      }),
    ).toBe('invalid');
    expect(
      code(() => {
        editor.setTableOwner('db', 'db2');
      }),
    ).toBe('invalid');
    expect(
      code(() => {
        editor.setTableOwner('orders', 'nope');
      }),
    ).toBe('not-found');
    expect(
      code(() => {
        editor.setTableOwner('nope', 'db');
      }),
    ).toBe('not-found');
    expect(node('orders')?.parent).toBe('db');
  });
});
