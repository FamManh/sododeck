import type { DbColumn } from '@sododeck/schema';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { fixedWidthMeasurer } from '../export/text-measure';
import { tableContextOf } from '../table-keys';
import { tableLayout } from '../table-layout';
import { EnumPopover } from './enum-popover';
import { TableBody } from './table-body';

const columns: DbColumn[] = [
  { id: 'id', name: 'id', type: 'uuid', pk: true },
  { id: 'status', name: 'status', type: 'order_status', enumRef: 'e-status' },
  { id: 'kind', name: 'kind', type: 'order_kind', enumRef: 'e-kind' },
  { id: 'ghost', name: 'ghost', type: 'gone_enum', enumRef: 'e-gone' },
];

const deck = deckOf({
  enums: [
    {
      id: 'e-status',
      name: 'order_status',
      values: [
        { id: 'v1', name: 'pending', note: 'awaiting payment' },
        { id: 'v2', name: 'paid' },
        { id: 'v3', name: 'shipped' },
        { id: 'v4', name: 'cancelled' },
      ],
    },
    { id: 'e-kind', name: 'order_kind', values: [] },
  ],
  nodes: [{ id: 'orders', type: 'db-table', title: 'orders', columns }],
});

function renderTable() {
  // The chips sit in a card, as on the canvas: the popover finds its anchor by node id.
  const layout = tableLayout(
    deck.nodes[0] ?? { title: '' },
    tableContextOf(deck),
    undefined,
    fixedWidthMeasurer(),
  );
  return renderWithEditor(
    <>
      <div data-node-id="orders">
        <TableBody nodeId="orders" layout={layout} focused />
      </div>
      <EnumPopover deck={deck} />
    </>,
    deck,
  );
}

describe('enum values popover (041 US2)', () => {
  it('opens after resting on the chip, with the values in order and their notes', async () => {
    const user = userEvent.setup();
    renderTable();
    await user.hover(screen.getByRole('button', { name: 'order_status values' }));
    const dialog = await screen.findByRole('dialog', { name: 'order_status' });
    const items = [...dialog.querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual(['pending — awaiting payment', 'paid', 'shipped', 'cancelled']);
    // Hovering never takes focus away.
    expect(dialog).not.toContainElement(document.activeElement as HTMLElement);
    await user.unhover(screen.getByRole('button', { name: 'order_status values' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('opens from the keyboard, and Escape closes it and returns focus to the chip', async () => {
    const user = userEvent.setup();
    renderTable();
    const chip = screen.getByRole('button', { name: 'order_status values' });
    act(() => {
      chip.focus();
    });
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'order_status' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(chip).toHaveFocus();
  });

  it('"Edit enum" opens the enum drawer and closes the popover (052 US4)', async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole('button', { name: 'order_status values' }));
    await user.click(await screen.findByRole('button', { name: 'Edit enum' }));
    expect(useUiStore.getState().drawer).toMatchObject({
      open: true,
      mode: 'enum',
      enumId: 'e-status',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('says "No values" for an empty enum, and keeps one popover open at a time', async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole('button', { name: 'order_status values' }));
    await screen.findByRole('dialog', { name: 'order_status' });
    act(() => {
      useUiStore
        .getState()
        .openEnumPopover({ nodeId: 'orders', columnId: 'kind', source: 'keyboard' });
    });
    const dialog = await screen.findByRole('dialog', { name: 'order_kind' });
    expect(dialog).toHaveTextContent('No values');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('draws a missing enum as type text, with no chip', () => {
    renderTable();
    expect(screen.queryByRole('button', { name: 'gone_enum values' })).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'ghost, gone_enum, nullable' })).toHaveTextContent(
      'gone_enum',
    );
  });
});
