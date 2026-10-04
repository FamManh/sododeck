import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { shopDeck } from '../../../db/fixtures/shop';
import { useUiStore } from '../../../state/ui-store';
import { renderTableTab } from '../../../test/render-table-tab';
import { ColumnsTab } from './columns-tab';

const render = (tableId = 'customers') => renderTableTab(shopDeck('postgres'), tableId, ColumnsTab);

type View = ReturnType<typeof render>;
const column = (view: View, id: string) => view.table()?.columns?.find((c) => c.id === id);
const names = (view: View) => view.table()?.columns?.map((c) => c.name);
const expand = async (view: View, name: string) => {
  await view.user.click(screen.getByRole('button', { name: new RegExp(`^${name}\\b`) }));
};

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('ColumnsTab rows (052 US1)', () => {
  it('shows each column with its key, name, type and not-null badge', () => {
    render();
    const email = screen.getByRole('button', { name: /^email\b/ });
    expect(email).toHaveTextContent('varchar(255)');
    expect(within(email).getByText('NN')).toBeInTheDocument();
    const id = screen.getByRole('button', { name: /^id\b/ });
    expect(id).toHaveAccessibleName(/primary key/);
  });

  it('filters the rows by name or type', async () => {
    const view = render();
    await view.user.type(screen.getByRole('searchbox', { name: 'Filter columns' }), 'time');
    expect(screen.getByRole('button', { name: /^created_at\b/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^email\b/ })).not.toBeInTheDocument();
  });

  it('adds column_n expanded with its name focused, as one undo step', async () => {
    const view = render();
    await view.user.click(screen.getByRole('button', { name: 'Column' }));
    expect(names(view)).toEqual(['id', 'email', 'name', 'created_at', 'column_1']);
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('column_1');
    expect(name).toHaveFocus();
    act(() => {
      view.editor().undo();
    });
    expect(names(view)).toEqual(['id', 'email', 'name', 'created_at']);
  });

  it('expands a row on click and Enter, one at a time', async () => {
    const view = render();
    await expand(view, 'email');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('email');
    await view.user.click(screen.getByRole('button', { name: /^name\b/ }));
    expect(screen.getAllByRole('textbox', { name: 'Name' })).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('name');
    screen.getByRole('button', { name: /^id\b/ }).focus();
    await view.user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('id');
  });
});

