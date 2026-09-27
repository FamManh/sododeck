import { act, screen } from '@testing-library/react';
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
});
