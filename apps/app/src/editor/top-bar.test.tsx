import { toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithEditor } from '../test/render-canvas';
import { TopBar } from './top-bar';

describe('TopBar (rule editor, 008; the canvas uses islands since 018)', () => {
  it('shows the deck name and enables Undo / Redo from the history', async () => {
    const user = userEvent.setup();
    const { editor } = renderWithEditor(
      <MemoryRouter>
        <TopBar deckName="Shop" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Local/Shop/Rules',
    );
    expect(screen.getByText('Demo · not saved')).toBeInTheDocument();
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

  it('renames the deck from the breadcrumb in one undo step', async () => {
    const user = userEvent.setup();
    const { editor, doc } = renderWithEditor(
      <MemoryRouter>
        <TopBar deckName="Shop" />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Rename deck' }));
    const field = screen.getByRole('textbox', { name: 'Deck name' });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, 'Store{Enter}');
    expect(toJSON(doc).name).toBe('Store');
    expect(screen.queryByRole('textbox', { name: 'Deck name' })).not.toBeInTheDocument();
    expect(editor().undo()).toBe(true);
    expect(toJSON(doc).name).toBeUndefined();
  });

  it('cancels the breadcrumb rename with Esc and keeps the name when emptied', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(
      <MemoryRouter>
        <TopBar deckName="Shop" />
      </MemoryRouter>,
    );
    const before = toJSON(doc);
    await user.click(screen.getByRole('button', { name: 'Rename deck' }));
    await user.type(screen.getByRole('textbox', { name: 'Deck name' }), 'x{Escape}');
    expect(toJSON(doc)).toEqual(before);
    expect(screen.getByRole('button', { name: 'Rename deck' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rename deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Deck name' }));
    await user.keyboard('{Enter}');
    expect(toJSON(doc)).toEqual(before);
  });
});
