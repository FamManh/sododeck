import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { ToolsIsland } from './tools-island';

const tools = () => screen.getByRole('toolbar', { name: 'Tools' });
const button = (name: string | RegExp) => within(tools()).getByRole('button', { name });

describe('ToolsIsland (018 FR-011, contract "Tools island")', () => {
  it('opens the command palette from Jump to', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    await user.click(button(/^Jump to…/));
    expect(useUiStore.getState().palette.open).toBe(true);
  });

  it('toggles Labels', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    expect(button('Labels')).toHaveAttribute('aria-pressed', 'false');
    await user.click(button('Labels'));
    expect(button('Labels')).toHaveAttribute('aria-pressed', 'true');
    expect(useUiStore.getState().labelsOn).toBe(true);
  });

  it('toggles Focus and disables it while a flow is shown', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    expect(button('Focus')).toHaveAttribute('title', 'Focus · F');
    await user.click(button('Focus'));
    expect(useUiStore.getState().focusMode).toBe(true);
    act(() => {
      useUiStore.getState().openFlow('order', 'o1');
    });
    expect(button('Focus')).toBeDisabled();
    expect(button('Focus')).toHaveAttribute('title', 'Not available while a flow is shown');
  });

  it('sets sticky visibility from its menu, in and out of flow mode (§g-46)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    await user.click(button('Notes: dimmed'));
    const menu = screen.getByRole('menu', { name: 'Notes during flows' });
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Shown' }));
    expect(useUiStore.getState().notesDisplay).toBe('shown');
    expect(button('Notes: shown')).toBeInTheDocument();
  });

  it('switches the theme and opens export', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />, deckOf({ name: 'Shop' }));
    expect(button(/^Switch to (dark|light) theme$/)).toBeInTheDocument();
    await user.click(button('Export'));
    expect(useUiStore.getState().exportDialog).toEqual({
      open: true,
      returnFocus: button('Export'),
    });
  });

  it('keeps accessible names in the compact islands (FR-041)', () => {
    renderWithEditor(<ToolsIsland compact />);
    for (const name of [/^Jump to…/, 'Labels', 'Notes: dimmed', 'Focus', 'Export']) {
      expect(button(name)).toBeInTheDocument();
    }
    expect(button('Labels')).not.toHaveTextContent('Labels');
    expect(button('Labels')).toHaveAttribute('aria-pressed', 'false');
  });
});
