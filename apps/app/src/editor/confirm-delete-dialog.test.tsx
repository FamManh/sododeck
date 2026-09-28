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

describe('ConfirmDeleteDialog', () => {
  it('names what will be removed, with Cancel focused', () => {
    setup();
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Order Service?' });
    expect(dialog).toHaveTextContent('Also removes 2 connections.');
    expect(dialog).toHaveTextContent('1 pinned note will stay on the canvas, unpinned.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('changes nothing on Cancel or Escape', async () => {
    const { doc, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toJSON(doc)).toEqual(deck);
    act(() => {
      useUiStore.getState().requestDelete({ nodes: ['svc'], edges: [] });
    });
    await user.keyboard('{Escape}');
    expect(useUiStore.getState().pendingDelete).toBeNull();
    expect(toJSON(doc)).toEqual(deck);
  });

  it('deletes in one undo step, shows an Undo toast, and undo restores the same ids', async () => {
    const { doc, user, editor } = setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
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

  it('says how many new problems a delete created, and undo removes them (015 FR-026)', async () => {
    const { doc, user, editor } = setup();
    const before = checkDeck(toJSON(doc)).total;
    await user.click(screen.getByRole('button', { name: 'Delete' }));
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

  it('leaves the toast unchanged when nothing new breaks', async () => {
    const { user } = setup([], [], ['note-2']);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useUiStore.getState().announcement.text).not.toMatch(/problem/);
  });

  it('undoes through the toast button', async () => {
    const { doc, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(toJSON(doc)).toEqual(deck);
  });

  it('deletes a node and one of its own connections without double-removing', async () => {
    const { doc, user } = setup(['svc'], ['e2']);
    expect(screen.getByRole('alertdialog', { name: 'Delete 2 items?' })).toHaveTextContent(
      'Also removes 1 connection.',
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(toJSON(doc).edges).toEqual([]);
  });

  it('uses note-specific dialog text and delete targets for selected notes', async () => {
    const { user, doc, editor } = setup([], [], ['note-2']);
    expect(screen.getByRole('alertdialog', { name: 'Delete this note?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/Note deleted · (⌘Z|Ctrl\+Z) to undo/)).toBeInTheDocument();
    expect(toJSON(doc).stickies.find((sticky) => sticky.id === 'note-2')).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).stickies.find((sticky) => sticky.id === 'note-2')).toBeDefined();
  });

  it('replaces the toast on a second delete, and undo goes in reverse order', async () => {
    const { doc, user, editor } = setup(['db']);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const afterFirst = toJSON(doc);
    act(() => {
      useUiStore.getState().requestDelete({ nodes: ['web'], edges: [] });
    });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
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
