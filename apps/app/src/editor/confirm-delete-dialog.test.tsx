import { checkDeck, toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useEditor } from '../model/use-editor';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';

const deck = deckOf({
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service', position: { x: 1, y: 2 } },
    { id: 'db', type: 'database', title: 'Orders DB' },
    { id: 'web', type: 'client', title: 'Web' },
  ],
  edges: [
    { id: 'e1', from: 'web', to: 'svc', label: 'POST' },
    { id: 'e2', from: 'svc', to: 'db' },
  ],
  // A flow over both connections: deleting Order Service breaks its steps (015 FR-026).
  flows: [
    {
      id: 'f',
      title: 'Checkout',
      steps: [
        { id: 's1', edge: 'e1' },
        { id: 's2', edge: 'e2' },
      ],
    },
  ],
  stickies: [
    { id: 'note-1', text: 'Pinned note', anchor: 'svc', position: { x: 24, y: -96 } },
    { id: 'note-2', text: 'Loose note', position: { x: 160, y: 200 } },
  ],
});

function Harness() {
  const editor = useEditor();
  return <ConfirmDeleteDialog deck={useDeckSnapshot(editor.doc)} />;
}

function setup(nodes: string[] = ['svc'], edges: string[] = [], stickies: string[] = []) {
  const view = renderWithEditor(<Harness />, deck);
  act(() => {
    useUiStore.getState().select({ nodes, edges, stickies });
    useUiStore.getState().requestDelete({ nodes, edges, stickies });
  });
  return { ...view, user: userEvent.setup() };
}

const groupDeck = deckOf({
  nodes: [
    { id: 'in1', type: 'service', title: 'In 1', group: 'g', position: { x: 0, y: 0 } },
    { id: 'in2', type: 'service', title: 'In 2', group: 'g', position: { x: 300, y: 0 } },
    { id: 'out', type: 'service', title: 'Out', position: { x: 0, y: 400 } },
  ],
  groups: [{ id: 'g', title: 'Core' }],
  edges: [{ id: 'e', from: 'in1', to: 'in2' }],
});

describe('ConfirmDeleteDialog: groups', () => {
  function deleteNow(selection: { nodes?: string[]; groups?: string[] }) {
    const view = renderWithEditor(<Harness />, groupDeck);
    act(() => {
      useUiStore.getState().select(selection);
      useUiStore.getState().requestDelete(useUiStore.getState().selection);
    });
    return view;
  }

  it('ungroups a selected group at once: the frame goes, its cards stay', () => {
    const { doc } = deleteNow({ groups: ['g'] });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const file = toJSON(doc);
    expect(file.groups).toEqual([]);
    expect(file.nodes.map((n) => n.id)).toEqual(['in1', 'in2', 'out']);
    expect(file.nodes.every((n) => n.group === undefined)).toBe(true);
    expect(file.edges.map((e) => e.id)).toEqual(['e']);
    expect(useUiStore.getState().announcement.text).toMatch(/^Ungrouped Core/);
  });

  it('removes a group and its selected cards in one undo step', () => {
    const { doc, editor } = deleteNow({ nodes: ['in1', 'in2', 'out'], groups: ['g'] });
    expect(toJSON(doc).groups).toEqual([]);
    expect(toJSON(doc).nodes).toEqual([]);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(groupDeck);
  });

  it('skips a locked group', () => {
    const locked = deckOf({
      ...groupDeck,
      nodes: groupDeck.nodes.map((n) => (n.group === 'g' ? { ...n, locked: true } : n)),
    });
    const view = renderWithEditor(<Harness />, locked);
    act(() => {
      useUiStore.getState().requestDelete({ groups: ['g'] });
    });
    expect(toJSON(view.doc).groups.map((g) => g.id)).toEqual(['g']);
    expect(useUiStore.getState().announcement.text).toMatch(/Skipped 1 locked/);
  });
});

