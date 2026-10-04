import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../../test/render-canvas';
import { renderTableTab } from '../../../test/render-table-tab';
import { TableInspector } from './table-inspector';

const deck = (locked: boolean) =>
  deckOf({
    name: 'Shop',
    nodes: [
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        ...(locked ? { locked: true } : {}),
        columns: [{ id: 'o-id', name: 'id', type: 'uuid' }],
      },
    ] as never,
  });

describe('TableInspector locked state (052 FR-023)', () => {
  it('is editable and shows no banner when unlocked', () => {
    renderTableTab(deck(false), 'orders', TableInspector);
    expect(screen.queryByText('Locked · unlock to edit')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeEnabled();
  });

  it('disables every control and offers Unlock when the table is locked', async () => {
    const { user, table } = renderTableTab(deck(true), 'orders', TableInspector);
    expect(screen.getByText('Locked · unlock to edit')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(table()?.locked).toBeUndefined();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeEnabled();
    expect(screen.queryByText('Locked · unlock to edit')).not.toBeInTheDocument();
  });

  it('keeps the tabs usable while locked', async () => {
    const { user } = renderTableTab(deck(true), 'orders', TableInspector);
    await user.click(screen.getByRole('tab', { name: 'Columns' }));
    expect(screen.getByRole('button', { name: 'Column' })).toBeDisabled();
    act(() => undefined);
  });
});
