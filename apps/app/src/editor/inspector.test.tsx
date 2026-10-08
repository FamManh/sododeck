import { createEditor, serializeDeck, toJSON } from '@sododeck/model';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import * as download from '../storage/download';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { savedFile } from '../test/saved-file';
import { Inspector } from './inspector';

const deck = deckOf({
  name: 'Shop',
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service' },
    { id: 'db', type: 'database', title: 'Orders DB' },
  ],
  edges: [{ id: 'e1', from: 'svc', to: 'db', label: 'insert' }],
});

function Harness() {
  return <Inspector deck={useDeckSnapshot(useEditor().doc)} />;
}

function setup(selection: { nodes?: string[]; edges?: string[] } = {}) {
  const view = renderWithEditor(<Harness />, deck);
  act(() => {
    useUiStore.getState().select(selection);
  });
  return { ...view, user: userEvent.setup() };
}

describe('Inspector', () => {
  it('edits the title of one component as a single undo step', async () => {
    const { doc, user, editor } = setup({ nodes: ['svc'] });
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Order Service' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Orders API{Enter}');
    expect(toJSON(doc).nodes[0]?.title).toBe('Orders API');
    expect(screen.getByRole('heading', { name: 'Orders API' })).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes[0]?.title).toBe('Order Service');
    expect(editor().canUndo()).toBe(false);
  });

  it('refuses an empty title and keeps the old one', async () => {
    const { doc, user } = setup({ nodes: ['svc'] });
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.keyboard('{Enter}');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(toJSON(doc).nodes[0]?.title).toBe('Order Service');
    await user.tab();
    expect(title).toHaveValue('Order Service');
  });

  it('reverts a draft with Escape', async () => {
    const { doc, user } = setup({ nodes: ['svc'] });
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.type(title, ' x{Escape}');
    expect(title).toHaveValue('Order Service');
    expect(toJSON(doc).nodes[0]?.title).toBe('Order Service');
  });

  it('edits the label of one connection, clearing it when empty', async () => {
    const { doc, user } = setup({ edges: ['e1'] });
    expect(screen.getByRole('heading', { name: 'Order Service → Orders DB' })).toBeInTheDocument();
    const label = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(label);
    await user.keyboard('{Enter}');
    expect(toJSON(doc).edges[0]?.label).toBeUndefined();
  });

  it('sets the line type of several connections as one undo step (029 T043)', async () => {
    const view = renderWithEditor(<Harness />, {
      ...deck,
      edges: [
        { id: 'e1', from: 'svc', to: 'db', label: 'insert' },
        { id: 'e2', from: 'db', to: 'svc', style: { shape: 'straight' } },
      ],
    });
    act(() => {
      useUiStore.getState().select({ edges: ['e1', 'e2'] });
    });
    expect(screen.getByRole('heading', { name: '2 connectors' })).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'Type' });
    expect(within(group).queryByRole('radio', { checked: true })).toBeNull();
    await userEvent.setup().click(within(group).getByRole('radio', { name: 'Elbow' }));
    expect(toJSON(view.doc).edges.map((e) => e.style?.shape)).toEqual(['elbow', 'elbow']);
    expect(within(group).getByRole('radio', { name: 'Elbow' })).toBeChecked();
    act(() => {
      view.editor().undo();
    });
    expect(toJSON(view.doc).edges.map((e) => e.style?.shape)).toEqual([undefined, 'straight']);
  });

  it('edits the deck name when nothing is selected', async () => {
    const { doc, user } = setup();
    expect(screen.getByRole('heading', { name: 'Shop' })).toBeInTheDocument();
    // Deck settings open on Database (founder feedback 2026-10-06).
    await user.click(screen.getByRole('tab', { name: 'General' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Webshop{Enter}');
    expect(toJSON(doc).name).toBe('Webshop');
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('shows both counts for components and connections, and deletes the components', async () => {
    const { user } = setup({ nodes: ['svc', 'db'], edges: ['e1'] });
    expect(
      screen.getByRole('heading', { name: '2 components, 1 connection selected' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete 2 components' }));
    expect(useUiStore.getState().pendingDelete).toEqual({
      targets: [
        { scope: 'nodes', id: 'svc' },
        { scope: 'nodes', id: 'db' },
      ],
    });
  });

  it('deletes every kind of a mixed selection from its trash, groups included', async () => {
    renderWithEditor(<Harness />, {
      ...deck,
      nodes: deck.nodes.map((n) => ({ ...n, group: 'g' })),
      edges: [...deck.edges, { id: 'e2', from: 'db', to: 'svc' }],
      groups: [{ id: 'g', title: 'Core' }],
      stickies: [{ id: 'n', text: 'Note', position: { x: 0, y: 0 } }],
    });
    act(() => {
      useUiStore.getState().select({ edges: ['e1', 'e2'], groups: ['g'], stickies: ['n'] });
    });
    expect(screen.getByRole('heading', { name: '4 items selected' })).toBeInTheDocument();
    expect(screen.getByText('2 connections · 1 group · 1 note')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete 4 items' }));
    expect(useUiStore.getState().pendingDelete).toEqual({
      targets: [
        { scope: 'edges', id: 'e1' },
        { scope: 'edges', id: 'e2' },
        { scope: 'stickies', id: 'n' },
        { scope: 'groups', id: 'g' },
      ],
    });
  });

  it.each([
    ['component', { nodes: ['svc'] }, 'Order Service'],
    ['connection', { edges: ['e1'] }, 'Order Service → Orders DB'],
  ])(
    'falls back to the deck inspector when the selected %s is removed in another tab',
    (_what, selection, heading) => {
      const { doc } = setup(selection);
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      const other = new Y.Doc();
      Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
      const remote = createEditor(other);
      remote.remove('nodes', 'svc');
      act(() => {
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));
      });
      expect(screen.getByRole('heading', { name: 'Shop' })).toBeInTheDocument();
      expect(screen.getByText('Deck')).toBeInTheDocument();
    },
  );

  it('falls back to the deck inspector when the shown flow is removed in another tab', () => {
    const withFlow = { ...deck, flows: [{ id: 'f', title: 'Checkout', steps: [] }] };
    const view = renderWithEditor(<Harness />, withFlow);
    act(() => {
      useUiStore.getState().setActiveFlow('f');
    });
    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(view.doc));
    createEditor(other).remove('flows', 'f');
    act(() => {
      Y.applyUpdate(view.doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(view.doc)));
    });
    expect(screen.getByRole('heading', { name: 'Shop' })).toBeInTheDocument();
  });

  it('shows where the deck is stored and exports it when nothing is selected', async () => {
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'General' }));
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeInTheDocument();
    // The component tests run without a stored deck: the demo wording.
    expect(screen.getByText('Demo deck · not stored')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export .sododeck' }));
    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalled();
    });
    expect(await savedFile(downloadBlob)).toMatchObject({
      name: 'Shop.sododeck',
      text: serializeDeck(deck),
    });
    downloadBlob.mockRestore();
  });

  it('also offers the .sododeck.md note form next to the .sododeck export (070)', async () => {
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'General' }));
    expect(screen.getByRole('button', { name: 'Export .sododeck' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export .sododeck.md' }));
    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalled();
    });
    expect((await savedFile(downloadBlob)).name).toBe('Shop.sododeck.md');
    downloadBlob.mockRestore();
  });
});

