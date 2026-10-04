import { toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { CanvasMenu } from '../quick-edit/canvas-menu';
import { useEditorShortcuts } from '../use-canvas-shortcuts';

const col = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id.split('.')[1] ?? id,
  type: 'int',
  ...extra,
});

const shipments = deckOf({
  nodes: [
    {
      id: 'shipments',
      type: 'db-table',
      title: 'shipments',
      position: { x: 0, y: 0 },
      columns: [
        col('s.id', { pk: true }),
        col('s.carrier', { type: 'text' }),
        col('s.tracking', { type: 'text' }),
        col('s.order_id'),
        col('s.city', { type: 'text' }),
      ],
      indexes: [{ id: 'i1', columns: ['s.tracking', 's.city'] }],
    },
    {
      id: 'orders',
      type: 'db-table',
      title: 'orders',
      detail: 'keys',
      position: { x: 500, y: 0 },
      columns: [col('o.id', { pk: true }), col('o.note', { type: 'text' })],
    },
  ],
  edges: [
    {
      id: 'r1',
      from: 'shipments',
      to: 'orders',
      fromColumns: ['s.tracking'],
      toColumns: ['o.id'],
      cardinality: 'n-1',
    },
  ],
});

const ui = () => useUiStore.getState();

function Editor() {
  useEditorShortcuts();
  return (
    <>
      <Canvas />
      <CanvasMenu />
    </>
  );
}

function setup(file: SododeckFile = shipments) {
  const env = editorWrapper(file);
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

const row = (key: string) => document.querySelector<HTMLElement>(`[data-row="${key}"]`);
const names = (doc: Parameters<typeof toJSON>[0], id = 'shipments') =>
  (toJSON(doc).nodes.find((n) => n.id === id)?.columns ?? []).map((c) => c.name);

describe('row keys (043 US3, R5)', () => {
  it('moves a column with ⌥↑ / ⌥↓, clamped, keeping row focus', async () => {
    const { user, doc } = setup();
    focusTable('shipments');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(ui().focusedRow?.columnId).toBe('s.carrier');
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(names(doc)).toEqual(['carrier', 'id', 'tracking', 'order_id', 'city']);
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(names(doc)).toEqual(['carrier', 'id', 'tracking', 'order_id', 'city']);
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(names(doc)).toEqual(['id', 'carrier', 'tracking', 'order_id', 'city']);
    expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });

  it('opens the editor with ⏎ or F2, and a new row below with C', async () => {
    const { user } = setup();
    focusTable('shipments');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(ui().columnEdit).toEqual({
      tableId: 'shipments',
      columnId: 's.carrier',
      select: 'name',
    });
    expect(screen.getByRole('textbox', { name: 'Edit column carrier' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(row('shipments:s.carrier')).toHaveFocus();
    });
    await user.keyboard('{F2}');
    expect(ui().columnEdit?.columnId).toBe('s.carrier');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(row('shipments:s.carrier')).toHaveFocus();
    });
    await user.keyboard('c');
    expect(ui().columnEdit).toMatchObject({ tableId: 'shipments', columnId: null, at: 2 });
  });

  it('keeps ⏎ on the table for details, ↓ enters the rows, C adds a column at the end', async () => {
    const { user } = setup();
    focusTable('shipments');
    await user.keyboard('c');
    expect(ui().columnEdit).toMatchObject({ tableId: 'shipments', columnId: null, at: 5 });
    await user.keyboard('{Escape}');
    focusTable('shipments');
    await user.keyboard('{Enter}');
    expect(ui().drawer.open).toBe(true);
    expect(ui().focusedRow).toBeNull();
  });

  it('opens the table connect popover with R', async () => {
    const { user } = setup();
    focusTable('orders');
    await user.keyboard('r');
    expect(ui().popover).toEqual({ kind: 'connect', fromId: 'orders' });
  });

  it('deletes a focused column with ⌫, says what went with it, and Undo restores it all', async () => {
    const { user, doc } = setup();
    focusTable('shipments');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(ui().focusedRow?.columnId).toBe('s.tracking');
    await user.keyboard('{Backspace}');
    expect(names(doc)).toEqual(['id', 'carrier', 'order_id', 'city']);
    expect(toJSON(doc).edges).toEqual([]);
    expect(toJSON(doc).nodes).toHaveLength(2);
    expect(
      await screen.findByText('Deleted column tracking · 1 relationship removed'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(row('shipments:s.order_id')).toHaveFocus();
    });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(names(doc)).toEqual(['id', 'carrier', 'tracking', 'order_id', 'city']);
    expect(toJSON(doc).edges).toHaveLength(1);
    expect(toJSON(doc).nodes[0]?.indexes).toEqual([
      { id: 'i1', columns: ['s.tracking', 's.city'] },
    ]);
  });

  it('ignores the row keys while typing in a field', async () => {
    const { user, doc } = setup();
    focusTable('shipments');
    await user.keyboard('{ArrowDown}');
    act(() => {
      ui().startColumnEdit({ tableId: 'shipments', columnId: 's.id', select: 'name' });
    });
    await user.keyboard('{Backspace}');
    expect(names(doc)).toHaveLength(5);
  });
});

describe('row editing shows the table at All (043 FR-010a)', () => {
  it('draws every row while the rows have focus, and returns to Keys on Esc', async () => {
    const { user, doc } = setup();
    expect(row('orders:o.note')).toBeNull();
    const before = JSON.stringify(toJSON(doc));
    focusTable('orders');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(row('orders:o.note')).not.toBeNull();
    });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(row('orders:o.note')).toBeNull();
    });
    expect(JSON.stringify(toJSON(doc))).toBe(before);
  });
});

describe('row pointer gestures (043 US2, US4)', () => {
  it('starts the line editor on double-click, not the title edit', () => {
    setup();
    const target = row('shipments:s.city');
    expect(target).not.toBeNull();
    if (target === null) return;
    fireEvent.doubleClick(target);
    expect(ui().columnEdit).toEqual({
      tableId: 'shipments',
      columnId: 's.city',
      select: 'name',
    });
    expect(ui().titleEdit).toBeNull();
  });

  it('opens the row menu on right-click, with the table selected', () => {
    setup();
    const target = row('shipments:s.city');
    if (target === null) throw new Error('row not drawn');
    fireEvent.contextMenu(target, { clientX: 10, clientY: 20 });
    expect(ui().selection.nodes).toEqual(['shipments']);
    expect(screen.getByRole('menu', { name: 'Actions for column city' })).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toEqual([
      'EditEnter',
      'Set as primary key',
      'Not null',
      'Unique',
      'Add index',
      'Add relationship…R',
      'Move upAlt+↑',
      'Move downAlt+↓',
      'Delete columnDelete',
    ]);
  });
});