describe('ColumnsTab fields (052 US1)', () => {
  it('writes the name, refusing a duplicate', async () => {
    const view = render();
    await expand(view, 'email');
    const name = screen.getByRole('textbox', { name: 'Name' });
    await view.user.clear(name);
    await view.user.type(name, 'NAME');
    expect(screen.getByText('NAME is already a column of customers')).toBeInTheDocument();
    expect(column(view, 'customers.email')?.name).not.toBe('NAME');
    await view.user.clear(name);
    await view.user.type(name, 'mail');
    await waitFor(() => {
      expect(column(view, 'customers.email')?.name).toBe('mail');
    });
    await view.user.tab();
    act(() => {
      view.editor().undo();
    });
    expect(column(view, 'customers.email')?.name).toBe('email');
  });

  it('shows one length field for varchar and writes size', async () => {
    const view = render();
    await expand(view, 'email');
    const length = screen.getByRole('textbox', { name: 'Length' });
    expect(length).toHaveValue('255');
    await view.user.clear(length);
    await view.user.type(length, '320');
    await waitFor(() => {
      expect(column(view, 'customers.email')?.size).toBe('320');
    });
    await view.user.clear(length);
    await view.user.tab();
    expect(column(view, 'customers.email')).not.toHaveProperty('size');
  });

  it('shows precision and scale for numeric types and writes "10,2"', async () => {
    const view = render('orders');
    await expand(view, 'total');
    const precision = screen.getByRole('textbox', { name: 'Precision' });
    const scale = screen.getByRole('textbox', { name: 'Scale' });
    expect([precision, scale].map((i) => (i as HTMLInputElement).value)).toEqual(['10', '2']);
    await view.user.clear(scale);
    await view.user.type(scale, '4');
    await waitFor(() => {
      expect(column(view, 'orders.total')?.size).toBe('10,4');
    });
  });

  it('shows no size field for a type without one', async () => {
    const view = render();
    await expand(view, 'id');
    expect(screen.queryByRole('textbox', { name: 'Length' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Precision' })).not.toBeInTheDocument();
  });

  it('toggles the flags, writing true or removing the key', async () => {
    const view = render();
    await expand(view, 'name');
    for (const [label, key] of [
      ['Primary key', 'pk'],
      ['Not null', 'notNull'],
      ['Unique', 'unique'],
      ['Auto-increment', 'increment'],
    ] as const) {
      const toggle = screen.getByRole('switch', { name: label });
      const before = toggle.getAttribute('aria-checked') === 'true';
      await view.user.click(toggle);
      if (before) expect(column(view, 'customers.name')).not.toHaveProperty(key);
      else expect(column(view, 'customers.name')).toHaveProperty(key, true);
    }
    act(() => {
      view.editor().undo();
    });
    expect(column(view, 'customers.name')).not.toHaveProperty('increment');
  });

  it('writes a value or an expression default and clears the other', async () => {
    const view = render();
    await expand(view, 'created_at');
    expect(screen.getByRole('radio', { name: 'Expression' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Default' })).toHaveValue('now()');
    await view.user.click(screen.getByRole('radio', { name: 'Value' }));
    const field = screen.getByRole('textbox', { name: 'Default' });
    await view.user.clear(field);
    await view.user.type(field, 'never');
    await waitFor(() => {
      expect(column(view, 'customers.created_at')).toMatchObject({ default: 'never' });
    });
    expect(column(view, 'customers.created_at')).not.toHaveProperty('defaultExpr');
    await view.user.click(screen.getByRole('radio', { name: 'Expression' }));
    const expr = screen.getByRole('textbox', { name: 'Default' });
    await view.user.clear(expr);
    await view.user.type(expr, 'now()');
    await waitFor(() => {
      expect(column(view, 'customers.created_at')).toMatchObject({ defaultExpr: 'now()' });
    });
    expect(column(view, 'customers.created_at')).not.toHaveProperty('default');
  });

  it('writes the check and the note, empty clearing them', async () => {
    const view = render();
    await expand(view, 'email');
    await view.user.type(screen.getByRole('textbox', { name: 'Check' }), "email <> ''");
    await view.user.type(screen.getByRole('textbox', { name: 'Note' }), 'login');
    await waitFor(() => {
      expect(column(view, 'customers.email')).toMatchObject({
        check: "email <> ''",
        note: 'login',
      });
    });
    await view.user.clear(screen.getByRole('textbox', { name: 'Note' }));
    await view.user.tab();
    expect(column(view, 'customers.email')).not.toHaveProperty('note');
  });

  it('moves a row with ⌥↓ and ⌥↑, one step each', async () => {
    const view = render();
    screen.getByRole('button', { name: /^id\b/ }).focus();
    await view.user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(names(view)).toEqual(['email', 'id', 'name', 'created_at']);
    await view.user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(names(view)).toEqual(['id', 'email', 'name', 'created_at']);
    act(() => {
      view.editor().undo();
    });
    expect(names(view)).toEqual(['email', 'id', 'name', 'created_at']);
  });

  it('deletes a column with the Undo toast, from the button and from ⌫ on the row', async () => {
    const view = render();
    await expand(view, 'name');
    await view.user.click(screen.getByRole('button', { name: 'Delete column' }));
    expect(names(view)).toEqual(['id', 'email', 'created_at']);
    expect(await screen.findByText('Deleted column name')).toBeInTheDocument();
    screen.getByRole('button', { name: /^email\b/ }).focus();
    await view.user.keyboard('{Backspace}');
    expect(names(view)).toEqual(['id', 'created_at']);
  });
});
