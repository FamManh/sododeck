import { NEW_DECK_PACKS, toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { PacksPanel } from './packs-panel';

const newDeck = () => deckOf({ packs: [...NEW_DECK_PACKS] });

describe('PacksPanel (030)', () => {
  it('lists the packs with type counts and a switch each', () => {
    renderWithEditor(<PacksPanel />, newDeck());
    expect(screen.getByRole('heading', { name: 'Packs in this deck' })).toBeInTheDocument();
    for (const name of ['Architecture', 'Process', 'Data cards', 'Database']) {
      expect(screen.getByRole('switch', { name })).toBeChecked();
    }
    // A new deck has Logistics off (051 US7).
    expect(screen.getByRole('switch', { name: 'Logistics' })).not.toBeChecked();
    expect(screen.getByText('7 types')).toBeInTheDocument();
    // Data cards and Database (040) each have one type.
    expect(screen.getAllByText('1 type')).toHaveLength(2);
    expect(screen.getByText(/Turning a pack off hides its types from Add/)).toBeInTheDocument();
  });

  it('lists the packs in display order (051 US7)', () => {
    renderWithEditor(<PacksPanel />, newDeck());
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Basic shapes',
      'Process',
      'Data cards',
      'Database',
      'Architecture',
      'Logistics',
    ]);
  });

  it('shows a deck from before packs as Architecture only', () => {
    renderWithEditor(<PacksPanel />);
    expect(screen.getByRole('switch', { name: 'Architecture' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Process' })).not.toBeChecked();
  });

  it('toggles one pack as one undo step and announces it', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<PacksPanel />, newDeck());
    await user.click(screen.getByRole('switch', { name: 'Logistics' }));
    expect(toJSON(doc).packs).toEqual([
      'architecture',
      'process',
      'logistics',
      'data',
      'database',
      'shapes',
    ]);
    expect(useUiStore.getState().announcement.text).toBe('Logistics on');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).packs).toEqual(['architecture', 'process', 'data', 'database', 'shapes']);
    await user.click(screen.getByRole('switch', { name: 'Process' }));
    await user.click(screen.getByRole('switch', { name: 'Process' }));
    expect(useUiStore.getState().announcement.text).toBe('Process on');
  });

  it('counts the Basic shapes tiles: eleven shapes plus Sticky and Frame (031)', () => {
    renderWithEditor(<PacksPanel />, newDeck());
    const row = screen.getByRole('switch', { name: 'Basic shapes' }).closest('li');
    expect(row).toHaveTextContent('13 types');
    expect(screen.getByRole('switch', { name: 'Basic shapes' })).toBeChecked();
  });

  it('disables the last pack on and says why', () => {
    renderWithEditor(<PacksPanel />);
    const only = screen.getByRole('switch', { name: 'Architecture' });
    expect(only).toBeDisabled();
    expect(only).toHaveAccessibleDescription('At least one pack stays on');
  });

  it('Back and Esc return to the types view', async () => {
    const user = userEvent.setup();
    renderWithEditor(<PacksPanel />, newDeck());
    useUiStore.getState().setPalette({ view: 'packs' });
    await user.click(screen.getByRole('button', { name: 'Back to Add' }));
    expect(useUiStore.getState().addFlyout.view).toBe('types');
    useUiStore.getState().setPalette({ view: 'packs' });
    screen.getByRole('switch', { name: 'Process' }).focus();
    await user.keyboard('{Escape}');
    expect(useUiStore.getState().addFlyout.view).toBe('types');
  });
});
