import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf } from '../test/render-canvas';
import { DrillCrumbs } from './drill-crumbs';

const deck = deckOf({
  nodes: [{ id: 'service', type: 'service', title: 'Order Service' }],
  groups: [{ id: 'core', title: 'Core services' }],
});

describe('DrillCrumbs', () => {
  it('shows Overview view as the current page when not drilled', () => {
    act(() => {
      useUiStore.getState().resetForDeck();
    });
    render(
      <nav aria-label="Breadcrumb">
        <span>Local</span>
        <span>/</span>
        <span>Shop</span>
        <DrillCrumbs deck={deck} />
      </nav>,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Local/Shop/Overview view',
    );
    expect(screen.getByText('Overview view')).toHaveAttribute('aria-current', 'page');
  });

  it('marks the last frame current and lets Overview view go back to depth 0', async () => {
    const user = userEvent.setup();
    act(() => {
      useUiStore.setState({
        drill: [
          { kind: 'group', id: 'core', viewport: { x: 0, y: 0, zoom: 1 } },
          { kind: 'node', id: 'service', viewport: { x: 0, y: 0, zoom: 1 } },
        ],
      });
    });
    const drillUp = vi.spyOn(useUiStore.getState(), 'drillUp');
    render(
      <nav aria-label="Breadcrumb">
        <span>Local</span>
        <span>/</span>
        <span>Shop</span>
        <DrillCrumbs deck={deck} />
      </nav>,
    );
    expect(screen.getByText('Order Service')).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Overview view' }));
    expect(drillUp).toHaveBeenCalledWith(0);
    drillUp.mockRestore();
  });
});
