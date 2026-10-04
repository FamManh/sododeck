import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { addTable } from '../canvas-actions';
import { Canvas } from '../canvas';
import { ViewSwitcher } from './view-switcher';

const tables = (extra: object = {}) =>
  deckOf({
    nodes: [
      { id: 'p', type: 'db-table', title: 'payments', schema: 'billing', position: { x: 0, y: 0 } },
      {
        id: 'i',
        type: 'db-table',
        title: 'invoices',
        schema: 'billing',
        position: { x: 300, y: 0 },
      },
      { id: 'c', type: 'db-table', title: 'customers', schema: 'crm', position: { x: 0, y: 300 } },
      { id: 's', type: 'service', title: 'Svc', position: { x: 300, y: 300 } },
    ],
    views: [
      { id: 'sys', type: 'system', title: 'System' },
      { id: 'mine', type: 'custom', title: 'Mine', ...extra },
    ],
  });

function Harness() {
  return (
    <>
      <ViewSwitcher />
      <Canvas />
    </>
  );
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Mine, custom view' }));
  await user.click(screen.getByRole('button', { name: 'View options for Mine' }));
  await user.click(screen.getByRole('menuitem', { name: 'View settings…' }));
  return screen.findByRole('dialog', { name: 'View settings: Mine' });
}

const viewOf = (doc: Parameters<typeof toJSON>[0]) =>
  toJSON(doc).views.find((v) => v.id === 'mine');

describe('view settings for tables (048 US5)', () => {
  it('lists the deck schemas and writes the chosen ones', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Harness />, tables());
    const dialog = await openSettings(user);
    const schemas = within(dialog).getByRole('group', { name: 'Schemas' });
    expect(within(schemas).getByRole('checkbox', { name: 'billing' })).not.toBeChecked();
    expect(within(schemas).getByRole('checkbox', { name: 'crm' })).toBeInTheDocument();
    await user.click(within(schemas).getByRole('checkbox', { name: 'billing' }));
    expect(viewOf(doc)?.schemas).toEqual(['billing']);
    expect(document.querySelector('.react-flow__node[data-id="c"]')).toBeNull();
    expect(document.querySelector('.react-flow__node[data-id="p"]')).not.toBeNull();
    act(() => {
      editor().undo();
    });
    expect(viewOf(doc)?.schemas).toBeUndefined();
  });

  it('picks tables by name into includes', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Harness />, tables({ schemas: ['billing'] }));
    const dialog = await openSettings(user);
    const picker = within(dialog).getByRole('group', { name: 'Tables' });
    await user.type(within(picker).getByRole('searchbox', { name: 'Find a table' }), 'cust');
    expect(within(picker).queryByRole('checkbox', { name: 'payments' })).not.toBeInTheDocument();
    await user.click(within(picker).getByRole('checkbox', { name: 'customers' }));
    expect(viewOf(doc)?.includes).toEqual(['c']);
    await user.click(within(picker).getByRole('checkbox', { name: 'customers' }));
    expect(viewOf(doc)?.includes).toBeUndefined();
  });

  it('sets the detail of the view, Deck default removing it', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Harness />, tables());
    const dialog = await openSettings(user);
    const detail = within(dialog).getByRole('radiogroup', { name: 'Detail' });
    expect(within(detail).getByRole('radio', { name: 'Deck default' })).toBeChecked();
    await user.click(within(detail).getByRole('radio', { name: 'Keys' }));
    expect(viewOf(doc)?.detail).toBe('keys');
    await user.click(within(detail).getByRole('radio', { name: 'Deck default' }));
    expect(viewOf(doc)?.detail).toBeUndefined();
    expect(
      within(detail)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('value')),
    ).toHaveLength(4);
  });

  it('has no table sections in a deck without tables', async () => {
    const user = userEvent.setup();
    renderWithEditor(
      <Harness />,
      deckOf({
        nodes: [{ id: 'a', type: 'service', title: 'A' }],
        views: [
          { id: 'sys', type: 'system', title: 'System' },
          { id: 'mine', type: 'custom', title: 'Mine' },
        ],
      }),
    );
    const dialog = await openSettings(user);
    expect(within(dialog).queryByRole('group', { name: 'Schemas' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('radiogroup', { name: 'Detail' })).not.toBeInTheDocument();
  });
});

describe('a view that shows no table (048 US5)', () => {
  it('says so and offers Edit filter, which opens the view settings', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, tables({ schemas: ['nope'], excludeKinds: ['service'] }));
    await user.click(screen.getByRole('tab', { name: 'Mine, custom view' }));
    expect(await screen.findByText('No tables match this view')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit filter' }));
    expect(await screen.findByRole('dialog', { name: 'View settings: Mine' })).toBeInTheDocument();
  });
});

describe('a table created outside the filter (048 US5)', () => {
  it('shows a note and Add to this view, which adds it to includes in one undo step', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Harness />, tables({ schemas: ['billing'] }));
    await user.click(screen.getByRole('tab', { name: 'Mine, custom view' }));
    let id = '';
    act(() => {
      id = addTable(editor(), { x: 900, y: 900 });
    });
    expect(await screen.findByText("Outside this view's filter")).toBeInTheDocument();
    expect(screen.queryByText('Hidden in this view')).not.toBeInTheDocument();
    const before = JSON.stringify(viewOf(doc));
    await user.click(screen.getByRole('button', { name: 'Add to this view' }));
    expect(viewOf(doc)?.includes).toEqual([id]);
    expect(viewOf(doc)?.schemas).toEqual(['billing']);
    expect(screen.queryByText("Outside this view's filter")).not.toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(JSON.stringify(viewOf(doc))).toBe(before);
  });

  it('keeps "Hidden in this view" for a card a non-table filter hides', async () => {
    const user = userEvent.setup();
    const { editor } = renderWithEditor(<Harness />, tables({ excludeKinds: ['db-table'] }));
    await user.click(screen.getByRole('tab', { name: 'Mine, custom view' }));
    act(() => {
      addTable(editor(), { x: 900, y: 900 });
    });
    expect(await screen.findByText('Hidden in this view')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to this view' })).not.toBeInTheDocument();
  });
});
