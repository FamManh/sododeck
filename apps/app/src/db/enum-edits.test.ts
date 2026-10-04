import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { createEnum, nextEnumName, renameEnum, renameEnumValue } from './enum-edits';
import { shopDeck } from './fixtures/shop';

const ENUM = 'enum.order_status';

function open() {
  const doc = fromJSON(shopDeck('postgres'));
  const editor = createEditor(doc, { captureTimeout: 0 });
  return { doc, editor, deck: () => toJSON(doc) };
}

const columns = (deck: ReturnType<typeof toJSON>) =>
  deck.nodes.flatMap((n) => (n.columns ?? []).map((c) => ({ table: n.id, ...c })));

describe('renameEnum', () => {
  it('sets the type of every linked column, and only those, in one undo step', () => {
    const { editor, deck } = open();
    const before = deck();
    renameEnum(editor, before, ENUM, 'order_state');
    const after = deck();
    expect(after.enums?.find((e) => e.id === ENUM)?.name).toBe('order_state');
    for (const column of columns(after)) {
      if (column.enumRef === ENUM) expect(column.type).toBe('order_state');
    }
    const changed = columns(after).filter((c, i) => c.type !== columns(before)[i]?.type);
    expect(changed.map((c) => `${c.table}.${c.name}`)).toEqual(['orders.status']);
    expect(editor.undo()).toBe(true);
    expect(deck()).toEqual(before);
  });
});

describe('renameEnumValue', () => {
  it('renames defaults equal to the old value on linked columns only, in one undo step', () => {
    const { editor, deck } = open();
    const before = deck();
    // An unlinked column with the same default text must stay as it is.
    editor.updateColumn('addresses', 'addresses.city', { default: 'pending' });
    editor.stopCapturing();
    const start = deck();
    renameEnumValue(editor, start, ENUM, 'enum.order_status.pending', 'waiting');
    const after = deck();
    const status = columns(after).find((c) => c.table === 'orders' && c.name === 'status');
    expect(status?.default).toBe('waiting');
    expect(columns(after).find((c) => c.name === 'city')?.default).toBe('pending');
    expect(
      after.enums?.find((e) => e.id === ENUM)?.values.find((v) => v.id.endsWith('.pending'))?.name,
    ).toBe('waiting');
    expect(editor.undo()).toBe(true);
    expect(deck()).toEqual(start);
    expect(before).not.toEqual(start);
  });

  it('leaves a default that differs from the old value alone', () => {
    const { editor, deck } = open();
    renameEnumValue(editor, deck(), ENUM, 'enum.order_status.paid', 'settled');
    const status = columns(deck()).find((c) => c.name === 'status' && c.table === 'orders');
    expect(status?.default).toBe('pending');
  });
});

describe('nextEnumName', () => {
  it('gives enum_1, then the first free number', () => {
    expect(nextEnumName([])).toBe('enum_1');
    expect(nextEnumName([{ name: 'enum_1' }, { name: 'enum_3' }])).toBe('enum_2');
    expect(nextEnumName([{ name: 'ENUM_1' }])).toBe('enum_2');
  });
});

describe('createEnum', () => {
  it('returns the new id and adds an empty enum named enum_1', () => {
    const { editor, deck } = open();
    const id = createEnum(editor, deck());
    const made = deck().enums?.find((e) => e.id === id);
    expect(made).toMatchObject({ name: 'enum_1', values: [] });
  });

  it('links the column in the same undo step', () => {
    const { editor, deck } = open();
    const start = deck();
    const id = createEnum(editor, start, {
      linkColumn: { tableId: 'orders', columnId: 'orders.shipping_address_id' },
    });
    const column = columns(deck()).find((c) => c.id === 'orders.shipping_address_id');
    expect(column).toMatchObject({ enumRef: id, type: 'enum_1' });
    expect(editor.undo()).toBe(true);
    expect(deck()).toEqual(start);
  });
});