describe('Inspector database routing (052)', () => {
  const dbDeck = deckOf({
    name: 'Shop',
    nodes: [
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        columns: [
          { id: 'o-id', name: 'id', type: 'uuid' },
          { id: 'o-customer', name: 'customer_id', type: 'uuid' },
        ],
        indexes: [{ id: 'ix', columns: ['o-customer'] }],
      },
      {
        id: 'customers',
        type: 'db-table',
        title: 'customers',
        columns: [{ id: 'c-id', name: 'id', type: 'uuid' }],
      },
      { id: 'svc', type: 'service', title: 'Order Service' },
    ] as never,
    edges: [
      {
        id: 'rel',
        from: 'orders',
        to: 'customers',
        fromColumns: ['o-customer'],
        toColumns: ['c-id'],
        cardinality: 'n-1',
      },
      { id: 'plain', from: 'svc', to: 'orders' },
    ] as never,
  });

  function setupDb(selection: { nodes?: string[]; edges?: string[] }) {
    const view = renderWithEditor(<Harness />, dbDeck);
    act(() => {
      useUiStore.getState().select(selection);
    });
    return { ...view, user: userEvent.setup() };
  }

  it('shows the tabbed table drawer for a table', () => {
    setupDb({ nodes: ['orders'] });
    expect(screen.getByRole('heading', { name: 'orders' })).toBeInTheDocument();
    expect(screen.getByText('Table · 2 columns · 1 index')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'General',
      'Columns',
      'Indexes',
      'Checks',
    ]);
  });

  it('keeps the generic inspector for other cards', () => {
    setupDb({ nodes: ['svc'] });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
  });

  it('shows the relationship drawer for a relationship and the edge inspector for a plain edge', () => {
    const { unmount } = setupDb({ edges: ['rel'] });
    expect(
      screen.getByRole('heading', { name: 'orders.customer_id → customers.id' }),
    ).toBeInTheDocument();
    unmount();
    setupDb({ edges: ['plain'] });
    // Generic edge inspector (a relationship drawer would show the cardinality as its subtitle).
    expect(screen.queryByText('Relationship')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete connection' })).toBeInTheDocument();
  });
});
