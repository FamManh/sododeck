import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Inspector } from '../inspector';

describe('GroupInspector', () => {
  it('shows the heading, collapsed switch, merged connections and expand button', async () => {
    const user = userEvent.setup();
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'b', type: 'service', title: 'B' },
      ],
      groups: [{ id: 'core', title: 'Core services' }],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
      ],
    });
    renderWithEditor(<Inspector deck={deck} />, deck);
    act(() => {
      useUiStore.getState().setCollapsed('core', true);
      useUiStore.getState().select({ groups: ['core'] });
    });

    expect(screen.getByText('Core services')).toBeInTheDocument();
    const collapsed = screen.getByRole('switch', { name: 'Collapsed' });
    expect(collapsed).toBeChecked();
    expect(screen.getByText('Merged connections')).toBeInTheDocument();
    expect(screen.getByText(/collapsed:core|b/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand group' }));
    expect(useUiStore.getState().collapsed.has('core')).toBe(false);
  });
});
