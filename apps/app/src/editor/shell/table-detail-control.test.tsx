import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { TableDetailControl } from './table-detail-control';

const withTable = deckOf({
  nodes: [{ id: 't', type: 'db-table', title: 'orders', columns: [] }] as never,
});

describe('TableDetailControl (041 FR-014, 054 FR-007)', () => {
  it('is one button, with no segmented group', () => {
    renderWithEditor(<TableDetailControl />, withTable);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Detail: Auto' })).toBeInTheDocument();
  });

  it('lists four choices with a one-line description each', async () => {
    const user = userEvent.setup();
    renderWithEditor(<TableDetailControl />, withTable);
    await user.click(screen.getByRole('button', { name: 'Detail: Auto' }));
    const menu = await screen.findByRole('menu', { name: 'Detail: Auto' });
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Auto',
      'Names',
      'Keys',
      'All',
    ]);
    expect(within(menu).getByText('Table names only, no columns')).toBeInTheDocument();
    expect(items[2]).toHaveAccessibleDescription('Key columns and columns with a relationship');
    expect(screen.getByRole('menuitemradio', { name: 'Auto' })).toBeChecked();
  });

  it('writes the deck detail; Auto removes it, one undo step each', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<TableDetailControl />, withTable);
    await user.click(screen.getByRole('button', { name: 'Detail: Auto' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Keys' }));
    expect(toJSON(doc).tableDisplay).toEqual({ detail: 'keys' });
    expect(screen.getByRole('button', { name: 'Detail: Keys' })).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).not.toHaveProperty('tableDisplay');
    expect(await screen.findByRole('button', { name: 'Detail: Auto' })).toBeInTheDocument();
    act(() => {
      editor().redo();
    });
    await user.click(screen.getByRole('button', { name: 'Detail: Keys' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Auto' }));
    expect(toJSON(doc)).not.toHaveProperty('tableDisplay');
  });

  it('is absent in a deck without tables', () => {
    renderWithEditor(<TableDetailControl />, deckOf({}));
    expect(screen.queryByRole('button', { name: /^Detail:/ })).not.toBeInTheDocument();
  });
});
