import { toJSON } from '@sododeck/model';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { Canvas } from './canvas';
import { DetailDrawer } from './shell/detail-drawer';
import { SelectionToolbar } from './quick-edit/selection-toolbar';
import { useEditorShortcuts } from './use-canvas-shortcuts';

const deck = deckOf({
  packs: ['architecture', 'process'],
  nodes: [
    { id: 'a', type: 'service', title: 'Order Service', position: { x: 0, y: 0 } },
    { id: 'b', type: 'warehouse', title: 'Hub', position: { x: 300, y: 0 } },
    { id: 'c', type: 'robot', title: 'Rover', position: { x: 0, y: 200 } },
  ],
});

function Harness() {
  useEditorShortcuts();
  const file = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <Canvas />
      <SelectionToolbar />
      <DetailDrawer deck={file} />
    </>
  );
}

const select = (nodes: string[]) => {
  act(() => {
    useUiStore.getState().select({ nodes });
  });
};

describe('type picker (030)', () => {
  it('names the toolbar control "Type: <Name>" and "Type: Mixed"', () => {
    renderWithEditor(<Harness />, deck);
    select(['a']);
    expect(screen.getByRole('button', { name: 'Type: Service' })).toBeInTheDocument();
    select(['a', 'b']);
    expect(screen.getByRole('button', { name: 'Type: Mixed' })).toBeInTheDocument();
  });

  it('lists types of packs that are on, grouped, plus the current type of a card whose pack is off', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, deck);
    select(['b']);
    await user.click(screen.getByRole('button', { name: 'Type: Warehouse' }));
    const list = screen.getByRole('listbox', { name: 'Type options' });
    const options = within(list).getAllByRole('option');
    // Groups in display order (051): Process, Architecture, then Logistics.
    expect(options.map((o) => o.textContent)).toEqual([
      'Task',
      'Decision',
      'Document',
      'Service',
      'Database',
      'Gateway',
      'Client',
      'Queue',
      'External',
      'Component',
      'Warehouse',
    ]);
    expect(within(list).getByRole('option', { name: 'Warehouse' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(list).queryByRole('option', { name: 'Truck route' })).toBeNull();
    expect(screen.getByText('Process')).toBeInTheDocument();
  });

  it('filters types with "Filter types"', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, deck);
    select(['a']);
    await user.click(screen.getByRole('button', { name: 'Type: Service' }));
    await user.type(screen.getByRole('searchbox', { name: 'Filter types' }), 'dec');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Decision']);
  });

  it('shows an unknown current type under its id', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, deck);
    select(['c']);
    await user.click(screen.getByRole('button', { name: 'Type: robot' }));
    expect(screen.getByRole('option', { name: 'robot' })).toBeInTheDocument();
  });

  it('picks for every selected card in one undo step and keeps everything else', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Harness />, deck);
    select(['a', 'b']);
    await user.click(screen.getByRole('button', { name: 'Type: Mixed' }));
    await user.click(screen.getByRole('option', { name: 'Task' }));
    const after = toJSON(doc).nodes;
    expect(after.slice(0, 2).map((n) => n.type)).toEqual(['task', 'task']);
    expect(after.slice(0, 2).map((n) => [n.id, n.title, n.position])).toEqual([
      ['a', 'Order Service', { x: 0, y: 0 }],
      ['b', 'Hub', { x: 300, y: 0 }],
    ]);
    act(() => {
      editor().undo();
    });
    expect(
      toJSON(doc)
        .nodes.slice(0, 2)
        .map((n) => n.type),
    ).toEqual(['service', 'warehouse']);
  });

  it('the drawer field is labelled "Type" with the same grouped options', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, deck);
    select(['a']);
    await user.click(screen.getByRole('button', { name: 'Open details' }));
    const drawer = await screen.findByRole('complementary', { name: 'Details' });
    // The drawer focuses its title one frame after opening; wait so it does not steal focus.
    await waitFor(() => {
      expect(within(drawer).getByRole('textbox', { name: 'Title' })).toHaveFocus();
    });
    const field = within(drawer).getByRole('combobox', { name: 'Type' });
    field.focus();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByRole('listbox', { name: 'Types' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Decision' })).toBeInTheDocument();
  });
});
