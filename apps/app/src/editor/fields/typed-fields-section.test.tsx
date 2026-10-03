import { getObject, toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { renderInspector } from '../../test/render-inspector';

const deck: SododeckFile = deckOf({
  packs: ['architecture', 'process', 'logistics', 'data'],
  nodes: [
    { id: 't1', type: 'task', title: 'Write spec', owner: 'Lan' },
    { id: 't2', type: 'task', title: 'Build' },
    { id: 's1', type: 'service', title: 'Orders', tech: 'Go', owner: 'Payments team' },
    { id: 'w1', type: 'warehouse', title: 'HCM' },
    { id: 'w2', type: 'warehouse', title: 'Hanoi' },
  ],
});

const rows = () =>
  within(screen.getByRole('list', { name: 'Fields' }))
    .getAllByRole('listitem')
    .map((row) => row.querySelector('[id]')?.textContent ?? '');

const nameOfRows = () =>
  within(screen.getByRole('list', { name: 'Fields' }))
    .getAllByRole('button', { name: /^Reorder / })
    .map((button) => button.getAttribute('aria-label')?.replace('Reorder ', ''));

describe('TypedFieldsSection (032 US1, contracts/fields-ui.md)', () => {
  it('lists a Task’s Status, Assignee, Due date and Owner, with "On card" switches', () => {
    renderInspector(deck, { nodes: ['t2'] });
    expect(nameOfRows()).toEqual(['Status', 'Assignee', 'Due date', 'Owner']);
    expect(rows()).toHaveLength(4);
    const status = screen.getByRole('switch', { name: 'Status on card' });
    expect(status).toBeChecked();
    expect(status).toHaveAccessibleDescription('Applies to every Task');
    expect(screen.getByRole('switch', { name: 'Owner on card' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Owner on card' })).toHaveAccessibleDescription(
      'Applies to every card',
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('');
  });

  it('lists a Service’s Tech, Host and Owner with their values, off the card (US4 AS1)', () => {
    renderInspector(deck, { nodes: ['s1'] });
    expect(nameOfRows()).toEqual(['Tech', 'Host', 'Owner']);
    expect(screen.getByRole('textbox', { name: 'Tech' })).toHaveValue('Go');
    expect(screen.getByRole('combobox', { name: 'Owner' })).toHaveValue('Payments team');
    for (const name of ['Tech', 'Host', 'Owner']) {
      expect(screen.getByRole('switch', { name: `${name} on card` })).not.toBeChecked();
    }
  });

  it('offers built-ins only reorder and the switch (US4 AS3)', () => {
    renderInspector(deck, { nodes: ['s1'] });
    expect(screen.queryByRole('button', { name: 'Owner options' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reorder Owner' })).toBeInTheDocument();
  });

  it('sets a value as one undo step, and clearing removes it (AS2, AS5)', async () => {
    const { user, doc, editor } = renderInspector(deck, { nodes: ['t2'] });
    const status = screen.getByRole('combobox', { name: 'Status' });
    await user.click(status);
    await user.click(screen.getByRole('option', { name: 'In progress' }));
    expect(getObject(doc, 'nodes', 't2')?.values).toEqual({ 'task.status': 'doing' });
    expect(toJSON(doc).fields).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(getObject(doc, 'nodes', 't2')?.values).toBeUndefined();
    await user.click(status);
    await user.click(screen.getByRole('option', { name: 'Done' }));
    await user.click(status);
    await user.click(screen.getByRole('option', { name: 'None' }));
    expect(getObject(doc, 'nodes', 't2')?.values).toBeUndefined();
  });

  it('refuses an invalid entry with a message and writes nothing (AS4)', async () => {
    const { user, doc } = renderInspector(deck, { nodes: ['w1'] });
    await user.type(screen.getByRole('spinbutton', { name: 'Capacity percent' }), '140{Enter}');
    expect(screen.getByText('Enter a number from 0 to 100.')).toBeInTheDocument();
    expect(getObject(doc, 'nodes', 'w1')?.values).toBeUndefined();
  });

  it('writes the deck’s spelling of a person (FR-014b)', async () => {
    const { user, doc } = renderInspector(deck, { nodes: ['t2'] });
    await user.type(screen.getByRole('combobox', { name: 'Assignee' }), 'lan{Enter}');
    expect(getObject(doc, 'nodes', 't2')?.values).toEqual({ 'task.assignee': 'Lan' });
  });

  it('does not list a Warehouse field on a Service (AS6)', () => {
    renderInspector(
      { ...deck, fields: [{ id: 'f_zone', name: 'Zone', kind: 'text', types: ['warehouse'] }] },
      { nodes: ['s1'] },
    );
    expect(screen.queryByRole('textbox', { name: 'Zone' })).not.toBeInTheDocument();
  });

  it('toggles "On card" for every card of the type in one step (US2 AS3)', async () => {
    const { user, doc, editor } = renderInspector(deck, { nodes: ['w1'] });
    await user.click(screen.getByRole('switch', { name: 'Capacity on card' }));
    expect(toJSON(doc).fields?.find((f) => f.id === 'warehouse.capacity')?.onCard).toBeUndefined();
    expect(screen.getByRole('switch', { name: 'Capacity on card' })).not.toBeChecked();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).fields).toBeUndefined();
  });

  it('turns Owner on for services storing only an owner entry (US4 AS2)', async () => {
    const { user, doc } = renderInspector(deck, { nodes: ['s1'] });
    await user.click(screen.getByRole('switch', { name: 'Owner on card' }));
    expect(toJSON(doc).fields).toEqual([
      { id: 'owner', name: 'Owner', kind: 'person', onCard: true },
    ]);
    expect(toJSON(doc).nodes.every((n) => n.values === undefined)).toBe(true);
  });
});

describe('managing fields (032 US3)', () => {
  it('reorders with ⌥↑ / ⌥↓ on the handle, one step each', async () => {
    const { user, editor } = renderInspector(deck, { nodes: ['w1'] });
    screen.getByRole('button', { name: 'Reorder Region' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(nameOfRows()).toEqual(['Capacity', 'Region', 'SLA', 'Owner']);
    expect(screen.getByRole('button', { name: 'Reorder Region' })).toHaveFocus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}{Alt>}{ArrowDown}{/Alt}');
    expect(nameOfRows()).toEqual(['Capacity', 'SLA', 'Owner', 'Region']);
    act(() => {
      editor().undo();
    });
    expect(nameOfRows()).toEqual(['Capacity', 'SLA', 'Region', 'Owner']);
  });

  it('offers Rename, Change kind…, Edit options…, Also use for… and Delete field', async () => {
    const { user } = renderInspector(deck, { nodes: ['w1'] });
    await user.click(screen.getByRole('button', { name: 'Region options' }));
    const menu = screen.getByRole('menu', { name: 'Region options' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Rename', 'Change kind…', 'Edit options…', 'Also use for…', 'Delete field']);
  });

  it('renames; an empty or duplicate name is refused', async () => {
    const { user, doc } = renderInspector(deck, { nodes: ['w1'] });
    await user.click(screen.getByRole('button', { name: 'SLA options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const box = screen.getByRole('textbox', { name: 'Field name' });
    await user.clear(box);
    await user.type(box, 'capacity{Enter}');
    expect(screen.getByText('Warehouse already has a field named "Capacity".')).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'SLA (h){Enter}');
    expect(toJSON(doc).fields?.find((f) => f.id === 'warehouse.sla')?.name).toBe('SLA (h)');
    expect(screen.getByRole('switch', { name: 'SLA (h) on card' })).toBeInTheDocument();
  });

  it('edits options: add, rename, delete with a usage count', async () => {
    const { user, doc } = renderInspector(deck, { nodes: ['w1'] });
    await user.click(screen.getByRole('button', { name: 'Region options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit options…' }));
    await user.type(screen.getByRole('textbox', { name: 'New option' }), 'South{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'New option' }), 'East{Enter}');
    const options = () => toJSON(doc).fields?.find((f) => f.id === 'warehouse.region')?.options;
    expect(options()?.map((o) => o.label)).toEqual(['South', 'East']);
    const south = options()?.[0]?.id ?? '';
    act(() => {
      // Two cards hold South.
    });
    await user.click(screen.getByRole('combobox', { name: 'Region' }));
    await user.click(screen.getByRole('option', { name: 'South' }));
    await user.click(screen.getByRole('button', { name: 'Delete South' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete option · used on 1 card' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete option' }));
    expect(options()?.map((o) => o.id)).not.toContain(south);
    expect(getObject(doc, 'nodes', 'w1')?.values).toBeUndefined();
  });

  it('extends a field to another type with "Also use for…"', async () => {
    const { user, doc } = renderInspector(deck, { nodes: ['w1'] });
    await user.click(screen.getByRole('button', { name: 'SLA options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Also use for…' }));
    await user.click(screen.getByRole('checkbox', { name: 'Truck route' }));
    expect(toJSON(doc).fields?.find((f) => f.id === 'warehouse.sla')?.types).toEqual([
      'warehouse',
      'truck-route',
    ]);
    expect(screen.getByRole('checkbox', { name: 'Warehouse' })).toBeEnabled();
  });

  it('confirms a delete with the usage count, one undo step (AS4)', async () => {
    const { user, doc, editor } = renderInspector(
      {
        ...deck,
        fields: [{ id: 'docks', name: 'Docks', kind: 'number', types: ['warehouse'] }],
        nodes: deck.nodes.map((n) => (n.type === 'warehouse' ? { ...n, values: { docks: 4 } } : n)),
      },
      { nodes: ['w1'] },
    );
    await user.click(screen.getByRole('button', { name: 'Docks options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete field' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete field · used on 2 cards' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Delete field' }));
    expect(toJSON(doc).fields?.some((f) => f.id === 'docks')).toBe(false);
    expect(getObject(doc, 'nodes', 'w2')?.values).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(getObject(doc, 'nodes', 'w2')?.values).toEqual({ docks: 4 });
  });

  it('changes kind, confirming only when values would be cleared (AS6)', async () => {
    const estimate: SododeckFile = {
      ...deck,
      fields: [{ id: 'est', name: 'Estimate', kind: 'text', types: ['task'] }],
      nodes: deck.nodes.map((n, i) =>
        n.type === 'task' ? { ...n, values: { est: i === 0 ? '5' : 'big' } } : n,
      ),
    };
    const { user, doc, editor } = renderInspector(estimate, { nodes: ['t1'] });
    await user.click(screen.getByRole('button', { name: 'Estimate options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Change kind…' }));
    // Keyboard: jsdom loses Radix submenus on pointer moves.
    screen.getByRole('menuitem', { name: 'Number' }).focus();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('alertdialog', {
      name: 'Change kind to Number? 1 value will be cleared.',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Change kind' }));
    expect(getObject(doc, 'nodes', 't1')?.values).toEqual({ est: 5 });
    expect(getObject(doc, 'nodes', 't2')?.values).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(getObject(doc, 'nodes', 't2')?.values).toEqual({ est: 'big' });
    // Text → Person clears nothing: no confirmation.
    await user.click(screen.getByRole('button', { name: 'Estimate options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Change kind…' }));
    screen.getByRole('menuitem', { name: 'Person' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toJSON(doc).fields?.[0]?.kind).toBe('person');
  });

  it('materialises a type’s defaults invisibly on the first change', async () => {
    const { user, doc } = renderInspector(deck, { nodes: ['w1'] });
    await user.click(screen.getByRole('switch', { name: 'SLA on card' }));
    expect(nameOfRows()).toEqual(['Capacity', 'SLA', 'Region', 'Owner']);
    expect(toJSON(doc).fieldDefaults).toEqual(['warehouse']);
  });
});
