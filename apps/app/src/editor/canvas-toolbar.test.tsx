import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { renderWithEditor } from '../test/render-canvas';
import { CanvasToolbar } from './canvas-toolbar';

describe('CanvasToolbar', () => {
  it('shows the count only for two or more selected items', () => {
    renderWithEditor(<CanvasToolbar />);
    act(() => {
      useUiStore.getState().select({ nodes: ['a'] });
    });
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    act(() => {
      useUiStore.getState().select({ nodes: ['a', 'b'], edges: ['e'] });
    });
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('toggles Labels', async () => {
    const user = userEvent.setup();
    renderWithEditor(<CanvasToolbar />);
    const labels = screen.getByRole('button', { name: 'Labels' });
    expect(labels).toHaveAttribute('aria-pressed', 'false');
    await user.click(labels);
    expect(labels).toHaveAttribute('aria-pressed', 'true');
    expect(useUiStore.getState().labelsOn).toBe(true);
  });

  it('shows a Focus toggle and disables it while a flow is shown', async () => {
    const user = userEvent.setup();
    renderWithEditor(<CanvasToolbar />);
    const focus = screen.getByRole('button', { name: 'Focus' });
    expect(focus).toHaveAttribute('aria-pressed', 'false');
    expect(focus).toHaveAttribute('title', 'Focus · F');
    await user.click(focus);
    expect(useUiStore.getState().focusMode).toBe(true);

    act(() => {
      useUiStore.getState().openFlow('order', 'o1');
    });
    expect(screen.getByRole('button', { name: 'Focus' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveAttribute(
      'title',
      'Not available while a flow is shown',
    );
  });

  it('shows the Notes switch only in flow mode and updates notesDisplay from its menu', async () => {
    const user = userEvent.setup();
    renderWithEditor(<CanvasToolbar />);
    expect(screen.queryByRole('button', { name: 'Notes: dimmed' })).not.toBeInTheDocument();

    act(() => {
      useUiStore.getState().openFlow('order', 'o1');
    });

    const trigger = screen.getByRole('button', { name: 'Notes: dimmed' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Notes during flows' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Dimmed' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Shown' }));
    expect(useUiStore.getState().notesDisplay).toBe('shown');
    expect(screen.getByRole('button', { name: 'Notes: shown' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notes: shown' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Hidden' }));
    expect(useUiStore.getState().notesDisplay).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Notes: hidden' })).toBeInTheDocument();
  });
});