describe('ConfirmDeleteDialog', () => {
  it('deletes cards, notes and connectors at once, without a dialog', () => {
    const { doc } = setup(['svc'], [], ['note-2']);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(useUiStore.getState().pendingDelete).toBeNull();
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['db', 'web']);
    expect(toJSON(doc).stickies.map((sticky) => sticky.id)).toEqual(['note-1']);
  });

  it('deletes in one undo step, shows an Undo toast, and undo restores the same ids', () => {
    const { doc, editor } = setup();
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['db', 'web']);
    expect(toJSON(doc).edges).toEqual([]);
    expect(toJSON(doc).stickies.find((sticky) => sticky.id === 'note-1')).toMatchObject({
      id: 'note-1',
      text: 'Pinned note',
      position: { x: 25, y: -94 },
    });
    expect(useUiStore.getState().selection).toEqual({
      nodes: [],
      edges: [],
      groups: [],
      stickies: [],
      images: [],
    });
    expect(
      screen.getByText(/Deleted Order Service and 2 connections · 1 note unpinned/),
    ).toBeInTheDocument();
    expect(useUiStore.getState().announcement.text).toMatch(/^Deleted Order Service/);

    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
  });

  it('says how many new problems a delete created, and undo removes them (015 FR-026)', () => {
    const before = checkDeck(deck).total;
    const { doc, editor } = setup();
    // The Checkout flow loses both of its connections.
    expect(
      screen.getByText(/1 note unpinned · \d+ new problems? · (⌘Z|Ctrl\+Z) to undo$/),
    ).toBeInTheDocument();
    expect(useUiStore.getState().announcement.text).toMatch(/\d+ new problems?/);
    act(() => {
      editor().undo();
    });
    expect(checkDeck(toJSON(doc)).total).toBe(before);
  });

  it('leaves the toast unchanged when nothing new breaks', () => {
    setup([], [], ['note-2']);
    expect(useUiStore.getState().announcement.text).not.toMatch(/problem/);
  });

  it('undoes through the toast button', async () => {
    const { doc, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(toJSON(doc)).toEqual(deck);
  });

  it('deletes a node and one of its own connections without double-removing', () => {
    const { doc } = setup(['svc'], ['e2']);
    expect(toJSON(doc).edges).toEqual([]);
  });

  it('uses note-specific toast text and delete targets for selected notes', () => {
    const { doc, editor } = setup([], [], ['note-2']);
    expect(screen.getByText(/Note deleted · (⌘Z|Ctrl\+Z) to undo/)).toBeInTheDocument();
    expect(toJSON(doc).stickies.find((sticky) => sticky.id === 'note-2')).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).stickies.find((sticky) => sticky.id === 'note-2')).toBeDefined();
  });

  it('replaces the toast on a second delete, and undo goes in reverse order', () => {
    const { doc, editor } = setup(['db']);
    const afterFirst = toJSON(doc);
    act(() => {
      useUiStore.getState().requestDelete({ nodes: ['web'], edges: [] });
    });
    expect(screen.getByText(/Deleted Web/)).toBeInTheDocument();
    expect(screen.queryByText(/Deleted Orders DB/)).not.toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(afterFirst);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
  });

  it('deletes a used rule after confirming, and one ⌘Z restores every attachment (008)', async () => {
    const ruleDeck = deckOf({
      ...deck,
      nodes: deck.nodes.map((n) => (n.id === 'svc' ? { ...n, rules: ['R'] } : n)),
      flows: [
        {
          id: 'f',
          title: 'Checkout',
          steps: [{ id: 's1', edge: 'e1', rules: ['R'], ruleInputs: { R: { c: '5' } } }],
        },
      ],
      rules: {
        R: {
          title: 'Delivery tier',
          hitPolicy: 'first',
          inputs: [{ id: 'c', label: 'C' }],
          outputs: [],
          rows: [],
        },
      },
    });
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Harness />, ruleDeck);
    act(() => {
      useUiStore.getState().requestRemoval([{ scope: 'rules', id: 'R' }]);
    });
    const dialog = screen.getByRole('alertdialog', { name: 'Delete rule “Delivery tier”?' });
    expect(dialog).toHaveTextContent(
      'Used in 1 step and 1 component. It will be detached from them.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(toJSON(doc)).toEqual(ruleDeck);
    act(() => {
      useUiStore.getState().requestRemoval([{ scope: 'rules', id: 'R' }]);
    });
    await user.keyboard('{Escape}');
    expect(useUiStore.getState().pendingDelete).toBeNull();
    expect(toJSON(doc)).toEqual(ruleDeck);
    act(() => {
      useUiStore.getState().requestRemoval([{ scope: 'rules', id: 'R' }]);
    });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(toJSON(doc).rules).toEqual({});
    expect(toJSON(doc).flows[0]?.steps[0]).toEqual({ id: 's1', edge: 'e1' });
    expect(screen.getByText(/Rule “Delivery tier” deleted/)).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(ruleDeck);
  });
});

