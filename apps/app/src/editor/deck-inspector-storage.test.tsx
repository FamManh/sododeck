import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf, editorWrapper } from '../test/render-canvas';
import { DeckInspectorStorage } from './deck-inspector-storage';

describe('DeckInspectorStorage', () => {
  it('says which export opens where', () => {
    const { wrapper } = editorWrapper(deckOf({ name: 'Deck' }));
    render(<DeckInspectorStorage />, { wrapper });
    expect(screen.getByRole('button', { name: 'Export .sododeck' })).toBeInTheDocument();
    expect(screen.getByText(/opens in Obsidian and VS Code/)).toBeInTheDocument();
    expect(screen.getByText(/adds search and links in Obsidian/)).toBeInTheDocument();
  });
});
