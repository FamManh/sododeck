import { toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../../test/render-canvas';
import { renderInspector } from '../../../test/render-inspector';

const table = (id: string, title: string, columns: [string, string, string?][], x = 0) => ({
  id,
  type: 'db-table',
  title,
  position: { x, y: 0 },
  columns: columns.map(([cid, name, type]) => ({ id: cid, name, type: type ?? 'int' })),
});

const deck: SododeckFile = deckOf({
  nodes: [
    table('orders', 'orders', [
      ['o.id', 'id'],
      ['o.cust', 'customer_id'],
      ['o.region', 'region_id', 'uuid'],
    ]),
    table('customers', 'customers', [
      ['c.id', 'id'],
      ['c.region', 'region_id', 'int'],
    ]),
  ],
  edges: [
    {
      id: 'rel',
      from: 'orders',
      to: 'customers',
      fromColumns: ['o.cust'],
      toColumns: ['c.id'],
      cardinality: 'n-1',
    },
    {
      id: 'comp',
      from: 'orders',
      to: 'customers',
      fromColumns: ['o.cust', 'o.region'],
      toColumns: ['c.id'],
      cardinality: 'n-1',
    },
    {
      id: 'mis',
      from: 'orders',
      to: 'customers',
      fromColumns: ['o.region'],
      toColumns: ['c.id'],
      cardinality: 'n-1',
    },
    {
      id: 'self',
      from: 'orders',
      to: 'orders',
      fromColumns: ['o.cust'],
      toColumns: ['o.id'],
      cardinality: 'n-1',
    },
  ],
});

const setup = (edge = 'rel') => renderInspector(deck, { edges: [edge] });
const edgeOf = (doc: Parameters<typeof toJSON>[0], id = 'rel') =>
  toJSON(doc).edges.find((e) => e.id === id);

async function pick(
  user: ReturnType<typeof setup>['user'],
  name: string,
  text: string,
): Promise<void> {
  const box = screen.getByRole('combobox', { name });
  await user.clear(box);
  await user.type(box, text);
  await user.keyboard('{ArrowDown}{Enter}');
}

describe('RelationshipInspector (052 US2)', () => {
  it('shows the ends in the header and the cardinality as a subline', () => {
    setup();
    expect(
      screen.getByRole('heading', { name: 'orders.customer_id → customers.id' }),
    ).toBeInTheDocument();
    expect(screen.getByText('many-to-one')).toBeInTheDocument();
  });

  it('lists each table’s columns in the From and To pair selects', async () => {
    const { user } = setup();
    expect(screen.getByRole('combobox', { name: 'From column 1' })).toHaveValue('customer_id');
    expect(screen.getByRole('combobox', { name: 'To column 1' })).toHaveValue('id');
    await user.click(screen.getByRole('combobox', { name: 'From column 1' }));
    const list = screen.getByRole('listbox');
    expect(
      within(list)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['id', 'customer_id', 'region_id']);
  });

  it('changes a pair, adds a pair and removes it, writing both lists in one undo step', async () => {
    const { user, doc, editor } = setup();
    await pick(user, 'From column 1', 'region');
    expect(edgeOf(doc)?.fromColumns).toEqual(['o.region']);
    await user.click(screen.getByRole('button', { name: 'Add column pair' }));
    expect(edgeOf(doc)?.fromColumns).toHaveLength(2);
    expect(edgeOf(doc)?.toColumns).toHaveLength(2);
    act(() => {
      editor().undo();
    });
    expect(edgeOf(doc)?.fromColumns).toEqual(['o.region']);
    expect(edgeOf(doc)?.toColumns).toEqual(['c.id']);
  });

  it('removes a pair from both lists and reorders pairs', async () => {
    const { user, doc } = setup('comp');
    await user.click(screen.getByRole('button', { name: 'Add column pair' }));
    expect(edgeOf(doc, 'comp')?.fromColumns).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Move pair 1 down' }));
    expect(edgeOf(doc, 'comp')?.fromColumns?.slice(0, 2)).toEqual(['o.region', 'o.cust']);
    await user.click(screen.getByRole('button', { name: 'Remove pair 3' }));
    expect(edgeOf(doc, 'comp')?.fromColumns).toHaveLength(2);
  });

  it('warns when the two lists differ in length', () => {
    setup('comp');
    expect(screen.getByText('From has 2 columns, To has 1')).toBeInTheDocument();
  });

  it('marks a pair whose types differ', () => {
    setup('mis');
    expect(screen.getByRole('img', { name: 'Types differ: uuid → int' })).toBeInTheDocument();
  });

  it('confirms before removing the last pair and then requests the delete', async () => {
    const { user, ui } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove pair 1' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Remove the relationship?');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(ui().pendingDelete).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove pair 1' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove relationship' }),
    );
    expect(ui().pendingDelete?.targets).toEqual([{ scope: 'edges', id: 'rel' }]);
  });

  it('lists a self-reference’s columns on both sides', async () => {
    const { user } = setup('self');
    await user.click(screen.getByRole('combobox', { name: 'To column 1' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
  });

  it('sets the cardinality and shows the n–n hint', async () => {
    const { user, doc, editor } = setup();
    const group = screen.getByRole('radiogroup', { name: 'Cardinality' });
    expect(within(group).getByRole('radio', { name: 'n–1' })).toBeChecked();
    expect(screen.queryByText('SQL export writes a junction table')).not.toBeInTheDocument();
    await user.click(within(group).getByRole('radio', { name: 'n–n' }));
    expect(edgeOf(doc)?.cardinality).toBe('n-n');
    expect(screen.getByText('SQL export writes a junction table')).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(edgeOf(doc)?.cardinality).toBe('n-1');
  });

  it('writes the optional sides as true or removes them', async () => {
    const { user, doc } = setup();
    await user.click(screen.getByRole('switch', { name: 'From side optional' }));
    expect(edgeOf(doc)?.fromOptional).toBe(true);
    await user.click(screen.getByRole('switch', { name: 'From side optional' }));
    expect(edgeOf(doc)).not.toHaveProperty('fromOptional');
    await user.click(screen.getByRole('switch', { name: 'To side optional' }));
    expect(edgeOf(doc)?.toOptional).toBe(true);
  });

  it('sets On delete and On update, and "Not set" removes the key', async () => {
    const { user, doc } = setup();
    await pick(user, 'On delete', 'Cascade');
    expect(edgeOf(doc)?.onDelete).toBe('cascade');
    await pick(user, 'On update', 'Restrict');
    expect(edgeOf(doc)?.onUpdate).toBe('restrict');
    await user.click(screen.getByRole('combobox', { name: 'On delete' }));
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Not set', 'Cascade', 'Restrict', 'Set null', 'Set default', 'No action']);
    await user.keyboard('{Escape}');
    await pick(user, 'On delete', 'Not set');
    expect(edgeOf(doc)).not.toHaveProperty('onDelete');
  });

  it('writes the name as the label, the line type and the colour', async () => {
    const { user, doc } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'fk_orders_customer{Enter}');
    expect(edgeOf(doc)?.label).toBe('fk_orders_customer');
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Line type' })).getByRole('radio', {
        name: 'Elbow',
      }),
    );
    expect(edgeOf(doc)?.style?.shape).toBe('elbow');
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', {
        name: 'Green',
      }),
    );
    expect(edgeOf(doc)?.style?.color).toBe('green');
  });
});