describe('deleting a database card that owns tables (049 US1)', () => {
  const table = (id: string, x: number) => ({
    id,
    type: 'db-table' as const,
    title: id,
    parent: 'odb',
    position: { x, y: 0 },
    columns: [{ id: `${id}-id`, name: 'id', type: 'int' }],
  });
  const dbDeck = deckOf({
    nodes: [
      { id: 'odb', type: 'database', title: 'Orders DB', position: { x: 0, y: 0 } },
      { id: 'web', type: 'client', title: 'Web', position: { x: 0, y: 300 } },
      table('orders', 0),
      table('items', 300),
    ],
  });

  it('asks first, says the tables are kept, and one undo restores card and ownership', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Harness />, dbDeck);
    act(() => {
      useUiStore.getState().select({ nodes: ['odb'] });
      useUiStore.getState().requestDelete({ nodes: ['odb'], edges: [], stickies: [] });
    });
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Orders DB?' });
    expect(dialog).toHaveTextContent('2 tables are kept and become unowned.');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const after = toJSON(doc);
    expect(after.nodes.map((n) => n.id)).toEqual(['web', 'orders', 'items']);
    expect(after.nodes.filter((n) => n.type === 'db-table').map((n) => n.parent)).toEqual([
      undefined,
      undefined,
    ]);
    // Placed clear of Web, which sits where the tables were.
    for (const id of ['orders', 'items']) {
      expect(after.nodes.find((n) => n.id === id)?.position).not.toEqual({ x: 0, y: 0 });
    }
    expect(screen.getByText(/2 tables kept/)).toBeInTheDocument();

    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(dbDeck);
  });

  it('deletes an empty database card at once, like any card', () => {
    const { doc } = renderWithEditor(
      <Harness />,
      deckOf({ nodes: [{ id: 'odb', type: 'database', title: 'Orders DB' }] }),
    );
    act(() => {
      useUiStore.getState().requestDelete({ nodes: ['odb'], edges: [], stickies: [] });
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toJSON(doc).nodes).toEqual([]);
  });
});

describe('deleting a note with connectors (053 US1)', () => {
  const noted = deckOf({
    nodes: [{ id: 'svc', type: 'service', title: 'Order Service' }],
    stickies: [{ id: 'n', text: 'Why retry?', position: { x: 300, y: 0 } }],
    edges: [{ id: 'c', from: 'svc', to: 'n' }],
  });

  it('removes its connectors with it, and one undo restores both', () => {
    const { doc, editor } = renderWithEditor(<Harness />, noted);
    act(() => {
      useUiStore.getState().select({ stickies: ['n'] });
      useUiStore.getState().requestDelete({ nodes: [], edges: [], stickies: ['n'] });
    });
    expect(toJSON(doc).stickies).toEqual([]);
    expect(toJSON(doc).edges).toEqual([]);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(noted);
  });
});
