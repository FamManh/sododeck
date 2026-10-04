import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { shopDeck } from '../../../db/fixtures/shop';
import { useUiStore } from '../../../state/ui-store';
import { renderTableTab } from '../../../test/render-table-tab';
import { TypePicker } from './type-picker';

function render(columnId: string, tableId = 'orders') {
  return renderTableTab(shopDeck('postgres'), tableId, ({ deck, node }) => {
    const column = node.columns?.find((c) => c.id === columnId);
    return column === undefined ? null : (
      <TypePicker deck={deck} tableId={node.id} column={column} />
    );
  });
}

const columnOf = (view: ReturnType<typeof render>, id: string) =>
  view.table()?.columns?.find((c) => c.id === id);

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('TypePicker (052 US1)', () => {
  it('lists the deck enums first, then the dialect groups', async () => {
    const view = render('orders.customer_id');
    await view.user.click(screen.getByRole('combobox', { name: 'Type' }));
    const list = screen.getByRole('listbox', { name: 'Type suggestions' });
    const items = within(list).getAllByRole('presentation');
    expect(items[0]).toHaveTextContent('Enums in this deck');
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent('order_status');
    expect(items.map((i) => i.textContent)).toContain('Text');
  });

  it('filters while typing', async () => {
    const view = render('orders.customer_id');
    const input = screen.getByRole('combobox', { name: 'Type' });
    await view.user.clear(input);
    await view.user.type(input, 'timest');
    const names = within(screen.getByRole('listbox', { name: 'Type suggestions' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names).toEqual(expect.arrayContaining(['timestamp', 'timestamptz']));
    expect(names).not.toContain('uuid');
  });

  it('accepts a type outside the dialect list and marks it', async () => {
    const view = render('orders.customer_id');
    const input = screen.getByRole('combobox', { name: 'Type' });
    await view.user.clear(input);
    await view.user.type(input, 'citext{Enter}');
    expect(columnOf(view, 'orders.customer_id')?.type).toBe('citext');
    expect(screen.getByText('Not in the Postgres list')).toBeInTheDocument();
  });

  it('writes a list type and clears the enum link', async () => {
    const view = render('orders.status');
    await view.user.click(screen.getByRole('combobox', { name: 'Type' }));
    await view.user.click(screen.getByRole('option', { name: 'text' }));
    expect(columnOf(view, 'orders.status')).toMatchObject({ type: 'text' });
    expect(columnOf(view, 'orders.status')).not.toHaveProperty('enumRef');
    view.editor().undo();
    expect(columnOf(view, 'orders.status')).toMatchObject({
      type: 'order_status',
      enumRef: 'enum.order_status',
    });
  });

  it('picking an enum writes the link and the enum name as type', async () => {
    const view = render('orders.customer_id');
    await view.user.click(screen.getByRole('combobox', { name: 'Type' }));
    await view.user.click(screen.getByRole('option', { name: 'order_status' }));
    expect(columnOf(view, 'orders.customer_id')).toMatchObject({
      type: 'order_status',
      enumRef: 'enum.order_status',
    });
    expect(screen.queryByText('Not in the Postgres list')).not.toBeInTheDocument();
  });

  it('"No enum" clears the link only', async () => {
    const view = render('orders.status');
    await view.user.click(screen.getByRole('button', { name: 'No enum' }));
    const column = columnOf(view, 'orders.status');
    expect(column?.type).toBe('order_status');
    expect(column).not.toHaveProperty('enumRef');
  });

  it('"New enum…" creates and links an enum and opens the enum drawer', async () => {
    const view = render('orders.customer_id');
    await view.user.click(screen.getByRole('button', { name: 'New enum…' }));
    const column = columnOf(view, 'orders.customer_id');
    expect(column).toMatchObject({ type: 'enum_1' });
    expect(column?.enumRef).toBeDefined();
    const state = useUiStore.getState().drawer;
    expect(state).toMatchObject({ open: true, mode: 'enum', enumId: column?.enumRef });
  });

  it('"Edit enum" opens the linked enum', async () => {
    const view = render('orders.status');
    await view.user.click(screen.getByRole('button', { name: 'Edit enum' }));
    expect(useUiStore.getState().drawer).toMatchObject({
      mode: 'enum',
      enumId: 'enum.order_status',
    });
  });
});
