import { toJSON } from '@sododeck/model';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { DetailDrawer } from '../shell/detail-drawer';
import { useEditorShortcuts } from '../use-canvas-shortcuts';

const col = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id.split('.')[1] ?? id,
  type: 'uuid',
  notNull: true,
  ...extra,
});

const shop = deckOf({
  nodes: [
    {
      id: 'orders',
      type: 'db-table',
      title: 'orders',
      position: { x: 0, y: 0 },
      columns: [col('orders.id', { pk: true }), col('orders.customer_id')],
    },
    {
      id: 'customers',
      type: 'db-table',
      title: 'customers',
      position: { x: 500, y: 0 },
      columns: [col('customers.id', { pk: true }), col('customers.email', { type: 'text' })],
    },
  ],
});

const ui = () => useUiStore.getState();

function Editor() {
  useEditorShortcuts();
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <Canvas />
      <DetailDrawer deck={deck} />
    </>
  );
}

function setup() {
  const env = editorWrapper(shop);
  render(<Editor />, { wrapper: env.wrapper });
  return { ...env, user: userEvent.setup() };
}

function focusTable(id: string) {
  act(() => {
    ui().select({ nodes: [id] });
    ui().focus(id);
  });
  act(() => {
    document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
  });
}

const row = (key: string) => document.querySelector(`[data-row="${key}"]`);

describe('column ports and row focus (042 US2)', () => {
  it('gives every drawn row two ports named after the column', () => {
    setup();
    expect(screen.getAllByRole('button', { name: 'Connect customer_id' })).toHaveLength(2);
    expect(row('orders:orders.customer_id')).not.toBeNull();
  });

  it('moves row focus with ↓ / ↑ inside a focused table, Esc returns to the card', async () => {
    const { user } = setup();
    focusTable('orders');
    await user.keyboard('{ArrowDown}');
    expect(ui().focusedRow).toEqual({ tableId: 'orders', columnId: 'orders.id' });
    expect(row('orders:orders.id')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(row('orders:orders.customer_id')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(row('orders:orders.customer_id')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(ui().focusedRow?.columnId).toBe('orders.id');
    await user.keyboard('{Escape}');
    expect(ui().focusedRow).toBeNull();
    expect(document.querySelector('[data-node-id="orders"]')).toHaveFocus();
  });

  it('connects a focused row with R: keys first, typing filters, Enter draws it', async () => {
    const { user, doc } = setup();
    focusTable('orders');
    await user.keyboard('{ArrowDown}{ArrowDown}r');
    const list = await screen.findByRole('listbox', { name: 'Connect customer_id to' });
    const labels = within(list)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(labels.slice(0, 2)).toEqual(['customers.id', 'orders.id']);
    expect(labels).not.toContain('orders.customer_id');
    await user.keyboard('cust');
    await waitFor(() => {
      expect(within(list).getAllByRole('option')[0]).toHaveTextContent('customers.id');
    });
    await user.keyboard('{Enter}');
    expect(toJSON(doc).edges).toEqual([
      expect.objectContaining({
        from: 'orders',
        to: 'customers',
        fromColumns: ['orders.customer_id'],
        toColumns: ['customers.id'],
        cardinality: 'n-1',
      }),
    ]);
  });
});
