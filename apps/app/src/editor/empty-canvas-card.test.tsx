import { NEW_DECK_PACKS, toJSON } from '@sododeck/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { deckOf, editorWrapper } from '../test/render-canvas';
import { Canvas } from './canvas';
import { EmptyCanvasCard } from './empty-canvas-card';

describe('EmptyCanvasCard (043 R12)', () => {
  it('offers Add table only when asked to', () => {
    const { rerender } = render(<EmptyCanvasCard />);
    expect(screen.queryByRole('button', { name: 'Add table' })).toBeNull();
    rerender(<EmptyCanvasCard onAddTable={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Add table' })).toBeInTheDocument();
  });

  it('adds a table from an empty deck with the Database pack on', async () => {
    const env = editorWrapper(deckOf({ packs: [...NEW_DECK_PACKS] }));
    render(<Canvas />, { wrapper: env.wrapper });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add table' }));
    expect(toJSON(env.doc).nodes).toEqual([
      expect.objectContaining({ type: 'db-table', title: 'table_1' }),
    ]);
  });

  it('has no Add table without the Database pack', () => {
    const env = editorWrapper(deckOf({ packs: ['architecture'] }));
    render(<Canvas />, { wrapper: env.wrapper });
    expect(screen.queryByRole('button', { name: 'Add table' })).toBeNull();
  });
});
