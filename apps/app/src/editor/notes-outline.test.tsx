import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactFlow from '@xyflow/react';
import { useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { NotesOutline } from './notes-outline';

const setCenter = vi.fn();

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof ReactFlow>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({ setCenter, getZoom: () => 1 }),
  };
});

const deck = deckOf({
  nodes: [{ id: 'svc', type: 'service', title: 'Order Service', position: { x: 120, y: 180 } }],
  stickies: [
    { id: 'note-1', text: 'First note', position: { x: 48, y: 72 } },
    { id: 'note-2', text: '   ', position: { x: 180, y: 220 } },
  ],
});

function Harness() {
  const editor = useEditor();
  const liveDeck = useDeckSnapshot(editor.doc);
  const notes = useMemo(() => liveDeck.stickies, [liveDeck.stickies]);
  return <NotesOutline deck={liveDeck} notes={notes} />;
}

describe('NotesOutline', () => {
  it('shows a collapsible heading and hides itself when there are no notes', async () => {
    const user = userEvent.setup();
    const first = renderWithEditor(<Harness />, deck);

    expect(screen.getByRole('heading', { name: 'Notes · 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list', { name: 'Notes' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Notes' })).not.toBeInTheDocument();

    first.unmount();
    renderWithEditor(<NotesOutline deck={deckOf({})} notes={[]} />);
    expect(screen.queryByRole('heading', { name: /Notes/ })).not.toBeInTheDocument();
  });

  it('choosing a note selects it and centres the note', async () => {
    const user = userEvent.setup();
    setCenter.mockClear();
    renderWithEditor(<Harness />, deck);

    await user.click(screen.getByRole('button', { name: 'Empty note' }));

    expect(useUiStore.getState().selection).toEqual({
      nodes: [],
      edges: [],
      groups: [],
      stickies: ['note-2'],
    });
    expect(setCenter).toHaveBeenCalledWith(180, 220, { zoom: 1 });
  });
});
