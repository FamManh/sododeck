import { toJSON } from '@sododeck/model';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { TableDetailControl } from './table-detail-control';

const withTable = deckOf({
  nodes: [{ id: 't', type: 'db-table', title: 'orders', columns: [] }] as never,
});

describe('TableDetailControl (041 FR-014)', () => {
  it('writes the deck detail; Auto removes it, one undo step each', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<TableDetailControl compact={false} />, withTable);
    const group = screen.getByRole('radiogroup', { name: 'Table detail' });
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    expect(group).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Keys' }));
    expect(toJSON(doc).tableDisplay).toEqual({ detail: 'keys' });
    expect(screen.getByRole('radio', { name: 'Keys' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(toJSON(doc)).not.toHaveProperty('tableDisplay');
    editor().undo();
    expect(toJSON(doc).tableDisplay).toEqual({ detail: 'keys' });
  });

  it('is absent in a deck without tables', () => {
    renderWithEditor(<TableDetailControl compact={false} />, deckOf({}));
    expect(screen.queryByRole('radiogroup', { name: 'Table detail' })).not.toBeInTheDocument();
  });

  it('is a menu of radios in the compact shell', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<TableDetailControl compact />, withTable);
    await user.click(screen.getByRole('button', { name: 'Table detail: Auto' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'All' }));
    expect(toJSON(doc).tableDisplay).toEqual({ detail: 'all' });
    expect(screen.getByRole('button', { name: 'Table detail: All' })).toBeInTheDocument();
  });
});
