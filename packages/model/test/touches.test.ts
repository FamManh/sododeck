import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, fromJSON, serializeDeck, toJSON } from '../src';
import { expectValid, seqIds, shopDeck } from './helpers';

function deckWithFlow(): SododeckFile {
  const file = shopDeck();
  file.flows = [{ id: 'fl', title: 'Checkout', steps: [{ id: 's', edge: 'r-orders-customer' }] }];
  return file;
}

function setup(file: SododeckFile = deckWithFlow()) {
  const doc = fromJSON(file);
  const editor = createEditor(doc, { newId: seqIds() });
  const touches = () => toJSON(doc).flows[0]?.steps[0]?.touches;
  return { doc, editor, touches };
}

function errorCode(fn: () => void): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof DeckEditError ? error.code : 'other';
  }
  return undefined;
}

describe('step touches (049)', () => {
  it('appends table and column touches in order, each one undo step', () => {
    const { doc, editor, touches } = setup();
    editor.addTouch('fl', 's', { table: 'orders', access: 'write' });
    editor.addTouch('fl', 's', { table: 'customers', column: 'c-email', access: 'read' });
    expect(touches()).toEqual([
      { table: 'orders', access: 'write' },
      { table: 'customers', column: 'c-email', access: 'read' },
    ]);
    expectValid(doc);
    editor.undo();
    expect(touches()).toEqual([{ table: 'orders', access: 'write' }]);
    editor.undo();
    expect(touches()).toBeUndefined();
  });

  it('keeps a table touch next to touches of its own columns', () => {
    const { editor, touches } = setup();
    editor.addTouch('fl', 's', { table: 'orders', access: 'write' });
    editor.addTouch('fl', 's', { table: 'orders', column: 'o-total', access: 'read' });
    expect(touches()).toHaveLength(2);
  });

  it('refuses a duplicate pair, a non-table, an unknown table, a foreign column and a bad access', () => {
    const { editor, touches } = setup();
    editor.addTouch('fl', 's', { table: 'orders', access: 'write' });
    expect(
      errorCode(() => {
        editor.addTouch('fl', 's', { table: 'orders', access: 'read' });
      }),
    ).toBe('invalid');
    expect(
      errorCode(() => {
        editor.addTouch('fl', 's', { table: 'db', access: 'read' });
      }),
    ).toBe('invalid');
    expect(
      errorCode(() => {
        editor.addTouch('fl', 's', { table: 'nope', access: 'read' });
      }),
    ).toBe('not-found');
    expect(
      errorCode(() => {
        editor.addTouch('fl', 's', { table: 'orders', column: 'c-email', access: 'read' });
      }),
    ).toBe('missing-reference');
    expect(
      errorCode(() => {
        editor.addTouch('fl', 's', { table: 'items', access: 'delete' as 'read' });
      }),
    ).toBe('invalid');
    expect(
      errorCode(() => {
        editor.addTouch('fl', 'x', { table: 'items', access: 'read' });
      }),
    ).toBe('not-found');
    expect(touches()).toEqual([{ table: 'orders', access: 'write' }]);
  });

  it('flips access by key and does nothing when unchanged', () => {
    const { editor, touches } = setup();
    editor.addTouch('fl', 's', { table: 'orders', access: 'write' });
    editor.addTouch('fl', 's', { table: 'orders', column: 'o-total', access: 'write' });
    editor.setTouchAccess('fl', 's', { table: 'orders', column: 'o-total' }, 'read');
    expect(touches()).toEqual([
      { table: 'orders', access: 'write' },
      { table: 'orders', column: 'o-total', access: 'read' },
    ]);
    const before = serializeDeck(toJSON(editor.doc));
    editor.setTouchAccess('fl', 's', { table: 'orders' }, 'write');
    expect(serializeDeck(toJSON(editor.doc))).toBe(before);
    editor.undo();
    expect(touches()?.[1]?.access).toBe('write');
    expect(
      errorCode(() => {
        editor.setTouchAccess('fl', 's', { table: 'items' }, 'read');
      }),
    ).toBe('not-found');
  });

  it('removes one touch by key and drops the field when the list empties', () => {
    const { editor, touches } = setup();
    editor.addTouch('fl', 's', { table: 'orders', access: 'write' });
    editor.addTouch('fl', 's', { table: 'items', access: 'read' });
    editor.removeTouch('fl', 's', { table: 'orders' });
    expect(touches()).toEqual([{ table: 'items', access: 'read' }]);
    editor.removeTouch('fl', 's', { table: 'items' });
    expect(touches()).toBeUndefined();
    editor.undo();
    expect(touches()).toEqual([{ table: 'items', access: 'read' }]);
    expect(
      errorCode(() => {
        editor.removeTouch('fl', 's', { table: 'orders' });
      }),
    ).toBe('not-found');
  });
});
