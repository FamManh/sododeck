import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { DetailsButton } from './details-button';

const deck = deckOf({ nodes: [{ id: 'a', type: 'service', title: 'Order Service' }] });

describe('DetailsButton (019 US4)', () => {
  it('is named after the card, selects it and opens the drawer', async () => {
    const user = userEvent.setup();
    renderWithEditor(<DetailsButton id="a" title="Order Service" focused={false} />, deck);
    const button = screen.getByRole('button', { name: 'Open details for Order Service' });
    expect(button).toHaveAttribute('tabindex', '-1');
    expect(button).toHaveClass('sd-details-button');
    await user.click(button);
    const ui = useUiStore.getState();
    expect(ui.selection.nodes).toEqual(['a']);
    expect(ui.focusedId).toBe('a');
    expect(ui.drawer).toMatchObject({ open: true, mode: 'selection' });
  });

  it('follows the card’s Tab stop and works from the keyboard', async () => {
    const user = userEvent.setup();
    renderWithEditor(<DetailsButton id="a" title="Order Service" focused />, deck);
    const button = screen.getByRole('button', { name: 'Open details for Order Service' });
    expect(button).toHaveAttribute('tabindex', '0');
    button.focus();
    await user.keyboard('{Enter}');
    expect(useUiStore.getState().drawer.open).toBe(true);
  });
});
