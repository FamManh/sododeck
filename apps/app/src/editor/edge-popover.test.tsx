import { toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useEditor } from '../model/use-editor';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { EdgePopover } from './edge-popover';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'Order Service' },
    { id: 'b', type: 'database', title: 'Orders DB' },
  ],
  edges: [{ id: 'e1', from: 'a', to: 'b', label: 'old' }],
});

function Harness() {
  const editor = useEditor();
  return <EdgePopover deck={useDeckSnapshot(editor.doc)} />;
}

function setup() {
  const view = renderWithEditor(<Harness />, deck);
  act(() => {
    useUiStore.getState().openEdgePopover('e1');
  });
  return { ...view, user: userEvent.setup() };
}

const edge = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).edges[0];

describe('EdgePopover', () => {
  it('opens a Connection dialog with focus in Label', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Connection' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveFocus();
    expect(screen.getByText('Order Service → Orders DB')).toBeInTheDocument();
  });

  it('commits the label on Enter as one undoable update, and closes', async () => {
    const { doc, user, editor } = setup();
    const label = screen.getByRole('textbox', { name: 'Label' });
    await user.clear(label);
    await user.type(label, 'POST /orders{Enter}');
    expect(edge(doc)?.label).toBe('POST /orders');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(edge(doc)).toEqual({ id: 'e1', from: 'a', to: 'b', label: 'old' });
  });

  it('clears the label when emptied', async () => {
    const { doc, user } = setup();
    await user.clear(screen.getByRole('textbox', { name: 'Label' }));
    await user.keyboard('{Enter}');
    expect(edge(doc)?.label).toBeUndefined();
  });

  it('keeps a typed label when closed with Escape', async () => {
    const { doc, user } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Label' }), '!');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useUiStore.getState().popover).toBeNull();
    expect(edge(doc)?.label).toBe('old!');
  });

  it('offers the schema protocols', async () => {
    const { doc, user } = setup();
    await user.click(screen.getByRole('combobox', { name: 'Protocol' }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Not set', 'HTTP', 'gRPC', 'Event', 'SQL', 'WebSocket', 'Other']);
    await user.click(screen.getByRole('option', { name: 'SQL' }));
    expect(edge(doc)?.protocol).toBe('sql');
  });

  it('sets the direction', async () => {
    const { doc, user } = setup();
    const direction = screen.getByRole('radiogroup', { name: 'Direction' });
    expect(direction).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Both' }));
    expect(edge(doc)?.direction).toBe('both');
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Forward',
      'Both',
      'None',
    ]);
  });

  it('closes when its edge disappears', () => {
    const { editor } = setup();
    act(() => {
      editor().remove('edges', 'e1');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('EdgePopover group ends (050 US4)', () => {
  it('names a group end by its title', () => {
    renderWithEditor(
      <Harness />,
      deckOf({
        nodes: [{ id: 'a', type: 'service', title: 'Order Service' }],
        groups: [{ id: 'g', title: 'Data layer' }],
        edges: [{ id: 'e1', from: 'a', to: 'g' }],
      }),
    );
    act(() => {
      useUiStore.getState().openEdgePopover('e1');
    });
    expect(screen.getByText('Order Service → Data layer')).toBeInTheDocument();
  });
});

describe('EdgePopover on a locked connector (053)', () => {
  const lockedDeck = deckOf({
    nodes: deck.nodes,
    edges: [{ id: 'e1', from: 'a', to: 'b', label: 'old', locked: true }],
  });

  it('shows the values read-only and writes nothing', () => {
    const { doc } = renderWithEditor(<Harness />, lockedDeck);
    act(() => {
      useUiStore.getState().openEdgePopover('e1');
    });
    expect(screen.getByRole('textbox', { name: 'Label' })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent('Locked');
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(toJSON(doc).edges[0]?.label).toBe('old');
  });
});
