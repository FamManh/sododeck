import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useSaveStatusStore } from '../storage/save-status';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { SaveContext, type SaveControls } from './save-context';
import { SaveStatus } from './save-status';
import { DeckIsland } from './shell/deck-island';

const host: SaveControls = {
  mode: 'host',
  flush: () => Promise.resolve(),
  markExported: () => undefined,
};

function Island() {
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <MemoryRouter>
      <DeckIsland deck={deck} />
    </MemoryRouter>
  );
}

describe('host save mode (067)', () => {
  it('shows no save state, whatever the save status says', () => {
    render(
      <SaveContext value={host}>
        <SaveStatus />
      </SaveContext>,
    );
    act(() => {
      useSaveStatusStore.getState().dispatch({
        type: 'failed',
        firstUnsavedAt: Date.now(),
        errorName: 'QuotaExceededError',
      });
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/Saved|Saving|save/)).not.toBeInTheDocument();
    useSaveStatusStore.getState().reset();
  });

  it('has no theme toggle in the deck menu: the host owns the theme', async () => {
    const user = userEvent.setup();
    renderWithEditor(
      <SaveContext value={host}>
        <Island />
      </SaveContext>,
      deckOf({ name: 'Shop' }),
    );
    await user.click(screen.getByRole('button', { name: 'Deck menu' }));
    expect(screen.getByRole('menuitem', { name: 'Deck settings' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^(Dark|Light) mode$/ })).not.toBeInTheDocument();
  });
});
