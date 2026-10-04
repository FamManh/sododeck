import { toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { useEditorShortcuts } from '../use-canvas-shortcuts';

const shop = deckOf({
  nodes: [
    {
      id: 'orders',
      type: 'db-table',
      title: 'orders',
      position: { x: 0, y: 0 },
      columns: [
        { id: 'o.id', name: 'id', type: 'int', pk: true },
        { id: 'o.email', name: 'email', type: 'text', unique: true, notNull: true },
        { id: 'o.customer', name: 'customer_id', type: 'int', notNull: true },
      ],
      indexes: [{ id: 'i1', columns: ['o.email'] }],
    },
    {
      id: 'customers',
      type: 'db-table',
      title: 'customers',
      position: { x: 500, y: 0 },
      columns: [{ id: 'c.id', name: 'id', type: 'int', pk: true }],
    },
  ],
  edges: [
    {
      id: 'r1',
      from: 'orders',
      to: 'customers',
      fromColumns: ['o.customer'],
      toColumns: ['c.id'],
      cardinality: 'n-1',
    },
  ],
  enums: [{ id: 'e1', name: 'order_status', values: [{ id: 'v1', name: 'pending' }] }],
});

const ui = () => useUiStore.getState();

function Editor() {
  useEditorShortcuts();
  return <Canvas />;
}

function setup(file: SododeckFile = shop) {
  const env = editorWrapper(file);
  render(<Editor />, { wrapper: env.wrapper });
  return { ...env, user: userEvent.setup() };
}

const columnsOf = (doc: Parameters<typeof toJSON>[0], id = 'orders') =>
  toJSON(doc).nodes.find((n) => n.id === id)?.columns ?? [];

function openNewRow(at = 3) {
  act(() => {
    ui().select({ nodes: ['orders'] });
    ui().startColumnEdit({ tableId: 'orders', columnId: null, at, select: 'name' });
  });
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'New column' });
}

const chips = () =>
  within(screen.getByRole('list', { name: 'Parsed parts' }))
    .getAllByRole('listitem')
    .map((chip) => chip.getAttribute('aria-label'));

describe('column line editor, new rows (043 US1)', () => {
  it('shows the parsed parts as chips while typing', async () => {
    const { user } = setup();
    const input = openNewRow();
    await user.type(input, 'mail text unique not null');
    expect(chips()).toEqual(['name · mail', 'type · text', 'not null', 'unique']);
    await user.clear(input);
    await user.type(input, 'status order_status sparkly');
    expect(chips()).toEqual(['name · status', 'enum · order_status', 'ignored · sparkly']);
  });

  it('adds the column at its index on ⏎ and opens an empty row below it', async () => {
    const { user, doc } = setup();
    const input = openNewRow(1);
    await user.type(input, "status order_status not null default 'pending'{Enter}");
    const columns = columnsOf(doc);
    expect(columns.map((c) => c.name)).toEqual(['id', 'status', 'email', 'customer_id']);
    expect(columns[1]).toMatchObject({
      name: 'status',
      type: 'order_status',
      enumRef: 'e1',
      notNull: true,
      default: 'pending',
    });
    expect(ui().columnEdit).toEqual({
      tableId: 'orders',
      columnId: null,
      at: 2,
      select: 'name',
    });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'New column' })).toHaveValue('');
    });
  });

  it('adds three lines in order, each undone by one ⌘Z', async () => {
    const { user, doc, editor } = setup();
    const input = openNewRow();
    await user.type(input, 'a int{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'New column' }), 'b int{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'New column' }), 'c int{Enter}');
    expect(columnsOf(doc).map((c) => c.name)).toEqual([
      'id',
      'email',
      'customer_id',
      'a',
      'b',
      'c',
    ]);
    act(() => {
      editor().undo();
    });
    expect(columnsOf(doc).map((c) => c.name)).toEqual(['id', 'email', 'customer_id', 'a', 'b']);
  });

  it('closes on Esc without writing', async () => {
    const { user, doc } = setup();
    const input = openNewRow();
    await user.type(input, 'notes text{Escape}');
    expect(ui().columnEdit).toBeNull();
    expect(columnsOf(doc)).toHaveLength(3);
  });

  it('refuses an empty or taken name with an inline message', async () => {
    const { user, doc } = setup();
    const input = openNewRow();
    await user.type(input, '   {Enter}');
    expect(columnsOf(doc)).toHaveLength(3);
    await user.clear(input);
    await user.type(input, 'EMAIL text{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('A column named EMAIL already exists');
    expect(columnsOf(doc)).toHaveLength(3);
    await user.clear(input);
    await user.type(input, '"" text{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Type a column name');
  });

  it('puts the caret at the type on Tab', async () => {
    const { user } = setup();
    const input = openNewRow();
    await user.type(input, 'price numeric(10,2)');
    input.setSelectionRange(0, 0);
    await user.keyboard('{Tab}');
    expect(input.selectionStart).toBe(6);
    expect(input).toHaveFocus();
  });
});

describe('column line editor, existing rows (043 US2)', () => {
  function editRow(columnId: string) {
    act(() => {
      ui().startColumnEdit({ tableId: 'orders', columnId, select: 'name' });
    });
    return screen.getByRole('textbox', { name: /^Edit column/ });
  }

  it('pre-fills the row’s line with the name selected', () => {
    setup();
    const input = editRow('o.email') as HTMLInputElement;
    expect(input).toHaveValue('email text not null unique');
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
  });

  it('rewrites name, type and flags in one step, keeping the id and every reference', async () => {
    const { user, doc, editor } = setup();
    const input = editRow('o.email');
    await user.clear(input);
    await user.type(input, 'email_address varchar(255){Enter}');
    const column = columnsOf(doc).find((c) => c.id === 'o.email');
    expect(column).toEqual({ id: 'o.email', name: 'email_address', type: 'varchar', size: '255' });
    expect(toJSON(doc).nodes[0]?.indexes).toEqual([{ id: 'i1', columns: ['o.email'] }]);
    expect(ui().columnEdit).toBeNull();
    act(() => {
      editor().undo();
    });
    expect(columnsOf(doc).find((c) => c.id === 'o.email')).toEqual({
      id: 'o.email',
      name: 'email',
      type: 'text',
      unique: true,
      notNull: true,
    });
  });

  it('removes the primary key when the line drops pk, and keeps relationships on a rename', async () => {
    const { user, doc } = setup();
    let input = editRow('o.id');
    await user.clear(input);
    await user.type(input, 'id int{Enter}');
    expect(columnsOf(doc).find((c) => c.id === 'o.id')).not.toHaveProperty('pk');
    input = editRow('o.customer');
    await user.clear(input);
    await user.type(input, 'buyer_id int not null{Enter}');
    expect(toJSON(doc).edges[0]?.fromColumns).toEqual(['o.customer']);
  });

  it('restores the row on Esc', async () => {
    const { user, doc } = setup();
    const input = editRow('o.email');
    await user.type(input, 'xyz{Escape}');
    expect(ui().columnEdit).toBeNull();
    expect(columnsOf(doc).find((c) => c.id === 'o.email')?.name).toBe('email');
  });
});
