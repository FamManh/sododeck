import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../../test/render-canvas';
import { renderTableTab } from '../../../test/render-table-tab';
import { ChecksTab } from './checks-tab';

const deck = deckOf({
  name: 'Shop',
  nodes: [
    {
      id: 'orders',
      type: 'db-table',
      title: 'orders',
      columns: [{ id: 'o-total', name: 'total', type: 'numeric' }],
      checks: [{ id: 'ck', name: 'positive', expr: 'total > 0' }],
    },
  ] as never,
});

const setup = () => renderTableTab(deck, 'orders', ChecksTab);

describe('ChecksTab', () => {
  it('lists checks with name and expression', () => {
    setup();
    const row = within(screen.getByRole('listitem', { name: 'Check positive' }));
    expect(row.getByRole('textbox', { name: 'Check name' })).toHaveValue('positive');
    expect(row.getByRole('textbox', { name: 'Check expression' })).toHaveValue('total > 0');
  });

  it('adds a check as one undo step', async () => {
    const { user, table, editor } = setup();
    await user.click(screen.getByRole('button', { name: '+ Check' }));
    expect(table()?.checks).toHaveLength(2);
    act(() => {
      editor().undo();
    });
    expect(table()?.checks).toHaveLength(1);
  });

  it('edits name and expression; an empty expression is refused', async () => {
    const { user, table } = setup();
    const row = within(screen.getByRole('listitem', { name: 'Check positive' }));
    const name = row.getByRole('textbox', { name: 'Check name' });
    await user.clear(name);
    await user.type(name, 'total_positive{Enter}');
    expect(table()?.checks?.[0]?.name).toBe('total_positive');
    const expr = row.getByRole('textbox', { name: 'Check expression' });
    await user.clear(expr);
    await user.type(expr, 'total >= 0{Enter}');
    expect(table()?.checks?.[0]?.expr).toBe('total >= 0');
    await user.tab();
    await user.clear(expr);
    await user.tab();
    expect(table()?.checks?.[0]?.expr).toBe('total >= 0');
  });

  it('deletes a check from its menu', async () => {
    const { user, table } = setup();
    await user.click(screen.getByRole('button', { name: 'Check options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete check' }));
    expect(table()?.checks ?? []).toEqual([]);
  });
});
