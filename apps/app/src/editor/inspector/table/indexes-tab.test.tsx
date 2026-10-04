import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../../test/render-canvas';
import { renderTableTab } from '../../../test/render-table-tab';
import { IndexesTab } from './indexes-tab';

const make = (dialect?: 'postgres' | 'sqlite', method?: string) =>
  deckOf({
    name: 'Shop',
    ...(dialect === undefined ? {} : { dialect }),
    nodes: [
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        columns: [
          { id: 'o-id', name: 'id', type: 'uuid' },
          { id: 'o-customer', name: 'customer_id', type: 'uuid' },
          { id: 'o-at', name: 'created_at', type: 'timestamptz' },
        ],
        indexes: [{ id: 'ix', columns: ['o-customer'], ...(method ? { method } : {}) }],
      },
      { id: 'empty', type: 'db-table', title: 'empty' },
    ] as never,
  });

const indexOf = (n: number) =>
  screen.getAllByRole('listitem', { name: /^Index / })[n] as HTMLElement;

describe('IndexesTab', () => {
  it('adds an unnamed index on the first column, as one undo step', async () => {
    const { user, table, editor } = renderTableTab(make('postgres'), 'orders', IndexesTab);
    await user.click(screen.getByRole('button', { name: '+ Index' }));
    expect(table()?.indexes).toHaveLength(2);
    expect(table()?.indexes?.[1]).toMatchObject({ columns: ['o-id'] });
    expect(table()?.indexes?.[1]?.name).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(table()?.indexes).toHaveLength(1);
  });

  it('disables "+ Index" for a table without columns', () => {
    renderTableTab(make(), 'empty', IndexesTab);
    expect(screen.getByRole('button', { name: '+ Index' })).toBeDisabled();
  });

  it('adds, removes and reorders column chips', async () => {
    const { user, table } = renderTableTab(make('postgres'), 'orders', IndexesTab);
    const row = within(indexOf(0));
    await user.click(row.getByRole('button', { name: '+ Column' }));
    await user.click(screen.getByRole('menuitem', { name: 'created_at' }));
    expect(table()?.indexes?.[0]?.columns).toEqual(['o-customer', 'o-at']);
    screen.getByRole('group', { name: 'created_at' }).focus();
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(table()?.indexes?.[0]?.columns).toEqual(['o-at', 'o-customer']);
    await user.click(row.getByRole('button', { name: 'Remove created_at' }));
    expect(table()?.indexes?.[0]?.columns).toEqual(['o-customer']);
    expect(row.getByRole('button', { name: 'Remove customer_id' })).toBeDisabled();
  });

  it('adds an expression part', async () => {
    const { user, table } = renderTableTab(make('postgres'), 'orders', IndexesTab);
    const row = within(indexOf(0));
    await user.click(row.getByRole('button', { name: '+ Expression' }));
    await user.type(row.getByRole('textbox', { name: 'Expression' }), 'lower(id){Enter}');
    expect(table()?.indexes?.[0]?.columns).toEqual(['o-customer', { expr: 'lower(id)' }]);
  });

  it('writes unique, name, note and removes the index from the menu', async () => {
    const { user, table, editor } = renderTableTab(make('postgres'), 'orders', IndexesTab);
    const row = within(indexOf(0));
    await user.click(row.getByRole('switch', { name: 'Unique' }));
    expect(table()?.indexes?.[0]?.unique).toBe(true);
    await user.click(row.getByRole('switch', { name: 'Unique' }));
    expect(table()?.indexes?.[0]?.unique).toBeUndefined();
    await user.type(row.getByRole('textbox', { name: 'Index name' }), 'orders_customer{Enter}');
    expect(table()?.indexes?.[0]?.name).toBe('orders_customer');
    await user.type(row.getByRole('textbox', { name: 'Index note' }), 'Lookup by customer');
    await user.tab();
    expect(table()?.indexes?.[0]?.note).toBe('Lookup by customer');
    act(() => {
      editor().undo();
    });
    expect(table()?.indexes?.[0]?.note).toBeUndefined();
    await user.click(row.getByRole('button', { name: 'Index options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete index' }));
    expect(table()?.indexes ?? []).toEqual([]);
  });

  it('offers the dialect methods and clears the method on "Default"', async () => {
    const { user, table } = renderTableTab(make('postgres'), 'orders', IndexesTab);
    const method = within(indexOf(0)).getByRole('combobox', { name: 'Method' });
    await user.clear(method);
    await user.type(method, 'gin');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(table()?.indexes?.[0]?.method).toBe('gin');
    await user.clear(method);
    await user.type(method, 'Default');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(table()?.indexes?.[0]?.method).toBeUndefined();
  });

  it('hides the method on SQLite unless one is stored', () => {
    const { unmount } = renderTableTab(make('sqlite'), 'orders', IndexesTab);
    expect(screen.queryByRole('combobox', { name: 'Method' })).not.toBeInTheDocument();
    unmount();
    renderTableTab(make('sqlite', 'gin'), 'orders', IndexesTab);
    expect(screen.getByRole('combobox', { name: 'Method' })).toHaveValue('gin');
  });
});
