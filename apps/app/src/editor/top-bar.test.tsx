import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithEditor } from '../test/render-canvas';
import { TopBar } from './top-bar';

describe('TopBar', () => {
  it('shows the deck name and enables Undo / Redo from the history', async () => {
    const user = userEvent.setup();
    const { editor } = renderWithEditor(
      <MemoryRouter>
        <TopBar deckName="Shop" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Shop');
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    act(() => {
      editor().add('nodes', { type: 'service', title: 'A' });
    });
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();

    await user.click(undo);
    expect(undo).toBeDisabled();
    expect(redo).toBeEnabled();

    await user.click(redo);
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();
  });
});
