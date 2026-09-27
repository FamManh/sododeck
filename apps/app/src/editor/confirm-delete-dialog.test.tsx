import { toJSON } from '@sododeck/model';
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
});

function Harness() {
  const editor = useEditor();
  return <ConfirmDeleteDialog deck={useDeckSnapshot(editor.doc)} />;
}

function setup(nodes: string[] = ['svc'], edges: string[] = []) {
  const view = renderWithEditor(<Harness />, deck);
  act(() => {
    useUiStore.getState().select({ nodes, edges });
    useUiStore.getState().requestDelete({ nodes, edges });
  });
  return { ...view, user: userEvent.setup() };
}

describe('ConfirmDeleteDialog', () => {
  it('names what will be removed, with Cancel focused', () => {
    setup();
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Order Service?' });
    expect(dialog).toHaveTextContent('Also removes 2 connections.');
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
    expect(useUiStore.getState().selection).toEqual({ nodes: [], edges: [] });
    expect(screen.getByText(/Deleted Order Service and 2 connections/)).toBeInTheDocument();
    expect(useUiStore.getState().announcement.text).toMatch(/^Deleted Order Service/);

    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
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
});
