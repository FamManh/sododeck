import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../../test/render-canvas';
import { renderTableTab } from '../../../test/render-table-tab';
import { GeneralTab } from './general-tab';

const deck = deckOf({
  name: 'Shop',
  nodes: [
    {
      id: 'orders',
      type: 'db-table',
      title: 'orders',
      columns: [{ id: 'o-id', name: 'id', type: 'uuid' }],
    },
    { id: 'customers', type: 'db-table', title: 'customers' },
    { id: 'audit-orders', type: 'db-table', title: 'orders', schema: 'audit' },
  ] as never,
});

const setup = () => renderTableTab(deck, 'orders', GeneralTab);

describe('GeneralTab', () => {
  it('renames the table as one undo step', async () => {
    const { user, table, editor } = setup();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'purchases{Enter}');
    expect(table()?.title).toBe('purchases');
    act(() => {
      editor().undo();
    });
    expect(table()?.title).toBe('orders');
    expect(editor().canUndo()).toBe(false);
  });

  it('refuses a name already used in the same schema, but not in another one', async () => {
    const { user, table } = setup();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'customers');
    expect(
      screen.getByText('A table named customers already exists in the default schema'),
    ).toBeVisible();
    expect(table()?.title).not.toBe('customers');
    await user.tab();
    expect(table()?.title).toBe('orders');
    // `orders` already exists in `audit`, so setting this table's schema to audit is refused.
    const schema = screen.getByRole('textbox', { name: 'Schema' });
    await user.type(schema, 'audit');
    expect(screen.getByText('A table named orders already exists in audit')).toBeVisible();
    expect(table()?.schema).not.toBe('audit');
    await user.clear(schema);
    await user.type(schema, 'sales{Enter}');
    expect(table()?.schema).toBe('sales');
  });

  it('picks the detail, with "Use deck setting" clearing it', async () => {
    const { user, table } = setup();
    const detail = screen.getByRole('combobox', { name: 'Detail' });
    await user.clear(detail);
    await user.type(detail, 'Keys');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(table()?.detail).toBe('keys');
    await user.clear(detail);
    await user.type(detail, 'Use');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(table()?.detail).toBeUndefined();
  });

  it('writes the note, owner and links, each focus session one undo step', async () => {
    const { user, table, editor } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'One row per order.');
    await user.tab();
    expect(table()?.description).toBe('One row per order.');
    const owner = screen.getByRole('combobox', { name: 'Owner' });
    await user.type(owner, 'Payments{Enter}');
    expect(table()?.owner).toBe('Payments');
    act(() => {
      editor().undo();
    });
    expect(table()?.owner).toBeUndefined();
    expect(table()?.description).toBe('One row per order.');
    expect(screen.getByRole('textbox', { name: 'Add link' })).toBeInTheDocument();
  });

  it('adds a tag as its own undo step', async () => {
    const { user, table, editor } = setup();
    await user.click(screen.getByRole('button', { name: /add tag/i }));
    await user.keyboard('core{Enter}');
    expect(table()?.tags).toEqual(['core']);
    act(() => {
      editor().undo();
    });
    expect(table()?.tags).toBeUndefined();
  });
});
