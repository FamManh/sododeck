import { toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { useUndoToast } from './undo-toast';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  ],
});

function Deleter({ id }: { id: string }) {
  const editor = useEditor();
  const show = useUndoToast();
  return (
    <button
      type="button"
      onClick={() => {
        editor.remove('nodes', id);
        show(`Deleted ${id} · ⌘Z to undo`);
      }}
    >
      Delete {id}
    </button>
  );
}

describe('useUndoToast', () => {
  it('shows one toast at a time whose Undo button undoes the last step and announces it', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(
      <>
        <Deleter id="a" />
        <Deleter id="b" />
      </>,
      deck,
    );
    await user.click(screen.getByRole('button', { name: 'Delete a' }));
    expect(screen.getByText('Deleted a · ⌘Z to undo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete b' }));
    expect(screen.queryByText('Deleted a · ⌘Z to undo')).not.toBeInTheDocument();
    expect(screen.getByText('Deleted b · ⌘Z to undo')).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['b']);
    expect(useUiStore.getState().announcement.text).toBe('Undone');
  });
});
