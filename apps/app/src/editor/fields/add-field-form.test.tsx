import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { renderInspector } from '../../test/render-inspector';

const deck = deckOf({
  nodes: [
    { id: 'd1', type: 'database', title: 'Orders DB' },
    { id: 'd2', type: 'database', title: 'Users DB' },
    { id: 's1', type: 'service', title: 'Orders' },
  ],
});

describe('AddFieldForm (032 US1, FR-012)', () => {
  it('adds a select with options to the card’s type, announced, one undo step', async () => {
    const { user, doc, editor, ui } = renderInspector(deck, { nodes: ['d1'] });
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await user.type(screen.getByRole('textbox', { name: 'Field name' }), 'Region');
    await user.click(screen.getByRole('button', { name: 'Kind: Text' }));
    const menu = screen.getByRole('menu', { name: 'Field type' });
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((i) => i.textContent),
    ).toEqual([
      'Text',
      'Number',
      'Select',
      'Status',
      'Person',
      'Date',
      'Date range',
      'Link',
      'Progress',
    ]);
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Select' }));
    expect(screen.getByRole('button', { name: 'Kind: Select' })).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'New option' }),
      'North{Enter}South{Enter}',
    );
    expect(screen.getByRole('switch', { name: 'Show on card' })).toBeChecked();
    await user.click(screen.getByRole('textbox', { name: 'Field name' }));
    await user.keyboard('{Enter}');
    const [field] = toJSON(doc).fields ?? [];
    expect(field).toMatchObject({
      name: 'Region',
      kind: 'select',
      types: ['database'],
      onCard: true,
      options: [{ label: 'North' }, { label: 'South' }],
    });
    expect(ui().announcement.text).toBe('Region added');
    expect(screen.getByRole('combobox', { name: 'Region' })).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).fields).toBeUndefined();
  });

  it('prefills a new status field with To do, In progress and Done', async () => {
    const { user } = renderInspector(deck, { nodes: ['d1'] });
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await user.click(screen.getByRole('button', { name: 'Kind: Text' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Status' }));
    expect(
      within(screen.getByRole('list', { name: 'New field options' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['To do', 'In progress', 'Done']);
  });

  it('refuses an empty or duplicate name; Esc cancels', async () => {
    const { user, doc } = renderInspector(deck, { nodes: ['s1'] });
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    const name = screen.getByRole('textbox', { name: 'Field name' });
    await user.type(name, '{Enter}');
    expect(screen.getByText('A field needs a name.')).toBeInTheDocument();
    await user.type(name, 'tech{Enter}');
    expect(screen.getByText('Service already has a field named "Tech".')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Field name' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add field' })).toBeInTheDocument();
    expect(toJSON(doc).fields).toBeUndefined();
  });
});
